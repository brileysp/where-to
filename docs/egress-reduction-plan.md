# Making the place catalog small (plan, 14 Oct 2026)

Goal: stop Supabase egress from growing as more interests get text, and make the public page lighter and faster. Steps 1 and 2 were built on 14 Oct 2026 (see section 6). Steps 0, 3 and 4 are not.

## 1. The problem in numbers

Every time the app reads the whole catalog from the database (200 places), it downloads every column of every place. Today that is **6.6 MB**. It is made of:

| Part | Size now | Share | Who needs it |
|---|---|---|---|
| Authorship stamps for overviews and monthly text (two columns) | 1.9 MB | 28% | The admin only. The public page never shows them. |
| Text: monthly blurbs, overviews, sources, N/A reasons, cost notes | 2.5 MB | 38% | Only when a visitor opens one place. |
| Scoring and list columns (curves, base scores, bands, months) | 2.2 MB | 34% | The ranked list. |

**It grows.** Only 12 of 54 interests have any text, and only 16% of the place-by-interest pairs that apply have it (1,085 of 6,799). Each pair adds about 1.9 KB of text and 1.8 KB of stamps. If every pair gets text, the text grows by about 10 MB and the stamps by about 10 MB. **A full read of the catalog would go from 6.6 MB to about 27 MB.** At that size, about 185 full reads would use a whole month of the free plan's 5 GB.

**When full reads happen:** a server starting up, a cold start on a hosting service, the cache being cleared (some admin saves), my scripts, and `next build`. Reading one edited place afterwards is cheap (about 30 KB), and a cheap "what changed" check runs every 30 minutes. What I do not know yet is how many full reads happen per day today; step 0 finds out.

## 2. The plan, in four steps

Each step stands alone, can be checked on its own, and can be rolled back on its own.

### Step 0. Measure (about an hour)
- Log every full read of the catalog (when, why, how many bytes) so we know what is actually costing egress.
- Measure how heavy the public page is when it first loads.
- You check the Supabase Usage page for the cycle that started 14 Oct.

### Step 1. Leave out what the public page never reads (about half a day)
- Add a public read that asks for named columns only and leaves out the two stamp columns, with its own cache.
- The admin keeps its full read. The two are separate, so nothing changes for you in the admin.
- **Result:** 6.6 MB becomes 4.7 MB now. At full authoring, 27 MB becomes about 17 MB.
- **Check:** all 200 places score and rank exactly the same before and after; a test fails if a stamp column ever sneaks into the public read.

### Step 2. Load text only when a place is opened (about one to one and a half days)
- The ranked list is built from scores only. The overview, monthly blurbs, sources, N/A reasons and cost notes load when a visitor opens a place, one place at a time (about 10 to 100 KB).
- The detail tabs show a short loading state. I would load the text as soon as a card is tapped so it is usually ready by the time the sheet opens.
- **Result:** the public list read is about 2.2 MB, and it stays about 2.2 MB however much text you write. The first page load also gets lighter, which matters on phones.
- **Check:** same scores and ranking; every detail tab shows the same text as before; a test fails if text columns appear in the list read.
- **Touches:** the public data mapping, the three detail tabs (For You, About, Costs), and one new server action.

### Step 3. Give the heavy text its own table (about two days, only if needed)
- Move overviews, monthly text and stamps into a separate table with one row per place and interest. The places table becomes small.
- This also shrinks the admin's own reads, which are the full-catalog kind and grow the same way.
- It touches about 16 files (the admin grids, the editing code, the Gemini apply code, the history log, the scripts). I would only do it if step 0 shows the admin side is a real cost. It is optional.

### Step 4. Share the cache between servers (depends on hosting)
- If the public site runs on a hosting service where many copies of the app start and stop, each cold start reads the catalog. After step 2 that is 2.2 MB, which is acceptable. A shared cache that clears only when you save would make it one read.
- I could not find hosting settings in the project, so I need to know where it runs.

## 3. What to expect

| Full read of the catalog | Today | After step 1 | After step 2 |
|---|---|---|---|
| Now (16% of text written) | 6.6 MB | 4.7 MB | 2.2 MB |
| When every interest has text | about 27 MB | about 17 MB | about 2.2 MB |
| Opening one place | already loaded | already loaded | +10 to 100 KB |

This makes each read cheaper by about 3x now and about 12x later. It does not reduce how many reads happen, which is why step 0 comes first.

## 4. Risks

- **The loading state in step 2.** Mitigation: start loading on tap, and keep the detail data in memory once fetched.
- **Missing a column the public page needs.** Mitigation: a before-and-after comparison of all 200 places, run as a test.
- **Admin screens depending on the public read.** Mitigation: they keep the full read until step 3.
- **Other places that read all the text** (for example search by text). I checked the public components: only the three detail tabs use text. Step 1 would confirm the same for every call.

## 5. What I need from you

1. Where is the public site hosted (or is it only on your laptop so far)?
2. OK to add the small read counter in step 0?
3. OK with step 2's approach: text loads when a place is opened, with a short loading state?

## 6. Built on 14 Oct 2026: steps 1 and 2 (the measuring step was skipped by the owner's choice)

- **Light public read** (`src/lib/db/queries/list-place-rows.ts`): only the 46 columns the ranked list and scoring read. A full read is **1.88 MB**, down from 6.56 MB (-71%), and it stays about that size however much text is written. Its own cache; the admin keeps its full read. Every full read is logged (`[place-rows] full read of the public list: ...`), which is the read counter from step 0.
- **Text on demand** (`place-detail.ts`, the `loadPlaceDetail` server action, `usePlaceDetail`): the overview, monthly blurbs, cost notes and special seasons of one place are fetched when its sheet opens, about 12 KB per place (largest 20 KB today), and the fetch starts when a card is touched. A small "Loading details..." shows until it arrives (about half a second on the first open).
- **Found while checking:** the data sent to every visitor's browser was about 12.5 MB, 75% of it `explanations` (admin debugging text the public page never reads) and 11% `sliderCurves`. Both are now left out of the public list. The page's data is **1.3 MB**, down from 12.5 MB (-89%); the page itself is about 1.5 MB of HTML (241 KB compressed).
- **Checked:** for all 200 places the new path gives identical scores, ranking inputs and text to the old one (`scripts/check-list-vs-full.ts`); `toScoringPlace` is typed to read only the light columns, so a missing column fails to compile; a test fails if a text or admin-only column is added to the list; the sheet's About, Costs and For You tabs were checked in the running app.
- **Not done:** step 0's Usage-page check (owner), step 3 (separate table, only if admin reads prove costly), step 4 (shared cache across Vercel instances).
