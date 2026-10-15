/**
 * Locale-aware formatting helpers. All KPI / table numbers go through these
 * so the UI stays consistent (and safe for zero/NaN/undefined values).
 */

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

function safe(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Full grouped number, e.g. 1,23,456 / 123,456 depending on locale. */
export function formatNumber(n) {
  return numberFmt.format(safe(n));
}

/** Abbreviated number for tight spaces: 12.4K, 1.2M (plain below 10k). */
export function formatCompact(n) {
  const v = safe(n);
  return Math.abs(v) < 1000 ? numberFmt.format(v) : compactFmt.format(v);
}

/** Percentage with one decimal, guards non-finite input. */
export function formatPercent(value, digits = 1) {
  const v = Number.isFinite(value) ? value : 0;
  return `${v.toFixed(digits)}%`;
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "just now" / "4m ago" / "3h ago" / "2d ago" — used by the live feed. */
export function relativeTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, now - t);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Local-time day key (YYYY-MM-DD) used to aggregate chart data by day. */
export function dayKey(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Human axis label for a day key, e.g. "Oct 5". */
export function dayLabel(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Delta text for KPI comparisons: "+12.4%", "-3.0%", or null when unavailable. */
export function formatDelta(current, previous) {
  if (!Number.isFinite(previous) || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (!Number.isFinite(change)) return null;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}
