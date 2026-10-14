// Marks species names in a blurb with ** (see emphasis.ts) using a fixed word list, no AI.
//
// What counts: a word or short phrase that makes a reader picture ONE particular kind of animal in this
// place. "lions", "elephants", "hippos" and "Grant's gazelle" count. "monkeys", "antelope", "big cats",
// "predators", "raptors" and "wildlife" do not, because they cover many different animals.
//
// How it works: find a species noun from NOUNS, then extend left over name parts that belong to the name
// (African, savanna, spotted, clouded, Grant's ...). GATED nouns (monkey, baboon, bear, fox, gazelle ...) only
// count when a name part comes before them, so "proboscis monkeys" is marked and bare "monkeys" is not.
// The list is meant to grow; the mark script prints what it marked and what it left alone so gaps show up.

import { stripEmphasis } from './emphasis';

/** Species nouns that point at one kind of animal on their own. Each entry is the regex for its singular and plural. */
const NOUNS: string[] = [
  'lions?', 'leopards?', 'cheetahs?', 'tigers?', 'jaguars?', 'elephants?', 'hippos?', 'hippopotamus(?:es)?', 'rhinos?', 'rhinoceros(?:es)?',
  'giraffes?', 'zebras?', 'buffalo(?:es)?', 'wildebeest', 'hyenas?', 'wild dogs?', 'capybaras?', 'orangutans?', 'servals?', 'banteng',
  'kob', 'oryx(?:es)?', 'kudus?', 'hartebeests?', 'impalas?', 'waterbucks?', 'elands?', 'warthogs?', 'crocodiles?', 'gharials?', 'lechwes?',
  'topis?', 'caimans?', 'sable antelope',
  'harbou?r porpoises?', 'orcas?', 'belugas?', 'narwhals?', 'humpbacks?', 'minkes?', 'bowheads?', 'dugongs?', 'giant otters?', 'pangolins?', 'aardvarks?', 'okapis?', 'bongos?', 'sitatungas?', 'klipspringers?', 'dik-diks?',
];

/** Nouns that cover several kinds of animal alone; they count only with a name part in front. */
const GATED: string[] = ['whales?', 'dolphins?', 'porpoises?', 'monkeys?', 'baboons?', 'bears?', 'foxes|fox', 'gazelles?', 'antelopes?', 'wolf|wolves', 'otters?', 'bee-eaters?', 'dogs?', 'cats?', 'deer', 'storks?', 'eagles?', 'hornbills?', 'vultures?'];

