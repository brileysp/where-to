// one-off: rewrite staged text/scores for Tasmania and Vancouver Island (winter is the clearest season) and fix one temperature line for Tierra del Fuego
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
const BATCH='b8a1b01a-c0ec-483a-9f7d-c17c396ecbe4';
type M={text:string;score:number};
const m=(text:string,score:number):M=>({text,score});
const TAS_JF=m('Summer is the warmest time at about 15°C, but spring and summer plankton cloud the water, so visibility is often no more than about 12 m.',6.2);
const TAS_JJA=(s:number)=>m('Winter water is about 11°C and a drysuit is the norm, but visibility is at its best, often 30 m or more and at times past 40 m. Rough seas cancel some days.',s);
const tasmania:{overview:string;monthly:M[]}={
 overview:'Tasmania offers cold-water diving (about 11-15°C) focused on kelp forests and rocky reefs, where weedy seadragons are the main draw and Australian fur seals sometimes appear. Winter has the clearest water and summer the warmest.',
 monthly:[
  TAS_JF,{...TAS_JF,score:6.2},
  m('Autumn begins with water still near 15°C as the plankton starts to thin, and visibility improves.',6.3),
  m('Water cools to about 14°C and the plankton fades, so visibility climbs steadily.',6.5),
  m('Water is about 13°C and visibility is now well above summer levels. A thick wetsuit or drysuit is the norm.',6.8),
  TAS_JJA(7),TAS_JJA(7),TAS_JJA(7),
  m('Water is still about 11°C and visibility stays excellent, before the spring plankton builds.',6.9),
  m('Spring plankton starts to build and visibility eases, while the water begins to warm toward 12-13°C.',6.6),
  m('Plankton thickens and visibility falls toward summer levels as the water warms to about 14°C.',6.3),
  m('Water is near 14-15°C and visibility is at its lowest of the year, though the kelp forests are lush.',6.2),
 ]};
const VI_JF='Winter is the clearest time to dive, with visibility that can reach 20 m or more, and Steller sea lions are at some sites. Storms can cancel boat days, but giant Pacific octopuses stay active on the reefs.';
const vi:{overview:string;monthly:M[]}={
 overview:'Vancouver Island offers excellent cold-water diving (about 6-14°C, drysuit needed) focused on kelp forests and rocky reefs. Giant Pacific octopuses and wolf eels are regular sights, and Steller sea lions can be found at some sites from November to April.',
 monthly:[
  m(VI_JF,7.2),m(VI_JF,7.3),
  m('Water is still clear and the sea lions remain at their sites, while the weather slowly settles.',7.2),
  m('Sea lion dives wind down and spring plankton begins to cut visibility, though conditions are still good, especially around Port Hardy in late April.',7.0),
  m('Plankton blooms lower visibility, while the kelp grows into dense canopy and seas are calm.',6.7),
  m('Plankton and river runoff keep visibility lower, but the water is at its warmest, seas are calm and the kelp is thick.',6.5),
  m('Plankton and river runoff keep visibility lower, but the water is at its warmest, seas are calm and the kelp is thick.',6.5),
  m('Visibility starts to recover and the seas stay calm, and mid-August brings one of the best windows around Port Hardy.',6.7),
  m('The plankton has cleared, the seas are still calm and visibility is good, one of the best windows around Port Hardy.',7.0),
  m('Visibility keeps improving as the water cools, though autumn storms begin to cancel some boat days.',7.2),
  m('Clear cold water returns and Steller sea lions arrive at some sites, while storms and heavy rain can limit access.',7.3),
  m('Winter clarity and the sea lions continue, but storms and heavy rain limit boat days.',7.2),
 ]};
(async()=>{
const {db}=await import('../src/lib/db/client');
const {contentGenerations}=await import('../src/lib/db/schema');
const {eq,and}=await import('drizzle-orm');
const {validateContent}=await import('../src/lib/gemini/validate');
async function edit(placeId:string,fn:(o:any)=>void){
 const rows=await db.select().from(contentGenerations).where(and(eq(contentGenerations.batchId,BATCH),eq(contentGenerations.placeId,placeId)));
 if(rows.length!==1){console.log(placeId,'rows',rows.length);return;}
 const r=rows[0];const o:any=r.parsedOutput;fn(o);
 const issues=validateContent(o,'diving',placeId);
 const rejects=issues.filter((i:any)=>i.severity==='reject');
 await db.update(contentGenerations).set({parsedOutput:o,validationStatus:rejects.length?'invalid':'valid',validationErrors:issues as any}).where(eq(contentGenerations.id,r.id));
 console.log(placeId,rejects.length?'INVALID':'valid',issues.map((i:any)=>i.severity+': '+i.message).join('\n  '));
}
await edit('tasmania',o=>{o.overview=tasmania.overview;o.monthly=tasmania.monthly;});
await edit('vancouver-island',o=>{o.overview=vi.overview;o.monthly=vi.monthly;});
await edit('tierra-del-fuego',o=>{
 for(const mm of o.monthly){mm.text=mm.text.replace('the water remains near freezing','the water is only about 2-4°C');}
 console.log(o.monthly.map((x:any)=>x.text).filter((t:string)=>/freez|2-4/.test(t)));
});
process.exit(0);})();
