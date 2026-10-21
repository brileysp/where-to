# To do

Open items only, cleaned on 19 Oct 2026. The full running history before that date is in `docs/archive/todo-history-2026-10-19.md` (batch-by-batch narratives, build notes, old numbers). Remove an item when it ships.

Where the other lists live: the admin **To do** tab (site-wide items, due dates, repeats) and each interest page's Outstanding items (per-interest items). Both can drift from this file and from reality, so verify against the live data before quoting a figure.

## Needs you (decisions and checks)

- **Onboarding questions.** Approve, reject or add on the questions page (claude.ai/artifact/TUAV7kbknYJXHVUiLrzKAw), then tell Claude "apply my question picks".
- **Chips:** your 20 Oct picks are applied (59 approved, 15 rejected drafts deleted, 10 of your own added). 11 interests still have nothing approved; one proposed change is undecided (Safari: Private reserves instead of Boat and canoe safaris).
- **Turn on the new onboarding flow in production** (`ONBOARDING_V2=1` in the hosting environment).
- **Push and deploy** the latest local commits (capitalization fixes, chip approvals, onboarding questions tab; their database changes are already applied).
- **Open onboarding decisions:** should chips affect ranking; when to ask for sign-in; questions still unwritten for Surfing, Diving, Wildlife Viewing and the ten DNA dials; Hiking question 5 needs a column.
- **Northern Tanzania:** set diving, surfing, wind sports, whale watching and beaches to N/A (their text is about Zanzibar, which left the place)?
- **Pilot chip data:** review the drafted data for Fine Dining, Coffee & Tea, Street Food, Shopping, Nightlife, Traditional Crafts (Claude judgement drafts).
- **Birding calls:** five bird-name decisions (Bewick's Swan, Eurasian Teal, Steppe Buzzard, the French Polynesia white terns, Citrine White-eye in Palau); six overviews over their lower length cap; views/photo ratings review; endemic counts left blank (~38 places); regional endemic counts; eBird totals for ~100 places that block automated access.
- **Hiking:** open decisions saved after 15 Oct; closures found 16 Oct that make live text out of date (Grand Canyon inner-canyon trails after the 29 Aug 2026 flood, others on the admin to-do).
- **Surfing:** scores that look too low for their waves (Namibia, French Polynesia).
- **Whale watching:** review weak source links on 16 places (2seewhales.com is one operator, logged as a source on 15 places).
- **Cell states** for interest columns: pick one of the two mockups.
- **Checklist:** review the proposed 67-step interest completion checklist (`docs/interest-completion-checklist.md`).
- **Supabase usage checks:** one was due 17 Oct, another 21 Oct (safe if the month so far is under about 1.5 GB), the grace period ends 4 Nov 2026. Decide on Pro only if the month trends over 5 GB. Check the live admin matches the local one.

## Ready for Claude

- **Broadened places:** the new Birding and Wildlife text for the 14 places went live 20 Oct 2026 (source-checked). Still to do: refresh their birding data columns; re-check scores for broadened places that only have scores (Myanmar, Assam & Northeast India, Hiking and others, as to-dos on each interest page); Northern Tanzania's Zanzibar-based texts (N/A decision above); Jamaica wildlife score looks low next to Cuba, the Dominican Republic and Puerto Rico.
- **Conditional onboarding questions** (table and admin controls built 20 Oct 2026): a question is asked of everyone, or only when one of its chips is ticked. Still to do: apply the chip-to-question links from the Chips and Questions page once you finish reviewing it; show the questions in onboarding and on the Travel DNA page using `src/lib/onboarding/question-rules.ts` (it also holds the 2/3/4/10 shares per top interest, in settings `questionShares`); make the shortlist unlock count follow the number of questions actually asked (it is still a fixed 10 in the old No/Yes/Love flow).
- **Your picks are in the admin (21 Oct 2026)**: 186 approved chips (22 rejected drafts and 7 replaced drafts deleted), 167 approved questions, 15 chip-to-question links; map of page ids to admin question keys in `scripts/data/apply-picks-oct21-map.json`. The six live chips you rejected were deleted on your word (Wildlife: Large herbivores; Safari: Big cats; Whale watching: Swim with whales; Surfing: Learn to surf; Diving: Big animals, Caves and cenotes). Still to do: tie the other questions to chips (I draft, you review in a grid); reason-chip messages for the 167 questions; columns (only 14 questions have one; 135 chips wait on a column).
- **Review the suggested question links** (21 Oct 2026): 28 links on 16 questions where a question clearly means nothing unless a chip is ticked. They do nothing until accepted. Admin: Interests, pick one, Chips & questions, Questions section, Grid. Accept or dismiss each cell, a row, or all of them. Borderline ones to look at: Museums & Art queue-skipping, Geology hazards (also opens for geothermal fields), Wine & Spirits taste style.
- **Matching model decided (21 Oct 2026)**, see `docs/matching-model.md`. Built: the formula (`personalMatch.ts`), the admin Matching tab with the editable numbers, and a reason-chip message field on every question. Still to do: a checked rating column for every chip; a fit for each question from its columns; store travelers' ticked chips and answers; call it from the scoring in shadow mode first; show reason chips on the card. Move the two bike-rental questions (Cycling, Mountain Biking) from Limit to Lean when applying your picks.
- **Spectator Sports is gone** (folded into Festivals 20 Oct 2026): the "Sporting events" chip has Festivals' first column (23 places, copied from the old scores; Wimbledon and US Open moved to Festivals events). The key was stripped from all places and 20 saved preferences (weight folded into Festivals); backup in `docs/backups/spectator-sports-removed-2026-10-20.json`. Festivals' other chips still need columns.
- **Landscape Photography is folded into Scenic Landscapes and Wildflowers is now Blooms and Fall Colors** (done 20 Oct 2026: interest hidden, chips added, names changed). The Scenic "Landscape photography" chip now has its column (filled for 174 places from the old photography scores, 20 Oct; it can go live whenever you want). Still to do: the "Fall foliage" chip waits on a data column; when Scenic and Blooms are authored, cover photography (Scenic) and foliage (Blooms: timed events for notable places, rescore the thin 40-place bloom scores). Link the three photography questions to the chip once approved. The picker's eighth Nature slot is now Aurora.
- **Columns and data for the approved draft chips** (18 from 19 Oct plus 59 from 20 Oct, and 10 you added).
- **Birding:** write the "access counts" rule into the v8 directive; re-run the audit for the 9 places that returned nothing; re-run the eBird-name sweep on the 200 live texts (~300 plain renames) then ask for approval; check the drafted columns; source-check draw birds (55 of 200 done); add odds chips to headline species; Champagne's Lac du Der cranes (waiting).
- **Diving:** check the drafted columns; N/A reason for the 1 place without one.
- **Safari:** N/A reasons for the 183 N/A places; re-run the Rwanda audit; re-check scores for Assam & Northeast India.
- **Surfing:** the last blank cells (breaks 8, wave direction 4, localism 3, wave size 3, boards 3, access 2, lessons 2); source-check columns for places not yet web-checked; check the six new columns (first drafts); a wider web sweep for permits (20 of 106 filled).
- **Hiking:** final expert read of all 200 texts; source-check the filled columns and re-check the 42 status notes (due 16 Nov).
- **Wildlife:** check the drafted animal columns.
- **Author the remaining interest content:** read `docs/interest-content-authoring-playbook.md` first. Next in line: the on-foot family (scenic landscapes, with photography folded in, then camping, trail running), then sailing and kayaking (`prompts/kayakingRafting/v1.md` exists).
- **Species names:** ~300 bird renames to eBird names (above); word lists for the bold species markers on birding, wildlife and other animal interests.

## Ideas and later

- Admin: ranked lowest-completeness list on the home page; per-place completeness score; weekly completeness snapshot; hidden place fields (curve source pill, isPublished, scoreStatus, parentPlaceId); thin old human edit-history entries (73 MB of 500 MB used); egress plan steps 3-4 (text in its own table, shared cache); add the passcode and admin email to Vercel preview builds; avoid repeated production builds.
- Decimalization: hot springs and beaches still coarse (about 40% and 60% whole or half numbers); wind sports and wildflowers need a check.
- Travel advisories: the field and admin tab exist but are empty; public-page banner not built. Set advisories for Myanmar and Cuba.
- Cost-checking agent (edits saved as kind "agent"); visually verify the Cost Items screen.
- Hot springs: 27 places have no logged sources; re-verify or leave unlogged. Reference sites: second wind-statistics source; check eBird and Merlin by hand each quarter.
- Future places: import the lists still only in the old Catalog Wishlist artifact (surfing 12, windsports 10, wildflowers 7, aurora 6, beaches 6, climbing 39); keep one name per place across lists.
- Place grain: pending splits (Egypt, Tanzania/Zanzibar, Thailand Gulf, Vietnam), Kaikoura into Marlborough & Abel Tasman, Hawaii (Kauai, Oahu), San Francisco, Makgadikgadi & Central Kalahari, Lower Zambezi, Kafue. Specialist ("gated") places are built; none gated yet.
- National parks: a tag or type of place, not an interest.
- Move Gemini calls to a newer model when available (the thinking cap stays on).
- Unreproduced broken-render report on the results page.
- "A vs B" onboarding question plan: superseded by the onboarding questions now in the admin (Chips & questions tab).

## Standing rules

- **Review pass reminder.** Once every place for an interest has been generated, remind the owner to ask for the full specialist/fact-check review pass (a deliberate, owner-requested step, not automatic).
- **Never apply Gemini text without the source-check** (`docs/fact-check-process.md`; the gate is enforced when applying).
- **Broadened places** (`docs/renamed-places.json`) need a scope sheet before any generation; call a place by its current name.
- Scripts that read the database must load `.env.local`; set `PLACE_ROWS_SNAPSHOT=1` to avoid re-downloading the catalog; avoid repeated production builds.
- Species names: birds full official name in Title Case; every other animal lowercase except proper nouns and adjectives; `**bold**` markers are written automatically for safari and whale watching.
