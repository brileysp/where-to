// First-draft values for the six surfing columns added 12 Oct 2026 (wave direction, boards, how you reach the waves, localism, lessons
// and rental, permits). Written from general knowledge, NOT checked against sources. Blank (omitted) = not sure enough to fill.
// Not-really-a-surf-destination places (Chicago, Athens, Dubai, Great Barrier Reef...) are left empty on purpose.
// Keys: d waveDirection, bd boards, ac access, lc localism, ls lessons, pm permits.
type Boards = Array<'longboard' | 'shortboard' | 'stepUp'>;
export interface SurfDraft2 {
  d?: 'lefts' | 'rights' | 'both'; bd?: Boards; ac?: 'walkUp' | 'drive' | 'boat' | 'resort' | 'remote';
  lc?: 'welcoming' | 'mixed' | 'protective' | 'hostile'; ls?: 'plentiful' | 'some' | 'few'; pm?: string;
}
const LS: Boards = ['longboard', 'shortboard'];
const LSS: Boards = ['longboard', 'shortboard', 'stepUp'];

export const SURF_DRAFT_2: Record<string, SurfDraft2> = {
  bali: { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  maui: { d: 'both', bd: LSS, ac: 'drive', lc: 'protective', ls: 'plentiful' },
  lisbon: { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  nicaragua: { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'plentiful' },
  'basque-country': { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  'vancouver-island': { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'plentiful', pm: 'A Parks Canada pass is needed at Long Beach in Pacific Rim National Park Reserve' },
  fiji: { d: 'both', bd: ['shortboard', 'stepUp'], ac: 'boat', lc: 'mixed', ls: 'few' },
  oaxaca: { d: 'both', bd: ['shortboard', 'stepUp'], ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  ghana: { d: 'both', bd: ['longboard'], ac: 'walkUp', lc: 'welcoming', ls: 'some' },
  canaries: { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  cornwall: { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  algarve: { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'plentiful' },
  'costa-rica': { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'plentiful' },
  srilanka: { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'plentiful' },
  'north-island': { d: 'lefts', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  sydney: { d: 'both', bd: LS, ac: 'walkUp', lc: 'mixed', ls: 'plentiful' },
  'cape-town': { d: 'both', bd: LSS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  'puerto-rico': { d: 'rights', bd: LSS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  'big-island': { d: 'both', bd: LS, ac: 'drive', lc: 'protective', ls: 'some' },
  'los-cabos': { d: 'rights', bd: LS, ac: 'drive', lc: 'mixed', ls: 'some' },
  maldives: { d: 'both', bd: LS, ac: 'boat', lc: 'welcoming', ls: 'few', pm: 'Many breaks are reached only through a resort or a licensed charter boat' },
  rio: { d: 'both', bd: LS, ac: 'walkUp', lc: 'protective', ls: 'plentiful' },
  'monterey-big-sur': { d: 'rights', bd: LS, ac: 'drive', lc: 'protective', ls: 'plentiful' },
  borabora: { d: 'lefts', bd: ['shortboard', 'stepUp'], ac: 'boat', lc: 'mixed', ls: 'few' },
  ireland: { d: 'both', bd: LSS, ac: 'drive', lc: 'welcoming', ls: 'plentiful' },
  nyc: { d: 'both', bd: LS, ac: 'walkUp', lc: 'mixed', ls: 'plentiful', pm: 'In summer surfing is allowed only on the designated surfing beaches at Rockaway' },
  azores: { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'some' },
  tasmania: { ac: 'drive', ls: 'few' },
  'cape-cod-islands': { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'some', pm: 'Parking fees apply at the Cape Cod National Seashore beaches' },
  'nova-scotia': { d: 'both', bd: LS, ac: 'drive', lc: 'welcoming', ls: 'some' },
  'st-andrews-fife': { ac: 'walkUp', lc: 'welcoming', ls: 'few' },
  'bavaria-munich': { d: 'both', bd: ['shortboard'], ac: 'walkUp', lc: 'protective', ls: 'few' },
  morocco: { d: 'rights', bd: LS, ac: 'drive', lc: 'mixed', ls: 'plentiful' },
  panama: { ac: 'drive', lc: 'welcoming', ls: 'some' },
  okinawa: { d: 'both', bd: LS, ac: 'drive', lc: 'mixed', ls: 'some' },
  'papua-new-guinea': { d: 'rights', bd: ['shortboard'], ac: 'resort', lc: 'welcoming', ls: 'few', pm: 'Reef access often involves a fee paid to the local landowners' },
  mauritius: { d: 'lefts', bd: ['shortboard', 'stepUp'], ac: 'drive', lc: 'mixed', ls: 'few' },
  bahamas: { d: 'both', bd: LS, ac: 'walkUp', lc: 'welcoming', ls: 'few' },
  namibia: { d: 'lefts', bd: ['shortboard', 'stepUp'], ac: 'remote', lc: 'welcoming', ls: 'few', pm: 'Pelican Point is reached by 4x4 or boat with a local operator; check current access rules' },
};
