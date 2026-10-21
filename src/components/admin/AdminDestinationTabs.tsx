'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/destinations/interests', label: 'Interests' },
  { href: '/admin/destinations', label: 'Places' },
  { href: '/admin/destinations/matrix', label: 'Interests × Places' },
  { href: '/admin/destinations/cost-items', label: 'Cost Items' },
  { href: '/admin/destinations/seasonal-flags', label: 'Seasonal Flags' },
  { href: '/admin/destinations/advisories', label: 'Advisories' },
  { href: '/admin/destinations/matching', label: 'Matching' },
  { href: '/admin/destinations/todo', label: 'To do' },
];

/** `todoCount` is the number of open items that need you or are past their check date. */
export function AdminDestinationTabs({ todoCount = 0 }: { todoCount?: number }) {
  const pathname = usePathname();
  return (
    <div className="admin-tabs">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`admin-tab${pathname === tab.href ? ' active' : ''}`}>
          {tab.label}
          {tab.href.endsWith('/todo') && todoCount > 0 && <span className="admin-tab-count">{todoCount}</span>}
        </Link>
      ))}
    </div>
  );
}
