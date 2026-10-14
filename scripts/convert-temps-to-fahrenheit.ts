/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// usage: npx tsx scripts/convert-temps-to-fahrenheit.ts [--apply]
// Owner decision 11 Oct 2026: every temperature in every blurb is written in Fahrenheit for now (a display setting for Celsius comes later).
// Converts: staged Gemini drafts that were never applied (overview + month text), and the live blurb fields on places
// (about, overview, monthlyWeather, sliderOverview, sliderMonthlyWeather). Dry run unless --apply; with --apply the old text is saved first.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const apply=process.argv.includes('--apply');
const {db}=await import('../src/lib/db/client');
const {places,contentGenerations}=await import('../src/lib/db/schema');
const {eq,isNull}=await import('drizzle-orm');
const {convertTemperaturesToF,hasCelsius}=await import('../src/lib/text/temperature');
const {validateContent,isNotApplicable}=await import('../src/lib/gemini/validate');
const {applyAdminEdits}=await import('../src/lib/admin/apply-edits');
const {SYSTEM_ACTOR}=await import('../src/lib/gemini/apply');
const backup:any={savedAt:new Date().toISOString(),note:'text before the Celsius-to-Fahrenheit conversion',generations:{},places:{}};
// 1. staged drafts
const gens=(await db.select().from(contentGenerations).where(isNull(contentGenerations.appliedAt))) as any[];
let gChanged=0,gTexts=0;
for(const g of gens){const o=g.parsedOutput;if(!o||isNotApplicable(o)||!Array.isArray(o.monthly))continue;
 const before={overview:o.overview,monthly:o.monthly.map((m:any)=>m.text)};
 const ov=convertTemperaturesToF(o.overview);const mt=o.monthly.map((m:any)=>convertTemperaturesToF(m.text));
 const diff=(ov!==o.overview?1:0)+mt.filter((t:string,i:number)=>t!==o.monthly[i].text).length;
 if(!diff)continue;gChanged++;gTexts+=diff;
 if(apply){backup.generations[g.id]=before;o.overview=ov;o.monthly.forEach((m:any,i:number)=>{m.text=mt[i];});
  const issues=validateContent(o,g.interestKey,g.placeId);const rej=issues.filter((x:any)=>x.severity==='reject');
  await db.update(contentGenerations).set({parsedOutput:o,validationStatus:g.validationStatus==='valid'||g.validationStatus==='invalid'?(rej.length?'invalid':'valid'):g.validationStatus,validationErrors:issues as any}).where(eq(contentGenerations.id,g.id));}
}
console.log(`staged drafts: ${gChanged} drafts, ${gTexts} texts change`);
// 2. live fields
const rows=(await db.select().from(places)) as any[];
let pChanged=0,pTexts=0;const samples:string[]=[];
for(const r of rows){
 const patch:Record<string,any>={};const before:any={};
 const conv=(t:any)=>typeof t==='string'?convertTemperaturesToF(t):t;
 for(const f of ['about','overview']) if(typeof r[f]==='string'&&conv(r[f])!==r[f]){patch[f]=conv(r[f]);before[f]=r[f];pTexts++;if(samples.length<6)samples.push(`${r.id}.${f}: ${r[f].match(/.{0,40}(°\\s?C|Celsius|\\d C\\b).{0,20}/i)?.[0]??''} -> ${conv(r[f]).match(/.{0,40}°F.{0,12}/)?.[0]??''}`);}
 if(Array.isArray(r.monthlyWeather)){const next=r.monthlyWeather.map(conv);if(JSON.stringify(next)!==JSON.stringify(r.monthlyWeather)){patch.monthlyWeather=next;before.monthlyWeather=r.monthlyWeather;pTexts+=next.filter((t:any,i:number)=>t!==r.monthlyWeather[i]).length;}}
 for(const f of ['sliderOverview','sliderMonthlyWeather']){
  const cur=r[f]??{};const next:any={};let ch=false;
  for(const [k,v] of Object.entries<any>(cur)){const nv=Array.isArray(v)?v.map(conv):conv(v);next[k]=nv;if(JSON.stringify(nv)!==JSON.stringify(v)){ch=true;pTexts+=Array.isArray(v)?v.filter((t:any,i:number)=>t!==nv[i]).length:1;}}
  if(ch){patch[f]=next;before[f]=cur;}
 }
 if(!Object.keys(patch).length)continue;pChanged++;
 if(apply){backup.places[r.id]=before;
  const res=await applyAdminEdits(Object.entries(patch).map(([field,value])=>({entityType:'destination' as const,entityId:r.id,field,value,loadedUpdatedAt:r.updatedAt.toISOString()})),SYSTEM_ACTOR);
  if(res.errors.length||res.conflicts.length)console.log('PROBLEM',r.id,JSON.stringify(res.errors),JSON.stringify(res.conflicts));}
}
console.log(`live places: ${pChanged} places, ${pTexts} texts change`);
for(const s of samples)console.log('  ',s);
if(apply){mkdirSync('docs/backups',{recursive:true});writeFileSync('docs/backups/blurb-text-before-fahrenheit-2026-10-11.json',JSON.stringify(backup));console.log('backup written to docs/backups/blurb-text-before-fahrenheit-2026-10-11.json');}
process.exit(0);})();
