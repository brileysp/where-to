// Species-name emphasis in authored blurbs. A name is stored wrapped in double asterisks, for example
// "the **Azores Bullfinch** is found only in the laurel forests". The public card shows those spans in a
// slightly heavier weight; everything that counts, compares or checks the text works on the stripped version.

const MARK = /\*\*([^*]+)\*\*/g;

/** The text without the markers. Use this for lengths, comparisons and any plain-text display. */
export function stripEmphasis(text: string): string {
  return text.replace(MARK, '$1');
}

/** True when every `**` has a partner and no marked span is empty or nested. */
export function emphasisIsBalanced(text: string): boolean {
  const withoutPairs = text.replace(MARK, '$1');
  return !withoutPairs.includes('**') && !/\*\*\s*\*\*/.test(text);
}

export type EmphasisPart = { text: string; emphasis: boolean };

/** Splits text into plain and emphasised parts, in order. Unbalanced markers are left as plain text. */
export function splitEmphasis(text: string): EmphasisPart[] {
  if (!emphasisIsBalanced(text)) return [{ text: stripEmphasis(text).replace(/\*\*/g, ''), emphasis: false }];
  const parts: EmphasisPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARK)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), emphasis: false });
    parts.push({ text: m[1], emphasis: true });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), emphasis: false });
  return parts;
}
