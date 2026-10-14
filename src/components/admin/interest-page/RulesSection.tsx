'use client';

import { createContext, useContext, useState } from 'react';
import { resetAnchor, resetRuleSection, saveAnchor, saveRuleSection } from '@/app/admin/destinations/interests/[key]/actions';
import type { InterestPageData } from '@/lib/admin/interest-pages/types';
import { DIVING_EDGE_CASES, DIVING_LADDER, DIVING_TESTS, DIVING_WRITING_RULES, BIRDING_LADDER, BIRDING_WRITING_RULES, SAFARI_EDGE_CASES, SAFARI_LADDER, SAFARI_LIKELIHOOD_SCALE, SAFARI_SCORING_WEIGHTS, SAFARI_TESTS, SAFARI_WRITING_RULES, WILDLIFE_ANIMAL_RULES, WILDLIFE_LADDER } from '@/lib/admin/interest-pages/config';
import { HIKING_TESTS, HIKING_EDGE_CASES, HIKING_SCORING_WEIGHTS, HIKING_LADDER, HIKING_WRITING_RULES, SURFING_TESTS, SURFING_EDGE_CASES, SURFING_SCORING_WEIGHTS, SURFING_LADDER, SURFING_WRITING_RULES, WHALE_TESTS, WHALE_EDGE_CASES, WHALE_SCORING_WEIGHTS, WHALE_LADDER, WHALE_WRITING_RULES } from '@/lib/admin/interest-pages/config';
import { birdingModel } from '@/lib/scoring/birdingModel';

export function RulesSection({ data }: { data: InterestPageData }) {
  const [overrides, setOverrides] = useState<Record<string, unknown[]>>(data.ruleOverrides ?? {});
  const set = (id: string, items: unknown[] | null) => setOverrides((o) => { const n = { ...o }; if (items) n[id] = items; else delete n[id]; return n; });
  return (
    <RulesContext.Provider value={{ interestKey: data.key, overrides, set }}>
    <div className="ip-section">
      <div className="ip-grid2">
        <AnchorCard data={data} />
        <div className="ip-card">
          <h3>How it is scored and written</h3>
          <ul className="ip-list ip-muted">
            <li>Scoring family: <b className="ip-mono">{data.formula}</b></li>
            <li>Audience tier: <b>{data.audienceTier ?? 'not set'}</b></li>
            <li>Authoring directive: {data.directive ? <b className="ip-mono">{data.directive}</b> : 'none found (this interest was not written through the Gemini pipeline, or the prompts folder is not deployed)'}</li>
          </ul>
          {data.key !== 'birding' && data.key !== 'safari' && data.key !== 'wildlifeViewing' && data.key !== 'diving' && data.key !== 'surfing' && data.key !== 'whaleWatching' && data.key !== 'hiking' && <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Interest-specific formula and writing rules are shown here for Birding first; the other interests get theirs as their columns are added.</p>}
        </div>
      </div>
      {data.key === 'birding' && <BirdingRules />}
      {data.key === 'safari' && <SafariRules />}
      {data.key === 'wildlifeViewing' && <WildlifeRules />}
      {data.key === 'diving' && <DivingRules />}
      {data.key === 'surfing' && <SurfingRules />}
      {data.key === 'whaleWatching' && <WhaleRules />}
      {data.key === 'hiking' && <HikingRules />}
    </div>
    </RulesContext.Provider>
  );
}

