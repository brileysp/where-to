<!--
  Shared voice/content rules, included by reference in every interest's
  prompt file — condensed from docs/interest-content-authoring-playbook.md
  §2-3. Update here, not per-prompt-file, when a rule changes: every prompt
  that includes this file picks up the fix at its next version bump.
-->

## Voice and content rules

- **Enthusiast lens, not specialist/technical.** Write for a general interested
  traveler, not a domain expert. No filler a specialist cares about but a normal
  person doesn't. No unexplained jargon.
- **Every claim must be real, specific, and verifiable** — a named site, an exact
  season window, a real record or regulation. Never invent or pattern-match a
  specific fact. If you're not confident a claim is accurate, say so in `flags`
  rather than asserting it.
- **State real odds honestly, not just presence.** "A matter of luck," "genuinely
  elusive even at the best odds" — never oversell a famous thing that's actually
  rare or hard to experience.
- **No comparisons between different destinations by name.** Comparing this one
  destination's own two seasons to each other is fine; naming a different
  destination in the catalogue is not.
- **State the practical seasonal reality explicitly, verified per destination —
  never assumed from the activity's general pattern.** For every month, know and
  say which is true: year-round (a peak but no real dead season), long-season-
  with-a-real-dip (a genuine but short quiet stretch), or a narrow window with a
  real dead off-season. If a destination genuinely has no seasonal variation
  beyond generic conditions, say that plainly — it's a legitimate answer, not a
  cop-out.
- **Every monthly entry must name the actual site or mechanism and stand alone.**
  A reader jumping straight to one month, with no other context, should
  understand exactly what's being described. "Essentially closed" reads as the
  whole destination shutting down; naming the specific spot/season doesn't have
  that problem.
- **Don't invent fake distinction.** If two or more months are genuinely
  identical in reality, give them the same (or near-identical) text AND the
  same (or near-identical) score. Manufacturing slightly different wording or
  scores across genuinely identical months — to avoid feeling repetitive — is a
  bug, not a nicety.
- **A literal maximum score is rare, not a default.** Reserve the top of the
  scale for the narrowest, most exceptional peak — usually 1-3 months for a
  destination, occasionally more only for a globally elite, extremely
  well-documented case.
- **Keep security/political/environmental-crisis content out entirely.** That
  belongs in a separate, destination-level field this pipeline doesn't touch —
  never weave it into interest-specific text. If research surfaces something
  like this, flag it in `flags` rather than working around it in the content.
- **Write the score and the text from the same research pass, for the same
  month.** Never derive a score's shape independently of the words describing
  that month, or vice versa — they must agree.
