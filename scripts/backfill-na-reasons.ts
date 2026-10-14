/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// usage: npx tsx scripts/backfill-na-reasons.ts [--apply]
// Fills places.na_reasons, for every interest, from (1) the newest Gemini "NOT_APPLICABLE:" draft for each place + interest and
// (2) the one-line notes in docs/<interest>-clear-na.json (diving, whale watching), used when there is no Gemini reason. Only for places
// that are ALREADY flagged N/A for that interest. Dry run unless --apply. Never overwrites a reason that already exists.
// After --apply it re-reads every touched place and reports whether any score curve changed (the audited write refits curves).
import { readFileSync, readdirSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const apply=process.argv.includes('--apply');
const {db}=await import('../src/lib/db/client');
const {places,contentGenerations}=await import('../src/lib/db/schema');
const {like}=await import('drizzle-orm');
const {applyAdminEdits}=await import('../src/lib/admin/apply-edits');
const {SYSTEM_ACTOR}=await import('../src/lib/gemini/apply');
const clear: Record<string, Record<string, string>> = {};
for (const f of readdirSync('docs').filter((n) => n.endsWith('-clear-na.json'))) clear[f.replace('-clear-na.json', '')] = JSON.parse(readFileSync('docs/' + f, 'utf8')).ids;
const gens=(await db.select().from(contentGenerations)).filter((g:any)=>typeof g.parsedOutput?.overview==='string'&&g.parsedOutput.overview.startsWith('NOT_APPLICABLE:'));
const newest=new Map<string,any>();
for(const g of gens){const k=g.placeId+'|'+g.interestKey;const o=newest.get(k);if(!o||g.createdAt>o.createdAt)newest.set(k,g);}
const all=await db.select().from(places);
const byInterest:Record<string,{write:number;haveReason:number;noReason:number}>={};
const bump=(k:string,f:'write'|'haveReason'|'noReason')=>{(byInterest[k]??={write:0,haveReason:0,noReason:0})[f]++;};
const touched:string[]=[];
for(const p of all){
 for(const interest of p.naSliders){
  const have=(p.naReasons as any)??{};
  if(have[interest]){bump(interest,'haveReason');continue;}
  const g=newest.get(p.id+'|'+interest);
  let r:{reason:string;source:'gemini'|'imported';by:string;generationId?:string}|null=null;
  if(g)r={reason:g.parsedOutput.overview.slice('NOT_APPLICABLE:'.length).trim(),source:'gemini',by:g.model??'gemini',generationId:g.id};
  else if(clear[interest]?.[p.id]){const n=clear[interest][p.id];r={reason:n.endsWith('.')?n:n+'.',source:'imported',by:`import from docs/${interest}-clear-na.json`};}
  if(!r){bump(interest,'noReason');continue;}
  bump(interest,'write');
  if(apply){
   const fresh=(await db.select().from(places).where(like(places.id,p.id)))[0];
   const before=JSON.stringify(fresh.sliderCurves);
   const value={...((fresh.naReasons as any)??{}),[interest]:{reason:r.reason,source:r.source,by:r.by,at:new Date().toISOString(),...(r.generationId?{generationId:r.generationId}:{})}};
   const res=await applyAdminEdits([{entityType:'destination',entityId:p.id,field:'naReasons',value,loadedUpdatedAt:fresh.updatedAt.toISOString()}],SYSTEM_ACTOR);
   if(res.errors.length||res.conflicts.length)console.log('PROBLEM',p.id,interest,JSON.stringify(res.errors),JSON.stringify(res.conflicts));
   const after=(await db.select().from(places).where(like(places.id,p.id)))[0];
   if(JSON.stringify(after.sliderCurves)!==before)touched.push(p.id);
  }
 }
}
console.table(byInterest);
if(apply)console.log('places whose curves changed after the write:',touched.length,touched.slice(0,20).join(', '));
process.exit(0);})();
