import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 7: volcano and altitude mountaineering at previously-NA
// destinations (NA cleared). Research this session: Iztaccihuatl (5,230m, ~70km
// from Mexico City) and Pico de Orizaba (5,636m, ~4h east) are short, well-
// trodden glacier routes, no permit or legal guide mandate, dry season Nov-Mar
// (Dec-Feb best), wet Apr-Oct; Popocatepetl sits behind a 12km exclusion zone.
// Licancabur (5,916m) is climbed from the Bolivian side (Chilean slope mined),
// Ojos del Salado (6,893m) is staged from Copiapo ~260km away, its season is
// Nov-Mar; sources disagree on Licancabur's months. Kinabalu (4,095m) is a guided
// trek with a short rope section, capped at 163 climbers a day, guide mandatory,
// peak season Mar-Sep, plus the Mountain Torq via ferrata. Ruapehu/Taranaki are
// winter alpine objectives; Wharepapa South has 1,300+ mainly sport routes.
const MEX_PEAK = 'Peak dry season — the best conditions for both volcanoes, though it’s cold at altitude.';
const MEX_WET = 'Wet season — afternoon storms and poor visibility make summit days less safe.';
const ATA_RAIN = 'The rainier stretch of the year — altiplano storms can disrupt climbs even though Ojos del Salado’s season is open.';
const ATA_STABLE = 'Stable, dry weather — Licancabur is in season, though nights are getting cold.';
const ATA_COLD = 'The coldest stretch of the year at altitude — climbable, but bitterly cold.';
const BOR_OFF = 'Off-peak — weather is less settled, though the climb still runs.';
const BOR_PEAK = 'Peak season — the best odds of clear weather, but permits book up three to six months ahead.';
const NI_SUMMER = 'Settled summer weather — Taranaki is at its most accessible and the rock at Wharepapa is in season.';
const NI_WINTER = 'Winter alpine season — ice axe, crampons, and real avalanche hazard on Ruapehu and Taranaki.';

const ENTRIES: Record<string, Entry> = {
  mexicocity: {
    overview: 'The gateway to two of North America’s highest glaciated volcanoes — Iztaccíhuatl (5,230m), about 70km away, and Pico de Orizaba (5,636m), four hours east — both short, well-trodden glacier routes that need crampons and an ice axe but no permit. Popocatépetl, the closest volcano, is off-limits. The dry season runs from November to March.',
    months: [
      m(6.4, MEX_PEAK), m(6.4, MEX_PEAK),
      m(5.6, 'Still dry, but the season is winding down.'),
      m(3.4, 'The wet season is beginning, with afternoon storms building daily.'),
      m(2.4, MEX_WET), m(2.4, MEX_WET), m(2.4, MEX_WET), m(2.4, MEX_WET), m(2.4, MEX_WET), m(2.4, MEX_WET),
      m(5.8, 'The dry season is beginning, with the best conditions still ahead.'),
      m(6.4, MEX_PEAK),
    ],
  },
  atacama: {
    overview: 'The volcanoes above San Pedro offer real altitude mountaineering — Licancabur (5,916m) is climbed from the Bolivian side because the Chilean slope is mined, as a two-day guided trip, while access to Láscar depends on volcanic alert levels. Ojos del Salado (6,893m), the world’s highest volcano, is a separate expedition staged from Copiapó, about 260km south, with its season running November to March.',
    months: [
      m(3.6, ATA_RAIN), m(3.6, ATA_RAIN),
      m(5.0, 'Dry conditions return, and Ojos del Salado’s season is winding down.'),
      m(5.6, ATA_STABLE), m(5.6, ATA_STABLE),
      m(4.4, ATA_COLD), m(4.4, ATA_COLD),
      m(5.6, 'Cold at altitude but stable, with the season warming toward spring.'),
      m(6.0, 'Spring — settled weather and warming temperatures for Licancabur.'),
      m(6.2, 'Prime conditions on the altiplano, with Ojos del Salado’s season beginning.'),
      m(6.4, 'Both Licancabur and Ojos del Salado are in season.'),
      m(5.8, 'Still in season, though summer storms begin returning late in the month.'),
    ],
  },
  borneo: {
    overview: 'Mount Kinabalu (4,095m) is a guided trek with a short rope section near the summit rather than technical climbing, though the Mountain Torq via ferrata on its slopes adds a genuine vertical route. Sabah Parks caps climbers at 163 a day, a guide is mandatory, and bookings fill months ahead; the peak season is March to September.',
    months: [
      m(3.4, BOR_OFF), m(3.4, BOR_OFF),
      m(5.0, 'The peak season begins.'),
      m(5.6, BOR_PEAK), m(5.6, BOR_PEAK), m(5.6, BOR_PEAK), m(5.6, BOR_PEAK), m(5.6, BOR_PEAK),
      m(5.0, 'The peak season is ending.'),
      m(3.4, BOR_OFF), m(3.4, BOR_OFF), m(3.4, BOR_OFF),
    ],
  },
  'north-island': {
    overview: 'Volcano mountaineering — Ruapehu (2,797m) and Taranaki (2,518m) are winter alpine objectives needing an ice axe and crampons, with real avalanche hazard and, on Ruapehu, eruption hazard — plus Wharepapa South, a large sport-climbing area of over 1,300 routes. Summer is the settled season for Taranaki; winter alpine runs roughly May to October.',
    months: [
      m(5.6, NI_SUMMER), m(5.6, NI_SUMMER),
      m(5.0, 'Still settled early in the month, then autumn weather returns.'),
      m(4.0, 'Autumn — icy conditions begin returning to the volcanoes.'),
      m(4.6, 'The winter alpine season begins as snow builds on the volcanoes.'),
      m(5.0, NI_WINTER), m(5.0, NI_WINTER), m(5.0, NI_WINTER),
      m(4.6, 'Late winter — good snow, with weather and avalanche hazard still serious.'),
      m(4.2, 'Spring — the winter season is ending as snow retreats.'),
      m(4.6, 'Spring — conditions are settling toward summer.'),
      m(5.2, 'Summer settles in — Taranaki’s best weather runs from December to early March, and Wharepapa’s rock is in season.'),
    ],
  },
};

runBatch(ENTRIES, { clearNA: ['mexicocity', 'atacama', 'borneo', 'north-island'] });
