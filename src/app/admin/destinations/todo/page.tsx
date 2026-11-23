import { listAllTodos } from '@/lib/db/queries/site-todos';
import { SLIDERS } from '@/lib/scoring/constants';
import { todayIso } from '@/lib/admin/todo-dates';
import { SiteTodoView } from '@/components/admin/SiteTodoView';
import { listInterestMetaForAdmin } from '@/lib/db/queries/admin-interests';

export const dynamic = 'force-dynamic';

export default async function AdminTodoPage() {
  const [{ todos, placeNames }, meta] = await Promise.all([listAllTodos(), listInterestMetaForAdmin()]);
  const evergreen = new Map(meta.map((m) => [m.key, m.evergreen]));
  const interests = SLIDERS.map((s) => ({ key: s.key, label: s.label, inactive: !!s.hidden, evergreen: evergreen.get(s.key) ?? null })).sort((a, b) => a.label.localeCompare(b.label));
  return <SiteTodoView initialTodos={todos} placeNames={placeNames} interests={interests} today={todayIso()} />;
}
