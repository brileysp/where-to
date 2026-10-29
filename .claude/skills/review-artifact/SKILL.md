---
name: review-artifact
description: Build and publish a review page for the "Where To?" owner: full tables and complete text with an approve / needs-a-change / not-now button and note box per decision, outliers first. Use whenever content or a proposal needs the owner's review or sign-off (column proposals, built results, strategy pages, Gemini text review), and when reading back or acting on the owner's recorded answers.
---

# Review artifact

The owner is non-technical and reviews in a browser. **Content review always goes in a published artifact with the complete text, never a chat summary.** One page per topic; decisions are per interest or per topic, each with a short question, a plain explanation and a recommendation.

## Build

1. Write a JSON spec (format at the top of `scripts/build_review_page.py`): title, lead, optional boxes, sections with tables / lists / text blocks, and decisions.
   ```
   python3 .claude/skills/review-artifact/scripts/build_review_page.py spec.json page.html
   ```
   Text is plain (escaped); `**x**` makes bold. Tables scroll sideways on a phone; the page works at 400 px and in dark mode (tokens in `assets/style.css`).
2. Order inside a section: what was built or proposed (table, with how each value is scored), **outliers first** (the cells that look wrong or surprising, with what you did about each), what differs from what the owner approved, then decisions.
3. Content rules:
   - Plain language; no code words, no jargon. Say "map data", not "OpenStreetMap tags", unless the source name matters.
   - Show every number you rely on. Pull figures from the saved data files with code; never retype them.
   - Every deviation from an approved description is listed as its own item and has its own decision.
   - Recommendations are real: say "yes", or "no, because", or "your call" (and why). Do not pad a decision list with minor points.
   - Keep decision ids stable across versions: the same question keeps its id, so the owner's earlier answer still shows. New questions get new ids.

## Publish

- Load the `artifact-design` and `artifact-capabilities` skills first (the page contract, the CDN and font rules, and the `db` capability).
- First publish: `capabilities: {db: {}}`, a short generic `icon` (e.g. "chart"), a two-to-four-word `<title>` that never changes, and a one-sentence `description`. Later publishes pass the same `url` and omit `icon` and `capabilities` (they carry forward).
- Answers are saved by the page into the `decisions` collection, one document per decision id: `{status: approved | change | later, note?, at}`. Read them with the ArtifactData tool (`action: list`, `collection: decisions`) before every update and before acting. Never treat an unanswered or "later" decision as a yes.
- "Stopped watching artifact" notices are routine; ignore them.
- After publishing, give the owner the link, what needs an answer first, and what you will do next. If the page is private, say so.

## Reading answers

`status: "change"` with a note is an instruction to change the approach: act on the note, then republish the same decision with a new id if the question changed. Record what you did in the project to-do log (`docs/todo.md`).
