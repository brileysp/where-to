// 18 Nov 2026 (step 6 of docs/place-naming-plan.md): the owner reads labels, never keys (standard D03). A script that calls installLabelFilter() cannot print a place key: every line it writes
// to the console has any key (p0113) replaced by the place's label (Myanmar) before it is printed. Used by the reporting and pipeline scripts.
const KEY_IN_TEXT = /(?<![A-Za-z0-9])p\d{4}(?![A-Za-z0-9])/g;

export function replaceKeysWithLabels(text: string, labels: ReadonlyMap<string, string>): string {
  return text.replace(KEY_IN_TEXT, (k) => labels.get(k) ?? k);
}

let installed = false;
/** Loads the labels once and wraps console.log / info / warn / error. Safe to call twice. */
export async function installLabelFilter(): Promise<void> {
  if (installed) return; installed = true;
  const { loadIdentityTables } = await import('./lookup');
  const labels = new Map((await loadIdentityTables(undefined, true)).identity.map((r) => [r.key, r.label]));
  for (const m of ['log', 'info', 'warn', 'error'] as const) {
    const orig = console[m].bind(console);
    console[m] = (...args: unknown[]) => orig(...args.map((a) => (typeof a === 'string' ? replaceKeysWithLabels(a, labels) : a)));
  }
}
