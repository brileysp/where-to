import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Rewrites the place-level text (overview and cost overview) that still described only the OLD, narrower
// place after a rename (Oct 2026). Text only; no scores, curves or per-interest blurbs are touched.
const EDITS: Record<string, { overview?: string; costOverview?: string }> = {
  angkor: {
    overview: 'Angkor Wat, the largest religious monument on Earth, explored by tuk-tuk over several days around Siem Reap, alongside the capital Phnom Penh and the Gulf of Thailand coast around Kampot, Kep and Sihanoukville.',
    costOverview: 'Cambodia is affordable day to day, with the multi-day Angkor pass as the one real fixed cost everyone pays.',
  },
  luangprabang: {
    overview: 'Luang Prabang, a UNESCO-listed royal capital of gilded temples and saffron-robed monks at the confluence of the Mekong and Nam Khan rivers, alongside the capital Vientiane and the riverside town of Vang Vieng.',
    costOverview: 'Laos is inexpensive across the board, even for the signature Kuang Si Falls day trip from Luang Prabang.',
  },
  snowdonia: {
    overview: "Eryri National Park's mountains, including Snowdon, Wales's highest peak — dramatic ridgelines, slate-quarry history, and some of the best hiking in Britain — with the Welsh coast beyond the park.",
  },
  bagan: {
    costOverview: 'Tea, food and e-bike rental are cheap across Myanmar — the Bagan archaeological zone pass is the one real fixed cost, valid across your whole stay in Bagan.',
  },
  'punta-cana': {
    costOverview: 'The Punta Cana resort zone runs expensive by Dominican standards — taxis there charge a real premium over the rest of the country, and even a beachfront dinner reaches genuine splurge territory fast.',
  },
  borabora: {
    overview: 'The overwater-bungalow icon of Bora Bora, a volcanic island ringed by one of the most photographed lagoons on Earth, alongside Tahiti, Moorea and the other islands of French Polynesia.',
    costOverview: 'One of the most expensive places on the planet to eat even a casual meal — there is no discount version of French Polynesia.',
  },
  tanzania: {
    overview: "The northern Tanzania safari circuit out of Arusha — big-cat drama on the Serengeti's plains and in Ngorongoro Crater, with Lake Manyara and Tarangire for landscape.",
  },
  'joshua-tree': {
    costOverview: 'At Joshua Tree, prices stay close to typical national-park levels — the real splurge is a guided stargazing tour, since its dark skies are one of the biggest draws.',
  },
};

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select().from(places).where(inArray(places.id, Object.keys(EDITS)));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    const e = EDITS[r.id];
    for (const f of ['overview', 'costOverview'] as const) {
      if (e[f] && e[f] !== (r as Record<string, unknown>)[f]) patches.push({ ...base, field: f, value: e[f] });
    }
  }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('edits', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})();
