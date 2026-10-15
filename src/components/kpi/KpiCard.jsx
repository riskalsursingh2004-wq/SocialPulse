import { ArrowDown, ArrowUp, ArrowUpRight, Minus } from 'lucide-react';
import { formatDelta, formatNumber } from '../../utils/format.js';

const ACCENTS = {
  indigo: 'bg-indigo-500/15 text-indigo-300',
  cyan: 'bg-cyan-500/15 text-cyan-300',
  amber: 'bg-amber-500/15 text-amber-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-300',
  rose: 'bg-rose-500/15 text-rose-300',
};

/** Delta chip: % change vs the previous equivalent period (or "no prior data"). */
function DeltaValue({ current, previous }) {
  const delta = formatDelta(current, previous);
  if (delta === null) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-500" title="Not enough dated data in the previous period to compare">
        <Minus size={12} /> No prior data
      </span>
    );
  }
  const positive = Number.parseFloat(delta) >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      <Icon size={12} />
      {delta}
    </span>
  );
}

/**
 * One KPI card: label, big value, optional formula tooltip,
 * and comparison against the previous equivalent period.
 * When `onClick` is provided the ENTIRE card becomes an accessible
 * navigation control (mouse + keyboard), keeping the same visual design.
 */
export default function KpiCard({ label, value, displayValue, icon: Icon, accent = 'indigo', current, previous, hint, compareLabel, onClick, destinationLabel }) {
  const interactive = typeof onClick === 'function';
  return (
    <article
      className={`card card-hover group relative overflow-hidden p-4 md:p-5 ${
        interactive
          ? 'cursor-pointer hover:border-indigo-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70'
          : ''
      }`}
      title={hint}
      {...(interactive
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
            'aria-label': `${label} — ${destinationLabel}`,
          }
        : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label flex items-center gap-1">
          {label}
          {interactive && (
            <ArrowUpRight
              size={12}
              aria-hidden
              className="text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </p>
        <span className={`rounded-lg p-2 ${ACCENTS[accent] || ACCENTS.indigo}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>

      <div className="mt-3 text-2xl font-bold tracking-tight text-white tabular-nums" title={hint}>
        {displayValue ?? formatNumber(value)}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
        <DeltaValue current={current} previous={previous} />
        <span className="text-slate-500" title={compareLabel}>
          vs previous period
        </span>
      </div>
    </article>
  );
}
