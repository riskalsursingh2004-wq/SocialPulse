import { Menu, RefreshCw, Search, X } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { PLATFORMS, SENTIMENTS } from '../utils/constants.js';
import { formatNumber } from '../utils/format.js';
import Spinner from './common/Spinner.jsx';

/** Small pill showing simulation status (LIVE / PAUSED / IDLE). */
function LiveStatus({ status, lastTickAt }) {
  const styles = {
    running: { dot: 'bg-emerald-400 live-dot', text: 'text-emerald-300', label: 'LIVE · SIMULATED' },
    paused: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'PAUSED' },
    idle: { dot: 'bg-slate-500', text: 'text-slate-400', label: 'IDLE' },
  };
  const s = styles[status] || styles.idle;
  const title =
    status === 'running'
      ? 'Simulated feed is running (one synthetic post every 5s)'
      : status === 'paused'
        ? 'Simulation paused'
        : 'Simulation stopped';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-[11px] font-bold tracking-wider ${s.text}`}
      title={lastTickAt ? `${title} · last update ${new Date(lastTickAt).toLocaleTimeString()}` : title}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/**
 * Top navigation: brand (mobile), global search, date-range + platform +
 * sentiment filters, live status indicator and refresh button.
 */
export default function Header({ onToggleSidebar }) {
  const {
    filters,
    updateFilters,
    clearFilters,
    activeFilterCount,
    refresh,
    loading,
    filteredPosts,
    posts,
    simulation,
  } = useDashboard();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      {/* Row 1: menu / brand / search / live status / refresh */}
      <div className="flex items-center gap-2 px-3 py-2.5 md:px-5 md:py-3">
        <button
          type="button"
          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Open menu"
        >
          <Menu size={19} />
        </button>

        <span className="text-sm font-bold text-white lg:hidden">SocialPulse</span>

        {/* Global search */}
        <div className="relative ml-1 w-full min-w-0 max-w-md sm:ml-2">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Search post text or ID…"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            aria-label="Search posts"
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LiveStatus status={simulation.status} lastTickAt={simulation.lastTickAt} />
          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={loading}
            title="Re-read the dataset from local storage"
            aria-label="Refresh data"
          >
            {loading ? <Spinner size={15} /> : <RefreshCw size={15} />}
            <span className="hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Row 2: filters */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 md:px-5">
        <select
          className="select w-auto min-w-[9.5rem]"
          value={filters.platform}
          onChange={(e) => updateFilters({ platform: e.target.value })}
          aria-label="Filter by platform"
        >
          <option value="All">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          className="select w-auto min-w-[9.5rem]"
          value={filters.sentiment}
          onChange={(e) => updateFilters({ sentiment: e.target.value })}
          aria-label="Filter by sentiment"
        >
          <option value="All">All sentiments</option>
          {SENTIMENTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className="input w-[9.5rem]"
            value={filters.dateFrom}
            onChange={(e) => updateFilters({ dateFrom: e.target.value })}
            aria-label="Date range from"
            title="From date"
          />
          <span className="text-xs text-slate-500">→</span>
          <input
            type="date"
            className="input w-[9.5rem]"
            value={filters.dateTo}
            onChange={(e) => updateFilters({ dateTo: e.target.value })}
            aria-label="Date range to"
            title="To date"
          />
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
          title="Remove all active filters"
        >
          <X size={14} />
          Clear filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-indigo-500/25 px-1.5 text-[10px] font-bold text-indigo-200">
              {activeFilterCount}
            </span>
          )}
        </button>

        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          Showing <span className="font-semibold text-slate-300">{formatNumber(filteredPosts.length)}</span> of{' '}
          {formatNumber(posts.length)} posts
        </span>
      </div>
    </header>
  );
}
