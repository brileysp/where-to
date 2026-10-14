import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ThinkingLevel } from '@google/genai';
import { DEFAULT_THINKING_LEVEL, assertThinkingLevelAllowed, resolveThinkingLevel, thinkingConfigFor } from '../../src/lib/gemini/client';

// Thinking tokens were 70-85% of every Gemini call's cost, so every call must cap them. See client.ts.
describe('thinking cap', () => {
  it('defaults to low and rejects unknown levels', () => {
    expect(DEFAULT_THINKING_LEVEL).toBe('low');
    expect(resolveThinkingLevel()).toBe('low');
    expect(thinkingConfigFor().thinkingLevel).toBe(ThinkingLevel.LOW);
    expect(thinkingConfigFor('minimal').thinkingLevel).toBe(ThinkingLevel.MINIMAL);
    expect(() => resolveThinkingLevel('off')).toThrow();
  });

  it('refuses a higher level than the default unless it is explicitly allowed', () => {
    expect(() => assertThinkingLevelAllowed('low', false)).not.toThrow();
    expect(() => assertThinkingLevelAllowed('minimal', false)).not.toThrow();
    expect(() => assertThinkingLevelAllowed('medium', false)).toThrow();
    expect(() => assertThinkingLevelAllowed('high', false)).toThrow();
    expect(() => assertThinkingLevelAllowed('high', true)).not.toThrow();
  });

  it('is used by every file that calls generateContent, so a new script cannot forget it', () => {
    const roots = [join(__dirname, '..', '..', 'scripts'), join(__dirname, '..', '..', 'src')];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) { if (name !== 'node_modules') walk(full); continue; }
        if (!/\.tsx?$/.test(name)) continue;
        const text = readFileSync(full, 'utf8');
        if (text.includes('.generateContent(') && !text.includes('thinkingConfigFor(')) offenders.push(full);
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
