import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { HeartPulse } from 'lucide-react';
import EmptyState from '../components/common/EmptyState.jsx';
import { SENTIMENT_META } from '../utils/constants.js';
import { formatNumber, formatPercent } from '../utils/format.js';

/**
 * C. Sentiment Distribution — donut with counts + percentages.
 * `data` = [{ name: 'Positive'|'Neutral'|'Negative', value, pct }]
 */
export default function SentimentDonutChart({ data, height = 'h-64' }) {
  const total = (data || []).reduce((sum, d) => sum + d.value, 0);
  if (!total) {
    return (
      <EmptyState
        compact
        icon={HeartPulse}
        title="No sentiment data yet"
        message="Sentiment appears once posts are available in the current filter."
      />
    );
  }

  return (
    <div>
      <div className={height}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value, name) => [formatNumber(value), name]}
              contentStyle={{
                background: 'rgba(2,6,23,0.95)',
                border: '1px solid #334155',
                borderRadius: 8,
                fontSize: 12,
                color: '#e2e8f0',
              }}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={3}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={SENTIMENT_META[entry.name]?.color || '#64748B'} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend with counts + percentages */}
      <div className="mt-3 space-y-2">
        {data.map((entry) => {
          const meta = SENTIMENT_META[entry.name] || {};
          return (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="text-slate-300">{entry.name}</span>
              <span className="ml-auto font-semibold text-slate-100 tabular-nums">
                {formatNumber(entry.value)}
              </span>
              <span className="w-14 text-right text-slate-500 tabular-nums">
                {formatPercent(entry.pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
