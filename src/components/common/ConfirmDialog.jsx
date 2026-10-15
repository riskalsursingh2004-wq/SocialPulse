import { CircleAlert } from 'lucide-react';

/**
 * Lightweight modal confirmation for destructive actions
 * (reset demo data, clear imported data, reset simulation).
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-md border-slate-700 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-rose-500/15 p-2 text-rose-300">
            <CircleAlert size={20} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
