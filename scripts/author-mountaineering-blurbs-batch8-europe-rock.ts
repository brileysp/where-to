import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 8: European rock climbing at destinations that were NA for
// the interest (NA cleared) — the "Rock Climbing" half of "Mountaineering &
// Rock Climbing". Research this session: Fontainebleau (~40-50 min from Paris by
// train) is called the biggest bouldering area in the world, best Mar-May and
// Sep-Oct; Verdon has 1,500+ routes (Route des Cretes open 7 May-21 Nov 2026),
// Calanques fire restrictions 1 Jun-30 Sep; Mallorca's deep-water soloing is
// famous but regional restrictions on parts of the east coast are unsettled;
// Montserrat ~45 min, Siurana ~1h45 from Barcelona; El Chorro ~45-50 min from
// Malaga; Cala Gonone (1,100+ routes) is ~1.5h from Olbia; San Vito lo Capo
// season Oct-mid May; Paklenica ~1h from Zadar, season Apr-mid Oct; Czech/Saxon
// sandstone towers are chalk-free with ring bolts and slings, Adrspach sectors
// open 1 May (seven from 1 Jul) to 31 Dec; Frankenjura (10,000+ routes) is ~200km
// from Munich; Cornwall's Chair Ladder is tidal, with nesting restrictions
// mid-Mar to end of Jun.
const PAR_WINTER = 'Winter — the best friction of the year, but it’s cold and wet, and wet sandstone is off-limits.';
const PAR_SPRING = 'Prime spring — mild temperatures and good friction on dry sandstone.';
const PAR_SUMMER = 'Summer — warm temperatures and worse friction make it a poor season.';
const PRO_WINTER = 'Winter — too cold for the Verdon, though Buoux and the Calanques stay climbable on good days.';
const PRO_SUMMER = 'Too hot, and the Calanques are restricted for fire risk from 1 June to 30 September.';
const MAL_WINTER = 'Winter — cooler, with sport climbing workable on dry days; deep-water soloing is out of season.';
const MAL_SPRING = 'Prime spring sport climbing, though some coasts have seasonal nesting restrictions.';
const MAL_SUMMER = 'Summer heat makes sport climbing a dawn-and-dusk affair, though the sea is warm for deep-water soloing.';
const BCN_WINTER = 'Winter — cold, but sunny days are workable at Montserrat and the Siurana and Margalef crags.';
const BCN_SPRING = 'Prime spring — Siurana, Margalef, and Montserrat are all at their best.';
const BCN_SUMMER = 'Summer heat makes climbing a shade-chasing exercise, and the pockets at Margalef feel greasy.';
const BCN_AUTUMN = 'Prime autumn — Siurana, Margalef, and Montserrat are all in season.';
const AND_WINTER = 'Winter — El Chorro’s high season, though fog is common; the Sierra Nevada is in winter-mountaineering condition.';
const SAR_WINTER = 'Winter — mild weather makes this a winter climbing destination, with sunny days on Cala Gonone’s crags.';
const SAR_SPRING = 'Prime spring — the best window for sport and multi-pitch climbing.';
const SAR_SUMMER = 'Too hot — only a few shaded crags are workable.';
const SIC_WINTER = 'Winter — mild, with the south- and west-facing crags in sun.';
const SIC_SUMMER = 'Very hot — only the east-facing crags on Monte Monaco work.';
const CRO_WINTER = 'Winter — Paklenica is wet and windy, but the coastal and island crags stay workable.';
const CRO_PRIME = 'Prime season — Paklenica and the coastal crags are both in condition.';
const PRA_WINTER = 'Winter — the towers are closed or iced over, and wet sandstone is off-limits.';
const BAV_WINTER = 'Winter — cold and snowy; Frankenjura’s season is over and the alpine huts are closed.';
const BAV_SPRING = 'Prime Frankenjura season — the sport-climbing crags are in their best condition.';
const COR_WINTER = 'Winter — short days and big swells can make the sea cliffs a serious undertaking.';
const COR_NESTING = 'Sea-cliff climbing is in season, though some cliffs, such as Chair Ladder’s Bishop’s Buttress, are closed for nesting until the end of June.';
const COR_SUMMER = 'Peak season — long days and all cliffs open, though Chair Ladder is only reachable at low tide in calm seas.';

