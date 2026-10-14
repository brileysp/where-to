import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { HomeCountryPicker } from '@/components/HomeCountryPicker';
import Link from 'next/link';
import { requireAdminUser } from '@/lib/admin/auth';
import { PendingEditsProvider } from '@/components/admin/PendingEditsProvider';
import { TrayCollapseProvider, PendingTrayToggle, PendingTrayPanel } from '@/components/admin/PendingChangesTray';
import { ToastHost } from '@/components/admin/ToastHost';
import { AdminDestinationTabs } from '@/components/admin/AdminDestinationTabs';
import { getAttentionTodoCount } from '@/lib/db/queries/site-todos';
import './admin-grid.css';

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono' });

export default async function AdminDestinationsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  const todoCount = await getAttentionTodoCount();

  return (
    <div
      className={`admin-grid-shell ${plexSans.variable} ${plexMono.variable}`}
      style={{ fontFamily: 'var(--font-plex-sans), -apple-system, "Helvetica Neue", Arial, sans-serif' }}
    >
      <PendingEditsProvider>
        <TrayCollapseProvider>
          <div className="admin-topbar">
            <Link href="/admin/destinations" className="admin-brand">
              <span className="mark">W?</span> Data Control
            </Link>
            <AdminDestinationTabs todoCount={todoCount} />
            <div className="admin-topbar-spacer" />
            <HomeCountryPicker />
            <PendingTrayToggle />
          </div>
          <div className="admin-body">
            {children}
            <PendingTrayPanel />
          </div>
        </TrayCollapseProvider>
        <ToastHost />
      </PendingEditsProvider>
    </div>
  );
}
