import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, Search } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { PAGE_SIZE } from '../../utils/constants.js';
import { engagementOf, engagementRateOf, sortPosts } from '../../utils/analytics.js';
import { formatDateTime, formatNumber, formatPercent } from '../../utils/format.js';
import PlatformIcon from '../common/PlatformIcon.jsx';
import SentimentBadge from '../common/SentimentBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';

const COLUMNS = [
  { key: 'postId', label: 'Post ID', sortable: true, align: '' },
  { key: 'date', label: 'Date & Time', sortable: true, align: '' }, // full date+time below
  { key: 'platform', label: 'Platform', sortable: true, align: '' },
  { key: 'text', label: 'Post Text', sortable: false, align: '' },
  { key: 'likes', label: 'Likes', sortable: true, align: 'text-right' },
  { key: 'comments', label: 'Comments', sortable: true, align: 'text-right' },
  { key: 'shares', label: 'Shares', sortable: true, align: 'text-right' },
  { key: 'reach', label: 'Reach', sortable: true, align: 'text-right' },
  { key: 'engagement', label: 'Eng.', sortable: true, align: 'text-right' },
  { key: 'rate', label: 'Rate %', sortable: true, align: 'text-right' },
  { key: 'sentiment', label: 'Sentiment', sortable: true, align: '' },
];

function rateTone(rate) {
  if (rate === null) return 'text-slate-500';
  if (rate >= 4) return 'text-emerald-400 font-semibold';
  if (rate >= 2) return 'text-amber-300 font-semibold';
  return 'text-slate-300';
}

/**
 * Sortable, searchable posts table.
 * - top 10 rows by default, "Load more" reveals the rest
 * - sort by rate / engagement / likes / reach / date / …
 * - shared search box (bound to the global filter state)
 * - horizontal scroll wrapper keeps it usable on mobile
 */
export default function PostTable({ initialCount = PAGE_SIZE, withToolbar = true, rowsLabel = 'posts' }) {
  const { filteredPosts, filters, updateFilters } = useDashboard();
  const [sortKey, setSortKey] = useState('rate');
  const [sortDir, setSortDir] = useState('desc');
  const [visible, setVisible] = useState(initialCount);

  const sorted = useMemo(() => sortPosts(filteredPosts, sortKey, sortDir), [filteredPosts, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setVisible(initialCount);
  };

  const shown = sorted.slice(0, visible);

  if (filteredPosts.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No posts to show"
        message="No posts match the current filters. Clear the filters or import data on the Data Management page."
      />
    );
  }

  return (
    <div>
      {withToolbar && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search in table…"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              aria-label="Search posts in table"
            />
          </div>
          <span className="text-xs text-slate-500">
            Sorted by <span className="font-semibold text-slate-300">{COLUMNS.find((c) => c.key === sortKey)?.label}</span>{' '}
            ({sortDir === 'desc' ? 'high → low' : 'low → high'})
          </span>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-2 py-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase ${col.align}`}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-slate-200"
                      title={`Sort by ${col.label}`}
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUp size={12} />
                        )
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const rate = engagementRateOf(p);
              return (
                <tr
                  key={p.postId}
                  className="border-b border-slate-800/60 transition-colors duration-100 hover:bg-slate-800/40"
                >
                  <td className="px-2 py-2.5 font-mono text-[11px] text-slate-400" title={p.postId}>
                    {p.postId}
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap text-xs text-slate-300">
                    {formatDateTime(p.timestamp)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-slate-300"
                      title={p.platform}
                    >
                      <PlatformIcon platform={p.platform} size="sm" />
                      <span className="hidden 2xl:inline">{p.platform}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="block max-w-[84px] truncate text-xs text-slate-400" title={p.text}>
                      {p.text}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-xs text-slate-200 tabular-nums">{formatNumber(p.likes)}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-slate-200 tabular-nums">{formatNumber(p.comments)}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-slate-200 tabular-nums">{formatNumber(p.shares)}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-slate-200 tabular-nums">{formatNumber(p.reach)}</td>
                  <td className="px-2 py-2.5 text-right text-xs font-semibold text-slate-100 tabular-nums">
                    {formatNumber(engagementOf(p))}
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right text-xs tabular-nums ${rateTone(rate)}`}
                    title={
                      rate === null
                        ? 'Zero reach — engagement rate undefined (division by zero guarded)'
                        : `(likes + comments + shares) / reach × 100 = ${rate.toFixed(2)}%`
                    }
                  >
                    {rate === null ? '—' : formatPercent(rate, 2)}
                  </td>
                  <td className="px-2 py-2.5">
                    <SentimentBadge sentiment={p.sentiment} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: counts + load more */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500 tabular-nums">
          Showing {formatNumber(shown.length)} of {formatNumber(sorted.length)} {rowsLabel}
        </span>
        {visible < sorted.length && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Load more (+{Math.min(PAGE_SIZE, sorted.length - visible)})
          </button>
        )}
      </div>
    </div>
  );
}
