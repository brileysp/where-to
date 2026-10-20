'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import './interest-page.css';
import type { AuthoringPassRow, ChipOverrideRow, ChipRow, InterestPageData, InterestPlaceRow, IdeaRow, QuestionRow, ReferenceSiteRow, ReviewRow, TodoRow } from '@/lib/admin/interest-pages/types';
import type { InterestFactValue } from '@/lib/db/schema';
import { RulesSection } from './RulesSection';
import { TodoSection } from './TodoSection';
import { IdeasSection } from './IdeasSection';
import { DataSection } from './DataSection';
import type { NaChange } from './NaReasonChip';
import { ReviewsSection } from './ReviewsSection';
import { ReferenceSitesSection } from './ReferenceSitesSection';
import { AuthoringSection } from './AuthoringSection';
import { ChipsSection } from './ChipsSection';
import { QuestionsSection } from './QuestionsSection';

type Tab = 'rules' | 'todo' | 'ideas' | 'data' | 'reviews' | 'authoring' | 'chips';
const TABS: Tab[] = ['data', 'todo', 'ideas', 'rules', 'reviews', 'authoring', 'chips'];
const TAB_HELP: Record<Tab, string> = {
  data: 'Every place with its text status and this interest\'s data columns. Click a cell to edit it.',
  todo: 'Open jobs for this interest. Finished items stay listed for the record.',
  ideas: 'Places worth adding to the catalog for this interest.',
  rules: 'How places are scored and written for this interest. Read-only.',
  reviews: 'The reference sites we fact-check against, and who reviewed what, and when, including notes on what they did.',
  authoring: 'Each Gemini authoring pass for this interest: when it finished, how many places, and what it cost in tokens and dollars.',
  chips: 'The sub-interest chips travelers pick under this interest (up to five live), and the onboarding questions they are asked about it. Each is driven by columns on Places & data, so a place\'s fit is worked out from the data.',
};

