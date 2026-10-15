import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import { orderedLegend } from './ChartLegend.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { dayLabel, formatCompact } from '../utils/format.js';

/**
 * A. Engagement Over Time — likes / comments / shares aggregated per day.
 */
export default function EngagementTrendChart({ data, height = 'h-72', focusMetric = null }) {
  // When a KPI card focused one metric, dim the other two lines.
  const lineProps = (key) => ({
    strokeOpacity: focusMetric && focusMetric !== key ? 0.22 : 1,
    strokeWidth: focusMetric === key ? 3 : 2.2,
  });
  if (!data || data.length === 0) {
    return (
      <EmptyState
        compact
        icon={TrendingUp}
        title="No engagement data yet"
        message="Adjust the filters or import data to see the daily engagement trend."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
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
            tickFormatter={formatCompact}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.25)' }} />
          <Legend content={orderedLegend(['Likes', 'Comments', 'Shares'])} />
          <Line
            type="monotone"
            dataKey="likes"
            name="Likes"
            stroke={CHART_COLORS.likes}
            {...lineProps('likes')}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="comments"
            name="Comments"
            stroke={CHART_COLORS.comments}
            {...lineProps('comments')}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="shares"
            name="Shares"
            stroke={CHART_COLORS.shares}
            {...lineProps('shares')}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
