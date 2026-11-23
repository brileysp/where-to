/**
 * 10 Nov 2026: the traveler-needs columns. Onboarding asks a traveler about kids (with ages), how they travel, language, dietary needs and mobility, and until now no
 * place carried data to match any of it. These columns are about the place as a whole, not one interest, so they live under one pseudo-interest key in
 * place_interest_facts and have their own admin page (Traveler needs), not an interest page. Ratings are 0 to 10, against the best in the world, like every other column.
 * Type-only imports from the interest config, because that file imports this one.
 */
import type { FactDef, FactOption } from '@/lib/admin/interest-pages/config';

export const TRAVEL_KEY = '_travel';

const r = (key: string, label: string, group: FactDef['group'], hint: string): FactDef => ({ key, label, type: 'rating', group, hint: `0-10. ${hint}` });

export const LANGUAGE_OPTIONS: FactOption[] = [
  { value: 'es', label: 'Spanish' }, { value: 'pt', label: 'Portuguese' }, { value: 'it', label: 'Italian' }, { value: 'ja', label: 'Japanese' },
  { value: 'fr', label: 'French' }, { value: 'de', label: 'German' }, { value: 'ar', label: 'Arabic' }, { value: 'zh', label: 'Chinese' },
  { value: 'ru', label: 'Russian' }, { value: 'ko', label: 'Korean' }, { value: 'hi', label: 'Hindi' }, { value: 'other', label: 'Another local language' },
];

export const TRAVEL_FACTS: FactDef[] = [
  r('kidsUnder5', 'Under 5s', 'kids', 'How easy the place is with babies and toddlers: short transfers, safe water and healthcare, shade, easy food, facilities for strollers and naps, nothing that needs long walks or constant watching. 0-1 very hard, 5 workable with planning, 8-10 easy and welcoming (Maui, Algarve).'),
  r('kids5to12', 'Children 5 to 12', 'kids', 'How good the place is for school-age children: things they enjoy and can do (beaches, animals, parks, easy adventure), safe and easy logistics, nothing too long or too dull for them. 0-1 hard, 5 fine with some planning, 8-10 a place children love.'),
  r('kidsTeens', 'Teens', 'kids', 'How good the place is for teenagers: active things to do, some independence, food and social scene they will accept, enough to keep them interested for the whole stay. 0-1 hard, 5 fine, 8-10 teens love it.'),

  r('fmtRoad', 'Road trip', 'format', 'How well the place works as a self-drive trip: connected roads with sights along the way, safe and easy driving, simple car rental, distances that suit it. 0-1 not suited (Venice, the Maldives), 5 possible, 8-10 a classic road trip (Iceland, the American Southwest, New Zealand).'),
  r('fmtTour', 'Guided tour', 'format', 'How well the place works as a guided or escorted group tour: established multi-stop tour operators, logistics that are hard to do alone, local guides that add a lot. 0-1 hardly any, 5 some options, 8-10 the usual way to see it (Egypt, Peru, Rajasthan, Tanzania).'),
  r('fmtCruise', 'Cruise', 'format', 'How well the place works as a cruise or ship-based trip: major cruise ports, expedition ships, river cruises. 0-1 none, 5 a port of call, 8-10 a main cruise destination (Alaska, the Norwegian fjords, the Mediterranean, the Galapagos; Antarctica is only reached by ship).'),
  r('fmtBase', 'One base, day trips', 'format', 'How well a visitor can settle in one hotel and do the best things as day trips: compact, good local transport, the main sights within one to two hours. 0-1 not possible, 5 workable, 8-10 ideal (Rome, Tokyo, Lisbon, Hong Kong).'),

  r('englishEase', 'English ease', 'language', 'How easily an English speaker gets by where visitors go: signs, menus, hotels, restaurants, transport. 0-1 almost no English, 5 tourist areas only, 8-10 English works nearly everywhere. Anchored to the EF English Proficiency Index bands by country, then raised in tourist hubs and lowered in remote places.'),
  { key: 'localLanguages', label: 'Other languages that work', type: 'multi', group: 'language', optional: true, options: LANGUAGE_OPTIONS, hint: 'The main local languages besides English that a traveler would use here (so a Spanish speaker can find places where Spanish works). Official or widely spoken languages only.' },

  r('dietVegetarian', 'Vegetarian', 'diet', 'How easy it is to eat vegetarian well without planning every meal. 0-1 very hard, 5 workable (a few vegetarian dishes, some restaurants), 8-10 easy and varied (India, Israel, Bali, big Western cities).'),
  r('dietVegan', 'Vegan', 'diet', 'How easy it is to eat vegan: dedicated vegan places, clearly labelled menus, plant-based cooking. 0-1 very hard, 5 workable in cities, 8-10 easy (Berlin, Bali, Los Angeles).'),
  r('dietGlutenFree', 'Gluten-free', 'diet', 'How easy it is to eat gluten-free safely: local awareness of coeliac disease, labelled menus, gluten-free options in restaurants. 0-1 very hard (noodle and bread cuisines with low awareness), 5 workable with care, 8-10 easy (Italy, Australia, the United States, the UK).'),
  r('dietHalal', 'Halal', 'diet', 'How easy it is to eat halal: in Muslim-majority places nearly all restaurants are halal (10); elsewhere it depends on halal restaurants and halal-certified choices that visitors can find. 0-1 almost none, 5 some in cities, 8-10 plentiful.'),
  r('dietKosher', 'Kosher', 'diet', 'How easy it is to keep kosher: kosher restaurants, shops and certified food. 0-1 none, 5 some in the main city, 8-10 plentiful (Israel, New York City).'),

  r('accessMobility', 'Few steps and short walks', 'access', 'How workable the place is for someone who can manage a few steps and short walks but not long staircases, steep cobbles or long hikes: paved routes, lifts and escalators, taxis and accessible transport, sights reached by car, train or cable car, a hotel close to things. 0-1 very hard (steep stairs everywhere, rough tracks), 5 workable with planning, 8-10 easy (Singapore, Sydney, American national parks with drive-up sights).'),
  r('accessWheelchair', 'Wheelchair or walker', 'access', 'How workable the place is for someone who uses a wheelchair or walker: pavements and ramps, lifts, accessible transport and hotels, step-free routes to the main sights. Stricter than the few-steps column. 0-1 very hard (cobbles, steep stairs, rough tracks), 5 workable with planning, 8-10 easy (Singapore, Sydney, Chicago).'),
  { key: 'evidence', label: 'Evidence', type: 'text', group: 'practical', wide: true, optional: true, maxLength: 400, hint: 'Where the ratings came from and anything unusual about this place: sources checked, hand adjustments.' },
];