const ENTRIES: Record<string, Entry> = {
  paris: {
    overview: 'Fontainebleau, about 40–50 minutes south of Paris by train, is widely described as the biggest and most developed bouldering area in the world — the origin of the Font grading scale, with colour-coded circuits on Oligocene sandstone. The best months are March to May and September to October; rain shuts it down in practice, because wet sandstone is fragile.',
    months: [
      m(6.4, PAR_WINTER), m(6.4, PAR_WINTER),
      m(9.2, 'Early spring — one of the prime months, though it can still be cold and wet.'),
      m(9.8, PAR_SPRING), m(9.8, PAR_SPRING),
      m(6.0, 'Warming up, and friction starts to fall off toward summer.'),
      m(4.6, PAR_SUMMER), m(4.6, PAR_SUMMER),
      m(9.3, 'Autumn begins — the summer heat fades and the prime season returns.'),
      m(9.8, 'Prime autumn — cool, dry rock and good friction.'),
      m(6.8, 'Cooling — friction improves, but rain and short days are the main limits.'),
      m(6.4, PAR_WINTER),
    ],
  },
  provence: {
    overview: 'Provence’s climbing is in the Verdon Gorge — over 1,500 routes, with multi-pitch limestone lines of 100–350m, about an hour and three-quarters from Aix — plus the sea cliffs of the Calanques near Marseille and the 500-route crag at Buoux. Spring and autumn are best; summer is too hot and the Calanques close for fire risk, and winter is too cold for the gorge.',
    months: [
      m(3.8, PRO_WINTER), m(3.8, PRO_WINTER),
      m(6.0, 'Spring begins — the Calanques and Buoux are in season, but the Verdon is still cold.'),
      m(8.2, 'Spring — the Verdon, Calanques, and Buoux are all coming into season.'),
      m(8.6, 'Prime spring — all three areas are in season, and the Route des Crêtes reopens.'),
      m(6.4, 'Getting hot — the Verdon’s shady sectors work, but the Calanques’ summer fire restrictions begin on 1 June.'),
      m(3.4, PRO_SUMMER), m(3.4, PRO_SUMMER),
      m(6.6, 'The heat is easing, but fire restrictions still apply in the Calanques until the end of the month.'),
      m(8.4, 'Prime autumn — all three areas are in season.'),
      m(7.6, 'Late autumn — Buoux and the Calanques are good, while the Verdon and its Route des Crêtes wind down.'),
      m(3.8, PRO_WINTER),
    ],
  },
  mallorca: {
    overview: 'One of the world’s best-known deep-water soloing destinations — Cala Barques is the most popular crag and Es Pontàs the island’s most famous line — alongside sport climbing at Sa Gubia. Regional restrictions on parts of the east coast and nesting zones in the Tramuntana have shifted in recent years, so check current rules before you go. Autumn and spring are best, with deep-water soloing peaking in October while the sea is still warm.',
    months: [
      m(4.8, MAL_WINTER), m(4.8, MAL_WINTER),
      m(6.4, 'Spring — sport climbing is coming into its best season, while the sea is still too cold for deep-water soloing.'),
      m(7.0, MAL_SPRING), m(7.0, MAL_SPRING),
      m(4.6, 'Getting hot, and the sea is warming for deep-water soloing.'),
      m(4.0, MAL_SUMMER), m(4.0, MAL_SUMMER),
      m(6.2, 'Autumn begins — the heat fades and the warm sea suits deep-water soloing.'),
      m(7.6, 'The best month — sport climbing improves and the sea is still warm for deep-water soloing.'),
      m(6.6, 'Sport climbing is prime, though the sea is cooling for deep-water soloing.'),
      m(4.8, MAL_WINTER),
    ],
  },
  barcelona: {
    overview: 'A gateway to some of Europe’s best rock: Montserrat, about 45 minutes away, has thousands of multi-pitch conglomerate routes, while Siurana (1h45), the “international reference” for limestone sport climbing, and Margalef (about two hours) are among the world’s top sport-climbing areas. Spring and autumn are best; summer is too hot.',
    months: [
      m(5.4, BCN_WINTER), m(5.4, BCN_WINTER),
      m(8.0, 'Spring begins — the season opens on all three areas, with mild temperatures.'),
      m(8.6, BCN_SPRING), m(8.6, BCN_SPRING),
      m(5.2, 'Getting hot; shade is needed, though Montserrat’s higher walls stay workable.'),
      m(3.2, BCN_SUMMER), m(3.2, BCN_SUMMER),
      m(6.2, 'Autumn begins as the heat eases.'),
      m(8.4, BCN_AUTUMN), m(8.4, BCN_AUTUMN),
      m(5.4, BCN_WINTER),
    ],
  },
  andalucia: {
    overview: 'El Chorro, about 45–50 minutes from Málaga, is a regional-to-national limestone sport-climbing area with hundreds of routes across dozens of sectors; the Sierra Nevada’s winter mountaineering is a separate, Granada-based trip and modest by alpine standards. Autumn to spring is the season, and summer sun is harsh on south faces.',
    months: [
      m(6.0, AND_WINTER), m(6.0, AND_WINTER),
      m(6.2, 'Spring — El Chorro is still in season, and the Sierra Nevada’s winter mountaineering continues into May.'),
      m(6.2, 'Spring — El Chorro is still in season, and the Sierra Nevada’s winter mountaineering continues into May.'),
      m(5.4, 'Warming quickly, with the Sierra Nevada’s winter season ending.'),
      m(3.2, 'Summer heat closes the sun-exposed crags.'),
      m(2.6, 'Summer — heat closes the sun-exposed crags, and Mulhacén is a walk, not a climb.'),
      m(2.6, 'Summer — heat closes the sun-exposed crags, and Mulhacén is a walk, not a climb.'),
      m(3.8, 'Still hot, though the first cooler days return.'),
      m(6.0, 'Autumn — El Chorro’s high season begins.'),
      m(6.4, 'Prime autumn conditions at El Chorro.'),
      m(6.0, AND_WINTER),
    ],
  },
  sardinia: {
    overview: 'World-class limestone: Cala Gonone alone has more than 1,100 sport routes across dozens of sectors, with long multi-pitch lines in the Supramonte and about 500 more routes at Domusnovas. Cala Gonone is roughly an hour and a half from Olbia and three hours from Cagliari. Mild winters make this a winter climbing destination; April–June and September–November are best, and summer is too hot.',
    months: [
      m(6.8, SAR_WINTER), m(6.8, SAR_WINTER),
      m(7.6, 'Spring — the season is building.'),
      m(8.4, SAR_SPRING), m(8.4, SAR_SPRING),
      m(7.4, 'Still good early in the month, then the heat starts to bite; shaded crags work.'),
      m(3.6, SAR_SUMMER), m(3.6, SAR_SUMMER),
      m(6.2, 'The heat eases and the season returns.'),
      m(8.2, 'Prime autumn — the best window for sport and multi-pitch climbing.'),
      m(8.2, 'Prime autumn — the best window for sport and multi-pitch climbing.'),
      m(6.8, SAR_WINTER),
    ],
  },
  sicily: {
    overview: 'San Vito lo Capo, at the island’s northwest tip, has more than 1,200 limestone sport routes plus long bolted and trad multi-pitches on Monte Monaco. The crags face south and west, so the season runs from October to mid-May and summer is very hot.',
    months: [
      m(6.6, SIC_WINTER), m(6.6, SIC_WINTER),
      m(7.4, 'Spring — the crags are in prime condition.'),
      m(7.6, 'Prime spring — the best window.'),
      m(6.4, 'The season ends by mid-month as the heat builds.'),
      m(3.4, 'Getting too hot — east-facing Monte Monaco crags are the exception.'),
      m(2.4, SIC_SUMMER), m(2.4, SIC_SUMMER),
      m(3.6, 'Still hot.'),
      m(7.2, 'The season begins as the heat fades.'),
      m(7.6, 'Prime autumn conditions.'),
      m(6.6, SIC_WINTER),
    ],
  },
  croatia: {
    overview: 'The coast’s best-known climbing is Paklenica’s 350m Anića Kuk wall, about an hour north of Zadar, with more than a hundred multi-pitch routes; there are also sport crags at Omiš, 20–25km from Split, and island crags like Vela Stiniva on Hvar. Paklenica’s season runs from April to mid-October, while the coastal and island crags work most of the year.',
    months: [
      m(4.4, CRO_WINTER), m(4.4, CRO_WINTER), m(4.4, CRO_WINTER),
      m(6.2, 'Spring — Paklenica’s season opens.'),
      m(6.8, CRO_PRIME), m(6.8, CRO_PRIME),
      m(5.0, 'Hot summer weather makes early starts essential.'), m(5.0, 'Hot summer weather makes early starts essential.'),
      m(6.6, 'Autumn — the heat fades and Paklenica is in season.'),
      m(5.8, 'Paklenica’s season ends by mid-month; the coastal crags remain open.'),
      m(4.4, CRO_WINTER), m(4.4, CRO_WINTER),
    ],
  },
  prague: {
    overview: 'Sandstone tower climbing with its own strict tradition — Adršpach-Teplice’s towers, Prachov, and Saxon Switzerland across the border — climbed without chalk, cams, or nuts, using only ring bolts and knotted slings. It’s world-class for the tradition rather than convenience: the towers are roughly 90–150km from Prague, and wet sandstone is off-limits.',
    months: [
      m(1.6, PRA_WINTER), m(1.6, PRA_WINTER), m(1.6, PRA_WINTER),
      m(2.2, 'Adršpach is still closed until 1 May, and nesting closures apply elsewhere.'),
      m(6.6, 'Adršpach opens on 1 May, though seven of its sectors stay closed for falcon nesting until July.'),
      m(7.0, 'Most sectors are open and the towers are in season, though the falcon-nesting sectors remain closed until July.'),
      m(7.6, 'All sectors are open from 1 July, so the full range of towers is available.'),
      m(7.6, 'All sectors are open from 1 July, so the full range of towers is available.'),
      m(7.6, 'All sectors are open from 1 July, so the full range of towers is available.'),
      m(7.6, 'All sectors are open from 1 July, so the full range of towers is available.'),
      m(5.6, 'Late season — sectors stay open through December, but cold and wet weather limits climbing.'),
      m(4.2, 'Sectors close on 31 December; days are short and cold.'),
    ],
  },
  'bavaria-munich': {
    overview: 'Two different worlds within reach of Munich: alpine limestone in the Wetterstein and Karwendel from Garmisch and Mittenwald (about 80–90km), and Frankenjura, the birthplace of redpoint sport climbing with more than 10,000 routes about 200km north. Frankenjura is best from late March to early June; the alpine huts run roughly mid-June to early October.',
    months: [
      m(2.2, BAV_WINTER), m(2.2, BAV_WINTER),
      m(4.6, 'The Frankenjura season begins on dry days by late March.'),
      m(8.6, BAV_SPRING), m(8.6, BAV_SPRING),
      m(8.0, 'Frankenjura is still good early on, and the alpine huts begin opening by mid-June.'),
      m(7.6, 'Alpine season — the huts are open for the Wetterstein and Karwendel routes.'),
      m(6.6, 'Humid at Frankenjura, but the alpine season is in full swing.'),
      m(7.2, 'Still alpine season — the huts stay open through September.'),
      m(5.0, 'The alpine season is over; Frankenjura is workable on dry days.'),
      m(3.0, 'Rainy, with the crags mostly wet.'),
      m(2.2, BAV_WINTER),
    ],
  },
  cornwall: {
    overview: 'Granite sea-cliff trad on the far west peninsula — Bosigran, Sennen, and Chair Ladder are the UK classics — national-class rather than a bucket-list destination. Tides and swell govern access (Chair Ladder is only reachable around low tide in calm seas), and bird-nesting restrictions close some cliffs from mid-March to the end of June.',
    months: [
      m(3.0, COR_WINTER), m(3.0, COR_WINTER),
      m(4.4, 'Spring begins, with bird-nesting restrictions starting on some cliffs from mid-March.'),
      m(5.8, COR_NESTING), m(5.8, COR_NESTING), m(5.8, COR_NESTING),
      m(6.2, COR_SUMMER), m(6.2, COR_SUMMER),
      m(6.0, 'Still good, with settled spells possible and shorter days.'),
      m(4.8, 'Autumn — days are short and swells are picking up.'),
      m(3.4, 'Days are short and the weather is wet and windy.'),
      m(3.0, COR_WINTER),
    ],
  },
};

runBatch(ENTRIES, { clearNA: Object.keys(ENTRIES) });
