import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 10: North American rock and alpine at destinations that
// were NA for the interest (NA cleared). Research this session: the Gunks (Mohonk
// Preserve, ~1,370 mostly trad routes on quartz conglomerate; best Sep-Oct; parts
// of the Trapps close from 1 Feb for peregrines, lifted 13 May in 2026); Indian
// Creek (~55 min south of Moab) and Castleton Tower (~30 min), peak late Sep to
// mid-Nov, BLM raptor avoidance 1 Feb-31 Jul is a request not a legal closure;
// Smith Rock (1,496 routes, ~35 min from Bend, raptor closures ~Feb-Aug, all lifted
// 18 Jul in 2026); Squamish (2,863 climbs, ~45 min from Whistler, reliable
// mid-Jun to mid-Sep, May/Oct can be drenched, small guide-oriented ice scene
// Dec-Mar); Custer State Park Needles (775 routes) and Devils Tower (107 mi from
// Rapid City, voluntary June closure since 1996); Mt Whitney's Mountaineer's
// Route (snow best late May-early Jul, dry scrambling Jul-Oct) is reached from
// Lone Pine, 282 miles / ~6.5 h from the parks because no road crosses the crest.
const GK_WINTER = 'Winter — cold, with short days; only mild days are climbable.';
const GK_AUTUMN = 'Prime autumn — cool, drier air, and all cliffs open.';
const GK_SUMMER = 'Summer — hot and humid; early mornings and shaded cliffs work best.';
const MOAB_WINTER = 'Winter — cold, though sunny days suit the Indian Creek cracks.';
const MOAB_SUMMER = 'Summer — very hot, and climbing is impractical.';
const SMITH_PRIME = 'Prime season — mild and dry, with some raptor closures possibly still in place.';
const SMITH_HOT = 'Hot — over 100°F in the sun, so shade and early mornings only.';
const SMITH_AUTUMN = 'Prime autumn — cooler, dry weather with all areas open.';
const SQ_PEAK = 'Peak season — the driest, most reliable weather, with the Chief, the Smoke Bluffs, and Murrin Park all in condition.';
const SQ_WINTER = 'Winter — cold and wet, though a small, guide-oriented ice-climbing scene runs from December to March.';
const BH_WINTER = 'Winter — cold and snowy, and climbing is limited.';
const BH_SUMMER = 'Summer — warm to hot, with early mornings best.';
const SIE_WINTER = 'Winter — deep snow and avalanche hazard put the high peaks out of reach for all but winter mountaineers.';

