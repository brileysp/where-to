# Onboarding v2: build spec

Status: owner decisions recorded (17 Oct 2026); all questions answered. Nothing is built yet.

**Source of truth:** the mockup, frozen as Version 17 of the published artifact (https://claude.ai/artifact/XHPV6GBabQNqS6ngsgtesU). Its full source is saved in this folder: `mockup-v17.html` (the page) and `mockup-v17-logic.js` (the logic and copy). Where this document and the mockup disagree, the mockup wins and this document gets corrected. Every sentence of copy in quotes below is copied from the mockup.

**How the build will be checked:** each slice is compared with the mockup, screen by screen, using the same stand-in travelers (section 12). Anything that cannot be built exactly goes on the "mockup vs real" list (section 11), with the reason. Nothing is changed quietly.

---

## 1. What this replaces, and how it is built

- It replaces the first-time flow in `src/components/dna/OnboardingFlow.tsx` and its screens, and the summary and DnaPanel screens that show the traveler's profile. It does not change the scoring engine, the results page ranking, or the admin pages.
- It is built beside the old flow on its own route, behind a switch that is off by default. The old flow stays live until the owner approves the switch.
- Pure decision logic (which screen comes next, the lock, the next-category button, airport matching) lives in `src/lib/onboarding/` as plain functions with tests. Screens only draw what those functions say.
- The mockup's scoring, sample places, sample questions and flight times are invented. The real build uses the app's real scoring and data (section 9). Nothing in the "invented" list is spec.

## 2. The two paths and the screen order

The first screen asks two A-or-B questions. Each pair is exclusive, so there are no multi-selects and no personas.

| Answer | Effect |
|---|---|
| Something I love to do | adds the interest screens (Love, then Top interests) |
| Just give me a great trip | skips the interest screens and adds the photo-pick screen (Vibes) at the end |
| A specific time window | adds When, then Getting there, before anything else |
| My timing is flexible | adds a month-only When screen before anything else (no week row, no Getting there) |

Screen order for a trip (a person can pick any combination):

1. Door (first screen)
2. When, then Getting there (only if "A specific time window"); When alone (if "My timing is flexible")
3. Love, then Top interests (only if "Something I love to do")
4. Essentials ("The basics")
5. Vibes (only if "Just give me a great trip")
6. Shortlist (first results)

The progress bar at the top of each screen fills in proportion to the screen's position in this person's own path.

Travel DNA path (from the small link on the first screen): Love, Top interests, Basics, Cards, Your Travel DNA. No trip, no When, no results. A banner at the top of each reads "Building your Travel DNA · no trip needed · about a minute".

Returning traveler: Welcome back, then Shortlist (section 4.12).

## 3. State the flow keeps

| Name | Meaning |
|---|---|
| doors | the four first-screen choices (love, open, window, flex) |
| month, week | a month 0 to 11, and week 0 (any) to 4 |
| who | companions picked (Solo, With friends, With a spouse or partner, With my kids) |
| bands | the app's four "Open to" bands; all selected means "no preference" |
| care | the "what else matters" choices, each with an optional "must" flag |
| interests | interest key mapped to a level (Off 0, Curious 1, Like 2, Love 2.5, Top 3) |
| subs | per interest, the "what kind" specifics picked |
| vibes | the photo picks |
| ans | answers to sharpen questions (-1 means skipped) |
| swipes | the five taste cards |
| origin, originSet, direct, maxH | home airport, whether it is chosen, nonstop only, longest flight in hours (0 means no limit) |
| grp, seen | the category tab open on the interest screen, and which tabs have ever been opened |
| topMsg | the "5 top interests" popup is showing |
| dxo, dsc, dorder, dall | Travel DNA page: card open or closed overrides, block collapsed, the order frozen at entry, and "show all" |
| keep | per row, whether it is kept in the Travel DNA or only for this trip |
| returning | the traveler has a saved Travel DNA |

## 4. Screens

### 4.1 Door
- Brand "Where To?". Headline "Let us plan a trip". Sub "Two quick choices. They only decide which questions come next."
- Question 1 "What should the trip be built around?": tiles "Something I love to do" (sub "Specific interests like hiking, diving, birding, golf…") and "Just give me a great trip" (sub "Surprise me").
- Question 2 "How fixed is your timing?": tiles "A specific time window" (sub "Exact weeks, or flight logistics") and "My timing is flexible" (sub "Just pick a month").
- One tile in each pair can be on. Continue is disabled until both are answered.
- Small link under the button: "Not planning a trip yet? Build my Travel DNA instead" starts the Travel DNA path.

### 4.2 When
- Headline "When are you going?". Sub: "Pick the month, and the week if you know it." for a time window, "Just pick a month." for flexible timing.
- Twelve month pills. After a month is picked, and only for a time window, a second row appears: Any week, Week 1 to Week 4.
- There is no "I am flexible" option. Continue is disabled until a month is picked.

### 4.3 Getting there (time window only)
- Headline "Getting there". Sub "Optional. If flights are not a limit, skip this. When you do set one, it is firm: places that do not fit are set aside, not just ranked lower."
- Card "Flying from" holds the home picker (section 5.4).
- Switch "Nonstop flights only" (small text "Hides anywhere you would have to change planes").
- Card "Longest flight I would take": No limit, 4 hours, 8 hours, 12 hours.
- Callout "Soft tastes (like “I prefer quiet beaches”) never hide a place. Only limits like these do, and you can always see what was set aside."
- Buttons: Continue; link "Skip, flights are not a limit".
- The nonstop switch and the hour pills do nothing until a home is chosen. Tapping them shows the message "Choose your home airport first".

### 4.4 Love (the interest picker)
- Headline "What do you love to do?". There is no subhead and no search box.
- A small label "Browse interests in 4 categories", then four sliding tabs: Nature & Wildlife, Sports & Recreation, Culture & Discovery, Relaxation & Leisure. The open tab shows its full name; a tab that has picks and is not open collapses to its icon plus a count. A collapsed tab slides open when it is navigated to. The open tab always stays expanded, even when it has picks.
- Under the tabs: the open category's name, then a grid of interest boxes, all the same size and shape. The first eight show; if there are more, a link "Show N more" opens the rest and becomes "Show fewer". The first eight in each category are fixed (section 8.2); the rest follow in popularity order.
- Tapping a box toggles the interest on (level Like).
- "People who pick these often add": up to four suggested interests, shown only once something is picked (section 8.3). Tapping one adds it.
- **Next-category prompt.** At the very bottom of a tab's content, a button reads "Continue to <category>" for the first category, in tab order after the current one, that has never been opened. Tapping it opens that category exactly as if its tab had been tapped, scrolled to the top. Once a tab has been opened by any means, no prompt appears for it. When every tab has been opened, no prompt appears at all.
- Bottom bar: a tray "N picked" with the emoji of the first seven, the button "Continue" (or "Pick at least one"), and, outside the Travel DNA path, a link "Skip, I have no favorites".

### 4.2.1 The 48 interests
The picker uses the app's four groups and its real interests (everything in `VISIBLE_SLIDERS` outside the Value group). Low-season deals, avoiding crowds and road-tripping are not interests; they appear in "What else matters" (section 5.3).

### 4.5 Top interests
- Headline "Top interests". Sub "Which are most important for picking where you go?".
- Only the interests picked appear, ordered by level. Tapping a row's header toggles it as a top interest, shown as "★ Top interest". A top interest's card is double height and shows "What kind?" with its specifics as chips with no emoji. All specifics start unselected.
- Up to five top interests. Tapping a sixth opens a popup (section 4.14) and does nothing else.
- Buttons: Continue; link "Back to add more".
- When a row changes level, the list animates the move, in the same style the live results page uses.

### 4.6 Essentials ("The basics")
- Headline "The basics". Sub "A few taps. Your shortlist appears right after."
- Card "Who is going?" with "Select all that apply." and the four companion pills.
- Card "Open to": Budget & Comfort and Weather, as the app's own multi-select pills; weather shows its hint "Daily highs: Cold under 50°F · Cool 50 to 69 · Warm 70 to 84 · Hot 85 and up". Everything selected means "no preference". Sub "What you're willing to accept. Pick any combination. Everything selected means “no preference.”"
- A collapsed line "What else matters when you choose?" with the sub "Optional: kids, food needs, language, travel modes and more." Details in section 5.3.
- If "With my kids" is picked and kid-friendly is not set, a suggestion line appears above: "Traveling with kids? Add ages and we will favor family-friendly places." with a link "Add kid-friendly".
- Buttons: Continue; link "Skip, I will decide later".

### 4.7 Vibes
- Only for people who did not choose interests. Headline "Which of these feels like you?". Sub "Pick any. These are the photos you would normally see."
- Eight photo tiles (the mockup uses gradients and emoji; real photography replaces them). Buttons "Show my shortlist" and a link "Skip, surprise me".

### 4.8 Shortlist (first results)
The owner chose the tight style (the mockup's V2), the same cards the live results page uses. The expanded style (V1) is dropped because short blurbs do not exist yet; its details below are kept only for later.

- Top bar: brand "Your shortlist" and a round DNA button with the calibration percent (opens section 4.11).
- A chip bar: when, who, budget, weather, "+ Flying from…" (or "From JFK · nonstop only · under 8h" in a firm colour), and "+ What matters" (or "What matters · N"). Each opens a sheet (section 4.13).
- A "First pass" (later "Sharpness") bar with a percent.
- **The teaser lock.** Until five sharpen questions have been answered, the list is a teaser:
  - A banner at the top: "Answer 5 quick questions to unlock your full list", with a progress bar and "N/5".
  - The top pick's first row (rank, name, score) is readable. Everything below that row, and every other card, is blurred and cannot be tapped.
  - The "see all" button is disabled and reads "🔒 See N places that fit your criteria", with "Answer N more questions to unlock".
  - The list still reorders behind the blur as questions are answered, with the same movement animation.
  - Skipped questions do not count. If there are no questions left to ask, the lock lifts. Returning travelers are never locked.
  - While locked, nothing names a place that moved. After a question the message is "Saved. N more to unlock your list". The fifth answer shows "Your full list is unlocked".
- **The sharpen card.** One question at a time: a tag ("Quick one", or "<interest> · expert lane" when it is about a chosen interest), a Skip link, the question, the answer options, and a hint ("Your answer would reshuffle about N of your top 5." when that is true; otherwise "Goes into your Travel DNA. Sharpens future trips." for an interest question, or "Small effect on this list, saved for later."). Once every question is answered: "You are well calibrated / That is as sharp as it gets for now. / Teach us your taste with a few swipes, or save this to your Travel DNA."
- **Cards.** The build uses the tight style (V2) only: five cards in the live results page's style (section 4.9). For later, the dropped V1 was six expanded cards, each with rank, emoji, name, region, a score, a tagline, up to four reason chips, a twelve-month bar chart with the chosen month marked, and a tap to open "Why it ranks here" bars. V2: five cards in the live results page's tight style (section 4.9).
- Reason chips: specialist unlock ("Specialist place · unlocked by <interest>"), flight line when a home is chosen ("Nonstop from SFO · 5.5h" or "About 9h from JFK"), the strongest interest or specific, month fit ("Great in June" or "Weak in June (off-season)"), the biggest band miss, and one care or attribute chip. At most four.
- Under the cards: the see-all button (above), and "N places set aside by your limits" which expands to the list with reasons.
- Footer: "Teach us your taste (5 swipes)" and "Save to my Travel DNA".

### 4.9 See all (the live results page)
This is the app's existing results page, not a new one. The only addition is one line when limits set places aside: "N places set aside by your limits · see why". The button that gets here reads "See N places that fit your criteria" (small text "N set aside by your limits · the full results page"). The Travel DNA button on that page opens section 4.11.

### 4.10 Travel DNA path screens
- **Love and Top interests** as above, with the DNA banner and no "Skip, I have no favorites".
- **Basics** ("Who do you usually travel with?" with "Select all that apply.", all four Open-to bands, a home picker titled "Home city or airport" with the sub "Optional. Type a city or airport code. Used to warn you about long flights and to show nonstop options.", and the "What else matters" line limited to lasting items). Button "Start swiping".
- **Cards.** Five scenarios ("Sunrise hike to a volcano crater", "A three-hour tasting menu, no phones", "A whole day with nothing planned", "Night market food crawl", "A private boat day, no itinerary") with No, Yes and "Love ♥". Headline "Which sounds like your kind of day?", sub "Card N of 5. Go with your gut." After the fifth: "Five cards in." and "That is enough for a first read." Link "Skip the cards".
- **Your Travel DNA, first sketch** (section 4.11), with buttons "Save my Travel DNA" and "See where it points".

### 4.11 Your Travel DNA page
Reachable from the round DNA button on the shortlist and the full results page, and at the end of the Travel DNA path. Back returns to where the person was. Edits apply to the list straight away; Save keeps them as defaults.

- Title "Your Travel DNA" (or "Your Travel DNA, first sketch" in the DNA path). A calibration bar with a percent, and the line "Changes apply to your list right away. Save to keep them as your defaults for the next trip. Switch off anything you do not want to carry over." (DNA path: "A sketch, not a verdict. Every trip you plan sharpens it.")
- Four main blocks, each collapsible by its heading: Interests, Open to, What matters when you choose, then the groups "Who and where from", "Tastes we learned" and "This trip only". Empty blocks are not shown.
- **Interests** heading: "Interests · 9/48 selected · 4/48 fine-tuned" (selected = interests with any level, fine-tuned = interests with at least one specific picked). Sub "Each interest has a level, and up to five can be Top. Tap a card header for its specifics."
  - One card per interest: emoji, name, a level control "Off · Curious · Like · Love · ★ Top", and a collapsible "What kind?" chip row.
  - A card is open by default only if the person has already picked specifics for it. Tapping the header opens or closes it. An interest set to Off cannot open.
  - Changing a level to anything except Off always opens the card. Setting Off closes it.
  - **No reordering while the page is open.** The order is fixed when the page is entered (highest level first) and refreshes only on the next visit.
  - Interests that are Off are not listed until the button "Show all N more interests" is tapped; they then appear under their category headings, and the button becomes "Hide the rest".
  - A line under the list: "N of 5 top interests. The order updates the next time you open this page." Trying for a sixth Top opens the popup (4.14).
- **Open to**: one card per band with an on/off switch ("keep in my Travel DNA"), a summary line, and pills when open. Sub "Your defaults. Tap a card header to edit it."
- **What matters when you choose**: cards for the lasting items the person has set (food needs, language, how you travel, step-free access), plus "+ <item>" chips to add more. Sub "Tap a card header to edit it. Add more below."
- **Who and where from**: "Who you usually travel with" (Travel DNA path) or "Who is going this time" (trip), and "Home airport" (the home picker).
- **Tastes we learned**: "Photo picks" and "Your answers and swipes" (a count, not editable).
- **This trip only** (starts switched off): dates and flight limits. Sub "Switch on to keep any of these in your Travel DNA."
- Every card header opens and closes its card. Cards open by default only where the person already made specific choices. Each editable card has a keep switch; the default for each row is in section 6.
- Footer, from a trip: "Save and go back" and "Back without saving". From the Travel DNA path: "Save my Travel DNA" and "See where it points".

### 4.12 Returning traveler (Welcome)
- "Welcome back, <name>. Planning something?" Below it, the saved Travel DNA as tags, with "No need to answer all that again. Two questions, then your shortlist."
- Card "When?" (twelve months) and "Who is going this time?". Button "Show my shortlist". Interest follow-ups already answered are not asked again. The shortlist is never locked.

### 4.13 Saved
"Saved. Next trip starts here." Shows the first sketch as tags with a calibration bar, then "Kept just for this trip: …" and "Next time we only ask: when, and who is coming." Buttons "See it as a returning traveler" and "Back to my shortlist".

### 4.14 Sheets and the popup
- Sheets (slide up from the bottom, dismissed by the backdrop or a "Done" button): who is going; when (months, plus weeks for a time window); What matters (section 5.3); the four bands; your limits (home picker, nonstop, longest flight); "Set aside by your limits" (each place and the reason, with "Change a limit and these come back."); place detail; the five-swipe sheet ("Stop here" link); and "Keep any of this?" before saving ("Tastes are saved to your Travel DNA by default. Trip details stay with this trip unless you say otherwise.", one switch per row marked "Your DNA" or "This trip").
- **The five-top-interests popup** (centred, with a dimmed backdrop, dismissed by "Got it" or the backdrop): a star, the heading "You already have 5 top interests", and the text "Deselect an interest above to add a new top interest." It appears on the Top interests screen and on the Travel DNA page. There is no inline message.

## 5. Shared pieces

### 5.1 Companions
Solo, With friends, With a spouse or partner, With my kids. Multi-select.

### 5.2 Open to
The app's four bands exactly (Budget & Comfort, Weather, Social Vibe, Physical Demand). All selected means no preference, and the last selected pill cannot be turned off on the DNA page.

### 5.3 What else matters when you choose
- One collapsed line. Opened, it shows a two-column grid of tiles, one per item: Social vibe, Physical demand, Kid-friendly, Food needs, Language, How you travel, Deals, Avoiding crowds, Step-free access. Tapping a tile opens a small editor under the grid: pills to pick, "Clear", and, where a firm rule makes sense, a switch between "Nice to have" and a must-have wording (kids: "Must be geared to families"; food: "Rule out places with few options"; language: "Rule out places where English is hard"; access: "Rule out places that are hard"). Several tiles can be open at once and all are multi-select.
- Below the grid, "Your picks · N": every selection as a removable chip.
- The app's three Value items: Deals ("Cheaper off-peak travel") and Avoiding crowds ("Quieter places and seasons", with the choice "Favor quieter places") are tiles here. Road-tripping is covered by the "Road trip" choice under How you travel, so it has no tile of its own.
- In the Travel DNA path only the lasting items show (food, language, how you travel, step-free access). Closed line text when something is set: the picks joined with " · ".

### 5.4 The home city or airport picker (everywhere a home is asked)
- One choice, never multi-select. Used on Basics (Travel DNA path), Getting there, the limits sheet, and the Travel DNA page.
- A text box "Type a city or airport code". Under it, before two letters: "Start typing a city, like “San”, or an airport code like “JFK”."
- From two letters, up to six matches, best first: city starts with the text, then airport code starts with the text, then any word of the city starts with it, then the region contains it (only for three or more letters). Each match shows the city, the region or airport name, and the code in the accent colour (for example "San Francisco · California, US · SFO"). Cities with several airports list each one.
- No match: "No airport found for “text”. Try the nearest big city."
- Choosing one shows a filled chip "📍 San Francisco SFO" with a "Change" link. "Change" clears the choice and also clears nonstop and the flight-hour limit.
- The stored value is the airport code plus the city name.

## 6. What is kept in the Travel DNA, and what stays with the trip

| Row | Kept by default |
|---|---|
| Each Open-to band (budget, weather, social vibe, physical demand) | yes, except Weather in a trip (trip only) |
| Food needs, language, how you travel, step-free access | yes |
| Kid-friendly, deals and avoiding crowds | this trip only |
| Who | yes in the Travel DNA path, this trip only otherwise |
| Home airport | yes |
| Photo picks | yes |
| Interests, levels and specifics | yes |
| Answers and swipes | yes |
| Dates, flight limits (nonstop, longest flight) | this trip only |

Each row has a switch that flips it. Saving writes only the kept rows to the profile.

## 7. Behaviours that must match exactly

1. Tabs and the next-category button follow section 4.4, including the "never opened" test.
2. The lock lifts on the fifth non-skipped answer, or when no question is left, or for returning travelers.
3. A level change other than Off always opens a Travel DNA card. Order never changes while the page is open.
4. The sixth top interest never gets set. A popup opens instead.
5. Flight limits only apply once a home is chosen. A place set aside by a limit says why.
6. A specialist place stays out of every list unless one of its gate interests is set to Love or Top (a weight of 7 or more, the rule already built, left as is); search still finds it. In the onboarding flow only Top can be set before the Travel DNA page, where Love is also available.
7. Changing anything on the shortlist (chip bar or sheet) re-ranks straight away, with the movement animation.

## 8. Data the screens need

### 8.1 Interest levels
Off, Curious, Like, Love, Top. The app stores a 0 to 10 weight for each interest. Decided mapping: Off 0, Curious 3, Like 5, Love 7, Top 9.5. Love (7) and Top (9.5) both open specialist places, because the existing rule (7 or more) is left unchanged.

### 8.2 First eight in each category
- Nature & Wildlife: Scenic Landscapes, Wildlife Viewing, Safari, Whale Watching, Camping & Backcountry, Stargazing, Birding, Landscape Photography.
- Sports & Recreation: Hiking & Trekking, Skiing & Snowboarding, Road & Gravel Cycling, Surfing, Snorkeling & Diving, Golf, Fishing, Sailing & Boating.
- Culture & Discovery: History & Archaeology, Architecture, Local Culture & City Exploration, Street Food & Markets, Museums & Art, Fine Dining, Festivals & Live Events, Wine & Spirits.
- Relaxation & Leisure: Beaches & Swimming, Sunbathing, Luxury Hotels, Nightlife, Shopping, Spa & Wellness, Hot Springs, Yoga & Wellness Retreats.
The rest of each category follow by the app's audience tier (iconic, popular, enthusiast, specialist), then the app's order. Display names: Yoga & Wellness, Seasonal Blooms and Climbing & Mountaineering use the shorter labels.

### 8.3 "People who pick these often add"
For each picked interest, up to five neighbours ranked by the similarity of the app's own Travel DNA attribute weights (`SLIDER_ATTRIBUTE_MAP`). The suggestions are the four highest-scoring neighbours not yet picked. A few hand fixes exist where the weights give no signal (birding, wind sports, golf, spa).

### 8.4 Specifics ("What kind?")
Each interest has a short list of specifics. In the real build these come from the live chips on the admin Chips tab (up to five per interest). Interests with no live chips show no specifics and cannot be fine-tuned. The mockup's chip names are placeholders.

## 9. What is invented in the mockup (not spec)

Sample destinations and their scores, the five swipe scenarios' score effects, the sharpen question bank and the logic that picks the next question, the "reshuffle about N of your top 5" hint, the calibration percent formula, flight hours and nonstop flags, the airport list's proxy times, the vibe photos, and the scores the mockup derives for interests it has no data for. The real build uses the app's real scoring, questions and data. What is spec: how these things are shown and when.

## 10. Decisions (owner, 17 Oct 2026)

1. **Airports and flights.** Agreed: a list of real commercial airports from an open dataset (about 500 to start), flight hours estimated from straight-line distance, and no nonstop switch until real route data exists. The nonstop switch in the mockup is not built in v1.
2. **Sharpen questions.** Agreed: the app's existing deep-dive and domain questions, picked the way the mockup picks (expert lane first, then the question that would change the top five most). The mechanics are in section 4.8; the questions come from the app.
3. **Level to weight.** Decided: Off 0, Curious 3, Like 5, Love 7, Top 9.5. (The Curious and Like values are my fill-in; the owner set Love and Top.)
4. **Specifics and ranking.** Agreed: v1 stores and shows the specifics a person picks but does not change the ranking yet.
5. **Saving.** Agreed as written. In plain words: when someone saves, the things in the "Kept by default" table in section 6 (budget, interests, food needs, language and so on) are remembered for their next trip, and the others (dates, flight limits, kid-friendly, deals, avoiding crowds) stay with this one trip. Each row has a switch to flip it. The owner did not follow the original question, so this table stands as written unless they say otherwise. Where it is stored (the existing `user_dna_state` and `user_preferences` tables) is a build detail, not a product decision.
6. **Where the Travel DNA page lives.** Agreed: it replaces the current profile panel and the old summary screen, reached from the round DNA button.
7. **Sign-in timing.** Not decided. The build keeps today's behaviour and treats it as a separate question.
8. **Shortlist style.** Decided: the tight style (V2). V1 is dropped for now.
9. **Avoiding crowds and road-tripping.** Decided: Avoiding crowds becomes a tile in "What else matters". Road-tripping is already covered by "Road trip" under How you travel.

**A. Specialist places and the Love level.** Decided: leave the existing rule at 7 (`GATE_MIN_WEIGHT` in `src/lib/scoring/gating.ts`), so Love (7) and Top (9.5) both open specialist places. The mockup is updated to match. The owner can change the number later from the admin controls screen (section 13).

**B. Settings screen.** Decided: the owner wants one master admin screen holding controls like these so the way the app works can be fine-tuned later. That screen is not part of this build, but the build is arranged so it can be added without rewriting anything (section 13).

## 11. The "mockup vs real" list

Anything that cannot match the mockup exactly is listed here with the reason.

**Slice 1 (first screen and path logic), built 17 Oct 2026**

- The mockup's phone frame and the notes panel with the stand-in travelers are demo-only. The real screen fills the phone, with a 440 px column on wider screens.
- The first screen's progress bar is a fixed quarter, as in the mockup (the spec's "position in the person's own path" applies from the second screen on).
- Screens after the first are placeholders showing the person's own path, until their slices.
- Small fix: the emoji column on the first screen's tiles no longer shrinks when the text wraps to two lines (the mockup lets it shrink).
- The browser tab title is still the app's global one, "Create Next App". Page titles are not part of this build.
- The flow is reachable only at `/onboarding-v2`, and only when the environment setting `ONBOARDING_V2=1` is on. It is off everywhere by default.

## 12. How each slice is checked

Stand-in travelers in the mockup, used for every comparison: Sam (a nice vacation, flexible), Priya (angler, Top interest), Alex (niche loves), Riya (vegan family of four), Omar (golfer, specialist place), Jordan (one exact week, nonstop), Mina (no trip yet, Travel DNA path), and a returning traveler. For each slice:

1. Drive the real build to the same state for each relevant traveler, at phone width, light and dark.
2. Put the real screenshot beside the mockup screenshot. A difference in copy, order, spacing, motion or behaviour is fixed or listed in section 11.
3. Run the tests for the slice's decision logic, which replay the cases from sections 4 and 7.
4. The owner approves the slice before the next starts.

Slices: (1) first screen and path logic, (2) interest picker and Top interests, (3) basics, home picker, getting there, (4) shortlist teaser and sharpen questions, (5) Travel DNA page, (6) saving, returning traveler and the switch.

## 13. Settings to keep adjustable (for the future master admin screen)

Decided: every number and list below lives in one settings file with its default, `src/lib/onboarding/settings.ts`, and the screens and logic read from it and never hard-code them. Later, a master admin screen can save overrides in the database and the same file will read them first. The existing admin override tables (for interests and personas) are the pattern to copy. The screen itself is a separate project.

| Setting | Default today |
|---|---|
| Weight for each level (Off, Curious, Like, Love, Top) | 0, 3, 5, 7, 9.5 |
| Specialist-place unlock weight | 7 |
| Maximum Top interests | 5 |
| Questions needed to unlock the shortlist | 5 |
| Interests shown before "Show more" in each category | 8, and which eight (section 8.2) |
| Related suggestions shown on the interest screen | 4 |
| Places shown on the shortlist | 5 |
| Airport matches shown while typing | 6 (minimum 2 letters) |
| Sharpen-question picking: which kinds first, and the weight of "would change the top five" | expert lane first |
| Which "What else matters" items exist, their choices, and which are kept by default | section 5.3 and section 6 |
| The Open-to bands and their labels | the app's four bands |
| Which rows are kept in the Travel DNA by default | section 6 |
| Calibration percent formula weights | as the mockup |
| Copy for the screens | not in v1; copy stays in code |

**Slice 2 (interest picker and Top interests), built 17 Oct 2026**

- "What kind?" specifics come from the live chips on the admin Chips tab (spec 8.4), as decided. Only the seven interests with chips (hiking, birding, safari, diving, whale watching, surfing, wildlife viewing) show a row; every other top interest shows just its "★ Top interest" header. The mockup invented specifics for all of them. The top card keeps its double height either way.
- The popup covers the whole screen and the page behind it still scrolls; the mockup's popup sat inside the phone frame.
- Movement animations (rows sliding, category tabs widening and narrowing) match the mockup's timings. They are measured on the page, not inside a frame, so scrolling never causes a slide.
- "People who pick these often add" uses a fixed table (`src/lib/onboarding/related-interests.ts`) copied from the mockup, not recalculated on the fly.
- Picks are held in the flow only (as Like or Top). Nothing is saved until slice 6.
- Skipping interests ("Skip, I have no favorites") goes straight to the basics, as in the mockup; the basics screen is still a placeholder.

**Slice 3 (When, Getting there, the basics, Travel DNA basics, home picker), built 17 Oct 2026**

- **Airport list is interim.** It is a hand-written starter list of 369 airports (code, city, region, coordinates good to a few miles), not an open dataset. The owner agreed an open dataset (about 500 airports); downloading one needs a go-ahead on the specific file, so it has not been fetched. The data file keeps a simple shape so the dataset can replace it.
- **No nonstop switch** on Getting there, as decided (no real route data). The Travel DNA basics home line therefore reads "Optional. Type a city or airport code. Used to warn you about long flights." (the mockup also said "and to show nonstop options").
- **Flight limits only record the choice.** The hour pills work and need a home chosen first ("Choose your home airport first"), but nothing is set aside until the shortlist exists (slice 4). Hours will be estimated from straight-line distance (500 mph plus half an hour), using the function already written and tested.
- **Temperature hint converts to the traveler's units** through the app's existing units setting, where the mockup always showed °F.
- **Companion, band, care and home choices are held in the flow only.** Nothing is saved until slice 6.
- **Still placeholders:** the photo picks, the taste cards, the Travel DNA page and the shortlist.

**Slice 4 (photo picks, taste cards, shortlist with the teaser, sharpen questions), built 17 Oct 2026**

- **Sharpen questions and taste cards are the app's own experience cards** (about 190 broad cards), answered No / Yes / Love, as decided. The mockup's invented question bank is gone. The tag reads "Quick one", or "<emoji> <category> · expert lane" when the card is about one of the traveler's interests (Top interests first, then the rest). The hint's "reshuffle about N of your top 5" is the real count, worked out with the real ranking.
- **A new table links the 48 interests to card categories** (`INTEREST_CARD_CATEGORIES`, so Surfing asks Surfing cards). An interest with no cards of its own (stargazing, aurora, geology and a few others) gets no expert-lane questions.
- **Ranking is the app's own engine.** Picked interests use their level's weight (Like 5, Top 9.5); every other interest comes from the app's own profile-to-weights conversion, seeded by who is going, the Open-to bands, the photo picks and every answer. A person with no picks is ranked entirely from that profile.
- **"What else matters" choices and the "What kind?" specifics are recorded but do not change the ranking.** The app has no kid, food, language or access data for places yet, and specifics were agreed not to rank in v1.
- **The shortlist cards are the live results page's own cards** (rank, name, score, emoji, region, save and visited menu, and the full place page on tap), five of them, with the same sliding when the order changes.
- **The calibration percent is the app's real formula.** It starts at 0% and rises slowly (about 2% after five answers), so "First pass" shows for a while, where the mockup showed 46%.
- **Flight limits are built but nothing is set aside yet:** no place has coordinates on file (0 of 200), and a place without coordinates is never set aside. Hours are estimated from straight-line distance. This needs the place coordinates filled in.
- **With no month chosen the ranking uses the current month** (the engine needs one). This only affects the Travel DNA path.
- **Photo picks are my own mapping:** each of the eight pictures nudges the app's preference attributes like a double-strength "yes"; gradients and emoji stand in for photography.
- **"See all" saves the traveler's choices as their preferences and opens the normal results page.** Wired, not yet exercised against the live database.
- **"Save to my Travel DNA" and the round DNA button open a placeholder** until slice 5. Returning travelers (never locked) arrive in slice 6.
- **The page is very slow in the local development server (about 100 seconds), as the existing home page is** (it passes the full place list to the browser, which the dev tools serialise slowly). I tested it in a harness with the real data and the real components; it still needs a look in a production-style build.

**Slice 5 (the Travel DNA page and the saved screen), built 17 Oct 2026**

- **Specifics on interest cards come from the live admin chips**, as in slice 2: an interest with none shows its level control but no "What kind?" row and cannot expand. The mockup invented specifics for every interest. The "fine-tuned" count counts interests with at least one specific picked.
- **The calibration percent is the app's real formula** (see slice 4), so it starts near 0%.
- **Nothing is stored yet.** "Save and go back" and "Save my Travel DNA" return to where the page was opened from (or open the saved screen) and show "Travel DNA saved", but the choices live only in the flow until slice 6. The "keep in my Travel DNA" switches are recorded and shown on the saved screen.
- **The saved screen has no "See it as a returning traveler" button yet.** That arrives with the returning-traveler path in slice 6; only "Back to my shortlist" is there.
- **"See where it points"** (Travel DNA path) opens the shortlist with no month chosen, so it ranks for the current month.
- **A "what matters" card the traveler empties stays on the page** ("Nothing picked yet"), as in the mockup, instead of disappearing as it does on the basics screen.
- **Place coordinates are now filled for all 200 places** (one representative point each, by hand, approximate), so flight limits now set places aside on the shortlist. Broad places have a note in `scripts/data/place-coordinates-oct17.json`.

**Slice 6 (saving, the returning-traveler welcome and the switch), built 17 Oct 2026**

- **Saving writes to three places.** A new table `user_travel_profiles` holds the whole choice set (interests and levels, "What kind?" specifics, Open-to bands, what matters, who, home airport, vibes, answers and swipes, plus the "keep in my Travel DNA" switches). The app's own DNA state (`user_dna_state`) and preferences (`user_preferences`, weights computed on the server) are updated too, so the normal results page and the old DNA features see the same traveler. The table has Row-Level Security on.
- **Month and who-is-going are saved only if the traveler switched "keep" on**, as the saving rules in section 6 say. Tested for real: a traveler who left the date switch off came back with no month stored.
- **Returning travelers start on the welcome screen** (their Travel DNA tags, then When and Who for this trip, then the shortlist). Their shortlist is never locked, and the five-question gate is skipped. The welcome screen is the "Welcome back" mockup screen.
- **"See it as a returning traveler"** on the saved screen opens that welcome screen immediately, so a new traveler can preview what they will see next time.
- **Two address switches for testing:** `/onboarding-v2?fresh=1` ignores any saved profile (starts as a new visitor); `/onboarding-v2?review=1` opens a returning traveler straight on their Travel DNA page. The old "review your DNA" link (`/dna?entry=review`) goes to the review address.
- **The on/off switch is the setting `ONBOARDING_V2=1`.** With it on, `/dna` redirects to the new flow; with it off, `/onboarding-v2` shows "not found" and the old flow is untouched. Nothing is switched on in the live site yet.
- **Production-style check (17 Oct 2026):** built the app, ran it, and went through the whole new-visitor path in a phone-sized browser: door, when, who, interests, ranking, shortlist, five answers (list unlocked), Travel DNA page, save. The saved row was read back from the real database, and reloading the page showed the returning welcome with the right tags and an unlocked shortlist with the same five places. The production server answers in 1 to 3 seconds. The browser pane stalled twice while hidden; the server itself was fine each time, apart from once needing a restart after it stopped answering (consistent with the known connection-pool issue; not investigated further).
- **A test traveler was left in the real database** (one anonymous row in `user_travel_profiles`, plus its DNA state and preferences). Harmless; can be deleted.
- **Still open:** sign-in timing (saving works for an anonymous traveler today, tied to the browser); the care items and specifics still do not change the ranking; the airport list is the interim 369-airport list.

**Changes after the owner's first try, 17 Oct 2026**

- **"See all N places" now opens the real results page with the traveler's Travel DNA active.** It used to save only the interests and month, so the results page, which stays hidden until it sees Travel DNA or a persona, showed an empty start screen. It now saves the whole profile first (profile, DNA state, preferences), then the exact weights and month the shortlist used. The results page also treats a traveler with a saved onboarding profile as started, even if they answered no questions.
- **Screen order changed: interests lead.** With "something I love to do", the interests and top-interests screens come first, then the timing screens (When, and Getting there for a specific window), then the basics. The month picker comes first only for "a great trip" with a specific window. A great trip with flexible timing now asks the basics and photo picks first, then the month last (my assumption; the owner did not specify this case).

**Changes after the owner's second try, 18 Oct 2026**

- **Top interests says "Choose up to 5"** (the number comes from the setting).
- **The sixth-top-interest popup is gentler:** a small card in the middle, no dimming of the screen, dismissed by the button or a tap anywhere.
- **"What else matters" is a list of rows, not a two-column grid.** Each row shows one chip: "No preference" until something is picked, then the picks. Tapping a row opens its choices right under it. Every item reads the same way, including on the Travel DNA page, where "Nothing picked yet" is now "No preference" and the "+ item" chips are gone because every item is always listed.
- **Removed "Step-free access" and "Avoiding crowds"** (they repeat physical demand and social vibe). Social vibe and physical demand now sit with the other "What matters" items on the Travel DNA page; budget and weather stay under "Open to".