function BirdingRules() {
  const ladder = useRuleList('birding.ladder', BIRDING_LADDER);
  const writing = useRuleList('birding.writing', BIRDING_WRITING_RULES);
  const [m, setM] = useState({ species: 1000, endemism: 9, charisma: 10, spectacle: 3, lineage: 2 });
  const r = birdingModel(m);
  const set = (k: keyof typeof m) => (e: React.ChangeEvent<HTMLInputElement>) => setM({ ...m, [k]: Number(e.target.value) });
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>How a place gets its birding score</h3>
          <div className="ip-eq">
            base = <b>0.50</b> × species-count curve + <b>0.25</b> × endemism + <b>0.25</b> × charisma
            <br />
            score = base × (1 + 0.25 × <b>spectacle</b>/10) × (1 + 0.25 × <b>lineage</b>/10), capped at 10
          </div>
          <ul className="ip-list ip-muted" style={{ marginTop: 10 }}>
            <li><b>Species count</b> is judged on a log curve from 40 to 1,600 species: 60 vs 600 is a huge gap, 900 vs 1,600 barely matters.</li>
            <li><b>Endemism</b> is species found nowhere else. <b>Charisma</b> is birds worth looking at, not little brown jobs.</li>
            <li><b>Spectacle</b> (colonies, migration bottlenecks) and <b>lineage</b> (whole bird families found only here) are bonuses, never a foundation.</li>
            <li>Scope is the place&apos;s own region, not the country. The 12-month curve then scales the peak by season.</li>
            <li><b>Access counts.</b> Easy, well-built access to the right places (for example Kruger&apos;s self-drive network) raises a score, because you will see more birds. Difficult access lowers it.</li>
          </ul>
        </div>
        <div className="ip-card">
          <h3>Try it <span className="ip-faint" style={{ fontWeight: 400 }}>(the same formula as scripts/audit-birding-model.ts)</span></h3>
          <div className="ip-calc">
            <label>Species count</label><input type="range" min={20} max={1800} step={10} value={m.species} onChange={set('species')} /><output>{m.species.toLocaleString()}</output>
            <label>Endemism</label><input type="range" min={0} max={10} value={m.endemism} onChange={set('endemism')} /><output>{m.endemism}</output>
            <label>Charisma</label><input type="range" min={0} max={10} value={m.charisma} onChange={set('charisma')} /><output>{m.charisma}</output>
            <label>Spectacle</label><input type="range" min={0} max={10} value={m.spectacle} onChange={set('spectacle')} /><output>{m.spectacle}</output>
            <label>Lineage</label><input type="range" min={0} max={10} value={m.lineage} onChange={set('lineage')} /><output>{m.lineage}</output>
          </div>
          <div className="ip-result">
            <b>{r.score.toFixed(1)}</b>
            <span className="ip-muted">count curve {r.count.toFixed(1)} → base {r.base.toFixed(2)}<br />× spectacle {r.spectacleBoost.toFixed(3)} × lineage {r.lineageBoost.toFixed(3)}{r.capped ? ' (capped at 10)' : ''}</span>
          </div>
          <div className="ip-faint" style={{ marginTop: 6, fontSize: 12 }}>Start values are the Colombian Andes. Try 60 species with charisma 10 and spectacle 10 (Falklands): spectacle cannot carry a short list.</div>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="birding.ladder" label="Birding calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r2) => (
              <div className="rung" key={r2.band}>
                <div className="band">{r2.band}</div>
                <div>{r2.title}<small>{r2.examples}</small></div>
              </div>
            ))}
          </div>
        </div>
        <div className="ip-card">
          <h3>Writing rules</h3><EditRules id="birding.writing" label="Birding writing rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The Places &amp; data tab records the raw facts behind this formula and behind a future place-comparison feature: species, endemic species, endemic families, charisma, views/photo and spectacle. Views/photo (how easy it is to get a clean, close view) is not part of the score yet. Rules here are read-only; they come from <span className="ip-mono">anchors.ts</span>, <span className="ip-mono">audit-birding-model.ts</span> and the birding directive.
      </div>
    </>
  );
}

