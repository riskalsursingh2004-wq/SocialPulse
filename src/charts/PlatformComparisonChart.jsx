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
import { BarChart3 } from 'lucide-react';
import ChartTooltip from './ChartTooltip.jsx';
import { orderedLegend } from './ChartLegend.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { CHART_COLORS } from '../utils/constants.js';
import { formatCompact } from '../utils/format.js';

/**
 * B. Platform Comparison — stacked engagement (likes/comments/shares)
 * across Instagram, Facebook, X, YouTube and LinkedIn.
 */
export default function PlatformComparisonChart({ data, height = 'h-72' }) {
  const hasData = data && data.some((d) => d.engagement > 0);
  if (!hasData) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="No platform data to compare"
        message="Posts in the current filter have no engagement yet."
      />
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="platform"
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={46}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            tickFormatter={formatCompact}
            stroke={CHART_COLORS.axis}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend content={orderedLegend(['Likes', 'Comments', 'Shares'])} />
          <Bar dataKey="likes" name="Likes" stackId="eng" fill={CHART_COLORS.likes} radius={[0, 0, 0, 0]} />
          <Bar dataKey="comments" name="Comments" stackId="eng" fill={CHART_COLORS.comments} />
          <Bar dataKey="shares" name="Shares" stackId="eng" fill={CHART_COLORS.shares} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
