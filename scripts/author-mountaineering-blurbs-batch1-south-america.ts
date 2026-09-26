import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 1: South America. Research this session: Aconcagua's
// park season is 1 Nov-30 Apr (permits in person in Mendoza, guide optional on
// the Normal route); Ecuador's volcanoes have two dry windows and Cotopaxi/
// Chimborazo need accredited guides above the refuges; Fitz Roy windows last
// 1-3 days a month even at peak; Torres del Paine is a trekking destination
// with a small, remote climbing scene; Frey's granite spires are national-class.
const WINTER_MEND = 'Winter — extreme cold and wind; not a realistic month for the mountain.';
const MEND_PRIME = 'Prime season — the most popular window for a summit attempt on the Normal route, and the Cordón del Plata is in condition too.';
const ECU_WET = 'Wet season — poor visibility and heavier snow on the glaciers.';
const ECU_PEAK = 'The main dry season — the most reliable window for all of the big glacier climbs.';
const CHAL_PEAK = 'Peak season — the best odds of a weather window, though even now a usable summit window lasts only one to three days a month, and wind can top 100 km/h.';
const CHAL_WINTER = 'Winter — heavy snow, storms, and short days close the technical objectives.';
const TDP_PEAK = 'Peak summer — long days and the most activity, with wind and fast-changing weather still the main constraint.';
const TDP_WINTER = 'Winter — heavy snow and short days close the climbing season.';
const ARG_WINTER = 'Winter snow shuts down the granite season.';

const ENTRIES: Record<string, Entry> = {
  mendoza: {
    overview: 'The gateway to Aconcagua (6,961m), the highest peak outside Asia — a non-technical but serious high-altitude expedition on the Normal route. The park season runs November to April, with a permit required for every climber and processed in person in Mendoza; the practical summit window is roughly mid-November through March, peaking December to January. Lower peaks in the Cordón del Plata need only a registration.',
    months: [
      m(9.6, MEND_PRIME),
      m(9.0, 'Still a strong window, though the season is beginning to wind down.'),
      m(7.4, 'Late season — colder, with a shrinking window; the Cordón del Plata’s season is ending too.'),
      m(3.0, 'The park’s official season runs to 30 April, but winter is closing in and few teams attempt a summit.'),
      m(1.0, WINTER_MEND), m(1.0, WINTER_MEND), m(1.0, WINTER_MEND), m(1.0, WINTER_MEND), m(1.0, WINTER_MEND),
      m(1.6, 'Winter’s tail — the park season hasn’t opened yet.'),
      m(5.6, 'The park season opens and the first expeditions head up, though it’s still early, cold, and windy.'),
      m(9.6, MEND_PRIME),
    ],
  },
  'ecuadorian-andes': {
    overview: 'Home to some of the world’s highest equatorial glaciers: Cotopaxi (5,897m) and Cayambe are non-technical glacier climbs, and Chimborazo (6,263m) is a longer, harder objective. There are two dry windows, roughly June to September and December to January, with the wetter months bringing poor visibility and heavier snow. Glacier ascents need an accredited guide, and summit access can change with volcanic activity.',
    months: [
      m(8.4, 'The shorter of the two dry windows — Cotopaxi, Illiniza, and Chimborazo are all in good condition.'),
      m(5.2, 'The dry spell is ending; Chimborazo is still workable, but the wet season is arriving on Cayambe and elsewhere.'),
      m(3.2, ECU_WET), m(3.2, ECU_WET),
      m(4.8, 'The wet season is easing, and Chimborazo’s May-to-July window is opening.'),
      m(8.2, 'The main dry season begins — Chimborazo and Cayambe are in good condition, with Cotopaxi and Illiniza coming in by July.'),
      m(9.3, ECU_PEAK), m(9.3, ECU_PEAK),
      m(8.3, 'Still dry, though past the peak window for Cotopaxi and Illiniza.'),
      m(5.2, 'The first rains return, with poorer visibility on the higher volcanoes.'),
      m(6.4, 'Chimborazo’s season opens as the rains ease, though it’s still unsettled elsewhere.'),
      m(8.6, 'The shorter dry window is beginning — Cotopaxi and Illiniza are coming into condition.'),
    ],
  },
  'el-chalten': {
    overview: 'One of the world’s great alpine granite objectives — Fitz Roy and Cerro Torre are technical, weather-gated climbs where even in peak season a usable summit window lasts just one to three days a month. The season runs November through March, with wind that can exceed 100 km/h.',
    months: [
      m(10, CHAL_PEAK), m(10, CHAL_PEAK),
      m(7.6, 'Deteriorating weather, though late-season windows are still possible.'),
      m(3.4, 'The season is over; short days and winter storms take over.'),
      m(1.2, CHAL_WINTER), m(1.2, CHAL_WINTER), m(1.2, CHAL_WINTER), m(1.2, CHAL_WINTER), m(1.2, CHAL_WINTER),
      m(2.4, 'Pre-season — conditions are still wintry, with heavy wind.'),
      m(6.4, 'The season opens — long days, but still cold, with short, unpredictable weather windows.'),
      m(8.6, 'Conditions are improving, with longer weather windows building toward peak.'),
    ],
  },
  'torres-del-paine': {
    overview: 'Better known for trekking than climbing, but its granite towers and big walls are a real, if remote, expedition-style objective. Climbing requires border and park-service permits, and the season follows the park’s October-to-April high season.',
    months: [
      m(6.1, TDP_PEAK), m(6.1, TDP_PEAK),
      m(6.4, 'Autumn often brings calmer, more settled spells, though days are shortening.'),
      m(4.6, 'The season is closing — shorter days and colder weather.'),
      m(1.0, TDP_WINTER), m(1.0, TDP_WINTER), m(1.0, TDP_WINTER), m(1.0, TDP_WINTER), m(1.0, TDP_WINTER),
      m(3.6, 'The park’s high season opens, but early-season wind and unsettled weather make climbing difficult.'),
      m(4.8, 'Spring — days are getting long, though the weather remains unsettled.'),
      m(5.9, 'Summer — the longest days of the year, though the wind is relentless.'),
    ],
  },
  'argentine-lake-district': {
    overview: 'A well-regarded trad-climbing hub around the granite spires of Refugio Frey, with routes from easy to hard multi-pitch cracks, plus the beginner-friendly Volcán Lanín. The rock season runs roughly December through March, driest in February; winter snow shuts the granite down.',
    months: [
      m(7.6, 'Peak season at Frey’s granite spires — long days, though weather can change quickly.'),
      m(7.9, 'Usually the driest month of the season — the best odds for multi-pitch climbing on the granite spires.'),
      m(6.6, 'The season is winding down, with cooler weather and shorter days.'),
      m(3.6, 'Cold weather returns and the season is largely over.'),
      m(1.2, ARG_WINTER), m(1.2, ARG_WINTER), m(1.2, ARG_WINTER), m(1.2, ARG_WINTER), m(1.2, ARG_WINTER),
      m(2.4, 'Snow is slowly retreating, but the rock is still wet and cold.'),
      m(5.2, 'Spring warms up and Volcán Lanín’s season begins, with Frey’s spires coming back into condition.'),
      m(6.9, 'The season is underway — Frey’s spires are climbable and Lanín is in its window.'),
    ],
  },
};

runBatch(ENTRIES);
