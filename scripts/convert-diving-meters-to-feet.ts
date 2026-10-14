/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// usage: npx tsx scripts/convert-diving-meters-to-feet.ts [--apply] [--show]
// Owner decision 11 Oct 2026: depth, visibility and other distances in DIVING blurbs are written in feet (American divers think in feet).
// Converts staged diving drafts that were never applied and the live diving blurbs on places. Dry run unless --apply (old text is saved).
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const apply=process.argv.includes('--apply'),show=process.argv.includes('--show');
const {db}=await import('../src/lib/db/client');
const {places,contentGenerations}=await import('../src/lib/db/schema');
const {eq,and,isNull}=await import('drizzle-orm');
const {convertMetersToFeet}=await import('../src/lib/text/length');
const {validateContent,isNotApplicable}=await import('../src/lib/gemini/validate');
const {applyAdminEdits}=await import('../src/lib/admin/apply-edits');
const {SYSTEM_ACTOR}=await import('../src/lib/gemini/apply');
const backup:any={savedAt:new Date().toISOString(),note:'diving text before the metres-to-feet conversion',generations:{},places:{}};
const seen=new Set<string>();
const sample=(a:string,b:string)=>{if(!show||seen.has(a))return;seen.add(a);const re=/(\d)\s?(m\b|meters?|metres?)/i;const k=a.search(re);console.log('  '+a.slice(Math.max(0,k-40),k+22)+'  =>  '+b.slice(Math.max(0,k-40),k+22));};
const gens=(await db.select().from(contentGenerations).where(and(eq(contentGenerations.interestKey,'diving'),isNull(contentGenerations.appliedAt)))) as any[];
let gC=0,gT=0;
for(const g of gens){const o=g.parsedOutput;if(!o||isNotApplicable(o)||!Array.isArray(o.monthly))continue;
 const ov=convertMetersToFeet(o.overview);const mt=o.monthly.map((m:any)=>convertMetersToFeet(m.text));
 const diff=(ov!==o.overview?1:0)+mt.filter((t:string,i:number)=>t!==o.monthly[i].text).length;if(!diff)continue;
 gC++;gT+=diff;sample(o.overview,ov);o.monthly.forEach((m:any,i:number)=>sample(m.text,mt[i]));
 if(apply){backup.generations[g.id]={overview:o.overview,monthly:o.monthly.map((m:any)=>m.text)};o.overview=ov;o.monthly.forEach((m:any,i:number)=>{m.text=mt[i];});
  const issues=validateContent(o,'diving',g.placeId);const rej=issues.filter((x:any)=>x.severity==='reject');
  await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rej.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,g.id));}
}
console.log(`staged diving drafts: ${gC} drafts, ${gT} texts change`);
const rows=(await db.select().from(places)) as any[];let pC=0,pT=0;
for(const r of rows){const patch:Record<string,any>={};const before:any={};
 const ov=r.sliderOverview?.diving;const mo=r.sliderMonthlyWeather?.diving;
 if(typeof ov==='string'){const c=convertMetersToFeet(ov);if(c!==ov){patch.sliderOverview={...r.sliderOverview,diving:c};before.sliderOverview=r.sliderOverview;pT++;sample(ov,c);}}
 if(Array.isArray(mo)){const c=mo.map((t:any)=>typeof t==='string'?convertMetersToFeet(t):t);if(JSON.stringify(c)!==JSON.stringify(mo)){patch.sliderMonthlyWeather={...r.sliderMonthlyWeather,diving:c};before.sliderMonthlyWeather=r.sliderMonthlyWeather;pT+=c.filter((t:any,i:number)=>t!==mo[i]).length;}}
 if(!Object.keys(patch).length)continue;pC++;
 if(apply){backup.places[r.id]=before;const res=await applyAdminEdits(Object.entries(patch).map(([field,value])=>({entityType:'destination' as const,entityId:r.id,field,value,loadedUpdatedAt:r.updatedAt.toISOString()})),SYSTEM_ACTOR);
  if(res.errors.length||res.conflicts.length)console.log('PROBLEM',r.id,JSON.stringify(res.errors),JSON.stringify(res.conflicts));}
}
console.log(`live diving blurbs: ${pC} places, ${pT} texts change`);
if(apply){mkdirSync('docs/backups',{recursive:true});writeFileSync('docs/backups/diving-text-before-feet-2026-10-11.json',JSON.stringify(backup));console.log('backup written');}
process.exit(0);})();
