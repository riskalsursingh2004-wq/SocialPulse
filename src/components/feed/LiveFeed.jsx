import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Pause, Play, Radio, RotateCcw, Share2 } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { formatCompact, relativeTime } from '../../utils/format.js';
import PlatformIcon from '../common/PlatformIcon.jsx';
import SentimentBadge from '../common/SentimentBadge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';

/**
 * Latest incoming posts (newest first) with simulation controls.
 * The feed intentionally shows the RAW incoming stream — it is labelled
 * as simulated and is not filtered by the dashboard filters.
 */
export default function LiveFeed() {
  const { posts, simulation, resetToDemo } = useDashboard();
  const { status, start, pause, resume, lastTickAt, intervalMs } = simulation;
  const [confirmReset, setConfirmReset] = useState(false);

  // Re-render every 30s so relative timestamps stay fresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const latest = useMemo(() => posts.slice(0, 8), [posts]);

  const secondsLeft =
    status === 'running' && lastTickAt
      ? Math.max(0, Math.ceil((intervalMs - (now - lastTickAt)) / 1000))
      : null;

  return (
    <section className="card flex h-full min-h-0 flex-col" aria-label="Live feed">
      {/* Header + controls */}
      <header className="border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio size={16} className={status === 'running' ? 'text-emerald-400' : 'text-slate-500'} />
            <h2 className="section-title">Live Feed</h2>
            {status === 'running' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                SIMULATING
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status === 'idle' && (
            <button type="button" className="btn-primary" onClick={start}>
              <Play size={14} /> Start simulation
            </button>
          )}
          {status === 'running' && (
            <button type="button" className="btn-secondary" onClick={pause}>
              <Pause size={14} /> Pause
            </button>
          )}
          {status === 'paused' && (
            <button type="button" className="btn-primary" onClick={resume}>
              <Play size={14} /> Resume
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmReset(true)}
            title="Stop the simulation and restore the original demo dataset"
          >
            <RotateCcw size={14} /> Reset
          </button>

          <span className="ml-auto text-[10px] text-slate-500">
            {status === 'running'
              ? `next synthetic post in ~${secondsLeft ?? '…'}s`
              : status === 'paused'
                ? 'simulation paused'
                : 'simulation stopped'}
          </span>
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          Simulated mode: one <strong className="font-semibold text-slate-400">synthetic</strong> post is
          generated locally every 5&nbsp;seconds. These are NOT real posts from social platforms.
        </p>
      </header>

      {/* Feed list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {latest.length === 0 ? (
          <EmptyState
            compact
            icon={Radio}
            title="No posts yet"
            message="Start the simulation or import a CSV to see incoming posts."
          />
        ) : (
          <ul className="space-y-2">
            {latest.map((p) => (
              <li
                key={p.postId}
                className="flex gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 p-3 transition-colors duration-150 hover:border-slate-700"
              >
                <PlatformIcon platform={p.platform} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200">{p.platform}</span>
                    <SentimentBadge sentiment={p.sentiment} size="sm" />
                    {p.source === 'simulation' && (
                      <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-violet-300">
                        SIMULATED
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{p.text}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 tabular-nums">
                    <span title={new Date(p.timestamp).toLocaleString()}>{relativeTime(p.timestamp, now)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Heart size={10} /> {formatCompact(p.likes)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle size={10} /> {formatCompact(p.comments)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Share2 size={10} /> {formatCompact(p.shares)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset simulation & dataset?"
        message="This stops the simulator and restores the original demo dataset. Imported records and simulated posts will be replaced."
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          resetToDemo();
        }}
      />
    </section>
  );
}
