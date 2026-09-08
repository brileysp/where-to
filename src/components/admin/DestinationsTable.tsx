'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface DestinationRow {
  id: string;
  name: string;
  region: string;
  climate: string;
  updatedAtLabel: string;
}

export function DestinationsTable({ destinations }: { destinations: DestinationRow[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? destinations.filter((d) => d.name.toLowerCase().includes(q) || d.region.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))
    : destinations;

  return (
    <>
      <input
        placeholder="Filter by name, region, or id…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
            <th style={{ padding: '6px 8px' }}>id</th>
            <th style={{ padding: '6px 8px' }}>name</th>
            <th style={{ padding: '6px 8px' }}>region</th>
            <th style={{ padding: '6px 8px' }}>climate</th>
            <th style={{ padding: '6px 8px' }}>updatedAt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 8px' }}>
                <Link href={`/admin/destinations/${d.id}`}>{d.id}</Link>
              </td>
              <td style={{ padding: '6px 8px' }}>{d.name}</td>
              <td style={{ padding: '6px 8px' }}>{d.region}</td>
              <td style={{ padding: '6px 8px' }}>{d.climate}</td>
              <td style={{ padding: '6px 8px', color: '#888' }}>{d.updatedAtLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
        {filtered.length} of {destinations.length} shown.
      </p>
    </>
  );
}
