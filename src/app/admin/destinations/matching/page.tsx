import { loadMatchSettings } from '@/lib/scoring/matchSettingsServer';
import { MatchingSettingsView } from '@/components/admin/matching/MatchingSettingsView';

export const dynamic = 'force-dynamic';

export default async function AdminMatchingPage() {
  const { settings } = await loadMatchSettings();
  return <MatchingSettingsView initial={settings} />;
}
