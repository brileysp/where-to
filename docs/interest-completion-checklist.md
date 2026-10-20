# Interest completion checklist (proposed, 16 Oct 2026)

End-to-end process for taking one interest from idea to live, checked text. Who: O owner decides, C Claude does, S script. Automation: now = scripted today, next = easy to script, judge = needs judgment.

## Owner decision points
- Phase 0, Scope: Approve the brief, the boundary table and the go decision.
- Phase 1, Columns: Pick the final 10 to 15 columns; approve rating definitions.
- Phase 2, Rules: Approve applicability, the scoring ladder, the 10 list and the writing rules.
- Phase 4, Marginal places: Decide each marginal place in one pass.
- Phase 5, Instructions: Approve the Gemini instructions in plain language.
- Phase 6, Pilot: Review pilot text and decide if the exit criteria are met.
- Phase 7, Batches: Review each batch page and give edits.
- Phase 8, Final pass: Do the last expert read and sign off.
- Phase 9, Go live: Give the explicit go to apply.

## Phase 0: Decide whether and how
Know why the interest exists, what it must do for matching, and where it stops.
*Owner touchpoint:* Owner approves the brief, the boundaries and the go decision.

- [ ] **0.1 Write the one-line promise** (C drafts, O approves; judge). Finish two sentences: "A traveler picks this interest because ___" and "the app should recommend a place when ___". Add who the traveler is and what they are choosing between (when to go, where, how hard). *Produces:* Interest brief, half a page. *Gate:* Owner has approved the brief.
- [ ] **0.2 Match-value test** (S then C; next). List everything in the app that consumes this interest: Travel DNA questions and personas that weight it, the chip and pill, the match note, the month preview, the passport. Count how many answers or personas move a score. Check whether it is a deal-breaker (gating) interest. *Produces:* One-page table: where the interest is used and how strongly. *Gate:* At least a few personas or questions depend on it, or the owner overrides in writing. *Lesson:* Without this step an interest can be beautifully authored and never move a recommendation.
- [ ] **0.3 Boundary table against neighbors** (C drafts, O approves; judge). For each neighboring interest (hiking next to mountaineering, scenic, camping, trail running; diving next to snorkeling and whales) write what is in, what is out and where each interest stops, so every interest has a clear scope for scoring. Overlap is fine: a topic covered by a neighbor can still be mentioned here, and nothing is left out just because a neighbor also has it. *Produces:* Boundary table, copied into the Rules tab. *Gate:* Owner has approved every ruling. *Lesson:* Hiking lesson: the first rules over-excluded scenery. Never solve overlap by exclusion.
- [ ] **0.4 Catalog applicability survey** (S; now). Sort all 200 places into clearly yes, maybe and clearly no using what is already known. Count them. Flag places whose scope is wrong for this interest (renamed or broadened places). *Produces:* Counts plus three lists. *Gate:* Enough applicable places to justify the work (roughly 40 or more) or a decision to merge into a neighbor.
- [ ] **0.5 Sequence and dependencies** (O; now). Place the interest in the queue. Note what must be finished first (a sister interest whose wording this one must not repeat) and add the dates to the To do tab. *Produces:* Queue entry and To do items with dates. *Gate:* Dependencies listed.
- [ ] **0.6 Budget check** (C; next). Estimate Gemini cost (about $0.035 per place per run, so roughly $7 for 200 places, times 2 to 4 runs) and the owner review load: number of review pages, number of owner decisions expected. *Produces:* Cost and attention estimate. *Gate:* Owner says go. *Lesson:* Money has never been the constraint. Owner attention is. Plan review pages, not API calls.

## Phase 1: Choose and build the columns
End with 10 to 15 columns that earn their place and are cheap to fill with facts.
*Owner touchpoint:* Owner picks the final column set and approves the rating definitions.

