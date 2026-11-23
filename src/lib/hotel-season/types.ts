/**
 * Hotel price seasonality (design reviewed with the owner 14 to 15 Nov 2026; see docs/hotel-season.md).
 * Luxury hotels only for now: the most expensive hotel-type listings per place, quoted for the cheapest available room, one night, two adults, US dollars.
 * The 14 quoted dates are: 15 Dec, 29 Dec and 31 Dec 2026, then one mid-month Tuesday for January to November 2027. Positions 1 and 2 are the two holiday dates.
 */
export const HOTEL_KINDS = ['luxury'] as const;
export type HotelKind = (typeof HOTEL_KINDS)[number];

/** Plain labels, stored so a screen can word them later. An empty list means a solid sample. */
export const HOTEL_FLAGS = ['thin', 'thin-holidays', 'closed-months', 'flat', 'small-market'] as const;
export type HotelFlag = (typeof HOTEL_FLAGS)[number];

/** Index positions of the two holiday dates inside a run's 14 dates. */
export const HOLIDAY_POSITIONS = [1, 2] as const;

export interface PanelHotel {
  name: string;
  /** One price per quoted date (US dollars per night, cheapest available room); null when the hotel had no price that night (sold out or closed). */
  prices: Array<number | null>;
  /** Left out of the summary but kept as evidence (for example a placeholder price). The import keeps every panel hotel in, so this is only set by hand. */
  excluded?: boolean;
  note?: string;
}

/** What one collection run found for one place and kind. Stored in place_hotel_quote_runs as evidence; the summary is computed from it. */
export interface QuoteRun {
  placeId: string;
  kind: HotelKind;
  source: string;
  searchTerm: string;
  /** The date the quotes were taken (YYYY-MM-DD). */
  quotedOn: string;
  /** The 14 stay dates (YYYY-MM-DD), in the order the prices and listed counts follow. */
  dates: string[];
  /** How many hotel-type properties Booking.com listed for each date; 0 means the page gave no count. */
  listed: number[];
  panel: PanelHotel[];
  note?: string;
}

export interface HotelSeasonSummary {
  v: 1;
  kind: HotelKind;
  source: string;
  asOf: string;
  /** What was searched, so a card never claims more than it covers (for example "Kailua-Kona" for the Big Island). */
  area: string;
  /** January to December. 100 is a typical month for this place's luxury hotels; null when fewer than 3 hotels had a price or most hotels were closed. */
  months: Array<number | null>;
  /** How many hotels stood behind each month. */
  monthsN: number[];
  holiday: { dec29: number | null; dec31: number | null; n29: number; n31: number };
  /** Months where fewer than 5 hotels had a price. */
  thinMonths: number[];
  /** Months where far fewer hotels were listed than later in the year (a seasonal closure), 1 to 12. */
  closedMonths: number[];
  flags: HotelFlag[];
  panelHotels: number;
  /** Fewest and most hotel-type properties listed across the monthly dates; [0, 0] when the page gave no count. */
  listedHotels: [number, number];
  /** The typical luxury nightly price in US dollars, rounded to $10. Stored but not shown. */
  levelUsd: number | null;
  /** The collector's own note about this place (for example "the panel is gateway-town motels"). */
  note?: string;
  /** Reserved for the event-weeks phase. */
  events: unknown[];
}
