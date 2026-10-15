/**
 * Reusable card surface with optional header (title / subtitle / actions).
 * Keeps every panel in the dashboard visually consistent.
 */
export default function Card({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3 md:px-5">
          <div className="min-w-0">
            {title && <h2 className="section-title truncate">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs break-words text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-4 md:p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
