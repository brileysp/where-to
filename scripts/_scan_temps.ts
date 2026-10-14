/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const {db}=await import('../src/lib/db/client');const {places,contentGenerations,placeInterestFacts}=await import('../src/lib/db/schema');
const rows=await db.select().from(places) as any[];
const re=/°\s?C\b|\bdegrees?\s+celsius\b|\bcelsius\b|\d\s?C\b(?![a-z])/i;
const cnt:Record<string,number>={};const ex:Record<string,string[]>={};
const bump=(k:string,t:string)=>{cnt[k]=(cnt[k]??0)+1;(ex[k]??=[]).length<4&&ex[k].push(t.slice(0,140));};
for(const r of rows){
 for(const f of ['about','overview','costOverview']) if(typeof r[f]==='string'&&re.test(r[f]))bump('places.'+f,r[f]);
 (r.monthlyWeather??[]).forEach((t:any)=>{if(typeof t==='string'&&re.test(t))bump('places.monthlyWeather',t);});
 for(const [k,t] of Object.entries<any>(r.sliderOverview??{}))if(typeof t==='string'&&re.test(t))bump('sliderOverview',k+': '+t);
 for(const [k,a] of Object.entries<any>(r.sliderMonthlyWeather??{}))(a??[]).forEach((t:any)=>{if(typeof t==='string'&&re.test(t))bump('sliderMonthlyWeather',k+': '+t);});
 (r.costItems??[]).forEach((c:any)=>{if(re.test(JSON.stringify(c)))bump('costItems',JSON.stringify(c));});
}
const gens=await db.select({id:contentGenerations.id,k:contentGenerations.interestKey,o:contentGenerations.parsedOutput,s:contentGenerations.validationStatus,a:contentGenerations.appliedAt}).from(contentGenerations);
for(const g of gens as any[]){const o=g.o;if(!o)continue;const texts=[o.overview,...(o.monthly??[]).map((m:any)=>m.text)];if(texts.some((t:any)=>typeof t==='string'&&re.test(t)))bump('generations('+g.k+(g.a?',applied':',staged')+')',texts.find((t:any)=>re.test(t)));}
const facts=await db.select().from(placeInterestFacts) as any[];
for(const f of facts)if(re.test(JSON.stringify(f.facts)))bump('placeInterestFacts('+f.interestKey+')',JSON.stringify(f.facts));
console.log(JSON.stringify(cnt,null,1));for(const [k,v] of Object.entries(ex))console.log('\n'+k+'\n  '+v.join('\n  '));
process.exit(0);})();
