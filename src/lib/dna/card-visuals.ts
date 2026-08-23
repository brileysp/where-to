// Ported verbatim from cards.js:45-74 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/cards.js).
// Placeholder visual styling per category — no real photo API yet. Each
// card renders a gradient panel + emoji.

export interface CategoryVisual {
  gradient: [string, string];
  emoji: string;
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  Welcome: { gradient: ['#2b3a4a', '#e8935a'], emoji: '🧭' },
  Wildlife: { gradient: ['#2d3b2a', '#6b8f4e'], emoji: '🦁' },
  Birding: { gradient: ['#243a3d', '#4f8a8b'], emoji: '🦜' },
  Beach: { gradient: ['#0e6ba8', '#8ecae6'], emoji: '🏖️' },
  'Ocean Swimming': { gradient: ['#023047', '#219ebc'], emoji: '🌊' },
  'Snorkeling & Diving': { gradient: ['#03045e', '#0077b6'], emoji: '🤿' },
  Hiking: { gradient: ['#3a4d39', '#7d9d6f'], emoji: '🥾' },
  Cycling: { gradient: ['#2b4162', '#5b7fa6'], emoji: '🚴' },
  Food: { gradient: ['#7a2e2e', '#c96f4a'], emoji: '🍜' },
  'Wine & Spirits': { gradient: ['#4a0e2e', '#8e3b5e'], emoji: '🍷' },
  Culture: { gradient: ['#523a1f', '#a9762c'], emoji: '🏛️' },
  Cities: { gradient: ['#1f2233', '#4a5578'], emoji: '🌆' },
  'Remote Wilderness': { gradient: ['#1b2a1e', '#3f5c3f'], emoji: '🏔️' },
  'Luxury Lodging': { gradient: ['#2e2418', '#a9814a'], emoji: '🛎️' },
  'Rustic Adventure': { gradient: ['#3b2e22', '#7c5e3c'], emoji: '🎒' },
  Wellness: { gradient: ['#1e3a34', '#5fa88f'], emoji: '🧘' },
  Shopping: { gradient: ['#3a1f3a', '#8a4f8a'], emoji: '🛍️' },
  Nightlife: { gradient: ['#1a0e2e', '#6a2c8a'], emoji: '🌃' },
  Family: { gradient: ['#1f4d5c', '#4fa3c4'], emoji: '👨‍👩‍👧' },
  Photography: { gradient: ['#1c1c1c', '#5a5a5a'], emoji: '📸' },
  'Low-Season Deals': { gradient: ['#2a3b2a', '#5f8f6f'], emoji: '💸' },
  'Avoiding Crowds': { gradient: ['#242424', '#5c6b73'], emoji: '🧭' },
  Golf: { gradient: ['#1e3d1e', '#6b9e5e'], emoji: '⛳' },
  'Snow Sports': { gradient: ['#2b3a4a', '#a8c5d6'], emoji: '🎿' },
  Fishing: { gradient: ['#1e3a3a', '#4f7d7d'], emoji: '🎣' },
  'Sailing & Yachting': { gradient: ['#0b1f3a', '#3a7bd5'], emoji: '⛵' },
  'Adventure Sports': { gradient: ['#3a1f0e', '#d9782f'], emoji: '🪂' },
  'Scenic Touring & Rentals': { gradient: ['#1e2e3a', '#5a8fae'], emoji: '🛵' },
  Surfing: { gradient: ['#004d61', '#00a8a8'], emoji: '🏄' },
  'Theme Parks & Resorts': { gradient: ['#7a1f4a', '#e0577a'], emoji: '🎢' },
};

export const DEFAULT_CATEGORY_VISUAL: CategoryVisual = { gradient: ['#333333', '#666666'], emoji: '✨' };

export function attributeLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
