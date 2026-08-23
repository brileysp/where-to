import { db } from '../src/lib/db/client';
import { destinations } from '../src/lib/db/schema';

async function main() {
  await db.insert(destinations).values({
    id: 'test-paris',
    name: 'Paris',
    region: 'France',
    emoji: '🗼',
    climate: 'temperate',
    about: 'Test row to verify array + jsonb round-trip.',
    baseScores: { museums: 10, sunbathing: 1 },
    dryMonths: [6, 7, 8],
    wetMonths: [11, 12, 1],
    monthlyWeather: Array.from({ length: 12 }, (_, i) => `Test month ${i + 1}`),
    specialSeasons: [{ months: [7], text: 'Bastille Day fireworks.' }],
    shopClosures: true,
  });

  const rows = await db.select().from(destinations);
  console.log(JSON.stringify(rows, null, 2));

  await db.delete(destinations);
  console.log('OK: inserted, read back, cleaned up.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
