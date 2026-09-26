import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 6: Thailand (Railay/Tonsai, Krabi). Flagged by the user as
// a real pure-climbing destination that the alpine-first survey missed because
// the entry was NA for the interest; NA is cleared here. Research this session:
// Mountain Project lists 381 sport routes (5.4-5.12b) at Railay/Tonsai; limestone
// with tufas, caves and overhangs; reachable only by boat from Ao Nang; dry
// season Dec-Feb is the peak (Jan-Feb driest), Mar-Apr hotter with storms building,
// May-Oct monsoon with October the wettest month; overhanging crags stay climbable
// in the rain; rooms in Dec-Jan can fill ~6 months ahead. Deep-water soloing is
// deliberately NOT featured: a 2017 club post said DWS had been banned in the
// nature park and current status could not be confirmed.
const TH_PEAK = 'Peak season — the driest weather of the year, and accommodation books up months ahead.';
const TH_MONSOON = 'Monsoon season — overhanging crags stay climbable in the rain, but it’s the low season.';
const TH_WETTEST = 'The wettest stretch of the year (October is the wettest month), with little climbing.';

const ENTRIES: Record<string, Entry> = {
  thailand: {
    overview: 'Railay and Tonsai, on the mainland coast near Krabi and reachable only by boat from Ao Nang, are among Southeast Asia’s best-known limestone sport-climbing areas — several hundred bolted routes on tufas, caves, and overhangs, from beginner to advanced. Phuket is under three hours away. The season is the dry months, roughly November to April, peaking December to February; overhanging crags stay climbable in the monsoon, but it’s the quiet season.',
    months: [
      m(9.0, TH_PEAK), m(9.0, TH_PEAK),
      m(7.4, 'Still dry, but getting hotter, and the best of the season is past.'),
      m(6.2, 'Very hot, with storms increasing by mid-month as the monsoon approaches.'),
      m(4.4, 'The monsoon begins — overhanging crags stay climbable in the rain, but conditions are less reliable.'),
      m(3.8, TH_MONSOON), m(3.8, TH_MONSOON), m(3.8, TH_MONSOON),
      m(3.0, TH_WETTEST), m(3.0, TH_WETTEST),
      m(7.4, 'The rains ease and the dry season begins, though it’s still a shoulder month.'),
      m(8.8, 'The high season begins, with dry weather and accommodation filling months ahead.'),
    ],
  },
};

runBatch(ENTRIES, { clearNA: ['thailand'] });
