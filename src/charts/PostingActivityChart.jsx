import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarDays } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { dayLabel } from '../utils/format.js';

/**
 * D. Posting Activity — number of posts published per day.
 */
export default function PostingActivityChart({ data, height = 'h-64' }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarDays}
        title="No posting activity"
        message="There are no posts in the current filter range."
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
          <Bar dataKey="posts" name="Posts" fill={CHART_COLORS.posts} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
