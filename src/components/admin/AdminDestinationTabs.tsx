'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/destinations', label: 'Places' },
  { href: '/admin/destinations/matrix', label: 'Interests × Places' },
  { href: '/admin/destinations/cost-items', label: 'Cost Items' },
  { href: '/admin/destinations/interests', label: 'Interests' },
  { href: '/admin/destinations/seasonal-flags', label: 'Seasonal Flags' },
];

export function AdminDestinationTabs() {
  const pathname = usePathname();
  return (
    <div className="admin-tabs">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`admin-tab${pathname === tab.href ? ' active' : ''}`}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
