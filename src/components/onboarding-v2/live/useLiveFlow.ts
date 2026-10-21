'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingChip } from '@/lib/db/queries/onboarding-chips';
import { barPoints, barTotal, dnaPercent, deeperItems, firstUnansweredGate, gateItems, gatePercent, newItems, qid, toUnlock, type LiveItem, type LiveStep, type Skipped } from '@/lib/onboarding/live-questions';
import type { MatchSetups } from '@/lib/onboarding/live-types';
import { orderedByLevel, type Levels } from '@/lib/onboarding/levels';
import type { InterestAnswers } from '@/lib/onboarding/profile';

/**
 * The state machine behind the live questions (the approved mockup). What the traveler picked and answered lives in the flow (so it is saved
 * with the profile); this hook keeps only what is on screen: which step, which question, whether the box is open, and the unlock sequence.
 */

export interface LiveFlowArgs {
  setups: MatchSetups;
  levels: Levels;
  subs: Record<string, string[]>;
  qa: InterestAnswers;
  chips: Record<string, OnboardingChip[]>;
  returning: boolean;
  /** Places the traveler marked Visited or Saved. */
  marks: number;
  onAnswer: (interest: string, questionKey: string, picks: number[]) => void;
  onTick: (interest: string, chip: string) => void;
  onAddInterest: (interest: string) => void;
  onRemoveInterest: (interest: string) => void;
  /** A line about what this answer did to the list, worked out before it is stored. Null = nothing worth saying. */
  describeMove: (interest: string, questionKey: string, picks: number[]) => string | null;
}

export type TeaserState = 'off' | 'on' | 'done';
export type FillState = 'none' | 'hold' | 'run';

