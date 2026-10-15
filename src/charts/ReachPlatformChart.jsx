import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { formatCompact } from '../utils/format.js';

/**
 * Reach by Platform — cumulative reach per platform (highest first),
 * computed from the same filtered dataset as the rest of the dashboard.
 */
export default function ReachPlatformChart({ data, height = 'h-72' }) {
  const rows = [...(data || [])].sort((a, b) => b.reach - a.reach);
  const hasData = rows.some((d) => d.reach > 0);
  if (!hasData) {
    return (
      <EmptyState
        compact
        icon={Eye}
        title="No reach to compare"
        message="Reach per platform will appear here once the filtered dataset contains reach values."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="platform"
            stroke={CHART_COLORS.axis}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={46}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
          />
          <YAxis
            tickFormatter={formatCompact}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={46}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Bar dataKey="reach" name="Reach" fill={CHART_COLORS.reach} radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
