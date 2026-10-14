// What can be edited on the "Domains & insights" admin screen (/admin/dna). Client-safe: no database imports.
export type DnaFieldKind = 'text' | 'longtext' | 'bool' | 'int' | 'list' | 'json';

export interface DnaField {
  key: string;
  label: string;
  kind: DnaFieldKind;
  /** The value may be empty (saved as null, or an empty list). */
  optional?: boolean;
  width?: number;
}

export type DnaTableKey = 'domains' | 'subdimensions' | 'dimensions' | 'tensions';

export interface DnaTable {
  key: DnaTableKey;
  label: string;
  help: string;
  idColumn: string;
  /** Column that is shown but never edited (the row id). */
  idLabel: string;
  fields: DnaField[];
}

export const DNA_TABLES: DnaTable[] = [
  {
    key: 'domains',
    label: 'Domains',
    help: 'The interest areas the Travel DNA swipe cards are grouped into. The key is how the whole app refers to a domain, so it cannot be changed here.',
    idColumn: 'key',
    idLabel: 'Key',
    fields: [
      { key: 'label', label: 'Label', kind: 'text', width: 170 },
      { key: 'emoji', label: 'Emoji', kind: 'text', optional: true, width: 60 },
      { key: 'hasDeepCards', label: 'Has deep cards', kind: 'bool' },
      { key: 'matchCategories', label: 'Matches card categories', kind: 'list', optional: true, width: 200 },
      { key: 'matchTags', label: 'Matches card tags', kind: 'list', optional: true, width: 200 },
      { key: 'unlockMinPositive', label: 'Unlock (yes swipes)', kind: 'int', optional: true, width: 80 },
      { key: 'unlockMinLove', label: 'Unlock (love swipes)', kind: 'int', optional: true, width: 80 },
      { key: 'transitionTitle', label: 'Transition title', kind: 'text', optional: true, width: 200 },
      { key: 'transitionBody', label: 'Transition text', kind: 'longtext', optional: true, width: 300 },
    ],
  },
  {
    key: 'subdimensions',
    label: 'Subdimensions',
    help: 'The finer topics inside each domain. The order number sets the order the deep-dive questions are asked in.',
    idColumn: 'id',
    idLabel: 'Domain',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', width: 240 },
      { key: 'ordinal', label: 'Order', kind: 'int', width: 70 },
    ],
  },
  {
    key: 'dimensions',
    label: 'Dimensions',
    help: 'The two-sided questions behind the Travel DNA (for example relaxing versus adventurous). The two keys are what the cards score against, so they cannot be changed here.',
    idColumn: 'id',
    idLabel: 'Id',
    fields: [
      { key: 'label', label: 'Label', kind: 'text', width: 160 },
      { key: 'poleA', label: 'First side', kind: 'text', width: 130 },
      { key: 'poleB', label: 'Second side', kind: 'text', width: 130 },
      { key: 'summaryA', label: 'First side summary', kind: 'longtext', width: 260 },
      { key: 'summaryB', label: 'Second side summary', kind: 'longtext', width: 260 },
      { key: 'question', label: 'Question', kind: 'longtext', width: 280 },
    ],
  },
  {
    key: 'tensions',
    label: 'Insights',
    help: 'The "you want two things that pull against each other" insights shown to travellers. Each compares two signals; a signal is JSON with a label, a type (profile, dimensionPole or rejectedAttrs), the keys it looks at and a minimum.',
    idColumn: 'id',
    idLabel: 'Id',
    fields: [
      { key: 'title', label: 'Title', kind: 'text', width: 200 },
      { key: 'insightText', label: 'Insight text', kind: 'longtext', width: 320 },
      { key: 'recommendationImplication', label: 'What it means for recommendations', kind: 'longtext', optional: true, width: 280 },
      { key: 'relatedDimensionIds', label: 'Related dimensions', kind: 'list', optional: true, width: 180 },
      { key: 'signalA', label: 'Signal A (JSON)', kind: 'json', width: 260 },
      { key: 'signalB', label: 'Signal B (JSON)', kind: 'json', width: 260 },
    ],
  },
];
