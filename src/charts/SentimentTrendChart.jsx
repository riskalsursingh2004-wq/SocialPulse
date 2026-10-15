import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HeartPulse } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import { orderedLegend } from './ChartLegend.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS, SENTIMENT_META } from '../utils/constants.js';
import { dayLabel } from '../utils/format.js';

/**
 * Extra chart for the Sentiment page: post counts per day, stacked by sentiment.
 */
export default function SentimentTrendChart({ data, height = 'h-72' }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        compact
        icon={HeartPulse}
        title="No sentiment trend available"
        message="Needs posts with valid dates in the current filter."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={dayLabel}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            allowDecimals={false}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend content={orderedLegend(['Positive', 'Neutral', 'Negative'])} />
          <Bar dataKey="Positive" name="Positive" stackId="s" fill={SENTIMENT_META.Positive.color} />
          <Bar dataKey="Neutral" name="Neutral" stackId="s" fill={SENTIMENT_META.Neutral.color} />
          <Bar dataKey="Negative" name="Negative" stackId="s" fill={SENTIMENT_META.Negative.color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
