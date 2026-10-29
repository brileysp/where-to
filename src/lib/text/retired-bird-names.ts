/**
 * Bird names swept out of the live texts on 22 Oct 2026 (docs/species-names.md): each is the older or regional name for a bird that eBird now
 * calls something else. A text that brings one back (a new Gemini run, a hand edit) fails known truth T06. `not` lists the longer names that
 * contain the old one and are right ("European Pied Flycatcher" contains "Pied Flycatcher").
 */
export interface RetiredBirdName {
  from: string;
  to: string;
  not?: readonly string[];
}

export const RETIRED_BIRD_NAMES: readonly RetiredBirdName[] = [
  { from: 'Common Starling', to: 'European Starling' },
  { from: 'Pied Flycatcher', to: 'European Pied Flycatcher', not: ['European ', 'Little ', 'Atlas ', 'Collared ', 'Semicollared '] },
  { from: 'Honey Buzzard', to: 'European Honey-buzzard', not: ['European ', 'Oriental ', 'Eurasian '] },
  { from: 'Golden Oriole', to: 'Eurasian Golden Oriole', not: ['Eurasian ', 'African ', 'Indian ', 'Black-naped ', 'Dark-throated ', 'Slender-billed '] },
  { from: 'Common Kestrel', to: 'Eurasian Kestrel' },
  { from: 'Eurasian Roller', to: 'European Roller' },
  { from: 'Three-toed Woodpecker', to: 'Eurasian Three-toed Woodpecker', not: ['Eurasian ', 'American ', 'Northern '] },
  { from: 'Sand Martin', to: 'Bank Swallow' },
  { from: 'Ringed Plover', to: 'Common Ringed Plover', not: ['Little ', 'Common ', 'Semipalmated ', 'Greater ', 'Lesser '] },
  { from: 'Arctic Skua', to: 'Parasitic Jaeger' },
  { from: 'Diederik Cuckoo', to: 'Dideric Cuckoo' },
  { from: 'Wynaad Laughingthrush', to: 'Wayanad Laughingthrush' },
  { from: "Hume's Pheasant", to: "Mrs. Hume's Pheasant", not: ['Mrs. '] },
  { from: 'Handsome Francolin', to: 'Handsome Spurfowl' },
  { from: 'Jabiru Stork', to: 'Jabiru' },
  { from: 'Griffon Vulture', to: 'Eurasian Griffon', not: ['Eurasian ', "Rüppell's ", 'Himalayan ', 'Cape ', 'Indian ', 'White-backed '] },
  { from: 'West Indian Flamingo', to: 'American Flamingo' },
  { from: 'Fiordland Crested Penguin', to: 'Fiordland Penguin' },
  { from: 'Little Blue Penguin', to: 'Little Penguin' },
  { from: 'King Shag', to: 'New Zealand King Shag', not: ['New Zealand '] },
  { from: 'Seychelles Black Parrot', to: 'Seychelles Parrot' },
  { from: 'Caucasian Black Grouse', to: 'Caucasian Grouse' },
  { from: 'Crimson-breasted Shrike', to: 'Crimson-breasted Gonolek' },
  { from: "Pander's Ground Jay", to: 'Turkestan Ground-Jay' },
  { from: 'Atlantic Canary', to: 'Island Canary' },
  { from: "Major Mitchell's Cockatoo", to: 'Pink Cockatoo' },
  { from: 'Red-fronted Serin', to: 'Fire-fronted Serin' },
  { from: 'Australian White Ibis', to: 'Australian Ibis' },
  { from: 'Cuban Pygmy Owl', to: 'Cuban Pygmy-Owl' },
  { from: 'Palau Owl', to: 'Palau Scops-Owl' },
  { from: 'African Crimson-winged Finch', to: 'Crimson-winged Finch' },
  { from: 'Maui Creeper', to: 'Maui Alauahio' },
  { from: 'Pacific-slope Flycatcher', to: 'Western Flycatcher' },
  { from: 'Eurasian Reed Warbler', to: 'Common Reed Warbler' },
  { from: "Steere's Liocichla", to: 'Taiwan Liocichla' },
  { from: 'Southern White-crowned Shrike', to: 'White-crowned Shrike' },
  { from: 'Spotted Nutcracker', to: 'Northern Nutcracker' },
  { from: 'Eurasian Nutcracker', to: 'Northern Nutcracker' },
  { from: 'Houbara Bustard', to: 'African Houbara or Asian Houbara' },
  { from: "MacQueen's Bustard", to: 'Asian Houbara' },
  { from: 'Lesser Sand Plover', to: 'Siberian Sand-Plover' },
  { from: "Bewick's Swan", to: 'Tundra Swan' },
  { from: 'Eurasian Teal', to: 'Green-winged Teal' },
  { from: 'Steppe Buzzard', to: 'Common Buzzard' },
  { from: 'Siberian Tit', to: 'Gray-headed Chickadee' },
  { from: "Güldenstädt's Redstart", to: 'White-winged Redstart' },
  { from: 'Little Auk', to: 'Dovekie' },
  { from: 'Common Guillemot', to: 'Common Murre' },
  { from: "Brünnich's Guillemot", to: 'Thick-billed Murre' },
  { from: 'Corncrake', to: 'Corn Crake' },
  { from: "Fea's Petrel", to: 'Desertas Petrel' },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = RETIRED_BIRD_NAMES.map((r) => ({ r, re: new RegExp(`(?<![\\p{L}'’-])${(r.not ?? []).map((n) => `(?<!${esc(n)})`).join('')}${esc(r.from)}(?=(?:e?s)?(?![\\p{L}-]))`, 'u') }));

/** The retired bird names a text still uses, each with the name that replaces it. */
export function retiredBirdNames(text: string): Array<{ found: string; use: string }> {
  return COMPILED.filter(({ re }) => re.test(text)).map(({ r }) => ({ found: r.from, use: r.to }));
}
