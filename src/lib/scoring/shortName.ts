/** Long interest names read badly inside a pill: "Cycling - Road & Gravel Biking" becomes "Cycling - Road". An admin-set pill name wins over this automatic rule. */
export function shortInterestLabel(label: string, adminName?: string): string {
  return adminName || label.split(' & ')[0];
}