export function useLiveFlow(a: LiveFlowArgs) {
  const { setups, levels, subs, qa } = a;
  // What the traveler had when the screen opened: these fix the first batch and the bar's total, so adding interests later never moves them.
  const [initial] = useState(() => {
    const all = Object.keys(levels);
    const top = orderedByLevel(levels).filter((k) => levels[k] === 'top');
    return { all, keys: all.filter((k) => setups[k]), top, gate: gateItems(top, setups) };
  });
  const gate = initial.gate;
  const applies = gate.length > 0;

  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const startPos = useMemo(() => firstUnansweredGate(gate, qa, {}), []); // eslint-disable-line react-hooks/exhaustive-deps
  const anyTicked = initial.all.some((k) => (subs[k] ?? []).length > 0);
  const alreadyOpen = applies && (a.returning || startPos >= gate.length);
  const [step, setStep] = useState<LiveStep>(alreadyOpen ? (anyTicked ? 'interests' : 'chips') : 'q1');
  const [j, setJ] = useState(alreadyOpen ? 0 : startPos);
  const [deeper, setDeeper] = useState<LiveItem[]>([]);
  const [nq, setNq] = useState<LiveItem[]>([]);
  const [chipsDone, setChipsDone] = useState(alreadyOpen && anyTicked);
  const [added, setAdded] = useState<string[]>([]);
  const [newChipped, setNewChipped] = useState<string[]>([]);
  const [open, setOpenState] = useState(applies && !alreadyOpen);
  const [unlocked, setUnlocked] = useState(alreadyOpen);
  const [pulse, setPulse] = useState(false);
  const [listShown, setListShown] = useState(alreadyOpen);
  const [fill, setFill] = useState<FillState>('none');
  const [teaser, setTeaser] = useState<TeaserState>('off');
  // The pop-up keeps its words while it fades out.
  const [pop, setPopState] = useState({ text: '', on: false });
  const setPop = (text: string | null) => setPopState((p) => (text === null ? { ...p, on: false } : { text, on: true }));
  // A counter rides along so the same line twice in a row is still shown twice.
  const [msg, setMsgState] = useState({ text: '', n: 0 });
  const setMsg = (text: string) => setMsgState((m) => ({ text, n: m.n + 1 }));
  const [dir, setDir] = useState<1 | -1 | 0>(0);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const item: LiveItem | null = step === 'q1' ? gate[j] ?? null : step === 'q3' ? deeper[j] ?? null : step === 'newq' ? nq[j] ?? null : null;
  const total = step === 'q1' ? gate.length : step === 'q3' ? deeper.length : nq.length;
  const newOnes = added.filter((k) => !newChipped.includes(k));

  const bar = { keys: initial.keys, added, setups, qa, ticked: subs, chipsDone, marks: a.marks, newChipped };
  const percent = dnaPercent(bar);
  const points = barPoints(bar);
  const barSize = barTotal(bar);
  const gatePct = gatePercent(gate.length, bar);
  const remaining = toUnlock(gate.length, j);
  const moreToDo = step !== 'interests' || !unlocked || newOnes.length > 0;

  const skippedMap: Skipped = skipped;
  const deeperNow = useCallback(() => deeperItems(initial.all, setups, subs, qa, skippedMap, gate), [initial.all, setups, subs, qa, skippedMap, gate]);

  function unlockSequence() {
    if (busy.current) return;
    busy.current = true;
    setUnlocked(true);
    later(() => { setPulse(true); setOpenState(false); }, 700); // 1 the box folds into the DNA button
    later(() => { setStep('chips'); setDir(0); setMsg(''); setPop('Full list unlocked'); }, 1350); // 2 a message that goes away
    later(() => setPop(null), 4950);
    later(() => { setListShown(true); setFill('hold'); }, 1900); // 3 the rest of the list, held invisible
    later(() => setFill('run'), 2900); // 5 the places fill in
    later(() => { setFill('none'); setTeaser('on'); busy.current = false; }, 4300); // 6 the teaser shows how to mark places
  }

  function advance() {
    const nextJ = j + 1;
    if (step === 'q1' && nextJ >= gate.length) { setJ(nextJ); unlockSequence(); return; }
    setDir(1);
    setJ(nextJ);
    if (step === 'q3' && nextJ >= deeper.length) setStep('interests');
    if (step === 'newq' && nextJ >= nq.length) { setStep('interests'); setMsg('Your new interests are part of your DNA.'); }
  }

  function answer(it: LiveItem, picks: number[]) {
    const line = a.describeMove(it.interest, it.q.key, picks);
    a.onAnswer(it.interest, it.q.key, picks);
    setMsg(line ?? 'Saved. The order held.');
    advance();
  }
  function skip(it: LiveItem) {
    setSkipped((s) => ({ ...s, [qid(it.interest, it.q.key)]: true }));
    advance();
  }
  function back() {
    if (j > 0) { setDir(-1); setJ(j - 1); setMsg(''); }
  }

  function toggleBox() {
    setPulse(false);
    if (!open && step === 'q1' && !item) { setStep('chips'); setDir(0); }
    setOpenState((o) => !o);
  }

  function finishChips() {
    setChipsDone(true);
    const items = deeperNow();
    setDeeper(items);
    setJ(0);
    setDir(1);
    setStep(items.length ? 'q3' : 'interests');
    setMsg('Your chips are applied to the list.');
  }
  function toNewChips() { setDir(1); setStep('newchips'); }
  function backToChips() { setDir(-1); setStep('chips'); }
  function finishNewChips() {
    const items = newItems(newOnes, setups, subs, qa, skippedMap);
    setNewChipped((c) => [...c, ...newOnes.filter((k) => !c.includes(k))]);
    setNq(items);
    setJ(0);
    setDir(1);
    setStep(items.length ? 'newq' : 'interests');
    setMsg(items.length ? `${items.length} new question${items.length > 1 ? 's' : ''} unlocked.` : 'Saved.');
  }
  function addInterest(k: string) { setAdded((x) => (x.includes(k) ? x : [...x, k])); a.onAddInterest(k); setMsg(''); }
  function removeInterest(k: string) { setAdded((x) => x.filter((y) => y !== k)); a.onRemoveInterest(k); setMsg(''); }

  return {
    applies, gate, initial, step, item, j, total, open, unlocked, pulse, listShown, fill, teaser, pop, msg, dir, added, newOnes,
    percent, points, barSize, gatePct, remaining, moreToDo,
    answer, skip, back, toggleBox, finishChips, toNewChips, backToChips, finishNewChips, addInterest, removeInterest,
    closeTeaser: () => setTeaser('done'),
    /** Marking a place Visited or Saved shows the teaser has done its job. */
    markedPlace: () => setTeaser((t) => (t === 'on' ? 'done' : t)),
    setOpen: setOpenState,
  };
}

export type LiveFlow = ReturnType<typeof useLiveFlow>;
