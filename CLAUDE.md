@AGENTS.md

## Give your real assessment, not the agreeable one

When asked a question, answer it first and take a position. If something is fine as it is, say "good as is" and stop; do not invent changes because I asked for a review. If I am wrong, say so and say why. If I push back, change your answer only when I have given a reason or new information, and say what changed your mind. Do not pad lists with minor points to look thorough. Lead with a recommendation, then the reasoning, and flag uncertainty plainly.

## Content work: read the standards first, report where the owner reads

Before authoring, reviewing, fixing or reporting on any content (texts, scores, columns, review pages), read `docs/standards.md`. It is the one list of the owner's rules, each with her words, the level she reads it at (a cell, a batch on its own, an interest, a page, or how we work) and how it is enforced. It is generated from `src/lib/authoring/standards.ts`; change the rule there.

- **Before showing her anything**, run `PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/standards-report.ts --results=<file>`. Paste what it finds, worst first, answer every judgement standard it lists with evidence, and say what was not checked. Never report only a catalog or batch total: she reads cells.
- **When she corrects something**, in the same turn: add or change the standard, add her example as a failing test, make a check fail on it, then fix it. If no code can decide it, it becomes a judgement standard with the evidence I must give.
- Use `getActiveInterests()` for any list of interests; never name retired ones. Never run Gemini unasked, and put any cost change on its own line.
- Progress and status come from the live database or `npm run interest:status`, never from memory notes.

## Places: key, label, slug (standard D03)

Every place has an unchanging key (`p0113`), an editable label (what the owner and travelers see: "Myanmar") and an editable slug (`myanmar`); old ids and retired slugs still resolve. In anything shown to the owner (chat, reports, review pages) use the label, never the key, slug or an old id. In code and tests write `PLACE.myanmar` (from `src/lib/places/keys.generated.ts`, regenerate with `scripts/generate-place-keys.ts`), never a typed key. Scripts take `--only=myanmar`, an old id or a key. Never reuse a key; a new place gets the next one automatically. `scripts/check-place-identity.ts` must pass after any place change. Plan and history: `docs/place-naming-plan.md` is in the artifact https://claude.ai/artifact/YWjoGmM5yqRAC48Wcegckn.