- [ ] **1.1 Brainstorm candidate columns** (C; judge). Generate 25 to 35 candidates from three sources: what a traveler decides (when, where, how hard, how crowded, permits, access), what experts use (field guides, trade bodies, trip sites, forums), and what hurt in earlier interests (items reviewers kept editing by hand). *Produces:* Long list with a one-line definition each. *Gate:* At least 25 candidates; each has a definition and an example value.
- [ ] **1.2 Score every candidate on six value tests** (C; judge). 1) Does it change a recommendation or a month score? 2) Is it a question travelers actually ask? 3) Can most places be filled from free sources? 4) Is it stable for a year, or clearly marked perishable? 5) Is it comparable across places, with under 25% blank by design? 6) Is it free of duplication inside this interest (monthly text, another column here, banned keys such as "best months")? Overlap with another interest is not a reason to cut. *Produces:* Scored table: keep, cut or later. *Gate:* Every candidate has a verdict and a reason. *Lesson:* Cut anything that would be mostly blank: a column that is 80% empty adds noise to matching and to the admin page.
- [ ] **1.3 Owner vets the final set** (O; judge). Show the recommended keep list with the value-test scores and the cut list with reasons. Owner adds, removes or defers. Target 10 to 15, including one or two ratings and one or two perishable columns. *Produces:* Approved column list (artifact). *Gate:* Owner approval in writing.
- [ ] **1.4 Write the column spec** (C; next). For each column: key, label, type (choice, multi, text, rating, yes/no), allowed values in plain words, units (US units in stored text, conversion by the traveler's home country), maximum length, what blank means (nothing to report versus unknown), group, hint text, whether it is sent to Gemini. *Produces:* Column spec table. *Gate:* Every column fully specified. *Lesson:* Vocabulary check: a word you do not want in the final text must not appear anywhere Gemini can read. The "moderate" difficulty label leaked this way.
- [ ] **1.5 Design the ratings** (C drafts, O approves; judge). Define each 0 to 10 rating with what a 10, a 5 and a 2 mean, plus three example places per band. Decide who sets it (Gemini, from the text, not from a number we send, to avoid anchoring) and the consistency rule (rating within 0.5 of the place peak where both apply). *Produces:* Rating definitions. *Gate:* Owner approves anchors and examples.
- [ ] **1.6 Build the columns into the admin page** (C; now). Add the columns to the interest config, hints, completeness weights, the facts-sheet builder and the CSV export. Typecheck and test. Confirm the page renders with all cells empty. *Produces:* Columns visible on the interest page; builder prints notes for a test place. *Gate:* Typecheck passes; empty page renders; builder output looks right.
- [ ] **1.7 Perishable-field policy** (O approves; now). Name which columns go stale (closures, permits, fees, status). They carry a "checked on" date, a recheck cadence, and are kept out of overview text unless an official page confirms them. *Produces:* Policy line in the Rules tab. *Gate:* Every perishable column is dated and has a cadence. *Lesson:* Hiking found six live texts contradicted by 2026 closures within hours of researching status notes.

## Phase 2: Write the rules and scoring spec
One written source of truth for what counts, how it scores and how it is written.
*Owner touchpoint:* Owner approves applicability, the scoring ladder, the 10 list and the writing rules.

- [ ] **2.1 Applicability test and edge cases** (C drafts, O approves; judge). Write the High, Medium and Low tests (what makes a place in, with a floor for "some real activity within a day trip"), a table of at least ten real edge-case rulings, and the N/A policy: allowed or not. Hiking decided "no N/A"; surfing allows N/A with a stored reason. *Produces:* Test text and edge-case table. *Gate:* Owner rules on every edge case.
- [ ] **2.2 Scoring weights and ladder** (C drafts, O approves; judge). Five weighted factors summing to 100. Bands with example places in each. A closed list of places allowed to hold a literal 10 with a one-line definition of what a 10 asserts. Rules: 10 is per place and limited to its best 1 to 3 months, tenths not clumped on x.0 or x.5, slopes and plateaus, a closed or flooded month scores 0 to 1, a mild climate has no bad month. *Produces:* Scoring spec; anchors file updated. *Gate:* Owner approves bands and the 10 list. *Lesson:* Wildlife lesson: caliber ordering inside a tier matters, not just the curve shape.
- [ ] **2.3 Writing rules** (C drafts, O approves; judge). What the overview does and what each month does. Length caps by peak tier (maximums, not targets). When crowds may be mentioned. Difficulty words. Units. Hemisphere months not seasons. Evergreen text: no years, fees or one-off closures in overviews. Air-quality and hazard seasons only when notable and predictable. Enthusiast tone, plain words, no stock superlatives. *Produces:* Writing rules list. *Gate:* Owner approves.
- [ ] **2.4 Build the Rules tab and the validators** (C; now). Put the rules in the admin Rules tab so the owner can edit them. For every mechanical rule write a validator check (score range, length, banned or limited words, ratings consistency, anchors, month names, units). Rules that need judgment stay as review items. *Produces:* Rules tab; validator checks with tests. *Gate:* Each mechanical rule has a failing and a passing test.
- [ ] **2.5 Dry-run the rules on hand examples** (C; judge). Score three hand-picked places by hand against the rules (an obvious 10, a middling place, a flat or dead place) and check the ladder gives sensible numbers. *Produces:* Three worked examples. *Gate:* Owner agrees the three results look right.

## Phase 3: Fill the facts
Every applicable place has researched, dated, sourced cells before Gemini sees it.
*Owner touchpoint:* Owner rules on sparse places and on conflicting sources.

- [ ] **3.1 Fix place scope first** (C; now). Write a one-line scope sheet for every renamed or broadened place ("Wales as a whole, not only Snowdonia") and rewrite any text that covers only the old scope. Check each place's grain (too narrow or too broad). *Produces:* Scope sheets; scope-rewrite to-dos. *Gate:* No applicable place has the wrong scope.
- [ ] **3.2 Reference-site list** (C; now). Keep a short list (about ten) of the sites used again and again to check this interest, each with access type (AI can read it, partly, or human only) and a usefulness score. *Produces:* Reference sites on the interest page. *Gate:* List exists and is rated.
- [ ] **3.3 Research and fill cells in batches** (C; now). Batch by place id letter. Source order: official (park service, agency), then guidebook or tourism board, then reputable outfitter, then blog. Two sources when numbers conflict. Leave a cell blank rather than guess. Fill only empty cells so nothing typed by hand is overwritten. Log a review row with the source links. Keep "source-checked" off until a person or a strict second pass confirms it. *Produces:* Filled cells; review rows. *Gate:* Each batch loads without errors; every filled cell has a basis.
- [ ] **3.4 Perishable sweep** (C; next). Status, closure, permit and fee cells are searched for the current year and stamped with the date. Conflicting sources are recorded in the note, not hidden. Live text that a new closure contradicts is listed for the owner. *Produces:* Status cells with dates; contradiction list. *Gate:* Every perishable cell is checked within the last 30 days. *Lesson:* Recheck again just before apply (8.6).
- [ ] **3.5 Coverage report** (S; next). Per column: percent filled for applicable places. Per place: blanks, contradictions (a rating that disagrees with its own text), outliers. Sparse places go on an owner call list. *Produces:* Coverage table. *Gate:* At least 90% of non-perishable columns filled for applicable places; the rest blank by design.
- [ ] **3.6 Second-pass source check on the high-impact columns** (C or O; judge). Re-verify the columns that move scores or carry risk (seasons, permits, access, ratings drivers) against a stronger source. Then tick "source-checked" for those cells only. *Produces:* Source-checked flags. *Gate:* No high-impact cell rests on a single blog.
- [ ] **3.7 Documented-indicator columns** (C; judge). For columns defined as impartial counts (for example crowding evidence), tick only documented indicators and record the figure and source for each. Never a feeling. *Produces:* Indicator ticks plus a sources cell. *Gate:* Each tick has a source.

## Phase 4: Applicability and N/A
Every place is decided before writing, and every N/A has a plain reason.
*Owner touchpoint:* Owner decides the marginal places.

- [ ] **4.1 Classify all 200 places** (C; now). Mark each Applicable, Marginal or N/A using the Phase 2 tests and the Phase 3 facts. Store a one-line reason on every N/A, in the place record, in plain words. *Produces:* Classification list; N/A reasons stored. *Gate:* Zero N/A without a reason.
- [ ] **4.2 Marginal review page** (O; judge). One review page: each marginal place with what it actually has, the proposed call and a recommendation. Owner decides in one pass. *Produces:* Review page; decisions recorded. *Gate:* Every marginal place decided.
- [ ] **4.3 Edge types** (O; judge). Rule on recurring odd cases (wave pools, indoor venues, places reachable only by cruise or boat) once, and add the ruling to the edge-case table. *Produces:* Edge-case table updated. *Gate:* Ruling recorded.
- [ ] **4.4 Skip file and counts** (S; now). Produce the skip file for the batch runner. Check: applicable plus N/A equals 200, N/A places carry a reason and no text. *Produces:* Skip file; reconciliation line. *Gate:* Counts reconcile.

## Phase 5: Write and approve the Gemini instructions
A frozen, approved directive and a validator that catches what instructions cannot.
*Owner touchpoint:* Owner approves the instructions in plain language before any run.

- [ ] **5.1 Assemble the prompt** (C; next). Shared voice rules plus the family core (if any) plus the interest directive. Write every rule positively. Keep phrases to avoid, bad examples and closed word lists out of the sendable text; Gemini copies them. Strip comments before sending. Cap Gemini thinking low. *Produces:* Directive v1 (a new file). *Gate:* Directive reads cleanly; nothing in it names a word we want removed. *Lesson:* Three separate leaks so far: example phrases, a level-label rule, and a worked example, each copied into dozens of texts.
- [ ] **5.2 Output schema and validator** (C; now). Define the output shape (overview, 12 months, ratings in extras, flags). Validator layers: shape, content rules, cross-checks (ratings versus peak, anchors, month names against the overview, units, hemisphere words). Add tests. *Produces:* Schema; validator; tests. *Gate:* Tests pass; known-bad examples are rejected.
- [ ] **5.3 Preview the exact payload** (S; now). Print what Gemini will receive for two places (rules, facts, scope, crowd tier). Check that ratings are not sent and nothing forbidden leaks. Estimate tokens and cost. *Produces:* Payload preview. *Gate:* Nothing sent that should not be.
- [ ] **5.4 Plain-language instructions page** (O; judge). Publish the instructions as a page the owner can read without code. Owner approves. Freeze the version: any later change is a new file; a version that has been run is never edited. *Produces:* Instructions artifact; frozen version. *Gate:* Owner approval; version number recorded.
- [ ] **5.5 Smoke test** (S; now). One place end to end: generate, validate, stage, review. Confirm cost logging and that nothing writes to live data. *Produces:* One staged generation. *Gate:* Round trip works; live data unchanged.

## Phase 6: Pilots
Prove the instructions on a small, deliberately awkward set before spending the full run.
*Owner touchpoint:* Owner reviews pilot text and says what is wrong.

- [ ] **6.1 Pick 5 to 16 pilot places** (C; judge). Cover both extremes (a 10 anchor and a low place), a flat-all-year place, a southern-hemisphere place, a crowded place, a broadened-scope place, a city, a remote place and one N/A-adjacent place. *Produces:* Pilot list with the reason for each. *Gate:* Every category covered.
- [ ] **6.2 Run the pilot, staged only** (S; now). Log the authoring pass (when, model, cost). Nothing applies. *Produces:* Staged generations; pass record. *Gate:* All valid or rejects explained.
- [ ] **6.3 Fact-check the pilot** (C; next). Run the claims gate. Count wrong claims per place; this is the Gemini error rate for this interest. *Produces:* Verdicts with sources; error count. *Gate:* Every risky sentence resolved.
- [ ] **6.4 Pilot review page** (C; now). Pilot text beside live text, what the fact-check changed, validator flags, and open questions. Full text, not a summary. *Produces:* Review artifact. *Gate:* Owner has read it.
- [ ] **6.5 Sort every correction by cause** (C; judge). For each owner edit decide: rule gap, instruction wording, validator gap, data gap or one-off. Fix at the right layer. When the owner dislikes one word, fix that word, not invent a rule. Rerun the same pilot places on the new version. *Produces:* Correction log; directive v2 and so on. *Gate:* Every correction has a cause and a fix. *Lesson:* Hiking v5 to v6: over-correcting with a closed vocabulary was worse than the problem.
- [ ] **6.6 Pilot exit criteria** (O; next). Move on only when: at least 80% of pilot places are accepted with at most one owner edit; no phrase appears in more than a third of texts; fewer than one wrong fact per place; validator rejects under 10%; the score ladder looks right to the owner. *Produces:* Exit decision. *Gate:* All five met.
- [ ] **6.7 Freeze the final directive** (C; now). Record the final version, the pilot results and the cost in the memory notes and docs. *Produces:* Frozen directive; handoff note. *Gate:* Written.

## Phase 7: Write everything
Every applicable place has a valid, fact-checked staged text. Nothing is live yet.
*Owner touchpoint:* Owner reviews each batch page and gives edits.

- [ ] **7.1 Batch the places** (S; now). About 25 per batch by id letter. Facts rows, crowd tiers and scope notes complete before each batch runs. *Produces:* Batch list. *Gate:* No place runs with an empty facts row it needs.
- [ ] **7.2 Run, then repair rejects** (C; now). Rejects are fixed in a hand-edit copy of the latest generation. Always pass the full 12-score array with an edit or score fixes silently vanish. Always edit the latest generation id. *Produces:* Valid staged generation per place. *Gate:* No rejects left.
- [ ] **7.3 Claims gate every batch** (C; next). List risky sentences, verify each against a source with a URL and a note, rewrite wrong ones, carry verdicts onto reworded sentences automatically where the match is close, then verify the leftovers by hand. *Produces:* Verdicts; status shows all checked. *Gate:* Status reads all claims checked. *Lesson:* The biggest time sink. First candidate for automation (see the roadmap).
- [ ] **7.4 Skeptical read** (C; judge). Read against the numbers: level words against length and gain, plural against singular, overview against months, a route that belongs to another catalog place, stock superlatives, evergreen text, regular haze or smoke seasons, the day-trip season versus the expedition season, month text naming something the overview no longer mentions. *Produces:* Fix list applied. *Gate:* Checklist done for every place.
- [ ] **7.5 Owner review page per batch** (O; now). Lead with what the fact-check found and fixed, then flags and options, then full text with scores and a month curve. Owner edits are applied verbatim, including over-length or disliked words, and any factual doubt is flagged beside them rather than overruled. *Produces:* Review page; owner edits. *Gate:* Owner has reviewed the batch.
- [ ] **7.6 Apply the owner edits to staged copies** (C; now). Hand-edit file, new generation, carry verdicts, verify the new sentences, rebuild the page. *Produces:* Updated staged text. *Gate:* Staged text matches the owner's edits.
- [ ] **7.7 Capture patterns** (C; next). After each batch classify the owner edits. Turn repeated ones into a rule, a validator warning or a facts column. Sweep all staged text for the same pattern. Update the memory notes. *Produces:* Rule and validator updates; sweep results. *Gate:* No pattern the owner corrected twice is still unaddressed. *Lesson:* Examples: obvious seasons for northern places, "offers" at the start of every blurb, walkers versus hikers.

## Phase 8: Catalog-wide QA and expert checks
Look at the whole interest at once. Fairness across places is invisible one place at a time.
*Owner touchpoint:* Owner does the final expert pass and signs off.

- [ ] **8.1 Mechanical sweep** (S; now). Validators on every staged text. Ratings within range of peak. Lengths. Banned or limited words. Units. Hemisphere words. Month names that no longer appear in the overview. Anchor audit: no non-anchor at 10; every anchor either has one or is a recorded decision. *Produces:* Audit report. *Gate:* No errors; warnings reviewed.
- [ ] **8.2 Score resolution audit** (S; now). Share of whole and half numbers under about 30% and at least 14 distinct values in the top 20. No run of five months at the cap. No isolated cliffs. Even tenths. *Produces:* Resolution report. *Gate:* Thresholds met.
- [ ] **8.3 Force rank** (C then O; judge). List all places by peak, by each rating and by season length. Read the top 20 and the bottom of each tier against each other. Compare to outside rankings where stable ones exist. Adjust scores with a recorded reason. *Produces:* Ranked table; adjustments. *Gate:* Owner agrees the order.
- [ ] **8.4 Internal consistency scan** (S then C; now). Same text with different score. Different text with identical score where one side is plainly lesser. Flat text with a score wobble. Summer heat or monsoon months that score like peak months. *Produces:* Flag list resolved. *Gate:* Zero unexplained flags.
- [ ] **8.5 Expert read by region** (O or second reviewer; judge). A domain expert (a person, or a second reviewer with a different brief) reads by region: would an enthusiast co-sign the tiers, are iconic features missing from an overview, are there regular hazard seasons (haze, smoke, fog), is the right discipline credited. *Produces:* Expert notes. *Gate:* Each region read.
- [ ] **8.6 Perishable sweep, again** (C; next). Repeat 3.4 immediately before apply. Rewrite any live or staged text a new closure contradicts. *Produces:* Updated status cells and text. *Gate:* Nothing in the text contradicts a current closure.
- [ ] **8.7 Sister-interest check** (C; next). Read this interest beside its neighbors for contradictions (one says a trail is closed, the other open) and for scope slips (a score or text covering something this interest does not cover). Repeated or identical text is fine. *Produces:* Contradiction and scope report. *Gate:* None unresolved.
- [ ] **8.8 N/A audit** (S; now). Every N/A has a stored plain reason, no text, and the counts reconcile with 200. *Produces:* Reconciliation line. *Gate:* Reconciles.
- [ ] **8.9 Owner final expert pass** (O; judge). The last read, as an expert would, with the open-decisions list in hand. Resolve the list or defer items with a to-do. *Produces:* Sign-off. *Gate:* Owner says ready.

## Phase 9: Go live
Apply deliberately, verify immediately, check what users will actually see.
*Owner touchpoint:* Owner gives the explicit go to apply.

- [ ] **9.1 Pre-apply checks** (S; now). Back up the current live text for the interest. Confirm the latest generation per place, all valid, all claims resolved. Run the test suite, typecheck, anchor audit and the new-table security check. Mind the database transfer budget (use the snapshot mode, avoid repeated builds). *Produces:* Backup file; green checks. *Gate:* All green.
- [ ] **9.2 Apply** (O says go, S runs; now). Id-scoped apply, latest generation per place, N/A drafts applied with their reasons. The run logs itself on the To do list and closes the to-dos it fixes. *Produces:* Applied count; log entry. *Gate:* Zero failures.
- [ ] **9.3 Verify live** (S then C; now). Coverage script: every non-N/A place has an overview and 12 months, every N/A has a reason. Open a sample of places in the browser at desktop and phone width. Check the chips, the card month preview, the match note and the admin completeness bar. *Produces:* Coverage output; screenshots. *Gate:* Coverage complete; pages render.
- [ ] **9.4 Matching sanity check** (C; next). Run a handful of personas and read the top results for this interest. Compare with before. Look for absurd tops and for places the new scores pushed out unfairly. *Produces:* Persona results table. *Gate:* No result the owner calls wrong.
- [ ] **9.5 Commit and deploy** (C; now). Commit the code changes (prompts, validators, config). Note the release on the To do tab. *Produces:* Commit and deploy. *Gate:* Done.
- [ ] **9.6 Take the interest off the seasonal flags** (C; now). Once the text is live, remove this interest from every seasonal flag's affected-interest list, so a hazard already in the scores is not subtracted a second time. Where the flag used to do the work, set exact month scores that include the hazard (as an admin override) and write the hazard into the text. Flags stay as an audit list. Back up the flag data first. *Produces:* Flag backup; before/after live scores. *Gate:* Live scores match the approved numbers within 0.4.

## Phase 10: Close out and keep it fresh
Leave the interest maintainable and the process better than before.
*Owner touchpoint:* Owner reviews the lessons and the maintenance calendar.

- [ ] **10.1 Write it down** (C; now). Update the memory notes and the playbook: directive version, rules changed, cost, owner edits per place, what to do differently. *Produces:* Docs updated. *Gate:* Done.
- [ ] **10.2 Future places** (C; now). Research a long list (about 40), analyze each for being too narrow or already inside another place, rate grain, add the best 30 to the Future places tab with shared names and "also on the X list" notes. *Produces:* Long list page; Future places rows. *Gate:* Cross-list names consistent.
- [ ] **10.3 Maintenance calendar** (C; now). To do items that repeat: monthly perishable recheck, an annual full refresh, and event triggers (a disaster, a new permit regime) that force a status sweep. *Produces:* Repeating to-dos with dates. *Gate:* Dated and recurring.
- [ ] **10.4 Feedback hook** (S; next). A way for users and the owner to flag a wrong or stale line, routed to a to-do. A stale detector lists status cells older than their cadence. *Produces:* Hook and stale list. *Gate:* Working.
- [ ] **10.5 Retrospective** (C and O; judge). Which owner edits came up most? Which phase took longest? What did a pilot miss? Update this checklist with the answers. *Produces:* Checklist revision. *Gate:* Done.

## Automation roadmap
A. **Make the checklist live**: Store each interest's step status in the database and show it on the To do tab, with the gate numbers filled in automatically (coverage, claims checked, N/A reasons, pilot results). (Highest value, small build. Everything else hangs off it.)
B. **One readiness command**: `interest:readiness <key>` prints pass or fail for every machine-checkable gate in this checklist, so "are we ready for the next phase" is a command, not a conversation. (Small build; most gates are already queries.)
C. **Generic scripts for every interest**: The fill, dump, hand-edit and review-page scripts exist as separate copies for surfing and hiking. Make them take an interest key. (Small build; removes copy-paste errors.)
D. **Fact-check assistant**: For each risky sentence, search, read the best sources, and propose a verdict with a URL and a note. Only conflicts and low-confidence items reach a person. (Biggest time saver; this is where most hours go.)
E. **Owner-edit learner**: Diff staged text against the owner's edit, classify the change (word swap, fact fix, length cut, structure) and propose a rule or validator warning, then sweep all text for the same pattern. (Turns review time into rules automatically.)
F. **Review page generator**: One generator per interest family that builds the batch pages, the instructions page and the marginal-places page from the database. (Medium build; pages are rebuilt dozens of times today.)
G. **Perishable refresher**: A scheduled monthly search per place for status and permit cells, writing changes to the To do tab with the source link and flagging live text that now conflicts. (Medium build; prevents silent staleness.)
H. **Catalog QA bundle**: Resolution audit, force-rank table, cliff and plateau detection, overview-versus-month name check and N/A reconciliation as one report. (Mostly exists as separate scripts.)
I. **Pilot harness**: Run the same pilot set across directive versions, diff them, and score each against the exit criteria. (Medium build; makes directive iteration cheap.)
J. **Cross-interest checker**: Find contradicting facts and scope slips between neighboring interests. (Small build once texts are in one table.)

## Rules learned
- Never put phrases to avoid, bad examples, worked examples or closed word lists in the text Gemini reads. It copies them. When the owner dislikes one word, fix that word.
- Instruction versions are frozen once run. Every change is a new file.
- Owner-written text goes in verbatim, even over length or with a disliked word. Flag doubts beside it; do not overrule.
- Hand-edit files must carry the full 12-score array and the latest generation id, or fixes vanish silently.
- Facts decay. Closures, permits and fees carry a date and a recheck cadence, and stay out of overviews unless an official page confirms them.
- A 10 belongs to a place for its best one to three months and only if the place is on the closed list.
- Look at the whole catalog before judging a score. Fairness across places is invisible one place at a time.
- Gemini thinking is always capped low. This is built into the client and tested.
- The fact-check gate refuses to apply any generation with an unverified risky sentence. The only override is explicit and prints a warning.
- Use snapshot mode for database reads and avoid repeated builds; the database transfer allowance is tight.
- Every new table needs row-level security switched on, and the security check run afterwards.
- Overlap between interests is normal and good, even identical blurbs. Boundaries (scope) stay. Never solve overlap by exclusion or by rewording.
- Every N/A has a one-line plain reason stored on the place.
- Search summaries are not sources of truth. Cell values from them stay "not source-checked" until a stronger check.
