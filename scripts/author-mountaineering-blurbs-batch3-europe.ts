import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 3: Europe. Research this session: Zermatt's summer
// season is set by hut dates (Hornli Hut ~26 Jun-19 Sep 2026, Monte Rosa Hut
// ~19 Jun-19 Sep plus an 18 Mar-17 May ski-touring window); Dolomites huts open
// mid/late June-late Sep, July best for via ferrate; Scottish winter climbing
// runs Dec-Apr (most reliable Feb-Mar), Cuillin Ridge May-Sep; Snowdonia and
// Lake District winter conditions are sporadic; Lofoten prime mid-Jun to mid-Aug;
// Romsdalen (near Alesund) best late Jun-mid Sep; Kazbek Jun-Sep, Ushba mid-Jul
// to Aug. Fjords: the Troll Wall's current climbing status is conflicting in
// sources, so it is deliberately not named.
const ZER_WINTER = 'Winter — the summer alpine routes are closed; this is ski-touring and lift-served skiing season.';
const ZER_PEAK = 'Peak alpine season — the huts are open and the Matterhorn, Monte Rosa, and the classic four-thousanders are in condition, with afternoon thunderstorms the main hazard.';
const DOL_WINTER = 'Winter — the rock and via ferrata season is closed.';
const SCOT_WINTER_PEAK = 'Peak winter season — the most reliable conditions for ice and mixed climbing on the big mountains.';
const SCOT_SUMMER = 'Summer conditions on the Cuillin are workable, with midges and unsettled weather the main nuisances.';
const SNOW_WINTER = 'Winter climbing is sporadic — some years bring conditions on the higher cliffs, but they rarely last.';
const SNOW_LONGDAYS = 'Long days and good rock conditions, though Welsh weather can change fast.';
const SNOW_SUMMER = 'Summer — good for the mountain crags, though rain is never far away.';
const LAKE_WINTER = 'Winter — the crags are cold and wet, and snow-and-ice conditions on the high fells are erratic and short-lived.';
const LAKE_LONGDAYS = 'Long days and good climbing on the mountain crags, though the weather is changeable.';
const LAKE_SUMMER = 'Summer — Gimmer and the mountain crags are workable, though rain is frequent.';
const LOF_WINTER = 'Winter — polar darkness, snow, and storms close the rock and alpine season.';
const LOF_PRIME = 'Prime season — the midnight sun gives round-the-clock daylight for the classic routes.';
const FJ_WINTER = 'Winter — snow and short days close the alpine rock season.';
const GEO_WINTER = 'Winter — the high peaks are closed to summer mountaineering, but there is ice climbing near Stepantsminda.';
const GEO_PEAK = 'Peak season — Kazbek is in prime condition and Ushba’s short window opens in mid-July.';

