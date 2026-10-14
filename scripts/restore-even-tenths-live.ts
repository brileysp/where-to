/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
// usage: npx tsx scripts/restore-even-tenths-live.ts <backup.json>  -- puts the curves and month overrides saved by even-tenths-live.ts --apply back
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim();if(!t||t.startsWith('#'))continue;const i=t.indexOf('=');let v=t.slice(i+1).trim().replace(/^["']|["']$/g,'');if(process.env[t.slice(0,i).trim()]===undefined)process.env[t.slice(0,i).trim()]=v;}
(async()=>{
const backup=JSON.parse(readFileSync(process.argv[2],'utf8'));
const {db}=await import('../src/lib/db/client');
const {places}=await import('../src/lib/db/schema');
const {eq}=await import('drizzle-orm');
const {applyAdminEdits}=await import('../src/lib/admin/apply-edits');
const {SYSTEM_ACTOR}=await import('../src/lib/gemini/apply');
let done=0,problems=0;
for(const [id,byInterest] of Object.entries<any>(backup.curves)){
 const fresh=(await db.select().from(places).where(eq(places.id,id)))[0] as any;
 const curves={...fresh.sliderCurves,...byInterest};
 const ovr={...(fresh.scoreOverrides??{})};
 for(const [k,v] of Object.entries<any>(backup.overrides?.[id]??{})){if(Object.keys(v).length>0)ovr[k]=v;else delete ovr[k];}
 const patches:any[]=[{entityType:'destination',entityId:id,field:'sliderCurves',value:curves,loadedUpdatedAt:fresh.updatedAt.toISOString()}];
 if(JSON.stringify(ovr)!==JSON.stringify(fresh.scoreOverrides??{}))patches.push({entityType:'destination',entityId:id,field:'scoreOverrides',value:ovr,loadedUpdatedAt:fresh.updatedAt.toISOString()});
 const res=await applyAdminEdits(patches,SYSTEM_ACTOR);
 if(res.errors.length||res.conflicts.length){problems++;console.log('PROBLEM',id,JSON.stringify(res.errors),JSON.stringify(res.conflicts));}else done++;
}
console.log(`restored ${done} places, ${problems} problems`);
process.exit(0);})();
