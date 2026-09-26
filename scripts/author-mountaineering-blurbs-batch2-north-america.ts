import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 2: western North America. Research this session:
// Denali season ~May 1-Jul 15 (best mid-May to late June, registration 60 days
// ahead, ski plane from Talkeetna); Yosemite Valley best Apr-May and late
// Sep-mid Nov, Tuolumne in summer, peregrine closures Mar 1-mid Jul on <=5% of
// routes; North Cascades thin glaciers melt out fast and Hwy 20 closes each
// winter (median reopening May 12); Rocky Mountain's Keyhole/Diamond are
// snow-free only ~mid Jul-mid Sep; Banff is ice mid-Nov to May with a summer
// scramble season; Aspen's 14ers are loose-rock class 3-5; Glacier is remote,
// loose sedimentary rock (Mountain Project: not a popular climbing destination).
const DEN_WINTER = 'Winter — extreme cold and very short days; not a realistic climbing season.';
const DEN_OFF = 'Outside the climbing season.';
const YOS_WINTER = 'Winter — cold, short days, and wet weather limit climbing in the Valley, though sunny stretches are workable.';
const YOS_PRIME = 'Prime Valley season — mild temperatures on the big walls, though nesting closures remain in place on a few routes.';
const YOS_SUMMER = 'The Valley is too hot for the big walls; Tuolumne’s high-country domes are the summer objective.';
const NCAS_WINTER = 'Winter — heavy snow, with Highway 20 closed for the season.';
const RMNP_WINTER = 'Winter — the high peaks demand serious snow and ice skills, and the lower crags are cold.';
const BANFF_ICE = 'Prime ice season — cold, stable conditions on the waterfalls.';
const ASPEN_WINTER = 'Winter — heavy snow and avalanche terrain close the high peaks.';
const GLAC_WINTER = 'Winter — the high country is snowbound and the Going-to-the-Sun Road is closed.';

