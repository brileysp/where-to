import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { KIDS_ITEM, KidsAges } from '@/components/onboarding-v2/KidsAges';
import { WhoCard } from '@/components/onboarding-v2/WhoCard';
import { toggleCareOption } from '@/lib/onboarding/care';

describe('"With my kids" asks for the ages right there (owner, 22 Nov 2026)', () => {
  it('offers the Kid-friendly row\'s own age choices and shows the ones picked', () => {
    const html = renderToStaticMarkup(createElement(KidsAges, { ages: ['k'], onToggle: () => {} }));
    for (const label of ['Under 5', '5 to 12', 'Teens']) expect(html).toContain(label);
    expect(html).toMatch(/aria-pressed="true"[^>]*>5 to 12/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Teens/);
  });
  it('writes the same choice the Kid-friendly row does, so the two always agree', () => {
    const picked = toggleCareOption({}, KIDS_ITEM, 'u5');
    expect(picked.kids.o).toEqual(['u5']);
    expect(toggleCareOption(picked, KIDS_ITEM, 'u5').kids?.o ?? []).toEqual([]);
  });
  it('shows under the companion pills only once kids is picked', () => {
    const base = { title: 'Who', sub: 's', onToggle: () => {}, ages: [], onAge: () => {} };
    expect(renderToStaticMarkup(createElement(WhoCard, { ...base, who: ['solo'] }))).not.toContain('How old are they');
    expect(renderToStaticMarkup(createElement(WhoCard, { ...base, who: ['kids'] }))).toContain('How old are they');
  });
});
