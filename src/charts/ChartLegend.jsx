/**
 * Shared custom legend for Recharts.
 * We render it ourselves so item ORDER is always deterministic
 * (Recharts' built-in legend order is not reliable across chart types).
 */
export default function ChartLegend({ payload = [], order = [] }) {
  const items = [...payload];
  if (order.length > 0) {
    items.sort((a, b) => {
      const ia = order.indexOf(a.value);
      const ib = order.indexOf(b.value);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 text-xs text-slate-300">
      {items.map((entry) => (
        <span key={entry.value} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

/** Helper: bind a fixed order to the legend content prop. */
export function orderedLegend(order) {
  return function LegendContent(props) {
    return <ChartLegend {...props} order={order} />;
  };
}
