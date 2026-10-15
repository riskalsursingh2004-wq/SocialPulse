import { formatNumber } from '../utils/format.js';

/**
 * Shared dark-theme tooltip for every Recharts visualization.
 * `payload` entries carry name / value / colour from the chart definition.
 */
export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 font-semibold text-slate-200">{label}</p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <p key={entry.dataKey ?? entry.name ?? i} className="flex items-center gap-2 text-slate-400">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.fill || entry.payload?.fill }}
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-semibold text-slate-100 tabular-nums">
              {formatNumber(entry.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
