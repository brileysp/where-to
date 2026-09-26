import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 9: rock climbing at destinations outside Europe/North
// America that were NA for the interest (NA cleared). Research this session:
// Yangshuo (~1h from Guilin) has ~800 routes on ~40 crags in one guidebook,
// best Oct-Nov, plum-rain season Apr-Jun with 80-100% humidity; Wadi Rum is
// ~320km south of Amman and needs a guide for most areas, season Oct-Apr;
// Spitzkoppe is ~1h45 from Swakopmund / ~3h from Windhoek, season Apr/May-Sep;
// Tsaranoro's granite walls (500-800m) are 57km from Ambalavao plus a 2h walk,
// dry season May-Oct; Tasmania's Tasman Peninsula dolerite sea cliffs (Totem
// Pole, Candlestick, Cape Raoul) are ~75km from Hobart, season Nov-Apr, Freycinet
// granite best in winter; Insubong's granite sits inside the Seoul area, Chouinard
// put up routes there in the 1960s.
const YAN_WINTER = 'Winter — cool, with wet mornings that delay climbing.';
const YAN_PLUM = 'Plum-rain season — humidity of 80–100% and frequent rain.';
const YAN_SUMMER = 'Midsummer — 35°C-plus heat, humidity, and rain make climbing miserable.';
const YAN_BEST = 'Best season — dry, with temperatures of 15–25°C.';
const JOR_WINTER = 'Winter — cold, with possible rain or snow.';
const JOR_PRIME = 'Prime season — mild, dry temperatures.';
const JOR_SUMMER = 'Summer heat of 35–45°C makes climbing impractical.';
const NAM_HOT = 'Summer heat makes climbing impractical.';
const NAM_PRIME = 'Cool, dry winter — the prime season for the granite.';
const MAD_WET = 'The wet season — rain closes the big walls.';
const MAD_DRY = 'Dry season — the best conditions for the big granite walls.';
const TAS_SUMMER = 'Summer — the Tasman Peninsula’s dolerite towers and Ben Lomond are in season, though wind and rain can still interrupt.';
const TAS_WINTER = 'Winter — the other areas are cold and wet, but Freycinet’s granite sea cliffs are at their best.';
const SEO_WINTER = 'Winter — cold, with icy rock and short days.';
const SEO_SPRING = 'Prime spring — the best of the two main climbing seasons.';
const SEO_MONSOON = 'Monsoon and summer heat — wet granite is dangerous.';

