import { Inbox } from 'lucide-react';

/**
 * Friendly empty / no-results / error state.
 * Every chart, table and page uses this instead of showing a blank box.
 */
export default function EmptyState({ icon: Icon = Inbox, title, message, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 text-center ${compact ? 'py-8' : 'py-14'}`}
    >
      <div className="mb-3 rounded-2xl border border-slate-700/70 bg-slate-800/60 p-4 text-slate-400">
        <Icon size={26} strokeWidth={1.7} />
      </div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
