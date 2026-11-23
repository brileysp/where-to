import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

// 15 Nov 2026: the owner's corrections to the instructions Gemini receives. The scope sheets and the shared prompt are the only place these rules live, so a test holds them there.
const root = join(__dirname, '..', '..');
const scopes = JSON.parse(readFileSync(join(root, 'scripts/data/family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, { scope: string }> }>;
const scopeOf = (k: string) => Object.values(scopes).map((f) => f.interests[k]).find(Boolean)!.scope;
const core = readFileSync(join(root, 'prompts/_shared/authoring-core.md'), 'utf8');

describe('stargazing: no stars is not the same as a few stars', () => {
  it('scores a month with no star at all exactly 0 and keeps it out of a blurb with a month where a few stars show', () => {
    const s = scopeOf('stargazing');
    expect(s).toContain('no star shows at all and the month scores exactly 0.0');
    expect(s).toContain('A few stars and no stars are different months');
    expect(s).not.toContain('scores at most 1.0');
  });
});
describe('stargazing: wording follows the sky (owner, 16 Nov 2026, Practice Batch Three)', () => {
  const s = scopeOf('stargazing');
  it('leaves out the length of the night for places closer to the equator than Seattle', () => {
    expect(s).toContain('closer to the equator than Seattle');
    expect(s).toContain('never mention the length of the night at all');
  });
  it('gives each kind of sky its own blurb and keeps "never gets fully dark" for months where no star shows', () => {
    expect(s).toContain('each of these skies gets its own blurb');
    expect(s).toContain('most stars still show (-18 to -12)');
    expect(s).toContain('do not say the sky "never gets fully dark" for such a month');
  });
  it('says nothing about when in the evening the Milky Way can be seen', () => {
    expect(s).toContain('never say when in the evening or night it can be seen');
    expect(s).not.toContain('early in the evening');
  });
});
describe('sunbathing: one smooth temperature scale for every place', () => {
  it('has no cliff at 68 degrees and puts the zero point at 50 degrees', () => {
    const s = scopeOf('sunbathing');
    expect(s).toContain('at or below 50 the month is 0');
    expect(s).toContain('60 is about 1.0 to 1.5');
    expect(s).not.toContain('below 68 scores near 0 to 1');
  });
});
describe('spa and wellness: all three kinds are covered in the overview', () => {
  it('asks for day spas, bathing culture and wellness retreats, with hot springs only briefly', () => {
    const s = scopeOf('spaWellness');
    expect(s).toContain('cover all three kinds');
    expect(s).toContain('do not lead with them');
  });
});

describe('scenic landscapes: the place is the subject, not its scenery (owner, 18 Nov 2026)', () => {
  it('tells Gemini the place is the subject, one subject per sentence, and to name famous ancient sites', () => {
    const sc = scopeOf('scenicLandscapes');
    expect(sc).toContain('Write the place as the subject of the overview');
    expect(sc).toContain('never "Northern Ireland\'s scenery is known for');
    expect(sc).toContain('one subject');
    expect(sc).toContain('Teotihuacan');
    expect(core).toContain('The place is the subject, never its scenery');
  });
});