const ENTRIES: Record<string, Entry> = {
  'denali-interior': {
    overview: 'The highest peak in North America (6,190m) and one of the world’s great big-mountain objectives, reached by ski plane from Talkeetna. The West Buttress accounts for most attempts and takes roughly two to three weeks; the season runs from about May to mid-July, best from mid-May to late June, and registration is required at least 60 days ahead.',
    months: [
      m(0.8, DEN_WINTER), m(0.8, DEN_WINTER), m(0.8, DEN_WINTER),
      m(3.4, 'The Alaska Range season is beginning, though it’s still very cold.'),
      m(9.3, 'The season is in full swing, and the prime window starts by mid-month.'),
      m(9.8, 'Peak season — the best window on the West Buttress, running through late June, and the busiest traffic.'),
      m(6.4, 'The season is winding down — the park’s climbing window closes around mid-July.'),
      m(1.4, DEN_OFF), m(1.4, DEN_OFF), m(1.4, DEN_OFF),
      m(0.8, DEN_WINTER), m(0.8, DEN_WINTER),
    ],
  },
  yosemite: {
    overview: 'The world’s most famous granite climbing area — the big walls of El Capitan and Half Dome, plus the domes and cracks of Tuolumne. The Valley is best in spring and fall, the high country in summer; peregrine falcon nesting closes a small share of routes from March through mid-July. Overnight wall climbs need a free, self-registered wilderness permit.',
    months: [
      m(3.8, YOS_WINTER),
      m(4.6, 'Late winter — sunny days in the Valley are increasingly workable, though it’s still cold and the Tioga Road is closed.'),
      m(6.4, 'Spring begins — the Valley warms and dries out, and peregrine nesting closures start on a handful of routes.'),
      m(10, YOS_PRIME), m(10, YOS_PRIME),
      m(7.4, 'The Valley is getting hot, but the high-country domes at Tuolumne are coming into season.'),
      m(6.6, YOS_SUMMER), m(6.6, YOS_SUMMER),
      m(8.6, 'The heat is easing and the Valley is coming back into season, with Tuolumne still workable.'),
      m(9.7, 'Prime Valley season, with cool weather and the Tioga Road closing for winter by late in the month.'),
      m(8.4, 'Still good, though days are short and the Tioga Road is closed.'),
      m(3.8, YOS_WINTER),
    ],
  },
  'north-cascades': {
    overview: 'Steep, glaciated alpine climbing — Mount Shuksan, Forbidden Peak, and Eldorado are the classic objectives, technical but not extreme, with approaches that take days. The thin glaciers melt out quickly, so the window is short, and Highway 20 across the park is closed each winter. Overnight climbs need a backcountry permit.',
    months: [
      m(1.6, NCAS_WINTER), m(1.6, NCAS_WINTER), m(1.6, NCAS_WINTER),
      m(2.4, 'Still winter in the high country; Highway 20 hasn’t reopened.'),
      m(3.6, 'Highway 20 reopens (mid-May in a typical year), but the high country is still snowbound and the glaciers carry deep snow.'),
      m(5.6, 'Snow is retreating, though much of the alpine terrain is still in winter condition.'),
      m(7.6, 'The alpine season is under way as the glaciers begin to melt out.'),
      m(8.0, 'Peak season — the glaciers are melting out and the classic routes are in prime condition, though the window is short.'),
      m(7.2, 'Still workable, though thin glaciers are more crevassed and shortening days narrow the window.'),
      m(3.2, 'The season is over; early snow returns to the high country.'),
      m(1.9, 'Winter is returning; Highway 20 closes for the season in late November or early December.'),
      m(1.6, NCAS_WINTER),
    ],
  },
  'rocky-mountain': {
    overview: 'Longs Peak is the headline — the Keyhole route is a class 3 scramble with fatal exposure, and the Diamond, its big east face, is a world-famous wall. Both are snow-free only from about mid-July to mid-September, and Lumpy Ridge, the main crag, has annual raptor closures through July.',
    months: [
      m(2.8, RMNP_WINTER), m(2.8, RMNP_WINTER), m(2.8, RMNP_WINTER),
      m(3.4, 'Still winter conditions on the high peaks, though the lower crags begin to open up.'),
      m(4.2, 'Snow still covers the high routes; Lumpy Ridge is open, but raptor closures apply.'),
      m(5.6, 'Snow is slowly retreating from the high routes; Lumpy Ridge nesting closures continue.'),
      m(7.8, 'The Keyhole route comes into condition by mid-month, and the Diamond opens up.'),
      m(8.2, 'Peak season — the Keyhole route and the Diamond are in their free season, with afternoon thunderstorms the main hazard.'),
      m(7.6, 'Still in season through mid-month, though fresh snow becomes a risk late in the month.'),
      m(3.8, 'Snow returns to the high routes and the season is ending.'),
      m(2.8, RMNP_WINTER), m(2.8, RMNP_WINTER),
    ],
  },
  banff: {
    overview: 'Best known for ice — routes from roadside cragging to 2,000-foot WI6 lines — with a season from mid-November into May, plus a summer scrambling and alpine season. The rock is often loose limestone, so most climbers come for the ice; Canmore, not Banff town, is the real climbing hub.',
    months: [
      m(7.8, BANFF_ICE), m(7.8, BANFF_ICE),
      m(7.4, 'Still a good ice season, though sun and warming days start to affect lower-elevation routes.'),
      m(5.4, 'Ice is thinning as temperatures rise, and the high-alpine terrain is still snowbound.'),
      m(3.2, 'The ice season is ending; the high terrain is still snowbound.'),
      m(3.8, 'Snow is retreating from the lower terrain, but the classic summer objectives aren’t yet in condition.'),
      m(6.6, 'The summer scrambling season opens — Mount Temple’s southwest ridge comes into condition by mid-July.'),
      m(7.0, 'Peak summer season for scrambles and alpine objectives.'),
      m(6.4, 'Still in season, though days are shortening and the first snow is possible.'),
      m(3.6, 'Between seasons — too early for ice, and the summer terrain has ended.'),
      m(6.0, 'The ice season is opening as the waterfalls start to form.'),
      m(7.0, 'Ice is coming into condition, though it’s still building on the bigger routes.'),
    ],
  },
  aspen: {
    overview: 'Scrambling and alpine climbing on the Elk Mountains’ 14,000-foot peaks — Pyramid Peak (class 4), Capitol Peak’s Knife Edge (class 4), and the Maroon Bells traverse (low class 5) — known more for loose, dangerous rock than for technical difficulty. The summer season is short, and Maroon Creek Road is closed to cars in winter.',
    months: [
      m(1.4, ASPEN_WINTER), m(1.4, ASPEN_WINTER), m(1.4, ASPEN_WINTER),
      m(1.8, 'Still winter in the high country.'),
      m(2.4, 'Snow still covers the peaks, and Maroon Creek Road remains closed to cars until the end of the month.'),
      m(4.4, 'Pyramid Peak begins to come into condition, though much of the high country is still snowy.'),
      m(6.2, 'Peak season begins — Capitol Peak is in condition by mid-month, and the Maroon Bells road has daytime car restrictions.'),
      m(6.4, 'Peak season, with afternoon thunderstorms a daily hazard and loose rock the main danger on every route.'),
      m(6.0, 'Still in season, with the first snow possible late in the month.'),
      m(3.4, 'Snow is returning to the high peaks and the season is over.'),
      m(1.4, ASPEN_WINTER), m(1.4, ASPEN_WINTER),
    ],
  },
  'glacier-waterton': {
    overview: 'Remote alpine climbing on loose, sedimentary rock that’s hard to protect, with long approaches — regional at best, and not a destination climbers usually travel for. The window is summer only, roughly July through September, and the Going-to-the-Sun Road isn’t fully open until late June.',
    months: [
      m(1.0, GLAC_WINTER), m(1.0, GLAC_WINTER), m(1.0, GLAC_WINTER), m(1.0, GLAC_WINTER),
      m(1.6, 'Still snowbound in the high country.'),
      m(2.6, 'Snow is retreating, but the road isn’t fully open until late June and the high routes are still in winter condition.'),
      m(4.0, 'The alpine season begins — long approaches, loose rock, and remote objectives.'),
      m(4.4, 'Peak season for the park’s remote alpine objectives, with loose rock the main hazard.'),
      m(3.8, 'Still workable, though shortening days and early snow narrow the window.'),
      m(1.6, 'The season is over; the Going-to-the-Sun Road closes by mid-October.'),
      m(1.0, GLAC_WINTER), m(1.0, GLAC_WINTER),
    ],
  },
};

runBatch(ENTRIES);
