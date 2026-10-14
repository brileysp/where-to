/* eslint-disable @typescript-eslint/no-explicit-any */
// one-off: rebuild the staged diving scores as they were before the round-score pass of 11 Oct 2026, and check the rebuild by re-running that pass.
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
const S='/private/tmp/claude-501/-Users-brendansalant-pearce-Desktop-Claude-Code/7967b631-7de4-44fc-a69e-c242cec19f01/scratchpad/';
const BATCHES=['f6811ae1-1e6a-4a67-9495-b4df66662947','0312d566-e1c4-48e4-af66-157f53d754e0','8b01d694-e584-4ee6-bb6e-8dc2c45d1a86','e1a7d88d-4230-47f8-8a04-76c25c05f60b','fb4f79a9-6aca-4636-beaf-7afc8190c8cc','fb2efc0d-efed-4c73-aa9e-a9496a113a35','b8a1b01a-c0ec-483a-9f7d-c17c396ecbe4'];
const RESTAGED=new Set(['antarctica','azores','angkor','colombian-caribbean','havana','gbr','hokkaido','los-cabos','nicaragua','oaxaca','provence','srilanka','taiwan','turks-caicos']);
(async()=>{
const {decimalizeScores,flatScoresIfSingleBlurb,holdFlatBands,holdFlatMonths}=await import('../src/lib/gemini/decimalize');
const {flatBandMonths,isBlocky,smoothBlockyScores}=await import('../src/lib/gemini/smooth-scores');
const {avoidRoundScores,countDigits}=await import('../src/lib/gemini/even-tenths');
const {db}=await import('../src/lib/db/client');
const {contentGenerations}=await import('../src/lib/db/schema');
const {inArray}=await import('drizzle-orm');
const {isNotApplicable}=await import('../src/lib/gemini/validate');
// 1. baseline from the first dumps
const base:Record<string,number[]>={};
for(let n=1;n<=7;n++){for(const p of JSON.parse(readFileSync(S+`set${n}.old.json`,'utf8'))){
 if(!p.final||p.overview.startsWith('NOT_APPLICABLE'))continue;
 if(RESTAGED.has(p.id)){const raw=p.raw as number[];const texts=p.texts as string[];
  base[p.id]=flatScoresIfSingleBlurb(texts,raw) ?? (isBlocky(raw)?smoothBlockyScores(raw,texts):holdFlatBands(raw,holdFlatMonths(texts,raw,decimalizeScores(raw,p.id)),flatBandMonths(raw)));
 } else base[p.id]=p.final;
}}
// 2. replay hand edits to scores, in the order they were made
base['tasmania']=[6.2,6.2,6.3,6.5,6.8,7,7,7,6.9,6.6,6.3,6.2];
base['vancouver-island']=[7.2,7.3,7.2,7.0,6.7,6.5,6.5,6.7,7.0,7.2,7.3,7.2];
const ids:Record<string,string>=JSON.parse(readFileSync(S+'place_ids.json','utf8'));
const applyPatches=(files:string[],target:Record<string,number[]>)=>{
 for(const f of files){
  const P=JSON.parse(readFileSync(S+f+'.json','utf8'));
  for(const [name,p] of Object.entries<any>(P)){const id=ids[name];if(!id||!target[id])continue;
   if(p.scoresAll)target[id]=[...p.scoresAll];
   for(const [k,s] of Object.entries<number>(p.scores??{}))target[id][+k-1]=s;
   if(typeof p.clampMax==='number')target[id]=target[id].map(v=>Math.min(v,p.clampMax));
  }}};
applyPatches(['patches_all','patches_b','patches_d','patches_e','patches_f','patches_g','patches_h'],base);
const rows=(await db.select().from(contentGenerations).where(inArray(contentGenerations.batchId,BATCHES))).filter((r:any)=>r.parsedOutput&&!isNotApplicable(r.parsedOutput)).sort((a:any,b:any)=>a.placeId.localeCompare(b.placeId));
const non=(s:number[][])=>s.map(x=>x.filter(v=>{const d=Math.round(v*10)%10;return d!==0&&d!==5;}));
const runPass=(state:Record<string,number[]>)=>{
 const counts=countDigits(non(rows.map((r:any)=>state[r.placeId]).filter(Boolean) as number[][]));
 const out:Record<string,number[]>={};
 for(const r of rows as any[]){const b=state[r.placeId];out[r.placeId]=r.placeId==='belize'?b:avoidRoundScores(b,r.placeId,counts);}
 return out;
};
// the first pass ran before the Milford / Monterey / Myanmar edits; the second ran after them
const pass1=runPass(base);
const before2:Record<string,number[]>={...pass1};
applyPatches(['patches_j'],before2);
const pass2=runPass(before2);
const preEvening:Record<string,number[]>={...base};
applyPatches(['patches_j'],preEvening);
let mismatch=0,missing=0;
for(const r of rows as any[]){
 if(!pass2[r.placeId]){missing++;continue;}
 const cur=r.parsedOutput.monthly.map((m:any)=>m.score);
 if(pass2[r.placeId].some((v:number,i:number)=>Math.abs(v-cur[i])>0.001)){mismatch++;console.log('MISMATCH',r.placeId,'\n  base',preEvening[r.placeId].join(' '),'\n  sim ',pass2[r.placeId].join(' '),'\n  db  ',cur.join(' '));}
}
console.log('places',rows.length,'mismatch',mismatch,'missing',missing);
writeFileSync(S+'baseline_scores.json',JSON.stringify(preEvening));
process.exit(0);})();
