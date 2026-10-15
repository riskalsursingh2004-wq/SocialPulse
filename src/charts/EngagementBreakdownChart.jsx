import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Scale } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { formatCompact } from '../utils/format.js';

const BAR_COLORS = {
  Likes: CHART_COLORS.likes,
  Comments: CHART_COLORS.comments,
  Shares: CHART_COLORS.shares,
};

/**
 * E. Engagement Breakdown — total likes vs comments vs shares (horizontal bars).
 */
export default function EngagementBreakdownChart({ data, height = 'h-56', focusMetric = null }) {
  const hasData = data && data.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <EmptyState
        compact
        icon={Scale}
        title="No engagement to break down"
        message="Likes, comments and shares totals will appear here."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={CHART_COLORS.axis}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={78}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="value" name="Total" radius={[0, 6, 6, 0]} maxBarSize={30}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={BAR_COLORS[entry.name] || CHART_COLORS.engagement}
                fillOpacity={focusMetric && entry.name.toLowerCase() !== focusMetric ? 0.25 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
