import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Broadens seven places in name, region and short blurbs only. Ids, scores, months and interest texts are untouched.
const CHANGES: Record<string, { name: string; region?: string; overview: string; about?: string; addAliases: string[] }> = {
  bagan: {
    name: 'Myanmar',
    overview: 'Thousands of ancient Buddhist temples scattered across the dusty Bagan plain, best explored slowly by e-bike at sunrise and sunset, alongside the stilt villages of Inle Lake and the royal and colonial cities of Mandalay and Yangon.',
    addAliases: ['Bagan', 'Inle Lake', 'Mandalay', 'Yangon'],
  },
  kaziranga: {
    name: 'Assam & Northeast India',
    region: 'Northeast India',
    overview: "One-horned rhino stronghold at Kaziranga, with jeep and elephant safaris through Assam's grasslands and wetlands, alongside Manas, the river island of Majuli, and Meghalaya's living root bridges.",
    about: 'Kaziranga closes entirely during monsoon flooding (roughly May–Oct), reopening for dry-season game drives Nov–Apr.',
    addAliases: ['Kaziranga', 'Northeast India', 'Meghalaya', 'Majuli', 'Manas', 'Guwahati'],
  },
  komodo: {
    name: 'Komodo & Flores',
    overview: 'Komodo dragons plus superb diving — prehistoric-looking lizards on land, manta rays and pink-sand beaches in the water — with Labuan Bajo as the gateway and the three-coloured Kelimutu crater lakes on Flores.',
    addAliases: ['Komodo', 'Labuan Bajo', 'Kelimutu', 'Rinca'],
  },
  'joshua-tree': {
    name: 'Palm Springs & Joshua Tree',
    overview: 'High Mojave desert meets low Colorado desert — otherworldly yucca-tree silhouettes, boulder fields, and some of the darkest skies in Southern California, with the resort pools, mid-century architecture and aerial tramway of Palm Springs a short drive away.',
    addAliases: ['Joshua Tree National Park', 'Coachella Valley'],
  },
  'punta-cana': {
    name: 'Dominican Republic',
    overview: 'All-inclusive resort beaches at Punta Cana, humpback whale watching in Samaná Bay (Jan–Mar), colonial Santo Domingo, and the kitesurf coast of Cabarete.',
    addAliases: ['Punta Cana', 'Santo Domingo', 'Cabarete', 'Puerto Plata'],
  },
  whistler: {
    name: 'Vancouver & Whistler',
    overview: "North America's largest ski resort by lift-served terrain, with a genuine summer mountain-biking and hiking season too, and the waterfront city of Vancouver about two hours south.",
    addAliases: ['Whistler', 'Vancouver', 'Squamish', 'Sea-to-Sky'],
  },
  'el-chalten': {
    name: 'El Chaltén & El Calafate',
    overview: "Argentina's self-declared trekking capital — free, well-marked trails to Fitz Roy and Cerro Torre from El Chaltén, plus Perito Moreno Glacier near El Calafate, the region's gateway town.",
    addAliases: [],
  },
};

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const ids = Object.keys(CHANGES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const c = CHANGES[r.id];
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'name', value: c.name });
    if (c.region) patches.push({ ...base, field: 'region', value: c.region });
    patches.push({ ...base, field: 'overview', value: c.overview });
    if (c.about) patches.push({ ...base, field: 'about', value: c.about });
    const aliases = [...r.searchAliases];
    for (const a of c.addAliases) if (!aliases.some((x) => x.toLowerCase() === a.toLowerCase())) aliases.push(a);
    if (aliases.length !== r.searchAliases.length) patches.push({ ...base, field: 'searchAliases', value: aliases });
  }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(0);
})();
