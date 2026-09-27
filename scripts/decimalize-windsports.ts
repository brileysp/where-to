import { runDecimalize } from './decimalize-runner';

// Windsurfing & Kitesurfing decimalization pass — see decimalize-runner.ts and playbook
// Step 6. Each entry is one named spot (Tarifa, Ho'okipa, Sotavento, ...), so caliber means
// world-reference status: the sport's own tour stops and "capital of the wind" spots first,
// then dependable destination spots, then modest local scenes. The four anchors that were
// already at a literal 10 keep it for their three-month peak (Cape Town's Dec-Feb Cape Doctor;
// the June-August trade winds at Ho'okipa, Sotavento and Tarifa). The other three anchors
// (Aruba, Le Morne, Essaouira) were deliberately authored just under 10 and stay there.
const tens = {
  maui: [5, 6, 7], canaries: [5, 6, 7], andalucia: [5, 6, 7], 'cape-town': [0, 1, 11],
};

// Aruba's Jan-Apr and Oct-Dec months shared one blurb ("solid, dependable trade winds — never a
// dead month") but scored 9 and 7. Oct-Dec now say what the score already meant.
const text = {
  aruba: {
    9: 'Lighter trade winds at Fisherman’s Huts as the peak season ends — still rideable most days, just short of the year’s best.',
    10: 'Lighter trade winds at Fisherman’s Huts as the peak season ends — still rideable most days, just short of the year’s best.',
    11: 'Lighter trade winds at Fisherman’s Huts as the peak season ends — still rideable most days, just short of the year’s best.',
  },
};

const caliber: Record<string, number> = {
  // world-reference (anchors)
  andalucia: 9.8, maui: 9.8, canaries: 9.8, 'cape-town': 9.7, aruba: 9.7, mauritius: 9.6, morocco: 9.5,
  // strong destination spots (old 9)
  'costa-rica': 9.1, 'los-cabos': 9.0, sardinia: 8.9, 'turks-caicos': 8.9, egypt: 8.8, namibia: 8.7,
  sicily: 8.6, vietnam: 8.6, oaxaca: 8.5,
  // old 8
  lisbon: 8.0, provence: 8.0, dubai: 7.5,
  // old 7
  tanzania: 7.6, barbados: 7.5, 'colombian-caribbean': 7.4, ireland: 7.3, srilanka: 7.2, croatia: 7.0,
  cornwall: 6.9, taiwan: 6.8, gbr: 6.6,
  // old 6
  madagascar: 6.5, mallorca: 6.0, bordeaux: 5.8, sydney: 5.6, 'nova-scotia': 5.4,
  // old 5
  bahamas: 5.0, jamaica: 4.8,
  // old 4
  rio: 4.4, copenhagen: 4.2, nyc: 4.0, bali: 3.9, 'cape-cod-islands': 3.8, 'big-island': 3.7, chicago: 3.5,
};

runDecimalize({ key: 'windSports', caliber, tens, text });
