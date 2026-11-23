// 20 Nov 2026: the Scenic Landscapes batch of 16 Nov sent Gemini landscape ratings and signature views written (on 23 Oct) for the OLD, narrower names of 20 widened places (Quebec City, not Quebec City & Montreal;
// Alba's Langhe hills, not the Alps), because the one script that sends batches to Gemini had no check for renamed places. The owner: "you repeatedly used the old names, then told me you'd solved the problem,
// and then made the same mistake again." A renamed or widened place (docs/renamed-places.json) may not be sent to Gemini until the owner has confirmed its scope on the Names & scope screen.
export interface GuardCell { k: string; id: string }
export interface GuardBlock { k: string; id: string; note: string }

/** The cells whose place was renamed or widened (listed in docs/renamed-places.json) and whose saved scope is not yet confirmed by the owner. */
export function renamedWithoutConfirmedScope(cells: GuardCell[], renamed: Record<string, string>, scopeStatusByKey: Record<string, string>): GuardBlock[] {
  return cells.filter((c) => renamed[c.id] !== undefined && scopeStatusByKey[c.id] !== 'confirmed').map((c) => ({ ...c, note: renamed[c.id] }));
}
