# Showing temperatures and prices in the visitor's own units

Written 11 Oct 2026. Nothing here is built yet except the first step (all blurb temperatures are now Fahrenheit).

## Temperatures (Fahrenheit or Celsius by visitor)

**What is true today.** Every temperature in every blurb is written the same strict way: `72°F`, `48-57°F`, `28 to 36°F`, `72 and 84°F`. Text is stored once, in Fahrenheit. The converter is `src/lib/text/temperature.ts` and the authoring script runs it on every new blurb, so new text stays in the same format.

**How to build the switch when the time comes.**
1. Decide each visitor's unit: a saved choice in their profile wins; otherwise guess from the country their browser reports (Fahrenheit for the US and a few small countries such as the Bahamas, Belize, the Cayman Islands and Palau, Celsius everywhere else). Always give them a visible °F / °C toggle.
2. When a blurb is shown and the visitor wants Celsius, find every `NN°F` (or range) in the text and replace it with the converted `NN°C`, rounded to a whole degree. Because the format is uniform, one small function does this and the stored text never changes. The reverse of the converter already written is about twenty lines.
3. Do it at display time, in one shared place, so every screen (cards, place pages, admin preview) behaves the same.
4. Admin screens keep showing Fahrenheit, since that is what is stored.

**Depth and visibility (diving blurbs).** Also converted on 11 Oct 2026: they are stored in feet in one strict format (`100 ft`, `15-65 ft`, `15 to 105 ft`), using `src/lib/text/length.ts`. Rounding is to the nearest 5 ft, so the standard dive limits come out as divers say them (18 m = 60 ft, 30 m = 100 ft, 40 m = 130 ft). A metric visitor setting would convert back the same way as temperatures. Other interests (for example altitude in mountaineering) are not converted yet. The admin columns for typical depth and water temperature on the diving page still show metres and Celsius.

## Prices (the visitor's home currency)

**What exists today.** Each cost item on a place has a number price and no currency field. They look like US dollars (for example a 15-minute taxi at 13), but nothing in the data says so, so confirm that before building.

**How to build it.**
1. Keep every stored price in US dollars (after confirming that is what they are). Add a "last checked" date to each item if it is not there yet; the cost-checking agent will keep these current.
2. Pick the visitor's currency the same way as units (saved choice first, then the country their browser reports), with a visible currency switcher.
3. Get exchange rates once a day from a free rates service, store them in one small table on the server, and never fetch them from the visitor's browser. If the service is down, keep showing the last rates.
4. Convert at display time and round to friendly figures: whole units for most currencies, nearest 10 or 100 for currencies with big numbers (yen, won, rupiah). Show "about" or "≈" so nobody takes it as an exact quote.
5. Leave the $ to $$$$$ cost bands alone: they are relative levels, not amounts.
6. Add a small note near prices: "Prices are estimates converted from US dollars at today's rate."
7. Edge cases to decide later: places that quote prices in a local currency only (keep the US dollar base anyway), and whether to show the local currency alongside the home currency.
