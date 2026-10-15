import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Eye } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { dayLabel, formatCompact } from '../utils/format.js';

/**
 * Reach Over Time — cumulative reach aggregated per day (same filtered
 * dataset as every other chart; reach is cumulative, not unique audience).
 */
export default function ReachTrendChart({ data, height = 'h-72' }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        compact
        icon={Eye}
        title="No reach data yet"
        message="Adjust the filters or import data to see the daily reach trend."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.reach} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.reach} stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="reach"
            name="Reach"
            stroke={CHART_COLORS.reach}
            strokeWidth={2.2}
            fill="url(#reachFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
