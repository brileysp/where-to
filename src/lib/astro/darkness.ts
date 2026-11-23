/**
 * Hours of true astronomical darkness (the sun more than 18 degrees below the horizon) on the middle day of each month, from latitude alone.
 * Pure arithmetic, no moon: the moon is the same everywhere on a given night, so it cannot be a place fact (owner and Claude, 9 Nov 2026).
 * 24 means the sun never gets within 18 degrees of the horizon (polar night); 0 means there is no true night (north of about 48.5 degrees in midsummer).
 */
const MID_MONTH_DAY = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];
const rad = (d: number) => (d * Math.PI) / 180;

export function darkHoursByMonth(latitude: number): number[] {
  return MID_MONTH_DAY.map((n) => {
    const dec = rad(23.44 * Math.sin(rad((360 / 365) * (284 + n))));
    const lat = rad(latitude);
    const cosH = (Math.sin(rad(-18)) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
    const aboveHours = cosH >= 1 ? 0 : cosH <= -1 ? 24 : (2 * (Math.acos(cosH) * 180) / Math.PI) / 15;
    return Math.round((24 - aboveHours) * 10) / 10;
  });
}

/**
 * How far below the horizon the sun gets at its lowest point (local midnight) on the middle day of each month, in degrees (negative = below the horizon; 0 or more = the sun does not set).
 * 15 Nov 2026 (owner, on Finnish Lapland): "there is a difference between 'you can only see a few stars' and 'you can not see a single star'". Hours of astronomical darkness cannot tell those
 * apart (both are 0), but the lowest point of the sun can: under about -18 the sky is fully dark; from -18 to -12 most stars still show; -12 to -9 only the brightest stars and planets; -9 to -6 a few
 * of the very brightest; above -6 (civil twilight or midnight sun) no star shows at all.
 */
export function lowestSunAltitudeByMonth(latitude: number): number[] {
  return MID_MONTH_DAY.map((n) => {
    const dec = 23.44 * Math.sin(rad((360 / 365) * (284 + n)));
    const lat = Math.abs(latitude); const d = latitude >= 0 ? dec : -dec;
    return Math.round((lat + d - 90) * 10) / 10;
  });
}
