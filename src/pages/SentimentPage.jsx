import { useMemo } from 'react';
import { Info, Sparkles } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext.jsx';
import Card from '../components/common/Card.jsx';
import DataStateBanner from '../components/common/DataStateBanner.jsx';
import SentimentBadge from '../components/common/SentimentBadge.jsx';
import PlatformIcon from '../components/common/PlatformIcon.jsx';
import SentimentDonutChart from '../charts/SentimentDonutChart.jsx';
import SentimentTrendChart from '../charts/SentimentTrendChart.jsx';
import { aggregateSentimentByDay, sentimentBreakdown } from '../utils/analytics.js';
import {
  NEGATIVE_WORDS,
  POSITIVE_PHRASES,
  POSITIVE_WORDS,
  NEGATIVE_PHRASES,
  classifySentiment,
} from '../utils/sentiment.js';
import { SENTIMENT_META } from '../utils/constants.js';
import { formatDateTime, formatNumber, formatPercent } from '../utils/format.js';

function StatCard({ label, count, pct, sentiment }) {
  const meta = SENTIMENT_META[sentiment];
  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <p className="label">{label} posts</p>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
      </div>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums">{formatNumber(count)}</p>
      <p className="mt-1 text-xs text-slate-400 tabular-nums">{formatPercent(pct)} of posts in view</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: meta.color }}
        />
      </div>
    </div>
  );
}

/**
 * Sentiment page — classifier explanation, totals/percentages, donut,
 * per-day trend and recent classifications with match counts.
 */
export default function SentimentPage() {
  const { filteredPosts, posts, resetToDemo, clearFilters, filters } = useDashboard();

  const breakdown = useMemo(() => sentimentBreakdown(filteredPosts), [filteredPosts]);
  const donutData = useMemo(
    () => [
      { name: 'Positive', value: breakdown.counts.Positive, pct: breakdown.percentages.Positive },
      { name: 'Neutral', value: breakdown.counts.Neutral, pct: breakdown.percentages.Neutral },
      { name: 'Negative', value: breakdown.counts.Negative, pct: breakdown.percentages.Negative },
    ],
    [breakdown],
  );
  const trendData = useMemo(() => aggregateSentimentByDay(filteredPosts), [filteredPosts]);

  const recent = useMemo(() => {
    const sorted = [...filteredPosts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return sorted.slice(0, 8).map((p) => ({ post: p, detail: classifySentiment(p.text) }));
  }, [filteredPosts]);

  const stateKind = posts.length === 0 ? 'no-data' : filteredPosts.length === 0 ? 'no-results' : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white md:text-xl">Sentiment Analysis</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Positive {formatNumber(breakdown.counts.Positive)} · Neutral {formatNumber(breakdown.counts.Neutral)} ·
          Negative {formatNumber(breakdown.counts.Negative)} across {formatNumber(breakdown.total)} posts
          {filters.sentiment !== 'All' ? ` (filtered to ${filters.sentiment})` : ''}.
        </p>
      </div>

      <DataStateBanner kind={stateKind} onResetDemo={resetToDemo} onClearFilters={clearFilters} />

      {/* Methodology / disclaimer */}
      <Card
        title="How classification works"
        subtitle="Methodology you can explain to faculty"
        actions={<Info size={15} className="text-slate-500" />}
      >
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-200/90">
          <Sparkles size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p>
            <strong className="font-semibold text-amber-200">This is a basic keyword-based estimate — not an AI language model.</strong>{' '}
            Text is lower-cased, punctuation is stripped, then positive/negative words and phrases are counted as
            whole tokens (so “best” never matches inside “bestowed”). More positives than negatives →{' '}
            <em>Positive</em>; the reverse → <em>Negative</em>; ties → <em>Neutral</em>. It is deterministic and fully
            offline, but it cannot understand sarcasm, context or emoji.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="label mb-2 text-emerald-400">Positive lexicon ({POSITIVE_WORDS.length + POSITIVE_PHRASES.length} terms)</p>
            <div className="flex flex-wrap gap-1.5">
              {[...POSITIVE_WORDS, ...POSITIVE_PHRASES].map((w) => (
                <span
                  key={w}
                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-2 text-rose-400">Negative lexicon ({NEGATIVE_WORDS.length + NEGATIVE_PHRASES.length} terms)</p>
            <div className="flex flex-wrap gap-1.5">
              {[...NEGATIVE_WORDS, ...NEGATIVE_PHRASES].map((w) => (
                <span
                  key={w}
                  className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Totals + percentages */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Positive" count={breakdown.counts.Positive} pct={breakdown.percentages.Positive} sentiment="Positive" />
        <StatCard label="Neutral" count={breakdown.counts.Neutral} pct={breakdown.percentages.Neutral} sentiment="Neutral" />
        <StatCard label="Negative" count={breakdown.counts.Negative} pct={breakdown.percentages.Negative} sentiment="Negative" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sentiment Distribution" subtitle="Counts and percentages of classified posts">
          <SentimentDonutChart data={donutData} height="h-64" />
        </Card>
        <Card title="Sentiment Over Time" subtitle="Posts per day, stacked by sentiment">
          <SentimentTrendChart data={trendData} height="h-72" />
        </Card>
      </div>

      {/* Recent classifications with match counts */}
      <Card title="Recent Classifications" subtitle="Why each post was labelled — positive / negative term hits">
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No posts to classify.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map(({ post, detail }) => (
              <li
                key={post.postId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5 transition-colors hover:border-slate-700"
              >
                <PlatformIcon platform={post.platform} size="sm" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={post.text}>
                  {post.text}
                </span>
                <span className="text-[10px] text-slate-500 tabular-nums" title="Positive / negative term matches">
                  +{detail.positive} / −{detail.negative}
                </span>
                <SentimentBadge sentiment={post.sentiment} size="sm" />
                <span className="hidden text-[10px] text-slate-600 md:inline">
                  {formatDateTime(post.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
