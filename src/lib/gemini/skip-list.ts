import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Place ids that must never be sent to Gemini for an interest, from docs/<interest>-clear-na.json
 * ({ "ids": { "<placeId>": "reason" } }). Empty when the file does not exist. */
export function loadSkipList(interestKey: string, root: string = join(__dirname, '..', '..', '..')): Map<string, string> {
  const file = join(root, 'docs', `${interestKey}-clear-na.json`);
  if (!existsSync(file)) return new Map();
  const doc = JSON.parse(readFileSync(file, 'utf8')) as { ids?: Record<string, string> };
  return new Map(Object.entries(doc.ids ?? {}));
}
