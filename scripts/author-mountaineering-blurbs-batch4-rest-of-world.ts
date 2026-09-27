import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 4: Asia, Africa, New Zealand, the Arctic, and the desert
// and island destinations. Research this session: Karakoram expedition season
// is late June-August with K2's window late July-early August (registered
// Pakistani operator and government permit required); Stok Kangri is reported
// closed to expeditions since a Dec 2023 Leh order (operator source, primary
// notice not opened); Lenin Peak/Inylchek need a border-zone permit; Rwenzori's
// Margherita Peak is a glacier expedition with compulsory guides, dry seasons
// Jun-Aug and Dec-Feb; Taghia's limestone walls are world-class but remote;
// Hvannadalshnukur is a 12-15 hour crevassed glacier climb; Svalbard needs a
// polar-bear rifle outside settlements; Faroe/Madeira climbing is minor.
// Deliberately NOT authored here (scope calls held for the user): kenya,
// ethiopia, bhutan, greenland.
const PAK_WINTER = 'Winter — extreme cold and heavy snow close the Karakoram to expeditions.';
const LAD_WINTER = 'Winter — snow closes the high passes and the trekking peaks.';
const LAD_PEAK = 'Peak season — the trekking peaks are in condition, with afternoon weather the main constraint.';
const KYR_WINTER = 'Winter — the high-altitude objectives are closed.';
const KYR_PEAK = 'Peak season — Lenin Peak and Khan Tengri base camps are open and the big peaks are in condition.';
const TW_TYPHOON = 'Typhoon season — storms and heavy rain can close routes and disrupt permits.';
const HOK_WINTER = 'Deep winter — low visibility and high winds make mountaineering a serious undertaking.';
const UG_SHORT_DRY = 'The shorter of the two dry seasons — better conditions on the glacier and trails, though still wet and cold at altitude.';
const UG_WET = 'Wet season — cold, wet, and cloud-covered, with poor conditions on the trails and glacier.';
const UG_LONG_DRY = 'The longer of the two dry seasons — the best window for the Margherita Peak expedition.';
const MOR_WINTER = 'Winter — Toubkal is a crampons-and-axe ascent and ski-touring season; the high rock is closed.';
const MOR_SPRING = 'Spring — Taghia and Todra are both in season.';
const MOR_SUMMER = 'Summer heat and thunderstorms — a trekking season on Toubkal, but not a rock-climbing one.';
const QT_SUMMER = 'Peak summer alpine season — Mount Aspiring’s guided season is in full swing.';
const QT_WINTER = 'Winter ice and mixed climbing — the Remarkables’ Alta Cirque is at its best.';
const MIL_GUIDED = 'The guided season is in full swing — the Darrans’ alpine rock is at its best, in one of the wettest places on Earth.';
const MIL_WINTER = 'Winter — heavy snow and avalanche danger close the alpine rock season.';
const ICE_ICE = 'Ice-climbing season on frozen waterfalls, with very short days and volatile weather.';
const ICE_PEAK = 'Peak season for Hvannadalshnúkur, with long days and firm snow bridges.';
const SVAL_OFF = 'The season is over as darkness returns.';
const SVAL_POLAR = 'Polar night — near-constant darkness closes the season.';
const FAR_WINTER = 'Winter — short days, wind, and fog make climbing unrealistic.';
const FAR_SEASON = 'The best of a difficult year — longer days, though fog and wind can still close things on short notice.';
const MAD_MILD = 'Mild weather and workable sport climbing on the coastal crags.';
const MAD_SPRING = 'Spring — pleasant temperatures for the coastal crags.';
const MAD_SUMMER = 'Warm summer temperatures — better for deep-water soloing than for the rock crags.';
const MAD_AUTUMN = 'Autumn — pleasant temperatures return for the crags and deep-water soloing.';
const SED_COOL = 'Cool weather — workable on dry days, but wet sandstone is off-limits.';
const SED_SUMMER = 'Summer heat regularly tops 100°F — not a realistic climbing season.';
const ZION_WINTER = 'Cold winter days limit climbing to sunny, dry stretches.';
const ZION_SUMMER = 'Summer heat makes the valley walls unrealistic.';

