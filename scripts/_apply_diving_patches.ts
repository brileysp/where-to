// one-off: apply hand-written fixes to staged diving generations. usage: npx tsx scripts/_apply_diving_patches.ts <patches.json> <placeIds.json>
// patches: { "<Place name>": { overview?, replace?: [[old,new],...] (applied to overview and every month text), months?: {"1":"text"}, monthsAll?: [12 strings], scores?: {"1":6.2}, scoresAll?: [12 numbers], extras?: {diving_rating?:n,snorkeling_rating?:n} } }
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
const BATCHES=['f6811ae1-1e6a-4a67-9495-b4df66662947','0312d566-e1c4-48e4-af66-157f53d754e0','8b01d694-e584-4ee6-bb6e-8dc2c45d1a86','e1a7d88d-4230-47f8-8a04-76c25c05f60b','fb4f79a9-6aca-4636-beaf-7afc8190c8cc','fb2efc0d-efed-4c73-aa9e-a9496a113a35','b8a1b01a-c0ec-483a-9f7d-c17c396ecbe4'];
(async()=>{
const patches=JSON.parse(readFileSync(process.argv[2],'utf8'));
const ids:Record<string,string>=JSON.parse(readFileSync(process.argv[3],'utf8'));
const {db}=await import('../src/lib/db/client');
const {contentGenerations}=await import('../src/lib/db/schema');
const {eq,and,inArray}=await import('drizzle-orm');
const {validateContent,bestForFromRatings}=await import('../src/lib/gemini/validate');
for(const [name,p] of Object.entries<any>(patches)){
 const pid=ids[name]; if(!pid){console.log('NO ID',name);continue;}
 const rows=await db.select().from(contentGenerations).where(and(inArray(contentGenerations.batchId,BATCHES),eq(contentGenerations.placeId,pid)));
 if(rows.length!==1){console.log('ROWS',name,rows.length);continue;}
 const r=rows[0]; const o:any=r.parsedOutput; const miss:string[]=[];
 for(const [a,b] of (p.replace??[])){let hit=false;
  if(o.overview.includes(a)){o.overview=o.overview.split(a).join(b);hit=true;}
  for(const m of o.monthly) if(m.text.includes(a)){m.text=m.text.split(a).join(b);hit=true;}
  if(!hit)miss.push(a);}
 if(p.overview)o.overview=p.overview;
 if(p.monthsAll)p.monthsAll.forEach((t:string,i:number)=>{o.monthly[i].text=t;});
 for(const [k,t] of Object.entries<string>(p.months??{}))o.monthly[+k-1].text=t;
 if(p.scoresAll)p.scoresAll.forEach((s:number,i:number)=>{o.monthly[i].score=s;});
 for(const [k,s] of Object.entries<number>(p.scores??{}))o.monthly[+k-1].score=s;
 if(typeof p.clampMax==='number')for(const m of o.monthly)m.score=Math.min(m.score,p.clampMax);
 if(p.extras){Object.assign(o.extras,p.extras);if(typeof o.extras.diving_rating==='number'&&typeof o.extras.snorkeling_rating==='number')o.extras.best_for=bestForFromRatings(o.extras.diving_rating,o.extras.snorkeling_rating);}
 const issues=validateContent(o,'diving',pid); const rej=issues.filter((i:any)=>i.severity==='reject');
 await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rej.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,r.id));
 console.log((rej.length?'INVALID ':'ok      ')+name+(miss.length?'  MISSED: '+JSON.stringify(miss):'')+(rej.length?'\n    '+rej.map((i:any)=>i.message.slice(0,200)).join('\n    '):''));
}
process.exit(0);})();
