// Flips the feature switches kept in the database (src/lib/features.ts). Takes effect within about ten seconds, no deploy.
// Usage: npx tsx scripts/set-feature.ts status
//        npx tsx scripts/set-feature.ts onboarding on|off
//        npx tsx scripts/set-feature.ts preview-code        (makes a new private preview number and prints the preview address)
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

(async () => {
  const { eq } = await import('drizzle-orm');
  const { db } = await import('../src/lib/db/client');
  const { appSettings } = await import('../src/lib/db/schema');
  const { FEATURES_KEY } = await import('../src/lib/features');
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, FEATURES_KEY));
  const values: Record<string, number> = { ...(row?.value ?? {}) };
  const [cmd, arg] = process.argv.slice(2);
  const save = async () => {
    await db.insert(appSettings).values({ key: FEATURES_KEY, value: values, updatedBy: 'claude (script)' }).onConflictDoUpdate({ target: appSettings.key, set: { value: values, updatedBy: 'claude (script)', updatedAt: new Date() } });
  };
  if (cmd === 'onboarding' && (arg === 'on' || arg === 'off')) { values.onboardingV2 = arg === 'on' ? 1 : 0; await save(); }
  else if (cmd === 'preview-code') { values.previewCode = 100000 + Math.floor(Math.random() * 900000); await save(); }
  else if (cmd !== 'status') { console.log('Usage: status | onboarding on|off | preview-code'); process.exit(1); }
  console.log(`New onboarding: ${values.onboardingV2 === 1 ? 'ON for everyone' : 'off'}`);
  console.log(values.previewCode ? `Preview address: /onboarding-v2?preview=${values.previewCode}` : 'No preview code yet');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
