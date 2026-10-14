// usage: npx tsx scripts/_dump_batch.ts <batchId> <outfile>
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const {db}=await import('../src/lib/db/client');
const {contentGenerations,places}=await import('../src/lib/db/schema');
const {eq}=await import('drizzle-orm');
const rows=await db.select().from(contentGenerations).where(eq(contentGenerations.batchId,process.argv[2]));
const nm=new Map((await db.select({id:places.id,name:places.name}).from(places)).map(p=>[p.id,p.name]));
const M=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const out:any[]=[];
for(const r of rows){const txt=(r.rawResponse as any)?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('')||'';let j:any={};try{j=JSON.parse(txt)}catch{}
 const o:any=r.parsedOutput;
 out.push({id:r.placeId,name:nm.get(r.placeId),status:r.validationStatus,cost:Number(r.costUsd),raw:M.map(m=>j['score_'+m]),final:o?.monthly?.map((m:any)=>m.score)??null,texts:o?.monthly?.map((m:any)=>m.text)??null,overview:o?.overview??'',extras:o?.extras??null,issues:r.validationErrors});}
out.sort((a,b)=>(a.name||'').toLowerCase().localeCompare((b.name||'').toLowerCase()));
writeFileSync(process.argv[3],JSON.stringify(out));
console.log(out.length);process.exit(0);})();
