// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('@/app/admin/destinations/interests/[key]/actions', () => ({ addIdea: vi.fn(), updateIdea: vi.fn(), deleteIdea: vi.fn(), moveIdea: vi.fn(), promoteIdea: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: unknown }) => createElement('a', { href }, children as never) }));

import { IdeasSection } from '@/components/admin/interest-page/IdeasSection';
import type { IdeaRow } from '@/lib/admin/interest-pages/types';

const idea = (over: Partial<IdeaRow>): IdeaRow => ({ id: 'i1', name: 'Cebu', region: 'Philippines', why: '', nearestExisting: '', settingTags: ['island', 'beach-coast'], stage: 'idea', grain: null, grainNote: '', sortOrder: null, promotedPlaceId: null, createdAt: '2026-11-10T00:00:00Z', ...over });

describe('Future place ideas', () => {
  it('shows the setting tags with the primary first, and a Setting filter', () => {
    const html = renderToString(createElement(IdeasSection, { interestKey: 'diving', ideas: [idea({}), idea({ id: 'i2', name: 'Nowhere', settingTags: [] })], setIdeas: () => {} }));
    expect(html).toContain('All settings'); expect(html).toContain('Island'); expect(html).toContain('Beach &amp; coast');
    expect(html).toContain('Not classified');
    expect(html).not.toContain('Seabird coasts'); expect(html).not.toContain('Neotropics');
  });
});
