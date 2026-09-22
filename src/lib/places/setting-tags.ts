// The closed set of "place type" tags a place can carry (what it's LIKE, not
// its administrative level — that's the single-valued `placeType` column).
// A place has 1–4 tags; the FIRST is its primary tag (icon / main label in the
// place-selection flow). Adding, renaming or removing a tag is a code change
// here, plus a data fix for any place already using it.
export const SETTING_TAGS = [
  { slug: 'city', label: 'City', emoji: '🏙️', blurb: 'Urban energy: streets, museums, food, nightlife.' },
  { slug: 'town-countryside', label: 'Town & countryside', emoji: '🏡', blurb: 'Villages, small towns, farmland and wine country.' },
  { slug: 'island', label: 'Island', emoji: '🏝️', blurb: 'An island or archipelago.' },
  { slug: 'beach-coast', label: 'Beach & coast', emoji: '🏖️', blurb: 'Beaches, coastline and seaside.' },
  { slug: 'mountains', label: 'Mountains', emoji: '🏔️', blurb: 'Peaks, alpine valleys and volcanoes.' },
  { slug: 'desert', label: 'Desert', emoji: '🏜️', blurb: 'Arid landscapes, dunes, canyons and red rock.' },
  { slug: 'jungle-forest', label: 'Jungle & forest', emoji: '🌴', blurb: 'Rainforest, jungle and woodland.' },
  { slug: 'savanna-wetlands', label: 'Savanna & wetlands', emoji: '🦁', blurb: 'Open grassland, plains, deltas and marsh.' },
  { slug: 'polar-ice', label: 'Polar & ice', emoji: '🧊', blurb: 'Glaciers, tundra and the polar regions.' },
] as const;

export type SettingTagSlug = (typeof SETTING_TAGS)[number]['slug'];
export const SETTING_TAG_SLUGS = SETTING_TAGS.map((t) => t.slug) as [SettingTagSlug, ...SettingTagSlug[]];
export const MAX_SETTING_TAGS = 4;