const ENTRIES: Record<string, Entry> = {
  'hudson-valley': {
    overview: 'The Shawangunks (the Gunks), at Mohonk Preserve near New Paltz, are the classic East Coast trad cliff — more than a thousand routes on quartz-conglomerate roofs and jugs, from beginner to hard. A day pass is required. September and October are best; parts of the Trapps close for peregrine nesting from February until spring.',
    months: [
      m(2.6, GK_WINTER),
      m(2.8, 'Still cold, and parts of the Trapps close from 1 February for peregrine nesting.'),
      m(4.2, 'Thawing, with muddy approaches and the peregrine closure still in place on parts of the Trapps.'),
      m(6.0, 'Spring — cool days are workable, though the peregrine closure is still in place on parts of the Trapps.'),
      m(7.6, 'Prime spring — most cliffs are open, and the peregrine closure typically lifts in May or June.'),
      m(6.8, 'Warm, with the peregrine closure lifted and humidity building.'),
      m(5.2, GK_SUMMER), m(5.2, GK_SUMMER),
      m(9.0, GK_AUTUMN), m(9.0, GK_AUTUMN),
      m(6.6, 'Late autumn — cool and crisp, with short days.'),
      m(2.6, GK_WINTER),
    ],
  },
  'arches-canyonlands': {
    overview: 'Moab is the gateway to desert-tower and sandstone crack climbing — Indian Creek, about 55 minutes south, is the benchmark for splitter cracks, and Castleton Tower, about 30 minutes out, is one of the most famous desert towers. Late September to mid-November is peak; summer is too hot, and Indian Creek asks climbers to avoid raptor-nesting walls until early summer.',
    months: [
      m(5.0, MOAB_WINTER),
      m(5.2, 'Late winter — cold, with raptor-avoidance areas beginning at Indian Creek.'),
      m(7.4, 'Spring — mild and quieter, though some Indian Creek walls are still under raptor avoidance.'),
      m(8.2, 'Prime spring — mild and less crowded, with cleared Indian Creek walls reopening by late April or May.'),
      m(7.0, 'Late spring — warm, with all cleared walls open, but afternoons are heating.'),
      m(3.6, 'Getting hot — climbing is limited to early mornings and shade.'),
      m(2.4, MOAB_SUMMER), m(2.4, MOAB_SUMMER),
      m(7.6, 'Cooling — the fall season starts by late September.'),
      m(9.3, 'Peak season — cool, stable weather, though October can be the wettest month.'),
      m(8.4, 'Peak season lasts until about mid-month, then the cold arrives.'),
      m(5.0, MOAB_WINTER),
    ],
  },
  'bend-crater-lake': {
    overview: 'Smith Rock, about 35 minutes from Bend, has nearly 1,500 mostly sport routes on volcanic tuff, plus the Monkey Face spire — one of the best-known sport-climbing areas in the US. Spring and fall are best; summer is very hot, and raptor closures run roughly February to early summer. Crater Lake, two hours away, is not a climbing destination.',
    months: [
      m(4.6, 'Winter — cold, though dry days are climbable.'),
      m(4.4, 'Late winter — cold, with raptor closures beginning on parts of the park.'),
      m(6.8, 'Spring — the season is building, though some raptor closures remain in place.'),
      m(8.0, SMITH_PRIME), m(8.0, SMITH_PRIME),
      m(6.4, 'Warming, with some closures possibly still in place.'),
      m(4.0, SMITH_HOT), m(4.0, SMITH_HOT),
      m(8.6, SMITH_AUTUMN), m(8.6, SMITH_AUTUMN),
      m(6.0, 'Cool, with short days.'),
      m(4.6, 'Winter — cold, though dry days are climbable.'),
    ],
  },
  whistler: {
    overview: 'Squamish, about 45 minutes south of Whistler, is a world-class granite trad and sport area — nearly 3,000 routes, including the Stawamus Chief’s 900-plus, and bouldering. Mid-June to mid-September is the reliable window; May and October can be drenched, and winter brings a small, guide-oriented ice scene.',
    months: [
      m(2.6, SQ_WINTER), m(2.6, SQ_WINTER),
      m(2.6, 'Late winter — cold and wet, with the ice season ending.'),
      m(3.2, 'Cool and wet.'),
      m(4.4, 'Wet and unsettled — some good days, but rain is frequent.'),
      m(7.6, 'The season begins by mid-June, though early-month rain is still possible.'),
      m(9.3, SQ_PEAK), m(9.3, SQ_PEAK),
      m(7.4, 'Reliable early in the month, with rain returning by mid-month.'),
      m(4.0, 'Wet — days can be drenched, though dry windows occur.'),
      m(2.4, 'Wet and dark.'),
      m(2.6, SQ_WINTER),
    ],
  },
  'badlands-black-hills': {
    overview: 'Custer State Park’s Needles offer bold granite face and crack climbing — several hundred routes under a purist, few-bolts ethic — while Devils Tower’s columns are a nationally famous trad objective, though about 107 miles from Rapid City. The Badlands themselves are not a climbing area. Late spring to early fall is the season.',
    months: [
      m(1.8, BH_WINTER), m(1.8, BH_WINTER),
      m(2.0, 'Late winter — still cold, with only occasional mild days.'),
      m(4.0, 'Spring — cool, with raptor-related route closures possible at Devils Tower.'),
      m(5.4, 'Late spring — warming, with falcon-related route closures possible at Devils Tower.'),
      m(5.6, 'Good weather, though Devils Tower has a voluntary climbing closure for the month (a request, not a legal closure).'),
      m(6.0, BH_SUMMER), m(6.0, BH_SUMMER),
      m(6.8, 'Prime early autumn — cooler, stable weather with all areas open.'),
      m(5.4, 'Autumn — cooler, with the season winding down as cold arrives.'),
      m(2.6, 'Cold, with short days.'),
      m(1.8, BH_WINTER),
    ],
  },
  'sequoia-kings-canyon': {
    overview: 'High Sierra alpine mountaineering rather than crag climbing — the Mountaineer’s Route on Mount Whitney, a snow gully best in late May to early July, is reached from Lone Pine on the east side, a full day’s drive (about 282 miles) from the parks because no road crosses the crest. The Palisades open mid-July. A Whitney Zone permit is required.',
    months: [
      m(1.8, SIE_WINTER), m(1.8, SIE_WINTER), m(1.8, SIE_WINTER),
      m(2.6, 'Spring snow, with the Whitney Portal road typically opening around early May.'),
      m(5.4, 'Late spring — snow-climbing season begins on Whitney’s Mountaineer’s Route.'),
      m(6.8, 'Snow-season mountaineering on Whitney’s Mountaineer’s Route, with the road open.'),
      m(6.6, 'The snow is melting, so Whitney becomes dry scrambling and the Palisades season opens mid-month.'),
      m(6.6, 'Peak alpine season, though rockfall is common in the Palisades in late July and August.'),
      m(6.8, 'Settled, dry alpine weather with the Palisades season still on.'),
      m(4.6, 'Late season — colder, with dry scrambling on Whitney and the road open until November.'),
      m(2.0, 'The road closes and snow arrives.'),
      m(1.8, SIE_WINTER),
    ],
  },
};

runBatch(ENTRIES, { clearNA: Object.keys(ENTRIES) });
