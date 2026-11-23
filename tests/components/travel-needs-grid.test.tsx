// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('@/app/admin/destinations/interests/[key]/actions', () => ({ saveFact: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never) }));

import { TravelNeedsGrid } from '@/components/admin/TravelNeedsGrid';
import { TRAVEL_FACTS } from '@/lib/admin/travel-needs/config';

const row = (id: string, name: string, facts: Record<string, number | string | string[]>) => ({ id, name, region: 'x', settingTags: ['beach-coast', 'town-countryside'], facts });

describe('Traveler needs admin page', () => {
  it('renders a row per place with a column for every traveler-needs field and the filled count', () => {
    const full = Object.fromEntries(TRAVEL_FACTS.filter((d) => d.type === 'rating').map((d) => [d.key, 7]));
    const html = renderToString(createElement(TravelNeedsGrid, { initialRows: [row('maui', 'Maui', full), row('nowhere', 'Nowhere', {})] }));
    expect(html).toContain('Maui'); expect(html).toContain('Nowhere'); expect(html).toContain('Beach &amp; coast'); expect(html).toContain('All settings');
    for (const d of TRAVEL_FACTS) expect(html).toContain(d.label.replace(/&/g, '&amp;'));
    const scored = TRAVEL_FACTS.filter((d) => !d.optional).length;
    expect(html).toContain(`${scored}/${scored}`); expect(html).toContain(`0/${scored}`);
    expect(html).toContain('/admin/destinations/maui/profile');
    expect(html).toContain(`${scored} of ${scored * 2} cells filled`);
  });
});