function SafariRules() {
  const tests = useRuleList('safari.tests', SAFARI_TESTS);
  const edge = useRuleList('safari.edge', SAFARI_EDGE_CASES);
  const weights = useRuleList('safari.weights', SAFARI_SCORING_WEIGHTS);
  const ladder = useRuleList('safari.ladder', SAFARI_LADDER);
  const writing = useRuleList('safari.writing', SAFARI_WRITING_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>What counts as safari</h3><EditRules id="safari.tests" label="The tests for what counts as safari" fields={TEST_FIELDS} items={tests as Array<Record<string, string>>} />
          <p className="ip-muted">A place counts when all four tests pass.</p>
          <ul className="ip-list">{tests.map((t) => <li key={t.title}><b>{t.title}.</b> <span className="ip-muted">{t.body}</span></li>)}</ul>
        </div>
        <div className="ip-card">
          <h3>Edge cases</h3><EditRules id="safari.edge" label="Safari edge cases" fields={EDGE_FIELDS} items={edge as Array<Record<string, string>>} />
          <ul className="ip-list">{edge.map((e) => <li key={e.case}><b>{e.case}:</b> <span className="ip-muted">{e.ruling}</span></li>)}</ul>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>How a place gets its safari score</h3><EditRules id="safari.weights" label="Safari scoring weights" fields={WEIGHT_FIELDS} items={weights as Array<Record<string, string | number>>} />
          <div className="ip-ladder">
            {weights.map((w) => (
              <div className="rung" key={w.label}>
                <div className="band">{w.pct}%</div>
                <div>{w.label}<small>{w.note}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Safari is scored by judgment against the ladder, with these four weights as the guide. There is no formula behind the data columns yet; they record the facts a future score model and place-comparison feature would use.</p>
        </div>
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="safari.ladder" label="Safari calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Animal likelihood scale</h3>
          <p className="ip-muted">For a typical 3 to 4 day visit in the best season.</p>
          <ul className="ip-list">{SAFARI_LIKELIHOOD_SCALE.map((l) => <li key={l.value}><span className={`ip-chip ${l.value === 'guaranteed' || l.value === 'likely' ? 'good' : l.value === 'possible' ? 'warn' : 'dim'}`}>{l.label}</span> <span className="ip-muted">{l.meaning}</span></li>)}</ul>
          <p className="ip-faint" style={{ marginBottom: 0 }}>&quot;Likely or better&quot; on the data table counts the animals rated Guaranteed or Likely, out of 10. Buffalo and crocodile are not in the grid: nearly every park has them. Jaguar is in the Other megafauna column.</p>
        </div>
        <div className="ip-card">
          <h3>Writing rules</h3><EditRules id="safari.writing" label="Safari writing rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The animal grid, the style and rules columns, the experience ratings and malaria are recorded facts for comparing places. Entries marked unverified are first drafts from park and operator sources and are listed in the to-do tab for checking. Rules here are read-only; they come from the safari directive.
      </div>
    </>
  );
}

function WildlifeRules() {
  const ladder = useRuleList('wildlife.ladder', WILDLIFE_LADDER);
  const animalRules = useRuleList('wildlife.animals', WILDLIFE_ANIMAL_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="wildlife.ladder" label="Wildlife calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
        </div>
        <div className="ip-card">
          <h3>Filling the animal columns</h3><EditRules id="wildlife.animals" label="Rules for filling the animal columns" items={animalRules} />
          <ul className="ip-list ip-muted">{animalRules.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-card">
        <h3>Likelihood scale</h3>
        <p className="ip-muted">For a typical 3 to 4 day visit in the best season.</p>
        <ul className="ip-list">{SAFARI_LIKELIHOOD_SCALE.filter((l) => l.value !== 'notPresent').map((l) => <li key={l.value}><span className={`ip-chip ${l.value === 'guaranteed' || l.value === 'likely' ? 'good' : l.value === 'possible' ? 'warn' : 'dim'}`}>{l.label}</span> <span className="ip-muted">{l.meaning}</span></li>)}</ul>
        <p className="ip-faint" style={{ marginBottom: 0 }}>Each animal column sorts by the best odds in its cell, so you can sort the table by how certain a place&apos;s best predator or primate is.</p>
      </div>
    </>
  );
}

function DivingRules() {
  const tests = useRuleList('diving.tests', DIVING_TESTS);
  const edge = useRuleList('diving.edge', DIVING_EDGE_CASES);
  const ladder = useRuleList('diving.ladder', DIVING_LADDER);
  const writing = useRuleList('diving.writing', DIVING_WRITING_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>What counts as snorkeling and diving</h3><EditRules id="diving.tests" label="The tests for what counts as snorkeling and diving" fields={TEST_FIELDS} items={tests as Array<Record<string, string>>} />
          <ul className="ip-list">{tests.map((t) => <li key={t.title}><b>{t.title}.</b> <span className="ip-muted">{t.body}</span></li>)}</ul>
        </div>
        <div className="ip-card">
          <h3>Edge cases</h3><EditRules id="diving.edge" label="Snorkeling and diving edge cases" fields={EDGE_FIELDS} items={edge as Array<Record<string, string>>} />
          <ul className="ip-list">{edge.map((e) => <li key={e.case}><b>{e.case}:</b> <span className="ip-muted">{e.ruling}</span></li>)}</ul>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="diving.ladder" label="Snorkeling and diving calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Scored by judgment against this ladder; there is no formula. The examples are today&apos;s live peaks.</p>
        </div>
        <div className="ip-card">
          <h3>Writing and scoring rules</h3><EditRules id="diving.writing" label="Snorkeling and diving writing and scoring rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The ratings and the format columns (how you do it, certification, depth, current, water temperature) are recorded facts. The text only calls out how a place differs from a typical reef dive. Rules here are read-only; they come from the diving directive and the checks that run on every draft.
      </div>
    </>
  );
}

function SurfingRules() {
  const tests = useRuleList('surfing.tests', SURFING_TESTS);
  const edge = useRuleList('surfing.edge', SURFING_EDGE_CASES);
  const weights = useRuleList('surfing.weights', SURFING_SCORING_WEIGHTS);
  const ladder = useRuleList('surfing.ladder', SURFING_LADDER);
  const writing = useRuleList('surfing.writing', SURFING_WRITING_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>What counts as surfing</h3><EditRules id="surfing.tests" label="The tests for what counts as surfing" fields={TEST_FIELDS} items={tests as Array<Record<string, string>>} />
          <p className="ip-muted">Applicability is decided from geography and what is documented, in this order.</p>
          <ul className="ip-list">{tests.map((t) => <li key={t.title}><b>{t.title}.</b> <span className="ip-muted">{t.body}</span></li>)}</ul>
        </div>
        <div className="ip-card">
          <h3>Edge cases</h3><EditRules id="surfing.edge" label="Surfing edge cases" fields={EDGE_FIELDS} items={edge as Array<Record<string, string>>} />
          <ul className="ip-list">{edge.map((e) => <li key={e.case}><b>{e.case}:</b> <span className="ip-muted">{e.ruling}</span></li>)}</ul>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>How a place gets its surfing score</h3><EditRules id="surfing.weights" label="Surfing scoring weights" fields={WEIGHT_FIELDS} items={weights as Array<Record<string, string | number>>} />
          <div className="ip-ladder">
            {weights.map((w) => (
              <div className="rung" key={w.label}>
                <div className="band">{w.pct}%</div>
                <div>{w.label}<small>{w.note}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Scored by judgment against the ladder, with these four weights as the guide; there is no formula. The best wave leads: one world-class wave outscores a dozen gentle beginner beaches. Each month is scored for whichever of two surfers the place suits better, a learner or an experienced one.</p>
        </div>
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="surfing.ladder" label="Surfing calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>The examples are today&apos;s live peaks. The new surfing instructions have so far only been run on a handful of places, so most scores shown are from the older text and will move when the full pass is done.</p>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Writing and scoring rules</h3><EditRules id="surfing.writing" label="Surfing writing and scoring rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The break list, wave type, crowds, localism, access and the other columns are recorded facts. They are sent to Gemini with each place as first-draft notes, except the two ratings, which Gemini writes itself so ours cannot anchor it. Rules here are edited for this page only; the Gemini file (prompts/surfing/v4.md) is not touched, so a change that should reach the writing has to be made there too.
      </div>
    </>
  );
}

function WhaleRules() {
  const tests = useRuleList('whale.tests', WHALE_TESTS);
  const edge = useRuleList('whale.edge', WHALE_EDGE_CASES);
  const weights = useRuleList('whale.weights', WHALE_SCORING_WEIGHTS);
  const ladder = useRuleList('whale.ladder', WHALE_LADDER);
  const writing = useRuleList('whale.writing', WHALE_WRITING_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>What counts as whale watching</h3><EditRules id="whale.tests" label="The tests for what counts as whale watching" fields={TEST_FIELDS} items={tests as Array<Record<string, string>>} />
          <p className="ip-muted">Applicability is decided from geography and what is documented, in this order.</p>
          <ul className="ip-list">{tests.map((t) => <li key={t.title}><b>{t.title}.</b> <span className="ip-muted">{t.body}</span></li>)}</ul>
        </div>
        <div className="ip-card">
          <h3>Edge cases</h3><EditRules id="whale.edge" label="Whale watching edge cases" fields={EDGE_FIELDS} items={edge as Array<Record<string, string>>} />
          <ul className="ip-list">{edge.map((e) => <li key={e.case}><b>{e.case}:</b> <span className="ip-muted">{e.ruling}</span></li>)}</ul>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>How a place gets its whale watching score</h3><EditRules id="whale.weights" label="Whale watching scoring weights" fields={WEIGHT_FIELDS} items={weights as Array<Record<string, string | number>>} />
          <div className="ip-ladder">
            {weights.map((w) => (
              <div className="rung" key={w.label}>
                <div className="band">{w.pct}%</div>
                <div>{w.label}<small>{w.note}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Scored by judgment against the ladder, with these four weights as the guide; there is no formula. Dolphins and porpoises alone cap a place at 3.9; reliable whales lift it above that.</p>
        </div>
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="whale.ladder" label="Whale watching calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>The examples are today&apos;s live peaks.</p>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Writing and scoring rules</h3><EditRules id="whale.writing" label="Whale watching writing and scoring rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The species, season, boat style, shore viewing and the other columns are recorded facts for comparing places. Rules here are edited for this page only; the Gemini file (prompts/whaleWatching/v3.md) is not touched, so a change that should reach the writing has to be made there too.
      </div>
    </>
  );
}

function HikingRules() {
  const tests = useRuleList('hiking.tests', HIKING_TESTS);
  const edge = useRuleList('hiking.edge', HIKING_EDGE_CASES);
  const weights = useRuleList('hiking.weights', HIKING_SCORING_WEIGHTS);
  const ladder = useRuleList('hiking.ladder', HIKING_LADDER);
  const writing = useRuleList('hiking.writing', HIKING_WRITING_RULES);
  return (
    <>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>What counts as hiking</h3><EditRules id="hiking.tests" label="The tests for what counts as hiking" fields={TEST_FIELDS} items={tests as Array<Record<string, string>>} />
          <p className="ip-muted">Applicability is decided from geography and what is documented, in this order.</p>
          <ul className="ip-list">{tests.map((t) => <li key={t.title}><b>{t.title}.</b> <span className="ip-muted">{t.body}</span></li>)}</ul>
        </div>
        <div className="ip-card">
          <h3>Edge cases</h3><EditRules id="hiking.edge" label="Hiking edge cases" fields={EDGE_FIELDS} items={edge as Array<Record<string, string>>} />
          <ul className="ip-list">{edge.map((e) => <li key={e.case}><b>{e.case}:</b> <span className="ip-muted">{e.ruling}</span></li>)}</ul>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>How a place gets its hiking score</h3><EditRules id="hiking.weights" label="Hiking scoring weights" fields={WEIGHT_FIELDS} items={weights as Array<Record<string, string | number>>} />
          <div className="ip-ladder">
            {weights.map((w) => (
              <div className="rung" key={w.label}>
                <div className="band">{w.pct}%</div>
                <div>{w.label}<small>{w.note}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>Scored by judgment against the ladder, with these five weights as the guide; there is no formula. The best walking leads, and scenery counts most when it can only be reached on foot. Each month is scored for whichever of two walkers the place suits better, a day hiker or a trekker.</p>
        </div>
        <div className="ip-card">
          <h3>Calibration ladder</h3><EditRules id="hiking.ladder" label="Hiking calibration ladder" fields={LADDER_FIELDS} items={ladder as Array<Record<string, string>>} />
          <div className="ip-ladder">
            {ladder.map((r) => (
              <div className="rung" key={r.band}>
                <div className="band">{r.band}</div>
                <div>{r.title}<small>{r.examples}</small></div>
              </div>
            ))}
          </div>
          <p className="ip-faint" style={{ marginTop: 10, marginBottom: 0 }}>The examples are today&apos;s live peaks. No hiking text has been written by Gemini yet, so these scores come from the older shared formula and will move after the first run.</p>
        </div>
      </div>
      <div className="ip-grid2">
        <div className="ip-card">
          <h3>Writing and scoring rules</h3><EditRules id="hiking.writing" label="Hiking writing and scoring rules" items={writing} />
          <ul className="ip-list ip-muted">{writing.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
      <div className="ip-note">
        <b>About the data columns.</b> The trail, rating, season, altitude, permit, crowd and hazard columns are recorded facts. They are built but empty: they are filled from web sources before any Gemini run, and then sent to Gemini with each place as first-draft notes. Rules here are edited for this page only. The Hiking instructions are the newest file in prompts/hiking (v3 at the time of writing), with the shared on-foot rules in prompts/_shared/on-foot-core.md, so a change that should reach the writing has to be made there too.
      </div>
    </>
  );
}


// ---- Editable lists ------------------------------------------------------------------

type RuleField = { key: string; label: string; number?: boolean };
interface RulesCtx { interestKey: string; overrides: Record<string, unknown[]>; set: (id: string, items: unknown[] | null) => void }
const RulesContext = createContext<RulesCtx | null>(null);

/** A list from the Rules & scoring tab: the edited version when one has been saved, otherwise the built-in one. */
function useRuleList<T>(id: string, defaults: T[]): T[] {
  const ctx = useContext(RulesContext);
  const o = ctx?.overrides[id];
  return (o as T[] | undefined) ?? defaults;
}

/** "Edit" beside a card heading: opens a box to change the list, save it, or go back to the built-in text. */
function EditRules({ id, label, fields, items }: { id: string; label: string; fields?: RuleField[]; items: Array<string | Record<string, string | number>> }) {
  const ctx = useContext(RulesContext)!;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const edited = ctx.overrides[id] !== undefined;
  const single = !fields;

  function show() {
    setRows(items.map((it) => (single ? { text: String(it) } : Object.fromEntries((fields ?? []).map((f) => [f.key, String((it as Record<string, string | number>)[f.key] ?? '')])))));
    setError('');
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    setError('');
    const clean = rows.filter((r) => Object.values(r).some((v) => v.trim() !== ''));
    const payload = single ? clean.map((r) => r.text.trim()) : clean.map((r) => Object.fromEntries((fields ?? []).map((f) => [f.key, f.number ? Number(r[f.key]) : r[f.key].trim()])));
    const res = await saveRuleSection(ctx.interestKey, id, payload);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    ctx.set(id, res.items);
    setOpen(false);
  }
  async function reset() {
    if (!window.confirm('Go back to the built-in text for this list?')) return;
    setBusy(true);
    const res = await resetRuleSection(ctx.interestKey, id);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    ctx.set(id, null);
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="ip-link-btn" style={{ float: 'right', fontSize: 12 }} onClick={show}>{edited ? 'Edit (changed)' : 'Edit'}</button>
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel" style={{ maxWidth: 780 }}>
            <div className="panel-head"><div><h2>Edit: {label}</h2><p>One row per item. Leave a row empty to drop it. This changes the admin reference text only; the Gemini directive file under prompts/ is not touched.</p></div><button className="panel-close" onClick={() => setOpen(false)}>✕</button></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: single ? '1fr auto' : `repeat(${fields!.length}, 1fr) auto`, gap: 8, alignItems: 'start' }}>
                  {single ? (
                    <textarea className="field-textarea" rows={2} value={r.text} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { text: e.target.value } : x)))} />
                  ) : (
                    fields!.map((f) => (
                      <label key={f.key} style={{ fontSize: 11, color: 'var(--text-faint)' }}>{f.label}
                        <textarea className="field-textarea" rows={2} value={r[f.key] ?? ''} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} />
                      </label>
                    ))
                  )}
                  <button type="button" className="btn" title="Remove this row" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div><button type="button" className="btn" onClick={() => setRows((all) => [...all, single ? { text: '' } : Object.fromEntries(fields!.map((f) => [f.key, '']))])}>+ Add a row</button></div>
              {error && <div className="ip-err">{error}</div>}
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn" disabled={busy || !edited} onClick={reset}>Back to built-in text</button>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save list</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const LADDER_FIELDS: RuleField[] = [{ key: 'band', label: 'Band' }, { key: 'title', label: 'Title' }, { key: 'examples', label: 'Examples' }];
const TEST_FIELDS: RuleField[] = [{ key: 'title', label: 'Test' }, { key: 'body', label: 'What it means' }];
const EDGE_FIELDS: RuleField[] = [{ key: 'case', label: 'Case' }, { key: 'ruling', label: 'Ruling' }];
const WEIGHT_FIELDS: RuleField[] = [{ key: 'label', label: 'What' }, { key: 'pct', label: 'Weight %', number: true }, { key: 'note', label: 'Note' }];


/** "What a 10 means" and the places allowed a peak of 10, editable. Saved edits replace the built-in list for the Gemini validator and the audits. */
function AnchorCard({ data }: { data: InterestPageData }) {
  const [anchor, setAnchor] = useState(data.anchor);
  const [open, setOpen] = useState(false);
  const [def, setDef] = useState('');
  const [ten, setTen] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function show() {
    setDef(anchor?.definition ?? '');
    setTen(anchor?.ten.map((t) => t.id) ?? []);
    setQ('');
    setError('');
    setOpen(true);
  }
  async function save() {
    setBusy(true);
    setError('');
    const res = await saveAnchor(data.key, def, ten);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setAnchor({ definition: res.definition, ten: res.ten });
    setOpen(false);
  }
  async function reset() {
    if (!window.confirm('Go back to the built-in definition and list from anchors.ts? Reload the page afterwards to see them.')) return;
    setBusy(true);
    const res = await resetAnchor(data.key);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setOpen(false);
    window.location.reload();
  }
  const options = data.placeOptions.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="ip-card">
      <h3>What a 10 means <button type="button" className="ip-link-btn" style={{ float: 'right', fontSize: 12 }} onClick={show}>Edit</button></h3>
      {anchor ? (
        <>
          <p>{anchor.definition}</p>
          <h4>The only places allowed a peak of 10</h4>
          <p style={{ marginBottom: 0 }}>{anchor.ten.map((t) => t.name).join(' · ') || 'None yet.'}</p>
        </>
      ) : (
        <p className="ip-muted">No ceiling has been defined for this interest yet. Click Edit to write what a 10 means and pick the places allowed one.</p>
      )}
      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="panel" style={{ maxWidth: 760 }}>
            <div className="panel-head"><div><h2>What a 10 means: {data.label}</h2><p>The Gemini validator only lets the places picked here peak at 10. Changes apply straight away to the validator and the audits.</p></div><button className="panel-close" onClick={() => setOpen(false)}>✕</button></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-faint)' }}>Definition: what a 10 asserts about a place
                <textarea className="field-textarea" rows={4} value={def} onChange={(e) => setDef(e.target.value)} />
              </label>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Places allowed a 10 ({ten.length} picked; usually 8 to 14)
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0' }}>
                  {ten.map((id) => <button key={id} type="button" className="ip-chip good" style={{ cursor: 'pointer', border: 'none' }} title="Remove" onClick={() => setTen((t) => t.filter((x) => x !== id))}>{data.placeOptions.find((p) => p.id === id)?.name ?? id} ✕</button>)}
                </div>
                <input className="cost-input" placeholder="Search places to add…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
                <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  {options.map((p) => (
                    <label key={p.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12.5, color: 'var(--text)' }}>
                      <input type="checkbox" checked={ten.includes(p.id)} onChange={() => setTen((t) => (t.includes(p.id) ? t.filter((x) => x !== p.id) : [...t, p.id]))} />{p.name}
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="ip-err">{error}</div>}
            </div>
            <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn" disabled={busy} onClick={reset}>Back to built-in list</button>
              <span style={{ display: 'flex', gap: 8 }}><button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
