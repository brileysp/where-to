import { runDecimalize } from './decimalize-runner';

// Wildflower Blooms decimalization pass — see decimalize-runner.ts and playbook Step 6.
// Wildflower scores are single-month spikes (a dated bloom event), so the caliber ordering
// is "how much does this bloom draw a traveller on its own": the world-reference events
// (sakura, Keukenhof tulips, Namaqualand daisies, Valensole/Furano lavender) first, then
// the strong regional events (bluebonnets, daffodils, hydrangeas, rhododendrons), then
// alpine meadows and one-off superblooms. Literal 10s go to the anchors' single best
// month (Glacier keeps Jul; its Aug blurb says "continues", so 9.7).
const tens = {
  'tokyo-kyoto': [3], amsterdam: [3], 'cape-town': [7], canaries: [4], 'glacier-waterton': [6],
};
const set = { 'glacier-waterton': { 7: 9.7 } };

const caliber: Record<string, number> = {
  // world-reference events (anchors' shoulder months scale from these)
  'tokyo-kyoto': 9.6, amsterdam: 9.6, 'cape-town': 9.6, canaries: 9.6, 'glacier-waterton': 9.6, provence: 9.6,
  hokkaido: 9.0, nepal: 8.8, seoul: 8.8, istanbul: 8.6, 'great-smoky-mountains': 8.5,
'texas-hill-country': 8.4, 'lake-district': 8.4, azores: 8.3, madeira: 8.3, tasmania: 8.2, bhutan: 8.1,
  iceland: 8.0, 'rocky-mountain': 7.9, 'scottish-highlands-skye': 7.9, 'north-cascades': 7.8,
  olympic: 7.7, namibia: 7.6, swissalps: 7.6, cotswolds: 7.4, tuscany: 7.2, ladakh: 6.8,
  mallorca: 6.5, 'north-island': 6.4, 'douro-valley-porto': 6.1, ethiopia: 6.0,
  dolomites: 5.6, 'death-valley': 5.4, 'joshua-tree': 5.0, kyrgyzstan: 5.0, napa: 4.9,
  lapland: 4.5, atacama: 4.2, 'badlands-black-hills': 4.0, santorini: 3.3,
};

// Off-season months: 15 places carried a 4-6 baseline in months their own blurb calls
// "Outside ... season" (Cape Town, Glacier, Rocky Mountain, Olympic, Azores and Madeira sat at 6
// in January), which outranked real blooms elsewhere. Compress those baselines toward 2 so an
// in-season bloom always beats an off-season month, while keeping a small decimal difference
// for places that genuinely have year-round flowers.
const offSeason = { match: /^Outside\b/i, map: (b: number) => (b <= 2 ? b : 2 + (b - 2) * 0.35) };

runDecimalize({ key: 'wildflowerBlooms', caliber, tens, set, offSeason });
