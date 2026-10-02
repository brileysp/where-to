/** Accepts both `--flag value` and `--flag=value` (the latter is what the
 * user's own example commands use, e.g. `--limit=14`) plus bare boolean
 * flags (`--reauthor`). Shared by every script in scripts/gemini-*.ts and
 * scripts/pipeline-*.ts so they all parse args the same way. */
export function parseCliArgs(argv: string[]): Map<string, string | true> {
  const out = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      out.set(arg.slice(2, eqIdx), arg.slice(eqIdx + 1));
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out.set(key, next);
      i++;
    } else {
      out.set(key, true);
    }
  }
  return out;
}

export function getString(args: Map<string, string | true>, key: string): string | undefined {
  const v = args.get(key);
  return typeof v === 'string' ? v : undefined;
}

export function getFlag(args: Map<string, string | true>, key: string): boolean {
  return args.has(key) && args.get(key) !== 'false';
}
