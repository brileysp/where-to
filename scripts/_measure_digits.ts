/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const {db}=await import('../src/lib/db/client');
const {places}=await import('../src/lib/db/schema');
const {scorePlace}=await import('../src/lib/db/queries/places');
const {SLIDERS}=await import('../src/lib/scoring/constants');
const rows=(await db.select().from(places)).filter((r:any)=>r.isPrimaryDestination);
const per:Record<string,{n:number;c:number[];places:number}>={};
const all=new Array(10).fill(0);
for(const r of rows as any[]){
 const sp:any=scorePlace(r);
 const authored:string[]=r.authoredCurves??[];
 for(const s of SLIDERS){
  if(!authored.includes(s.key)||r.naSliders.includes(s.key))continue;
  const m:number[]=sp.monthly?.[s.key];if(!m||m.length!==12)continue;
  const e=(per[s.key]??={n:0,c:new Array(10).fill(0),places:0});e.places++;
  for(const v of m){const x=Math.round(v*10)/10;if(x<=0||x>=10)continue;const d=Math.round(x*10)%10;e.c[d]++;e.n++;all[d]++;}
 }}
const pct=(c:number[],n:number)=>c.map(x=>String(Math.round(100*x/n)).padStart(2)+'%').join(' ');
console.log('interest'.padEnd(22),'places  values   .0  .1  .2  .3  .4  .5  .6  .7  .8  .9');
for(const [k,e] of Object.entries(per).sort((a,b)=>b[1].n-a[1].n))console.log(k.padEnd(22),String(e.places).padStart(6),String(e.n).padStart(7),' ',pct(e.c,e.n));
const N=all.reduce((a,b)=>a+b,0);console.log('ALL'.padEnd(22),'      ',String(N).padStart(7),' ',pct(all,N));
process.exit(0);})();
