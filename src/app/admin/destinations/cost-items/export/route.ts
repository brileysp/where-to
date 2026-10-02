import { NextRequest } from 'next/server';
import { requireAdminUser } from '@/lib/admin/auth';
import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { costItemIcon } from '@/lib/scoring/costIcons';
import { toCsv } from '@/lib/admin/csv';

/**
 * CSV export of the Cost Items screen, matching the Matrix export's
 * conventions (docs/todo.md's content-authoring-via-spreadsheet workflow).
 * One row per cost ITEM, not per place — a place's items live in one jsonb
 * array column (`costItems`), a genuinely one-to-many shape a single CSV
 * row per place can't hold without serializing JSON into a cell.
 *
 * `item_id` is the same stable id `stampCostItems` (cost-item-stamp.ts)
 * already matches edits against on save — round-tripping it back unchanged
 * lets a future import update the right existing item (carrying its
 * history forward) instead of matching by label/position or, worse,
 * silently creating a duplicate.
 *
 * `item_updated_at`/`updated_by`/`editor_kind`/`last_change` are read-only
 * context, not meant to be edited in the sheet — they're stamped
 * automatically by stampCostItems on save regardless of who/what wrote the
 * change, same as every other admin write path. They're included so a
 * reviewer (human or the cost-checking agent this tracking was built for —
 * see docs/todo.md) can judge a price's freshness/trust before deciding
 * whether it needs a second look, without opening each place individually.
 *
 * `place_updated_at` is the PLACE row's own updatedAt (costItems lives on
 * `places`, not a separate table) — for the same optimistic-concurrency
 * check the Matrix export's `updated_at` supports.
 *
 * Pass ?onlyNotHuman=1 to export only items never touched by a human yet —
 * the same filter this screen's own "Never edited by a human" checkbox
 * applies — instead of every item. This never hides a zero-item place
 * (see below): there's no human-edited-or-not item to filter there, and a
 * missing-data gap is exactly the kind of thing that filter is meant to
 * help surface, not hide.
 *
 * `cost_floor`/`cost_ceiling` are the place's own overall cost tier
 * ($ .. $$$$$ — "Cost floor"/"Cost ceiling" in the Places screen), and
 * `cost_overview` its free-text cost summary. Reviewing itemized prices
 * naturally means re-litigating whether this overall tier and blurb still
 * hold up against them (e.g. every item pricier than a "$" floor implies)
 * — and both fields live on the same `places` row already being queried
 * here, so including them costs nothing extra. Same round-trip shape as
 * the item fields: a changed cell is a plain overwrite of that place's
 * `costMin`/`costMax`/`costOverview`.
 *
 * A place with zero cost items still gets exactly one row, with every
 * item_* field blank — the gap itself (nothing here to review) is worth
 * surfacing, not something to leave silently absent from the sheet. A
 * later import that finds a blank item_id with a filled label/price
 * treats it as a new item; one entirely blank (place-level fields only)
 * means no items were added.
 */
export async function GET(req: NextRequest) {
  await requireAdminUser();

  const onlyNotHuman = req.nextUrl.searchParams.get('onlyNotHuman') === '1';
  const rows_ = await listDestinationsForAdmin();

  const header = [
    'place_id',
    'place_name',
    'region',
    'continent',
    'place_updated_at',
    'cost_floor',
    'cost_ceiling',
    'cost_overview',
    'item_id',
    'label',
    'price',
    'unit',
    'emoji',
    'item_updated_at',
    'updated_by',
    'editor_kind',
    'last_change',
  ];

  const rows: Array<Array<string | number | boolean | null>> = [];
  for (const d of rows_) {
    const continent = getContinent(d.id);
    const placeUpdatedAt = d.updatedAt.toISOString();
    const placeCols = [d.id, d.name, d.region, continent, placeUpdatedAt, d.costMin ?? '', d.costMax ?? '', d.costOverview ?? ''];
    const items = onlyNotHuman ? d.costItems.filter((i) => i.editorKind !== 'human') : d.costItems;

    if (d.costItems.length === 0) {
      // No items at all — one row so the gap itself shows up in the sheet,
      // every item_* column blank (see doc comment above).
      rows.push([...placeCols, '', '', '', '', '', '', '', '', '']);
      continue;
    }
    for (const item of items) {
      rows.push([
        ...placeCols,
        item.id ?? '',
        item.label,
        item.price,
        item.unit ?? '',
        item.emoji ?? costItemIcon(item.label),
        item.updatedAt ?? '',
        item.updatedBy ?? '',
        item.editorKind ?? '',
        item.lastChange ?? '',
      ]);
    }
  }

  const csv = toCsv(header, rows);
  const filename = `cost-items-export${onlyNotHuman ? '-needs-review' : ''}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