export function InterestPage({ data }: { data: InterestPageData }) {
  const [tab, setTab] = useState<Tab>('data');
  const router = useRouter();
  const [places, setPlaces] = useState<InterestPlaceRow[]>(data.places);
  const [todos, setTodos] = useState<TodoRow[]>(data.todos);
  const [ideas, setIdeas] = useState<IdeaRow[]>(data.ideas);
  const [reviews, setReviews] = useState<ReviewRow[]>(data.reviews);
  const [sites, setSites] = useState<ReferenceSiteRow[]>(data.referenceSites);
  const [passes, setPasses] = useState<AuthoringPassRow[]>(data.passes);
  const [chips, setChips] = useState<ChipRow[]>(data.chips);
  const [questions, setQuestions] = useState<QuestionRow[]>(data.questions);
  const [chipOverrides, setChipOverrides] = useState<ChipOverrideRow[]>(data.chipOverrides);

  // Deep-link to a section with #todo, #ideas, #data or #reviews.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#', '') as Tab;
      if (TABS.includes(h)) setTab(h);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  function go(t: Tab) {
    setTab(t);
    window.history.replaceState(null, '', `#${t}`);
  }

  function setFact(placeId: string, key: string, value: InterestFactValue) {
    setPlaces((ps) =>
      ps.map((p) => {
        if (p.id !== placeId) return p;
        const facts = { ...p.facts };
        if (value === null) delete facts[key];
        else facts[key] = value;
        return { ...p, facts };
      }),
    );
  }

  function setNa(placeId: string, change: NaChange) {
    setPlaces((ps) =>
      ps.map((p) => {
        if (p.id !== placeId) return p;
        // A reason on a place that was not N/A means it has just been marked N/A.
        if (change.kind === 'reason') return { ...p, naReason: change.info, status: 'na', monthly: [] };
        return { ...p, status: 'none', naReason: null, monthly: [] };
      }),
    );
  }

  function patchPlace(placeId: string, patch: Partial<InterestPlaceRow>) {
    setPlaces((ps) => ps.map((p) => (p.id === placeId ? { ...p, ...patch } : p)));
  }

  const counts = useMemo(() => {
    const applicable = places.filter((p) => p.status !== 'na');
    return {
      applicable: applicable.length,
      live: places.filter((p) => p.status === 'live').length,
      staged: places.filter((p) => p.status === 'staged').length,
      na: places.filter((p) => p.status === 'na').length,
      none: places.filter((p) => p.status === 'none').length,
      open: todos.filter((t) => t.status !== 'done').length,
    };
  }, [places, todos]);

  return (
    <div className="ip-wrap">
      <div className="ip-crumbs">
        <Link href="/admin/destinations/interests">Interests</Link> › {data.group} › {data.label}
      </div>
      <div className="ip-stickybar">
        <h1 className="ip-title">
            <select className="ip-picker" aria-label="Switch interest" value={data.key} onChange={(e) => router.push(`/admin/destinations/interests/${e.target.value}`)}>
              {[...new Set(data.interestOptions.map((o) => o.group))].map((g) => (
                <optgroup key={g} label={g}>
                  {data.interestOptions.filter((o) => o.group === g).map((o) => <option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
                </optgroup>
              ))}
            </select>
            <span className="ip-chip dim ip-mono">{data.key}</span>
            {data.audienceTier && <span className="ip-chip info">{data.audienceTier} audience</span>}
            {data.directive && <span className="ip-chip good ip-mono">{data.directive.replace('prompts/', '').replace('.md', '')}</span>}
        </h1>
      </div>
      <div className="ip-head">
        <div>
          {data.anchor && <p className="ip-def">{data.anchor.definition}</p>}
          <p className="ip-faint" style={{ margin: '4px 0 0' }}>{lastPassLine(passes)}</p>
        </div>
        <div className="ip-tiles">
          <div className="ip-tile"><b>{counts.applicable}</b><span>places scored</span></div>
          <div className="ip-tile"><b>{counts.live}</b><span>with live text</span></div>
          {counts.staged > 0 && <div className="ip-tile"><b>{counts.staged}</b><span>staged, not live</span></div>}
          {counts.none > 0 && <div className="ip-tile"><b>{counts.none}</b><span>no text yet</span></div>}
          {counts.na > 0 && <div className="ip-tile"><b>{counts.na}</b><span>N/A</span></div>}
        </div>
      </div>

      <Completeness c={data.completeness} openItems={counts.open} go={go} />

      <div className="ip-sub" role="tablist">
        <button className={tab === 'data' ? 'on' : ''} onClick={() => go('data')}>Places &amp; data <em>{places.length}</em></button>
        <button className={tab === 'todo' ? 'on' : ''} onClick={() => go('todo')}>To do <em>{counts.open}</em></button>
        <button className={tab === 'ideas' ? 'on' : ''} onClick={() => go('ideas')}>Future places <em>{ideas.length}</em></button>
        <button className={tab === 'rules' ? 'on' : ''} onClick={() => go('rules')}>Rules &amp; scoring</button>
        <button className={tab === 'reviews' ? 'on' : ''} onClick={() => go('reviews')}>Expert reviews <em>{reviews.length}</em></button>
        <button className={tab === 'authoring' ? 'on' : ''} onClick={() => go('authoring')}>Gemini passes <em>{passes.length}</em></button>
        <button className={tab === 'chips' ? 'on' : ''} onClick={() => go('chips')}>Chips &amp; questions <em>{chips.filter((c) => c.status === 'live').length}</em></button>
      </div>
      <p className="ip-tabhelp">{TAB_HELP[tab]}</p>

      {tab === 'rules' && <RulesSection data={data} />}
      {tab === 'chips' && (
        <>
          <ChipsSection interestKey={data.key} factDefs={data.factDefs} places={places} chips={chips} setChips={setChips} questions={questions} setQuestions={setQuestions} overrides={chipOverrides} setOverrides={setChipOverrides} />
          <QuestionsSection interestKey={data.key} factDefs={data.factDefs} chips={chips} questions={questions} setQuestions={setQuestions} />
        </>
      )}
      {tab === 'authoring' && <AuthoringSection interestKey={data.key} passes={passes} setPasses={setPasses} />}
      {tab === 'todo' && <TodoSection interestKey={data.key} todos={todos} setTodos={setTodos} placeOptions={data.placeOptions} />}
      {tab === 'ideas' && <IdeasSection interestKey={data.key} ideas={ideas} setIdeas={setIdeas} />}
      {tab === 'data' && <DataSection data={data} places={places} reviews={reviews} onFact={setFact} onNa={setNa} onPlace={patchPlace} />}
      {tab === 'reviews' && (
        <>
          <div className="ip-subhead">Reference sites</div>
          <ReferenceSitesSection interestKey={data.key} sites={sites} setSites={setSites} reviews={reviews} />
          <div className="ip-subhead" style={{ marginTop: 18 }}>Reviewers</div>
          <ReviewsSection interestKey={data.key} placeOptions={data.placeOptions} reviews={reviews} setReviews={setReviews} />
        </>
      )}
    </div>
  );
}

const BAND = (n: number) => (n < 50 ? 'lo' : n < 80 ? 'mid' : 'hi');

function Completeness({ c, openItems, go }: { c: InterestPageData['completeness']; openItems: number; go: (t: Tab) => void }) {
  // Collapsed by default: just the score, so the page does not push everything else off screen. Click to expand.
  const [open, setOpen] = useState(false);
  const part = (label: string, v: number | null, w: number) => (v === null ? null : <li key={label}>{label} <b>{Math.round(v)}</b> <span className="ip-faint">(weight {w})</span></li>);
  if (!open) {
    return (
      <div className="ip-score ip-score-collapsed">
        <div className={`ip-scorebig ip-scorebig-sm ${BAND(c.score)}`}><b>{c.score}</b><span>/ 100</span><em>completeness</em></div>
        <button type="button" className="ip-scoretoggle" onClick={() => setOpen(true)} aria-expanded={false}>
          {c.gains.length > 0 ? 'Show what would raise it ▸' : 'Show details ▸'}
        </button>
      </div>
    );
  }
  return (
    <div className="ip-score">
      <div className={`ip-scorebig ${BAND(c.score)}`}><b>{c.score}</b><span>/ 100</span><em>completeness</em></div>
      <div className="ip-scoremid">
        {c.gains.length > 0 ? (
          <>
            <div className="ip-scorehead">What would raise it most</div>
            <ul>{c.gains.map((g) => <li key={g.label}><span>{g.label}</span><button type="button" onClick={() => go(g.tab)}>Go →</button></li>)}</ul>
          </>
        ) : (
          <div className="ip-scorehead">Nothing is holding it back.</div>
        )}
        <details>
          <summary>How this is scored</summary>
          <div className="ip-scorecalc">
            <ul>
              {part('Content', c.parts.content, 50)}
              {part('Data columns', c.parts.data, 20)}
              {part('Scoring quality', c.parts.scoring, 10)}
              {part('Verification', c.parts.verify, 10)}
              {part('Scope and rules', c.parts.rules, 10)}
            </ul>
            <p className="ip-faint">An interest with no special columns scores on the other four. {openItems} open item{openItems === 1 ? '' : 's'} on the Outstanding tab never change the score. The number refreshes when the page reloads.</p>
          </div>
        </details>
        <button type="button" className="ip-scoretoggle" onClick={() => setOpen(false)} aria-expanded>Hide ▴</button>
      </div>
    </div>
  );
}

function lastPassLine(all: AuthoringPassRow[]): string {
  const passes = all.filter((p) => p.kind !== 'targeted'); // hand edits are not Gemini passes
  if (passes.length === 0) return 'No Gemini authoring pass recorded yet.';
  const open = passes.find((p) => !p.finishedAt);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (open) return `Gemini pass in progress: ${open.label} (last run ${fmt(open.lastActivityAt)}).`;
  const done = [...passes].filter((p) => p.finishedAt).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
  return `Last Gemini pass finished ${fmt(done.finishedAt!)}: ${done.label}.`;
}