const ENTRIES: Record<string, Entry> = {
  swissalps: {
    overview: 'The Matterhorn (4,478m) is the icon, but Zermatt gives access to 38 four-thousanders, from the easy Breithorn to Monte Rosa’s Dufourspitze (4,634m). The summer season is set by hut opening dates — the Hörnli Hut typically runs from late June to mid-September — and by afternoon storms; in spring, the Monte Rosa Hut supports a ski-touring window.',
    months: [
      m(3.0, ZER_WINTER), m(3.0, ZER_WINTER),
      m(4.6, 'Ski-touring season begins, with the Monte Rosa Hut opening around mid-March.'),
      m(4.9, 'Ski-touring season continues, with the Monte Rosa Hut open.'),
      m(4.4, 'The ski-touring window is closing, and the summer huts aren’t open yet.'),
      m(7.8, 'The summer huts are opening — Monte Rosa in mid-June and Hörnli by late June — but snow can still cover the routes.'),
      m(9.7, ZER_PEAK), m(9.7, ZER_PEAK),
      m(9.0, 'The huts close around 19 September; early-month conditions are still good, but fresh snow and shortening days narrow the window.'),
      m(3.4, 'The huts are closed and the high routes are shutting down for the year.'),
      m(3.0, ZER_WINTER), m(3.0, ZER_WINTER),
    ],
  },
  dolomites: {
    overview: 'World-class limestone — multi-pitch walls like the Tre Cime and a dense network of via ferrate; Cima Grande’s north face is one of the Alps’ six great north faces. The main season runs from mid-to-late June, when the huts open, to late September.',
    months: [
      m(2.0, DOL_WINTER), m(2.0, DOL_WINTER), m(2.0, DOL_WINTER),
      m(2.6, 'Still winter, with snow lingering at height.'),
      m(3.4, 'The snow is retreating, but the huts and high routes are mostly not yet open.'),
      m(6.8, 'The huts start opening in mid-to-late June, though some high ferrate routes are still snowbound.'),
      m(9.4, 'Peak — the huts are open and this is the best month for via ferrate, with most routes in condition.'),
      m(9.2, 'Peak season, with the huts open and most routes in condition, though afternoon storms are common.'),
      m(8.4, 'The huts close by late September; cooler and quieter, but still good climbing.'),
      m(4.0, 'Colder and quieter; the huts are closed and the season is over for all but the hardiest.'),
      m(2.0, DOL_WINTER), m(2.0, DOL_WINTER),
    ],
  },
  'scottish-highlands-skye': {
    overview: 'The UK’s top winter climbing — Ben Nevis’s gullies and ridges, graded from easy to extremely hard — plus the Cuillin Ridge on Skye, a 12km scrambling traverse. Winter runs roughly December to April, most reliable in February and March; the Cuillin’s season is May through September.',
    months: [
      m(7.6, 'The ice gullies begin coming into condition.'),
      m(8.6, SCOT_WINTER_PEAK), m(8.6, SCOT_WINTER_PEAK),
      m(6.6, 'The winter season is fading, though high routes can still be in condition.'),
      m(6.4, 'The Cuillin Ridge season opens, with the best weather windows from mid-May.'),
      m(6.6, 'Long days and good weather windows on the Cuillin Ridge, though midges are a nuisance from June.'),
      m(5.2, SCOT_SUMMER), m(5.2, SCOT_SUMMER),
      m(6.4, 'One of the best windows for the Cuillin Ridge, with the midges finished.'),
      m(3.6, 'Between seasons — the first snow is possible, but conditions are unreliable.'),
      m(3.4, 'Winter is starting, though it’s rarely in condition yet.'),
      m(5.4, 'Early winter — conditions are patchy and the days are very short.'),
    ],
  },
  snowdonia: {
    overview: 'Classic British mountain trad — Tryfan, Llanberis Pass, and the slate quarries at Dinorwic, with Clogwyn Du’r Arddu (Cloggy) as the serious cliff. Rock climbing runs mainly spring through autumn in a wet, changeable climate; winter climbing is possible in most years but sporadic and short-lived, and Scotland is far more reliable.',
    months: [
      m(3.0, SNOW_WINTER), m(3.0, SNOW_WINTER),
      m(4.6, 'The spring rock season begins as the crags start to dry.'),
      m(5.6, 'Spring — the crags are drying and the rock season is well under way.'),
      m(6.0, SNOW_LONGDAYS), m(6.0, SNOW_LONGDAYS),
      m(5.4, SNOW_SUMMER), m(5.4, SNOW_SUMMER),
      m(5.8, 'Autumn — settled spells are possible, but days are shortening.'),
      m(4.4, 'Days are short and the crags are getting wetter.'),
      m(3.2, 'Winter is approaching; the crags are wet and the days short.'),
      m(3.0, SNOW_WINTER),
    ],
  },
  'lake-district': {
    overview: 'The birthplace of British traditional climbing — Scafell’s East Buttress and Gimmer Crag are the classic mountain crags, with Langdale’s south-facing rock climbable most of the year. It’s national-class trad heritage rather than a mountaineering destination; winter conditions on Helvellyn and Great End are erratic and short.',
    months: [
      m(3.0, LAKE_WINTER), m(3.0, LAKE_WINTER),
      m(4.2, 'Spring begins and the south-facing crags in Langdale start to dry.'),
      m(5.0, 'Spring — the mountain crags are coming into season, though the weather is changeable.'),
      m(5.4, LAKE_LONGDAYS), m(5.4, LAKE_LONGDAYS),
      m(5.0, LAKE_SUMMER), m(5.0, LAKE_SUMMER),
      m(5.2, 'Autumn — settled spells are possible on the mountain crags, but days are shortening.'),
      m(4.0, 'Days are short and the crags are getting wetter.'),
      m(3.4, 'Winter is approaching; the crags are cold and wet.'),
      m(3.0, LAKE_WINTER),
    ],
  },
  lofoten: {
    overview: 'Sea-cliff granite and alpine ridges with midnight-sun climbing — Svolværgeita, “the Goat”, is a half-day classic and Vågakallen’s north ridge is the region’s top alpine route. The season runs from May to September, with the best conditions from mid-June to mid-August.',
    months: [
      m(1.4, LOF_WINTER), m(1.4, LOF_WINTER), m(1.4, LOF_WINTER),
      m(3.0, 'Early season — Svolværgeita is sometimes climbable on good days.'),
      m(5.4, 'The season opens as snow retreats and the days grow long.'),
      m(6.8, LOF_PRIME), m(6.8, LOF_PRIME),
      m(6.2, 'Still good through mid-month, with nights getting darker and weather turning more changeable.'),
      m(4.6, 'The season is winding down — days shorten quickly and the weather worsens.'),
      m(2.6, 'Svolværgeita is sometimes climbable on good days, but the season is essentially over.'),
      m(1.4, LOF_WINTER), m(1.4, LOF_WINTER),
    ],
  },
  fjords: {
    overview: 'The fjord country’s real climbing is inland — Romsdalen near Ålesund, home to Romsdalshorn’s north face, and the Hurrungane peaks at the head of the Sognefjord. It’s national-class alpine rock that most fjord visitors never touch, and the season is short, roughly late June to mid-September.',
    months: [
      m(1.2, FJ_WINTER), m(1.2, FJ_WINTER), m(1.2, FJ_WINTER),
      m(1.8, 'Still winter in the high country.'),
      m(2.8, 'Snow is retreating in the valleys, but the high routes are still snowbound.'),
      m(5.0, 'Snow is clearing and the season begins by late month.'),
      m(5.6, 'Peak season — Romsdalshorn’s north face is in condition, along with the ridges of Hurrungane.'),
      m(5.8, 'Peak season, and the best month for the Hurrungane peaks.'),
      m(4.4, 'Still workable until mid-month, then shortening days and snow end the season.'),
      m(2.0, 'The season is over as snow returns.'),
      m(1.2, FJ_WINTER), m(1.2, FJ_WINTER),
    ],
  },
  'tbilisi-caucasus': {
    overview: 'Real glacier mountaineering — Kazbek (5,054m) is a moderately technical glacier climb from Stepantsminda, about three hours north of Tbilisi, and Ushba in Svaneti is a serious alpine wall. The summer season runs June to September, most popular in July and August; winter brings ice climbing at Gveleti.',
    months: [
      m(3.2, GEO_WINTER), m(3.2, GEO_WINTER), m(3.2, GEO_WINTER),
      m(3.4, 'Late winter — ice season continues, but the high routes are snowbound.'),
      m(3.6, 'The ice season is ending and snow still covers the high routes.'),
      m(6.2, 'Kazbek’s season begins, though snow lingers on the upper routes.'),
      m(8.0, GEO_PEAK), m(8.0, GEO_PEAK),
      m(6.6, 'Kazbek is still workable and Ushba is possible into late September, but the window is closing.'),
      m(3.6, 'The ice season opens near Stepantsminda; the summer routes are closed.'),
      m(3.2, GEO_WINTER), m(3.2, GEO_WINTER),
    ],
  },
};

runBatch(ENTRIES);
