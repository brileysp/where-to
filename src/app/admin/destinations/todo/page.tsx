import { listAllTodos } from '@/lib/db/queries/site-todos';
import { SLIDERS } from '@/lib/scoring/constants';
import { todayIso } from '@/lib/admin/todo-dates';
import { SiteTodoView } from '@/components/admin/SiteTodoView';

export const dynamic = 'force-dynamic';

export default async function AdminTodoPage() {
  const [{ todos, placeNames }] = await Promise.all([listAllTodos()]);
  const interests = SLIDERS.map((s) => ({ key: s.key, label: s.label })).sort((a, b) => a.label.localeCompare(b.label));
  return <SiteTodoView initialTodos={todos} placeNames={placeNames} interests={interests} today={todayIso()} />;
}
