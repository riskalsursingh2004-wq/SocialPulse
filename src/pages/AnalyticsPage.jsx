import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext.jsx';
import Card from '../components/common/Card.jsx';
import DataStateBanner from '../components/common/DataStateBanner.jsx';
import EngagementTrendChart from '../charts/EngagementTrendChart.jsx';
import PlatformComparisonChart from '../charts/PlatformComparisonChart.jsx';
import SentimentDonutChart from '../charts/SentimentDonutChart.jsx';
import PostingActivityChart from '../charts/PostingActivityChart.jsx';
import EngagementBreakdownChart from '../charts/EngagementBreakdownChart.jsx';
import ReachTrendChart from '../charts/ReachTrendChart.jsx';
import ReachPlatformChart from '../charts/ReachPlatformChart.jsx';
import {
  aggregateByDay,
  aggregateByPlatform,
  engagementBreakdown,
  sentimentBreakdown,
} from '../utils/analytics.js';
import { formatNumber, formatPercent } from '../utils/format.js';
import { PLATFORMS } from '../utils/constants.js';

/**
 * Where each incoming KPI focus lands, and the chip shown while focused.
 * Focus never changes the data — it only scrolls to + highlights the
 * matching existing section (filters stay untouched).
 */
const FOCUS_META = {
  likes: { section: 'engagement', chip: 'Focus: Likes in the current filter' },
  comments: { section: 'engagement', chip: 'Focus: Comments in the current filter' },
  shares: { section: 'engagement', chip: 'Focus: Shares in the current filter' },
  reach: { section: 'reach', chip: 'Focus: Reach & audience in the current filter' },
  rate: { section: 'engagement', chip: null }, // chip is built from the live KPI below
};

/** Section wrapper with an id (navigation target) + transient focus ring. */
function Section({ id, title, active, chip, children }) {
  return (
    <section
      id={id}
      className={`scroll-mt-4 space-y-4 rounded-2xl transition-all duration-300 ${
        active ? 'p-2 ring-2 ring-indigo-400/60 md:p-3' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 md:px-3">
        <h2 className="section-title">{title}</h2>
        {chip && (
          <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
            {chip}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Analytics — engagement, reach and activity charts in one place. */
export default function AnalyticsPage({ focus = null }) {
  const { filteredPosts, posts, resetToDemo, clearFilters, kpis } = useDashboard();
  const [highlight, setHighlight] = useState(null);

  // Incoming KPI focus ({ value, n } — n is a nonce so clicking the same
  // card twice still re-triggers): smooth-scroll to the target section and
  // highlight it (plus dim non-focused metrics) for a few seconds.
  useEffect(() => {
    if (!focus || !FOCUS_META[focus.value]) return undefined;
    const section = FOCUS_META[focus.value].section;
    const raf = window.requestAnimationFrame(() => {
      setHighlight(focus.value);
      document.getElementById(`analytics-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const t = window.setTimeout(() => setHighlight(null), 3600);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [focus]);

  const dayData = useMemo(() => aggregateByDay(filteredPosts), [filteredPosts]);
  const platformData = useMemo(() => aggregateByPlatform(filteredPosts), [filteredPosts]);
  const breakdownData = useMemo(() => engagementBreakdown(filteredPosts), [filteredPosts]);
  const sentimentData = useMemo(() => {
    const b = sentimentBreakdown(filteredPosts);
    return [
      { name: 'Positive', value: b.counts.Positive, pct: b.percentages.Positive },
      { name: 'Neutral', value: b.counts.Neutral, pct: b.percentages.Neutral },
      { name: 'Negative', value: b.counts.Negative, pct: b.percentages.Negative },
    ];
  }, [filteredPosts]);

  const stateKind = posts.length === 0 ? 'no-data' : filteredPosts.length === 0 ? 'no-results' : null;
  const daysCovered = dayData.length;
  const avgPerDay = daysCovered > 0 ? filteredPosts.length / daysCovered : 0;

  const meta = highlight ? FOCUS_META[highlight] : null;
  const focusMetric = ['likes', 'comments', 'shares'].includes(highlight) ? highlight : null;
  const focusChip =
    highlight === 'rate'
      ? `Focus: Avg engagement rate — ${formatPercent(kpis.avgEngagementRate, 2)} in the current filter`
      : meta?.chip || null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white md:text-xl">Analytics</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Interactive charts — every visualisation recalculates whenever filters or imported data change.
        </p>
      </div>

      <DataStateBanner kind={stateKind} onResetDemo={resetToDemo} onClearFilters={clearFilters} />

      {/* Quick stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Posts in view', value: formatNumber(filteredPosts.length) },
          { label: 'Days covered', value: formatNumber(daysCovered) },
          { label: 'Avg posts / day', value: avgPerDay.toFixed(1) },
          { label: 'Platforms', value: `${new Set(filteredPosts.map((p) => p.platform)).size} / ${PLATFORMS.length}` },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="label">{s.label}</p>
            <p className="mt-1 text-lg font-bold text-white tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <Section
        id="analytics-engagement"
        title="Engagement analytics"
        active={meta?.section === 'engagement'}
        chip={meta?.section === 'engagement' ? focusChip : null}
      >
        <Card title="Engagement Over Time" subtitle="Line chart — likes, comments and shares per day">
          <EngagementTrendChart data={dayData} height="h-80" focusMetric={focusMetric} />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Platform Comparison" subtitle={`Stacked engagement per platform — ${platformData.filter((d) => d.posts > 0).length} of ${PLATFORMS.length} in view`}>
            <PlatformComparisonChart data={platformData} height="h-72" />
          </Card>

          <Card
            title="Engagement Breakdown"
            subtitle="Total likes vs comments vs shares"
            actions={<BarChart3 size={15} className="text-slate-500" />}
          >
            <EngagementBreakdownChart data={breakdownData} height="h-72" focusMetric={focusMetric} />
          </Card>
        </div>
      </Section>

      <Section
        id="analytics-reach"
        title="Reach & audience"
        active={meta?.section === 'reach'}
        chip={meta?.section === 'reach' ? focusChip : null}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Reach Over Time" subtitle="Area chart — cumulative reach per day (not unique audience)">
            <ReachTrendChart data={dayData} height="h-72" />
          </Card>

          <Card
            title="Reach by Platform"
            subtitle={`Cumulative reach per platform, highest first — ${platformData.filter((d) => d.reach > 0).length} of ${PLATFORMS.length} in view`}
            actions={<Eye size={15} className="text-slate-500" />}
          >
            <ReachPlatformChart data={platformData} height="h-72" />
          </Card>
        </div>
      </Section>

      <Section id="analytics-activity" title="Activity & sentiment" active={false} chip={null}>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Posting Activity" subtitle="Number of posts published each day">
            <PostingActivityChart data={dayData} height="h-64" />
          </Card>

          <Card title="Sentiment Distribution" subtitle="Share of positive, neutral and negative posts">
            <SentimentDonutChart data={sentimentData} height="h-64" />
          </Card>
        </div>
      </Section>
    </div>
  );
}
