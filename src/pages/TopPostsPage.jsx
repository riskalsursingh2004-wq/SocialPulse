import { useDashboard } from '../context/DashboardContext.jsx';
import Card from '../components/common/Card.jsx';
import DataStateBanner from '../components/common/DataStateBanner.jsx';
import PostTable from '../components/table/PostTable.jsx';
import { engagementRateOf, sortPosts } from '../utils/analytics.js';
import { formatPercent } from '../utils/format.js';

/** Top Posts — sortable, searchable, paginated table (top 10 by default). */
export default function TopPostsPage() {
  const { filteredPosts, posts, resetToDemo, clearFilters } = useDashboard();
  const stateKind = posts.length === 0 ? 'no-data' : filteredPosts.length === 0 ? 'no-results' : null;

  const best = sortPosts(filteredPosts, 'rate', 'desc')[0];
  const bestRate = best ? engagementRateOf(best) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white md:text-xl">Top-Performing Posts</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Sort by engagement rate, total engagement, likes, reach and more. Click any column header.
          </p>
        </div>
        {best && bestRate !== null && (
          <div className="card px-4 py-2.5 text-xs">
            <span className="text-slate-400">Best engagement rate:&nbsp;</span>
            <span className="font-bold text-emerald-400">{formatPercent(bestRate, 2)}</span>
            <span className="text-slate-500"> · {best.postId}</span>
          </div>
        )}
      </div>

      <DataStateBanner kind={stateKind} onResetDemo={resetToDemo} onClearFilters={clearFilters} />

      <Card title="Posts Table" subtitle="Top 10 shown by default — load more to reveal the rest">
        <PostTable initialCount={10} withToolbar rowsLabel="posts" />
      </Card>
    </div>
  );
}
