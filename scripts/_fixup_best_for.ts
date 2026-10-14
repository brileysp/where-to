// usage: npx tsx scripts/_fixup_best_for.ts <batchId...>  -- recompute best_for from the ratings and revalidate staged generations
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const {db}=await import('../src/lib/db/client');
const {contentGenerations}=await import('../src/lib/db/schema');
const {eq}=await import('drizzle-orm');
const {validateContent,bestForFromRatings,isNotApplicable}=await import('../src/lib/gemini/validate');
let changed=0,total=0;
for(const batchId of process.argv.slice(2)){
 const rows=await db.select().from(contentGenerations).where(eq(contentGenerations.batchId,batchId));
 for(const r of rows){const o:any=r.parsedOutput;if(!o||isNotApplicable(o))continue;total++;
  const x=o.extras;if(!x||typeof x.diving_rating!=='number'||typeof x.snorkeling_rating!=='number')continue;
  const want=bestForFromRatings(x.diving_rating,x.snorkeling_rating);
  if(x.best_for===want&&r.validationStatus==='valid')continue;
  x.best_for=want;
  const issues=validateContent(o,'diving',r.placeId);
  const rejects=issues.filter((i:any)=>i.severity==='reject');
  await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rejects.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,r.id));
  changed++;
 }}
console.log('checked',total,'updated',changed);process.exit(0);})();