const ENTRIES: Record<string, Entry> = {
  pakistan: {
    overview: 'The Karakoram holds K2 (8,611m), Broad Peak, the Gasherbrums, and Nanga Parbat — the most demanding high-altitude climbing on Earth, with K2’s summit window typically late July to early August. A registered Pakistani operator and a government permit are required; there is no independent travel to the K2 region.',
    months: [
      m(0.8, PAK_WINTER), m(0.8, PAK_WINTER), m(0.8, PAK_WINTER),
      m(1.4, 'Too early — the expedition season starts in late June.'),
      m(2.4, 'The high mountains are still in winter conditions.'),
      m(6.4, 'The expedition season is beginning — teams are arriving at base camps and starting acclimatization.'),
      m(10, 'Peak season — summit windows open in July on Nanga Parbat and by late July on K2, though weather, wind, and rockfall still close many attempts.'),
      m(8.6, 'The tail of the season — K2’s window runs into early August, with permit issuance ending around the start of the month.'),
      m(2.8, 'The season is over as autumn snow returns.'),
      m(1.4, 'Autumn snow and cold end the season.'),
      m(0.8, PAK_WINTER), m(0.8, PAK_WINTER),
    ],
  },
  ladakh: {
    overview: 'A gateway to non-technical and lightly technical trekking peaks — Kang Yatse II (6,250m) is a crampons-and-axe walk-up — with 7,000m Nun Kun via Kargil for real expeditions. Peaks above 6,000m need Indian Mountaineering Foundation clearance, and Stok Kangri, the region’s best-known peak, is reported closed to expeditions since a December 2023 order.',
    months: [
      m(0.8, LAD_WINTER), m(0.8, LAD_WINTER), m(0.8, LAD_WINTER), m(0.8, LAD_WINTER),
      m(2.2, 'Snow still blocks the high passes; the trekking-peak season hasn’t started.'),
      m(4.6, 'The season begins by mid-month, though snow lingers on the upper slopes.'),
      m(6.4, LAD_PEAK), m(6.4, LAD_PEAK),
      m(6.0, 'Still in season, with the window closing by month’s end.'),
      m(2.4, 'The season is over as snow returns to the high country.'),
      m(0.8, LAD_WINTER), m(0.8, LAD_WINTER),
    ],
  },
  kyrgyzstan: {
    overview: 'Central Asia’s big-range mountaineering — Lenin Peak (7,134m) is one of the least technical 7,000m peaks, and Khan Tengri (7,010m) is a serious objective reached by helicopter. The season runs late June to early September, Lenin Peak and Inylchek need a border-zone permit, and Ala-Archa near Bishkek offers more accessible alpine climbing.',
    months: [
      m(1.6, KYR_WINTER), m(1.6, KYR_WINTER), m(1.6, KYR_WINTER), m(1.6, KYR_WINTER),
      m(3.0, 'Spring — snow is retreating in the lower ranges, but the big peaks are still in winter.'),
      m(6.4, 'Late June begins Lenin Peak’s season, though the upper mountain is still snowy.'),
      m(9.0, KYR_PEAK), m(9.0, KYR_PEAK),
      m(5.8, 'The season ends in early September.'),
      m(2.4, 'Winter is returning and the high peaks are closed.'),
      m(1.6, KYR_WINTER), m(1.6, KYR_WINTER),
    ],
  },
  taiwan: {
    overview: 'Longdong on the northeast coast is the country’s premier crag — about 600 sport and trad routes on sandstone and quartzite — while Yushan (3,952m) and Xueshan are high-mountain hikes with a winter alpine season. Mountain entry needs a park permit and a police entry permit, allocated by lottery for popular lodges.',
    months: [
      m(4.2, 'Winter alpine season on Yushan and Xueshan — snow training, crampons, and small group sizes are required.'),
      m(4.2, 'Winter alpine season on Yushan and Xueshan — snow training, crampons, and small group sizes are required.'),
      m(4.2, 'Winter alpine season on Yushan and Xueshan — snow training, crampons, and small group sizes are required.'),
      m(5.4, 'Spring — the snow has cleared and the high-mountain hiking season is under way.'),
      m(6.0, 'Late spring — the best high-mountain conditions of the year, before typhoon season.'),
      m(6.0, 'Late spring — the best high-mountain conditions of the year, before typhoon season.'),
      m(3.4, TW_TYPHOON), m(3.4, TW_TYPHOON), m(3.4, TW_TYPHOON),
      m(5.8, 'Typhoon season is ending and the mountains return to good conditions.'),
      m(5.2, 'Cooler and clearer, with the winter snow season not far off.'),
      m(3.8, 'The winter alpine season begins in mid-December, with snow training required.'),
    ],
  },
  hokkaido: {
    overview: 'Daisetsuzan’s volcanic peaks offer summer alpine walking and real winter and spring mountaineering and ski touring, though the altitudes are modest. The snow melts in June and returns in late September; clearer spring days run mid-March to early May, while deep winter brings low visibility and high winds.',
    months: [
      m(3.2, HOK_WINTER), m(3.2, HOK_WINTER),
      m(4.8, 'Clearer days begin in mid-March, opening the spring mountaineering and ski-touring season.'),
      m(5.0, 'Spring — the best window for winter-style mountaineering on Daisetsuzan.'),
      m(4.6, 'The spring window is closing as snow starts to melt at lower elevations.'),
      m(3.8, 'The snow melts and conditions are in transition.'),
      m(4.0, 'Summer alpine walking on the volcanic peaks — scenic, but not technical.'),
      m(4.0, 'Summer alpine walking on the volcanic peaks — scenic, but not technical.'),
      m(3.8, 'Snow returns to the high peaks by late month.'),
      m(3.0, 'Early winter — snow is building and conditions turn serious.'),
      m(3.0, 'Early winter — snow is building and conditions turn serious.'),
      m(3.2, HOK_WINTER),
    ],
  },
  uganda: {
    overview: 'The Rwenzori Mountains — the “Mountains of the Moon” — offer a genuine equatorial glacier expedition to Margherita Peak (5,109m), with crampons, fixed lines, and compulsory guides and porters. It’s a week-long trek-and-climb rather than a quick objective, with two dry seasons: a longer one from June to August and a shorter one from December to February.',
    months: [
      m(6.0, UG_SHORT_DRY), m(6.0, UG_SHORT_DRY),
      m(2.4, UG_WET), m(2.4, UG_WET), m(2.4, UG_WET),
      m(7.2, UG_LONG_DRY), m(7.2, UG_LONG_DRY), m(7.2, UG_LONG_DRY),
      m(3.4, 'The dry season ends as the rains return.'),
      m(2.4, UG_WET), m(2.4, UG_WET),
      m(6.0, UG_SHORT_DRY),
    ],
  },
  morocco: {
    overview: 'The Atlas offers three different draws: Taghia’s limestone walls, up to 800m and world-class multi-pitch climbing, a 5–6 hour 4x4 drive from Marrakech plus a walk-in; Todra Gorge’s roughly 400 routes far to the east; and Toubkal (4,167m), a winter crampons-and-axe ascent with ski touring in season. Rock seasons are April–May and September–October.',
    months: [
      m(5.0, MOR_WINTER), m(5.0, MOR_WINTER),
      m(5.8, 'Late-winter ski touring on Toubkal continues, and the lower Todra routes come into season.'),
      m(7.6, MOR_SPRING), m(7.6, MOR_SPRING),
      m(4.0, 'Summer heat and storms end the rock season; Toubkal becomes a non-technical trek.'),
      m(3.2, MOR_SUMMER), m(3.2, MOR_SUMMER),
      m(7.4, 'The autumn rock season begins at Taghia and Todra.'),
      m(7.6, 'Still prime, though snow is possible late in the month.'),
      m(4.4, 'Cooler weather ends the rock season, and the first snow can arrive on the high Atlas.'),
      m(5.0, MOR_WINTER),
    ],
  },
  queenstown: {
    overview: 'The base for New Zealand’s most accessible guided alpine climbing — Mount Aspiring, reached from Wanaka, is the classic objective, with summer glacier climbs and winter ice and mixed climbing in the Remarkables. Aoraki/Mount Cook, the country’s best-known peak, is a long way north.',
    months: [
      m(8.5, QT_SUMMER), m(8.5, QT_SUMMER),
      m(7.4, 'Late summer — still in season, though days are shortening.'),
      m(4.6, 'Autumn — the summer season is over and winter conditions haven’t arrived.'),
      m(3.6, 'Between seasons — cold and unsettled.'),
      m(5.4, 'Winter ice and mixed climbing begins in the Remarkables.'),
      m(6.6, QT_WINTER), m(6.6, QT_WINTER),
      m(4.8, 'Spring — the winter season is ending, and avalanche hazard makes the alpine unreliable.'),
      m(4.6, 'Spring snow and avalanche hazard keep the alpine unreliable.'),
      m(7.6, 'The summer alpine season opens, with guided Mount Aspiring ascents from Wanaka.'),
      m(8.2, 'The summer alpine season is well under way.'),
    ],
  },
  'milford-sound-fiordland': {
    overview: 'The Darran Mountains along the Milford Road hold some of New Zealand’s best alpine rock — Mitre Peak, Mount Madeline, and Sabre’s North Buttress — but it’s remote, weather-dependent climbing based from the Homer Hut. Guided trips run January to April; this is one of the wettest places on Earth, and the Milford Road can close for avalanche control in winter.',
    months: [
      m(8.2, MIL_GUIDED), m(8.2, MIL_GUIDED),
      m(7.6, 'Still in guided season, though the days are shortening.'),
      m(5.4, 'The guided season is ending as autumn arrives.'),
      m(1.4, MIL_WINTER), m(1.4, MIL_WINTER), m(1.4, MIL_WINTER), m(1.4, MIL_WINTER),
      m(2.0, 'Late winter — avalanche danger remains, and the road can close for avalanche control.'),
      m(3.0, 'Spring — snow is retreating, but avalanche danger and unsettled weather persist.'),
      m(4.6, 'The summer season is getting started, though the guided season hasn’t begun.'),
      m(6.4, 'Early summer — conditions are improving ahead of the guided season.'),
    ],
  },
  iceland: {
    overview: 'Hvannadalshnúkur (2,110m), Iceland’s highest peak, is a crevassed glacier climb of 12–15 hours — not technical, but serious, and best from mid-April to mid-July. Ice climbing runs from late October to May, and rock climbing is limited to basalt columns in the warmer months.',
    months: [
      m(3.6, ICE_ICE), m(3.6, ICE_ICE),
      m(4.6, 'Ski ascents of Hvannadalshnúkur begin by mid-month, and the ice season continues with lengthening days.'),
      m(6.2, 'The main Hvannadalshnúkur season opens from mid-month.'),
      m(6.4, ICE_PEAK), m(6.4, ICE_PEAK),
      m(5.0, 'The season is ending as warm weather weakens the snow bridges over the crevasses.'),
      m(3.2, 'The glacier is more crevassed and the season for the big climb has ended; rock climbing on basalt is possible.'),
      m(3.0, 'Cooler weather returns; rock climbing continues at low elevations, but the glacier season is over.'),
      m(2.8, 'The ice season begins late in the month.'),
      m(3.6, ICE_ICE), m(3.6, ICE_ICE),
    ],
  },
  svalbard: {
    overview: 'Not technical rock climbing but a serious polar ski-mountaineering destination — Newtontoppen (1,713m), the highest point, needs no climbing experience, while Perriertoppen is steeper and uses crampons. Late April and May, with the midnight sun arriving around 20 April, are the signature months; travel outside the settlements requires a polar-bear rifle.',
    months: [
      m(0.6, SVAL_POLAR),
      m(2.2, 'The light is returning, but days are still very short.'),
      m(4.4, 'Ski-touring season opens — the most versatile stretch begins.'),
      m(4.8, 'Prime ski-mountaineering season, with the midnight sun arriving around 20 April.'),
      m(5.0, 'The signature ski-mountaineering season under the midnight sun.'),
      m(3.4, 'The ski-and-sail season, though skiing down to sea level gets less reliable.'),
      m(1.6, 'Summer — the snow melts out and the ski-mountaineering season is over.'),
      m(1.6, 'Summer — the snow melts out and the ski-mountaineering season is over.'),
      m(1.0, SVAL_OFF), m(1.0, SVAL_OFF),
      m(0.6, SVAL_POLAR), m(0.6, SVAL_POLAR),
    ],
  },
  'faroe-islands': {
    overview: 'Minor and niche — a small, growing sport-climbing scene and a few celebrated sea stacks like Risin and Kellingin, and Drangarnir can only be reached with a guide. Weather is famously unpredictable, with fog and wind closing things on short notice, and puffins nest on the cliffs roughly May to August.',
    months: [
      m(1.4, FAR_WINTER), m(1.4, FAR_WINTER), m(1.4, FAR_WINTER),
      m(2.4, 'Spring begins, though the weather remains unpredictable.'),
      m(3.6, FAR_SEASON), m(3.6, FAR_SEASON), m(3.6, FAR_SEASON), m(3.6, FAR_SEASON),
      m(2.8, 'Autumn — the days shorten and storms increase.'),
      m(2.0, 'The days are short and storms are frequent.'),
      m(1.4, FAR_WINTER), m(1.4, FAR_WINTER),
    ],
  },
  madeira: {
    overview: 'Minor — about 27 catalogued crags, mostly sport routes on São Lourenço, plus bouldering near Funchal and deep-water soloing; there’s no topo guide or via ferrata, and Pico Ruivo (1,861m) is a hike, not a climb. Climbing is possible in winter, spring, and autumn, with summer better for deep-water soloing.',
    months: [
      m(3.2, MAD_MILD), m(3.2, MAD_MILD), m(3.2, MAD_MILD),
      m(3.4, MAD_SPRING), m(3.4, MAD_SPRING),
      m(3.0, MAD_SUMMER), m(3.0, MAD_SUMMER), m(3.0, MAD_SUMMER),
      m(3.4, MAD_AUTUMN), m(3.4, MAD_AUTUMN),
      m(3.2, MAD_MILD), m(3.2, MAD_MILD),
    ],
  },
  sedona: {
    overview: 'Sandstone spires and buttes with 600+ documented routes, but the rock is often soft and route quality inconsistent — regional climbing that’s more popular for scrambling on Cathedral Rock. Wet sandstone breaks, so climbers avoid it during and after rain; summer regularly tops 100°F, and spring and fall are best.',
    months: [
      m(4.2, SED_COOL), m(4.2, SED_COOL),
      m(5.4, 'Spring — mild temperatures and the best conditions of the year.'),
      m(5.4, 'Spring — mild temperatures and the best conditions of the year.'),
      m(4.6, 'Warming quickly toward summer heat.'),
      m(1.6, SED_SUMMER), m(1.6, SED_SUMMER), m(1.6, SED_SUMMER),
      m(3.8, 'The heat is easing but is still a limiter.'),
      m(5.2, 'Fall — mild temperatures return, along with the biggest crowds.'),
      m(4.6, 'Cooling weather, with dry days still workable.'),
      m(4.2, SED_COOL),
    ],
  },
  'zion-bryce': {
    overview: 'Zion’s sandstone big walls — Moonlight Buttress, Spaceshot, and Prodigal Son — are national-class, arguably world-class for desert climbing, with multi-day routes needing a bivouac permit; Bryce prohibits climbing the hoodoos. Spring and fall are best, and peregrine nesting closes some cliffs from March through July.',
    months: [
      m(3.4, ZION_WINTER), m(3.4, ZION_WINTER),
      m(7.0, 'Spring — the season opens, with peregrine closures starting on some cliffs.'),
      m(8.4, 'Prime spring conditions, though nesting closures are in place on some cliffs.'),
      m(5.6, 'The valley is already hot by May, ending the comfortable season.'),
      m(1.6, ZION_SUMMER), m(1.6, ZION_SUMMER), m(1.6, ZION_SUMMER),
      m(5.6, 'The heat begins to ease.'),
      m(8.4, 'Prime fall conditions.'),
      m(6.8, 'Still good, though days are short and cold.'),
      m(3.4, ZION_WINTER),
    ],
  },
};

runBatch(ENTRIES);