/** Words that are part of a species name when they sit directly before a noun (lower case). */
const NAME_PARTS = new Set([
  'african', 'asian', 'bengal', 'bornean', 'ethiopian', 'indian', 'sumatran', 'savanna', 'forest', 'pygmy', 'water', 'cape', 'plains', 'spotted', 'striped',
  'black', 'white', 'greater', 'lesser', 'one-horned', 'clouded', 'proboscis', 'giant', 'river', 'sloth', 'bat-eared', 'roan', 'sable', 'painted', 'mountain',
  'nile', 'gelada', 'hamadryas', 'beisa', 'southern', 'carmine', 'blue', 'common', 'hook-lipped',
  // whales, dolphins and porpoises
  'humpback', 'sperm', 'fin', 'minke', 'gray', 'grey', 'beluga', 'pilot', 'long-finned', 'short-finned', 'right', 'bowhead', 'sei', 'bottlenose',
  'spinner', 'spotted', 'atlantic', 'pacific', 'white-sided', 'white-beaked', 'pantropical', 'guiana', 'dusky', 'rough-toothed',
  'killer', 'beaked', 'dwarf', 'melon-headed', 'northern', 'indo-pacific', 'orca',
]);
// 'blue' and 'common' only count before wildebeest-type nouns; 'southern' and 'carmine' only before bee-eaters.
const POSSESSIVE_NAME = /^[A-Z][A-Za-zé-]+['’]s$/;

export interface MarkOptions {
  /** Place words (country and park names) that must never be treated as part of a species name, lower case. */
  placeWords?: Set<string>;
}

// In a list that ends in "... whales", the earlier items are whale names too: "humpback, minke, fin and blue whales".
const ELLIPSIS = ['fin', 'blue', 'sperm', 'gray', 'grey', 'sei', 'right', 'pilot', 'minke', 'humpback', 'beluga', 'bowhead', 'orca', 'bottlenose', 'spinner', 'common', 'striped', 'dusky'];
const ellipsisRe = new RegExp(`\\b(?:${ELLIPSIS.join('|')})\\b(?=,| and | or )`, 'gi');
const ellipsisPossRe = /\b[A-Z][A-Za-zé-]+['’]s(?=,| and | or )/g;
const nounRe = new RegExp(`\\b(?:${[...NOUNS, ...GATED].join('|')})\\b`, 'gi');
const gatedRe = new RegExp(`^(?:${GATED.join('|')})$`, 'i');

export function markSpecies(text: string, opts: MarkOptions = {}): string {
  const plain = stripEmphasis(text);
  const place = opts.placeWords ?? new Set<string>();
  const spans: Array<[number, number]> = [];
  for (const m of plain.matchAll(nounRe)) {
    let start = m.index ?? 0;
    const end = start + m[0].length;
    const gated = gatedRe.test(m[0]);
    let parts = 0;
    for (;;) {
      const before = plain.slice(0, start);
      const prev = before.match(/(?:^|\s)([A-Za-zé'’-]+)\s$/);
      if (!prev) break;
      const word = prev[1];
      const lower = word.toLowerCase();
      const isPart = NAME_PARTS.has(lower) || (POSSESSIVE_NAME.test(word) && !place.has(lower.replace(/['’]s$/, '')));
      if (!isPart) break;
      start -= word.length + 1;
      parts++;
    }
    if (gated && parts === 0) continue;
    // "elephant grass", "elephant seal", "tigerfish"-style compounds are not the animal.
    if (/^\s+(?:grass|seals?|shrews?|fish|ears?|beetles?)\b/i.test(plain.slice(end))) continue;
    spans.push([start, end]);
  }
  for (const re of [ellipsisRe, ellipsisPossRe]) {
    for (const m of plain.matchAll(re)) {
      const at = m.index ?? 0;
      const end = at + m[0].length;
      if (re === ellipsisPossRe && place.has(m[0].toLowerCase().replace(/['’]s$/, ''))) continue;
      const rest = plain.slice(end, end + 90).split(/[.;:]/)[0];
      if (/\b(?:whales?|dolphins?|porpoises?)\b/i.test(rest)) spans.push([at, end]);
    }
  }
  // Merge spans that touch or are separated by one space ("gharial crocodiles"), and overlapping ones.
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1] + 1) last[1] = Math.max(last[1], sp[1]);
    else merged.push([sp[0], sp[1]]);
  }
  // Each animal is marked once per blurb: later mentions of the same animal, by a fuller or shorter name, stay plain.
  const seen: Array<{ key: string; mods: Set<string> }> = [];
  const keep: Array<[number, number]> = [];
  for (const [a, b] of merged) {
    const id = animalIdentity(plain.slice(a, b));
    const dup = seen.some((x) => x.key === id.key && (x.mods.size === 0 || id.mods.size === 0 || [...id.mods].some((m) => x.mods.has(m))));
    if (dup) continue;
    seen.push(id);
    keep.push([a, b]);
  }
  let out = '';
  let at = 0;
  for (const [a, b] of keep) {
    out += plain.slice(at, a) + '**' + plain.slice(a, b) + '**';
    at = b;
  }
  return out + plain.slice(at);
}

/** Heads that cover many animals: the animal is then named by the word before them (humpback whale, proboscis monkey). */
const GENERIC_HEADS = new Set(['whale', 'dolphin', 'porpoise', 'monkey', 'baboon', 'bear', 'fox', 'gazelle', 'antelope', 'wolf', 'otter', 'dog', 'cat', 'deer', 'stork', 'eagle', 'hornbill', 'vulture', 'bee-eater']);
const LEMMAS: Record<string, string> = { buffaloes: 'buffalo', wolves: 'wolf', foxes: 'fox', oryxes: 'oryx', rhinoceros: 'rhino', rhinoceroses: 'rhino', hippopotamus: 'hippo', hippopotamuses: 'hippo', porpoises: 'porpoise', humpbacks: 'humpback', minkes: 'minke', wildebeest: 'wildebeest', banteng: 'banteng', kob: 'kob', oryx: 'oryx' };
function lemma(w: string): string {
  const x = w.toLowerCase().replace(/['’]s$/, '').replace(/[^a-z-]/g, '');
  if (LEMMAS[x]) return LEMMAS[x];
  return x.endsWith('s') && !x.endsWith('ss') ? x.slice(0, -1) : x;
}

/** Which animal a marked name points at, so a second mention under another name is recognised. */
export function animalIdentity(name: string): { key: string; mods: Set<string> } {
  const words = name.replace(/\bwild dogs?\b/gi, 'wilddog').split(/\s+/).filter(Boolean).map(lemma);
  const head = words[words.length - 1] ?? name.toLowerCase();
  const mods = new Set(words.slice(0, -1));
  if (GENERIC_HEADS.has(head) && words.length > 1) {
    const key = words[words.length - 2];
    mods.delete(key);
    return { key, mods };
  }
  return { key: head, mods };
}

/** Interests whose new text is marked automatically when a generation is applied. Add an interest once its word list is ready. */
export const EMPHASIS_INTERESTS = new Set(['safari', 'whaleWatching']);

/** The words of a place's own name, region and search terms, lower case, so "Uganda's" is never read as part of a species name. */
export function placeWordsFor(place: { name: string; region?: string | null; searchAliases?: string[] | null }): Set<string> {
  const out = new Set<string>();
  for (const s of [place.name, place.region, ...(place.searchAliases ?? [])]) for (const w of String(s ?? '').toLowerCase().split(/[^a-zà-ÿ]+/)) if (w.length > 2) out.add(w);
  return out;
}
