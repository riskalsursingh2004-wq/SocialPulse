/** Brand mark + wordmark used by the sidebar and mobile header. */
export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/50">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 12h3.5l2-6.5 3.5 13 2.5-8 1.5 3H21" />
        </svg>
      </span>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold text-white">SocialPulse</div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
            Analytics
          </div>
        </div>
      )}
    </div>
  );
}
