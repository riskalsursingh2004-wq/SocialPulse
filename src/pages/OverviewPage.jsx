import { useMemo } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext.jsx';
import KpiGrid from '../components/kpi/KpiGrid.jsx';
import Card from '../components/common/Card.jsx';
import LiveFeed from '../components/feed/LiveFeed.jsx';
import DataStateBanner from '../components/common/DataStateBanner.jsx';
import EngagementTrendChart from '../charts/EngagementTrendChart.jsx';
import PlatformComparisonChart from '../charts/PlatformComparisonChart.jsx';
import SentimentDonutChart from '../charts/SentimentDonutChart.jsx';
import { aggregateByDay, aggregateByPlatform, sentimentBreakdown } from '../utils/analytics.js';

/**
 * Overview — KPI cards, engagement trend, platform comparison,
 * sentiment donut, live feed and a top-posts preview.
 */
export default function OverviewPage({ onNavigate }) {
  const { filteredPosts, posts, resetToDemo, clearFilters } = useDashboard();

  const trendData = useMemo(() => aggregateByDay(filteredPosts), [filteredPosts]);
  const platformData = useMemo(() => aggregateByPlatform(filteredPosts), [filteredPosts]);
  const sentimentData = useMemo(() => {
    const b = sentimentBreakdown(filteredPosts);
    return [
      { name: 'Positive', value: b.counts.Positive, pct: b.percentages.Positive },
      { name: 'Neutral', value: b.counts.Neutral, pct: b.percentages.Neutral },
      { name: 'Negative', value: b.counts.Negative, pct: b.percentages.Negative },
    ];
  }, [filteredPosts]);

  const stateKind = posts.length === 0 ? 'no-data' : filteredPosts.length === 0 ? 'no-results' : null;
  const topFive = useMemo(
    () => [...filteredPosts].sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares)).slice(0, 5),
    [filteredPosts],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-white md:text-xl">Overview</h1>
          <p className="mt-0.5 text-xs text-slate-400">
            All KPIs and charts below are calculated live from the currently filtered dataset.
          </p>
        </div>
      </div>

      <DataStateBanner kind={stateKind} onResetDemo={resetToDemo} onClearFilters={clearFilters} />

      <KpiGrid onNavigate={onNavigate} />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Engagement trend (2/3) */}
        <Card
          className="xl:col-span-2"
          title="Engagement Over Time"
          subtitle="Likes, comments and shares aggregated by day"
        >
          <EngagementTrendChart data={trendData} height="h-72" />
        </Card>

        {/* Live feed spans both rows on xl */}
        <div className="xl:row-span-2">
          <LiveFeed />
        </div>

        <Card title="Platform Comparison" subtitle="Stacked engagement per platform">
          <PlatformComparisonChart data={platformData} height="h-72" />
        </Card>

        <Card title="Sentiment Distribution" subtitle="Keyword-based classification of post text">
          <SentimentDonutChart data={sentimentData} height="h-56" />
        </Card>
      </div>

      {/* Top posts preview */}
      <Card
        title="Top Performing Posts"
        subtitle="Highest total engagement in the current filter"
        actions={
          <button type="button" className="btn-secondary" onClick={() => onNavigate('top')}>
            View all <ArrowRight size={14} />
          </button>
        }
      >
        {topFive.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No posts available.</p>
        ) : (
          <ul className="space-y-2">
            {topFive.map((p) => (
              <li
                key={p.postId}
                className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5 transition-colors hover:border-slate-700"
              >
                <Star size={14} className="shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={p.text}>
                  {p.text}
                </span>
                <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{p.platform}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-100 tabular-nums">
                  {(p.likes + p.comments + p.shares).toLocaleString()} eng.
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
