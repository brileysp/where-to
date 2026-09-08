'use client';

import { useActionState } from 'react';
import type { CardFormState } from '@/app/admin/cards/actions';

export interface CardFormInitialValues {
  id: string;
  short: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  imagePrompt: string | null;
  preferenceSignals: Record<string, number>;
  dimensionSignals: Record<string, number>;
  stage: 'broad' | 'deep';
  domainKey: string | null;
  niche: boolean;
  cardSubdimensions: string[] | null;
  sampleDestinations: string[] | null;
  unlockMinPositive: number | null;
  unlockMinLove: number | null;
  diagnosticPurpose: string | null;
}

const fieldStyle: React.CSSProperties = { display: 'block', width: '100%', padding: 8, marginTop: 4, boxSizing: 'border-box', fontFamily: 'inherit' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 16, fontSize: 14 };
const hintStyle: React.CSSProperties = { display: 'block', color: '#888', fontSize: 12, marginTop: 2, fontWeight: 400 };

export function CardForm({
  action,
  initialValues,
  mode,
  domainOptions,
}: {
  action: (prevState: CardFormState, formData: FormData) => Promise<CardFormState>;
  initialValues: CardFormInitialValues;
  mode: 'create' | 'edit';
  domainOptions: string[];
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <label style={labelStyle}>
        <strong>id</strong>
        <span style={hintStyle}>
          {mode === 'edit' ? 'Locked — a card can never be renamed after creation.' : 'lowercase_with_underscores, e.g. "birding_dawn_chorus"'}
        </span>
        <input name="id" defaultValue={initialValues.id} readOnly={mode === 'edit'} required style={{ ...fieldStyle, background: mode === 'edit' ? '#f0f0f0' : undefined }} />
      </label>

      <label style={labelStyle}>
        <strong>short</strong>
        <span style={hintStyle}>Short internal label, shown in lists.</span>
        <input name="short" defaultValue={initialValues.short} required style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>title</strong>
        <span style={hintStyle}>The card&apos;s headline text, shown to the swiper.</span>
        <input name="title" defaultValue={initialValues.title} required style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>description</strong>
        <textarea name="description" defaultValue={initialValues.description} required rows={2} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>category</strong>
        <input name="category" defaultValue={initialValues.category} required style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>stage</strong>
        <select name="stage" defaultValue={initialValues.stage} style={fieldStyle}>
          <option value="broad">broad</option>
          <option value="deep">deep</option>
        </select>
      </label>

      <label style={labelStyle}>
        <strong>domainKey</strong>
        <select name="domainKey" defaultValue={initialValues.domainKey ?? ''} style={fieldStyle}>
          <option value="">— none —</option>
          {domainOptions.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        <strong>tags</strong>
        <span style={hintStyle}>Comma-separated.</span>
        <input name="tags" defaultValue={initialValues.tags.join(', ')} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>imagePrompt</strong>
        <input name="imagePrompt" defaultValue={initialValues.imagePrompt ?? ''} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>preferenceSignals</strong>
        <span style={hintStyle}>JSON object, e.g. {'{"birding": 3, "relaxation": 1}'} — each value from -10 to 10.</span>
        <textarea
          name="preferenceSignals"
          defaultValue={JSON.stringify(initialValues.preferenceSignals, null, 2)}
          rows={4}
          style={{ ...fieldStyle, fontFamily: 'monospace' }}
        />
      </label>

      <label style={labelStyle}>
        <strong>dimensionSignals</strong>
        <span style={hintStyle}>Same shape as preferenceSignals.</span>
        <textarea
          name="dimensionSignals"
          defaultValue={JSON.stringify(initialValues.dimensionSignals, null, 2)}
          rows={4}
          style={{ ...fieldStyle, fontFamily: 'monospace' }}
        />
      </label>

      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" name="niche" defaultChecked={initialValues.niche} />
        <span>
          <strong>niche</strong>
          <span style={hintStyle}>Requires a specific hobby/skill — discounts a &quot;no&quot; as reject-evidence. Never mark on/off casually.</span>
        </span>
      </label>

      <label style={labelStyle}>
        <strong>cardSubdimensions</strong>
        <span style={hintStyle}>Comma-separated. Leave blank for none.</span>
        <input name="cardSubdimensions" defaultValue={(initialValues.cardSubdimensions ?? []).join(', ')} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>sampleDestinations</strong>
        <span style={hintStyle}>Comma-separated, free-text flavor only — not a validated reference.</span>
        <input name="sampleDestinations" defaultValue={(initialValues.sampleDestinations ?? []).join(', ')} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>unlockMinPositive</strong>
        <input name="unlockMinPositive" type="number" min={0} defaultValue={initialValues.unlockMinPositive ?? ''} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>unlockMinLove</strong>
        <input name="unlockMinLove" type="number" min={0} defaultValue={initialValues.unlockMinLove ?? ''} style={fieldStyle} />
      </label>

      <label style={labelStyle}>
        <strong>diagnosticPurpose</strong>
        <input name="diagnosticPurpose" defaultValue={initialValues.diagnosticPurpose ?? ''} style={fieldStyle} />
      </label>

      {state.error && (
        <p style={{ color: '#b00020', fontSize: 14, whiteSpace: 'pre-wrap' }}>{state.error}</p>
      )}

      <button type="submit" disabled={pending} style={{ padding: '8px 16px', cursor: pending ? 'default' : 'pointer' }}>
        {pending ? 'Saving…' : mode === 'create' ? 'Create card' : 'Save changes'}
      </button>
    </form>
  );
}
