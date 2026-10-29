'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<{ href: string; label: string; soon?: boolean }> = [
  { href: '/admin/destinations/interests', label: 'Interests' },
  { href: '/admin/destinations', label: 'Places' },
  { href: '/admin/destinations/matrix', label: 'Interests × Places' },
  { href: '/admin/destinations/cost-items', label: 'Cost Items' },
  { href: '/admin/destinations/advisories', label: 'Advisories', soon: true },
  { href: '/admin/destinations/question-links', label: 'Question links' },
  { href: '/admin/destinations/matching', label: 'Matching' },
  { href: '/admin/destinations/todo', label: 'To do' },
];

/** `todoCount` is the number of open items that need you or are past their check date. */
export function AdminDestinationTabs({ todoCount = 0, linksCount = 0 }: { todoCount?: number; linksCount?: number }) {
  const pathname = usePathname();
  return (
    <div className="admin-tabs">
      {TABS.map((tab) => tab.soon ? (
        <span key={tab.href} className="admin-tab soon" title="Not built yet" aria-disabled="true">{tab.label}</span>
      ) : (
        <Link key={tab.href} href={tab.href} className={`admin-tab${pathname === tab.href ? ' active' : ''}`}>
          {tab.label}
          {tab.href.endsWith('/todo') && todoCount > 0 && <span className="admin-tab-count">{todoCount}</span>}
          {tab.href.endsWith('/question-links') && linksCount > 0 && <span className="admin-tab-count">{linksCount}</span>}
        </Link>
      ))}
    </div>
  );
}
