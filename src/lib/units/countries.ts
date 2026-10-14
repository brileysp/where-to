// ISO 3166-1 alpha-2 country codes, for the home-country setting. Names come from Intl.DisplayNames in the visitor's browser.
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

const CODES = new Set(COUNTRY_CODES);
export const isCountryCode = (v: unknown): v is string => typeof v === 'string' && CODES.has(v);

/** The region of the first language tag that has one: "en-GB,en;q=0.9" gives GB, "fr-CA" gives CA, "en" gives null. */
export function regionFromAcceptLanguage(header: string | null | undefined): string | null {
  for (const part of (header ?? '').split(',')) {
    const tag = part.split(';')[0].trim();
    const m = /^[A-Za-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})$/.exec(tag);
    if (m && CODES.has(m[1].toUpperCase())) return m[1].toUpperCase();
  }
  return null;
}
