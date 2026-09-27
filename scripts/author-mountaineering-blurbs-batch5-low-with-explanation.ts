import { runBatch, m, type Entry } from './mountaineering-batch-runner';

// mountaineering batch 5: destinations where the interest is not a real draw, or
// is legally closed, but that are not structurally absent. Per direction from the
// user, these get a LOW score with an honest explanation rather than NA
// (bhutan and ethiopia named explicitly; kenya and greenland treated the same
// way for consistency). Travel advisories are deliberately kept out of slider
// text (cross-cutting boundary, playbook §2). Research this session: Bhutan
// has banned mountaineering (above 6,000m since 1994, all peaks since 2003);
// Gangkhar Puensum (7,570m) is the highest unclimbed peak; a small rock-climbing
// scene exists (The Nose above Thimphu, Neyphug Ney near Paro). Ethiopia's Ras
// Dashen is a trek and Tullu Deemtu is drivable; Gheralta's sandstone towers are
// the only real climbing. Neither Mara nor Amboseli has climbing; Mount Kenya
// is ~400km away. Greenland's real climbing (Tasermiut Fjord) is far south of
// the Ilulissat area this entry covers.
const BHU_SPRING = 'Spring — the better of the two windows for the small local rock-climbing scene near Thimphu and Paro.';
const BHU_AUTUMN = 'Autumn — the second of the two windows for the small local rock-climbing scene near Thimphu and Paro.';
const BHU_MONSOON = 'Monsoon rains make even the small rock-climbing scene impractical.';
const BHU_WINTER = 'Winter — cold, and the local rock-climbing scene is quiet.';
const ETH_DRY = 'Dry season — the best conditions for the Gheralta sandstone towers, Ethiopia’s only real climbing, and for the highland treks.';
const ETH_RAINS = 'Heavy rains — the rock and highland trails are wet, and access is poor.';
const KEN_ALL = 'Climbing isn’t a draw here — the Mara and Amboseli are safari parks, and Mount Kenya, the real objective, is a separate trip.';
const GRL_SUMMER = 'Summer is the expedition season, but Greenland’s real climbing is in the far south, a separate boat expedition from this area.';
const GRL_WINTER = 'Winter — polar darkness and ice; no climbing season.';

const ENTRIES: Record<string, Entry> = {
  bhutan: {
    overview: 'Mountaineering is banned in Bhutan — climbing peaks above 6,000m has been prohibited since 1994 and all peaks since 2003, out of respect for local spiritual beliefs — which is why Gangkhar Puensum (7,570m) remains the world’s highest unclimbed mountain. A small local rock-climbing scene exists, with bolted routes on the Nose above Thimphu and at Neyphug Ney near Paro, but it’s a footnote rather than a reason to go.',
    months: [
      m(1.2, BHU_WINTER), m(1.2, BHU_WINTER),
      m(2.0, BHU_SPRING), m(2.0, BHU_SPRING), m(2.0, BHU_SPRING),
      m(0.8, BHU_MONSOON), m(0.8, BHU_MONSOON), m(0.8, BHU_MONSOON),
      m(1.8, BHU_AUTUMN), m(1.8, BHU_AUTUMN), m(1.8, BHU_AUTUMN),
      m(1.2, BHU_WINTER),
    ],
  },
  ethiopia: {
    overview: 'Ethiopia has no real mountaineering scene: Ras Dashen, the highest peak (about 4,550m), is a trek rather than a climb, and Tullu Deemtu in the Bale Mountains can be reached by road. The one genuine climbing draw is the red sandstone towers of Gheralta, with crack and tower climbing on variable rock and only a handful of documented routes.',
    months: [
      m(2.2, ETH_DRY), m(2.2, ETH_DRY), m(2.2, ETH_DRY),
      m(1.8, 'The dry season is ending.'),
      m(1.6, 'The last of the dry-season window before the rains arrive.'),
      m(0.8, ETH_RAINS), m(0.8, ETH_RAINS), m(0.8, ETH_RAINS),
      m(1.4, 'The rains are ending and the season is just beginning.'),
      m(2.2, ETH_DRY), m(2.2, ETH_DRY), m(2.2, ETH_DRY),
    ],
  },
  kenya: {
    overview: 'Neither the Maasai Mara nor Amboseli offers climbing — these are safari parks. The real objectives are separate trips: Mount Kenya (Batian, 5,199m, and Nelion, 5,188m, are technical rock; Point Lenana, 4,985m, is the trek) lies roughly 400km from Amboseli, and Hell’s Gate near Lake Naivasha has a small novice climbing tower about two hours from Nairobi.',
    months: Array.from({ length: 12 }, () => m(1.4, KEN_ALL)),
  },
  greenland: {
    overview: 'The Ilulissat and Disko Bay area is a boat-and-hiking destination rather than a climbing one. Greenland’s real climbing — the 1,000m-plus granite walls of Tasermiut Fjord in the far south, and expeditions in the east — is a separate, self-sufficient expedition by boat, with no mountain rescue and a season of roughly June to August.',
    months: [
      m(0.6, GRL_WINTER), m(0.6, GRL_WINTER), m(0.6, GRL_WINTER), m(0.6, GRL_WINTER), m(0.6, GRL_WINTER),
      m(2.0, GRL_SUMMER), m(2.0, GRL_SUMMER), m(2.0, GRL_SUMMER),
      m(1.0, 'The short season is over.'),
      m(0.6, GRL_WINTER), m(0.6, GRL_WINTER), m(0.6, GRL_WINTER),
    ],
  },
};

runBatch(ENTRIES);
