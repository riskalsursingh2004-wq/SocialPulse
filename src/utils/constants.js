/**
 * Global constants shared across the app.
 * Keeping them in one place avoids magic strings scattered through components.
 */

/** Platforms supported by the dashboard (used by filters + charts). */
export const PLATFORMS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube',
  'LinkedIn',
  'X',
  'Reddit',
  'Pinterest',
  'Snapchat',
  'Threads',
  'Unknown',
];

/**
 * "Unknown" is used when an imported CSV has no platform column (or a value
 * we cannot normalise) — the record is still imported and stays visible in
 * charts/filters instead of disappearing from them.
 */

/** Accent colors for each platform (charts, badges, feed icons). */
export const PLATFORM_META = {
  Instagram: { color: '#E1306C', short: 'IG' },
  Facebook: { color: '#1877F2', short: 'FB' },
  TikTok: { color: '#25F4EE', short: 'TK' },
  YouTube: { color: '#FF3D50', short: 'YT' },
  LinkedIn: { color: '#0A66C2', short: 'LI' },
  X: { color: '#8B98AC', short: 'X' },
  Reddit: { color: '#FF4500', short: 'RD' },
  Pinterest: { color: '#E60023', short: 'PI' },
  Snapchat: { color: '#FFFC00', short: 'SN' },
  Threads: { color: '#A8B3CF', short: 'TH' },
  Unknown: { color: '#64748B', short: 'UN' },
};

/** Sentiment labels used by the keyword classifier. */
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

export const SENTIMENT_META = {
  Positive: { color: '#10B981', bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  Neutral: { color: '#F59E0B', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/40' },
  Negative: { color: '#F43F5E', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/40' },
};

/** Chart palette (consistent across every visualization). */
export const CHART_COLORS = {
  likes: '#6366F1',
  comments: '#22D3EE',
  shares: '#F59E0B',
  posts: '#818CF8',
  engagement: '#A78BFA',
  reach: '#FB7185',
  grid: 'rgba(148, 163, 184, 0.14)',
  axis: '#64748B',
};

/** localStorage keys (versioned so schema changes do not corrupt old data). */
export const STORAGE_KEYS = {
  posts: 'socialpulse.posts.v1',
  filters: 'socialpulse.filters.v1',
  simulation: 'socialpulse.simulation.v1',
};

/** Hard cap so the persisted simulated feed cannot grow without bound. */
export const MAX_RECORDS = 600;

/** Simulated feed tick: one synthetic post roughly every 5 seconds. */
export const SIMULATION_INTERVAL_MS = 5000;

/** Rows shown per page in the top-posts table. */
export const PAGE_SIZE = 10;

/** CSV columns accepted on import / produced on export. */
export const CSV_COLUMNS = ['post_id', 'timestamp', 'platform', 'text', 'likes', 'comments', 'shares', 'reach'];

/**
 * NOTE: uploaded CSVs no longer need exact column names — `utils/csv.js`
 * maps common aliases (date→timestamp, content→text, like_count→likes, …)
 * and lets users remap columns manually before importing.
 */

/** Default (empty) filter state — one shared source of truth for all views. */
export const DEFAULT_FILTERS = {
  search: '',
  platform: 'All',
  sentiment: 'All',
  dateFrom: '',
  dateTo: '',
};
