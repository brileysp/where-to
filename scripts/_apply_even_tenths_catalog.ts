/* eslint-disable @typescript-eslint/no-explicit-any */
// one-off: put the staged diving scores back to their pre-pass state (scratchpad/baseline_scores.json) and even out the last digits
// with evenTenthsCatalog. usage: npx tsx scripts/_apply_even_tenths_catalog.ts [--apply]
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
const S='/private/tmp/claude-501/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/scratchpad/';
const BATCHES=['f6811ae1-1e6a-4a67-9495-b4df66662947','0312d566-e1c4-48e4-af66-157f53d754e0','8b01d694-e584-4ee6-bb6e-8dc2c45d1a86','e1a7d88d-4230-47f8-8a04-76c25c05f60b','fb4f79a9-6aca-4636-beaf-7afc8190c8cc','fb2efc0d-efed-4c73-aa9e-a9496a113a35','b8a1b01a-c0ec-483a-9f7d-c17c396ecbe4'];
(async()=>{
const apply=process.argv.includes('--apply');
const {db}=await import('../src/lib/db/client');
const {contentGenerations}=await import('../src/lib/db/schema');
const {eq,inArray}=await import('drizzle-orm');
const {evenTenthsCatalog,countDigits}=await import('../src/lib/gemini/even-tenths');
const {validateContent,isNotApplicable}=await import('../src/lib/gemini/validate');
const base:Record<string,number[]>=JSON.parse(readFileSync(S+'baseline_scores.json','utf8'));
const after=evenTenthsCatalog(base,new Set(['belize']));
const hist=(m:Record<string,number[]>)=>{const c=countDigits(Object.values(m));const t=c.reduce((a,b)=>a+b,0);return c.map(x=>`${(100*x/t).toFixed(1)}%`).join('  ');};
console.log('digit 0..9 before:',hist(base));
console.log('digit 0..9 after :',hist(after));
const runLen=(m:Record<string,number[]>)=>{let n=0;for(const s of Object.values(m)){for(let i=0;i<12;i++){const d=Math.round(s[i]*10)%10;if(s[i]>0&&s[i]<10&&(d===0||d===5)&&s[i]===s[(i+1)%12])n++;}}return n;};
console.log('adjacent months sharing a round value, before/after:',runLen(base),runLen(after));
const rows=(await db.select().from(contentGenerations).where(inArray(contentGenerations.batchId,BATCHES))).filter((r:any)=>r.parsedOutput&&!isNotApplicable(r.parsedOutput));
let bad=0,wrote=0;
for(const r of rows as any[]){
 const next=after[r.placeId];if(!next){console.log('no baseline',r.placeId);continue;}
 const o=r.parsedOutput;o.monthly.forEach((m:any,k:number)=>{m.score=next[k];});
 const issues=validateContent(o,'diving',r.placeId);const rej=issues.filter((x:any)=>x.severity==='reject');
 if(rej.length){bad++;console.log('REJECT',r.placeId,rej.map((x:any)=>x.message.slice(0,150)).join(' | '));}
 if(apply){await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rej.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,r.id));wrote++;}
}
console.log(apply?`WROTE ${wrote}`:'dry run',`; ${bad} rejected`);
process.exit(0);})();