const ENTRIES: Record<string, Entry> = {
  'guilin-yangshuo': {
    overview: 'Yangshuo, about an hour from Guilin, is one of Asia’s best-known limestone sport-climbing areas — roughly 800 routes on some 40 crags in one guidebook, from beginner-friendly Moon Hill lines to 8c+ projects — set among the karst peaks. October and November are best; the spring plum rains bring 80–100% humidity, and midsummer is hot, humid, and wet.',
    months: [
      m(4.4, YAN_WINTER), m(4.4, YAN_WINTER),
      m(6.2, 'Spring — decent conditions, though showers are common.'),
      m(5.0, 'The plum-rain season begins, with rising humidity and frequent showers.'),
      m(3.6, YAN_PLUM), m(3.6, YAN_PLUM),
      m(2.6, YAN_SUMMER), m(2.6, YAN_SUMMER),
      m(5.4, 'The heat and rain are easing.'),
      m(8.4, YAN_BEST), m(8.4, YAN_BEST),
      m(5.0, 'Winter is setting in, though mornings can still be wet.'),
    ],
  },
  jordan: {
    overview: 'Wadi Rum, about 320km south of Amman and a separate trip from Petra, offers sandstone multi-pitch trad routes of 400–800m plus some bolted climbing, with a strong Bedouin adventure feel; a guide is needed for most areas. The season is October to April, with the shoulder months hot enough that only shaded routes work; June to August is not climbable.',
    months: [
      m(5.2, JOR_WINTER),
      m(6.8, 'Cool and dry — one of the better months.'),
      m(7.8, JOR_PRIME),
      m(6.4, 'The heat is building; only shaded routes are comfortable by month’s end.'),
      m(3.4, 'Getting hot — climbing is limited to early mornings.'),
      m(1.2, JOR_SUMMER), m(1.2, JOR_SUMMER), m(1.2, JOR_SUMMER),
      m(2.6, 'Still very hot.'),
      m(6.6, 'The heat is easing, though shaded routes are best early in the month.'),
      m(7.8, JOR_PRIME),
      m(5.2, JOR_WINTER),
    ],
  },
  namibia: {
    overview: 'Spitzkoppe, a granite inselberg about an hour and three-quarters from Swakopmund or three hours from Windhoek, has roughly 100 sport routes and 50 trad routes plus bouldering, with multi-pitch lines up to about 14 pitches. The cool, dry season runs from April or May to September; summer is too hot.',
    months: [
      m(1.8, NAM_HOT), m(1.8, NAM_HOT), m(1.8, NAM_HOT),
      m(4.4, 'The heat is easing and the season is starting.'),
      m(6.4, 'The cooler season begins, with good conditions on the granite.'),
      m(6.8, NAM_PRIME), m(6.8, NAM_PRIME), m(6.8, NAM_PRIME),
      m(6.2, 'Still cool, with the heat starting to return by month’s end.'),
      m(4.0, 'The heat is returning.'),
      m(1.8, NAM_HOT), m(1.8, NAM_HOT),
    ],
  },
  madagascar: {
    overview: 'The Tsaranoro Valley holds compact granite big walls of 500–800m, with long bolted multi-pitch routes — a genuine, if remote, big-wall destination, 57km from Ambalavao plus a two-hour walk-in, so it’s expedition-style. The dry season, roughly May to October, is the season.',
    months: [
      m(1.6, MAD_WET), m(1.6, MAD_WET),
      m(4.4, 'The rains are ending and the season is beginning.'),
      m(5.4, 'Conditions are settling toward the dry season.'),
      m(7.4, MAD_DRY), m(7.4, MAD_DRY), m(7.4, MAD_DRY), m(7.4, MAD_DRY), m(7.4, MAD_DRY), m(7.4, MAD_DRY),
      m(5.6, 'The dry season is ending.'),
      m(4.0, 'Warming and increasingly unsettled as the wet season approaches.'),
    ],
  },
  tasmania: {
    overview: 'World-class sea-cliff climbing on the Tasman Peninsula, about 75km from Hobart — the dolerite Totem Pole (65m), Candlestick, and Cape Raoul are reached by long walks and abseils — plus the granite sea cliffs of Freycinet and the 400m quartzite wall of Frenchmans Cap. The main season is November to April, though the peninsula is windy and wet, and Freycinet is best in winter.',
    months: [
      m(8.0, TAS_SUMMER), m(8.0, TAS_SUMMER),
      m(7.6, 'Still in season, with days shortening.'),
      m(6.4, 'Autumn — the season is winding down.'),
      m(4.4, 'Cold and unsettled, with Freycinet’s granite sea cliffs in season.'),
      m(3.8, TAS_WINTER), m(3.8, TAS_WINTER), m(3.8, TAS_WINTER),
      m(5.0, 'Spring — warming, but the weather is still unsettled.'),
      m(6.0, 'Spring — the season is opening.'),
      m(7.4, 'Late spring — the Tasman Peninsula season is in full swing.'),
      m(8.0, TAS_SUMMER),
    ],
  },
  seoul: {
    overview: 'Bukhansan’s granite peaks sit inside the Seoul metro area — Insubong is a roughly 200m slab-and-crack wall where Yvon Chouinard put up routes in the 1960s, reached by shared taxi from Ui Station and free to enter — a rare big-city trad scene. Spring and autumn are the climbing seasons; the summer monsoon and winter cold shut it down.',
    months: [
      m(3.0, SEO_WINTER), m(3.0, SEO_WINTER),
      m(5.4, 'Spring begins as the rock warms up.'),
      m(6.8, SEO_SPRING), m(6.8, SEO_SPRING),
      m(3.8, 'The summer monsoon begins.'),
      m(2.6, SEO_MONSOON), m(2.6, SEO_MONSOON),
      m(5.6, 'The rains ease and the granite dries out.'),
      m(6.8, 'Prime autumn — the second of the two main climbing seasons.'),
      m(6.0, 'Late autumn — cooling, with short days.'),
      m(3.2, 'Winter sets in.'),
    ],
  },
};

runBatch(ENTRIES, { clearNA: Object.keys(ENTRIES) });
