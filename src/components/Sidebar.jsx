import { BarChart3, Database, LayoutDashboard, Smile, Star, X } from 'lucide-react';
import Logo from './Logo.jsx';
import { useDashboard } from '../context/DashboardContext.jsx';
import { formatNumber } from '../utils/format.js';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, hint: 'KPIs & live feed' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: 'Charts & trends' },
  { id: 'sentiment', label: 'Sentiment Analysis', icon: Smile, hint: 'Keyword classifier' },
  { id: 'top', label: 'Top Posts', icon: Star, hint: 'Ranked table' },
  { id: 'data', label: 'Data Management', icon: Database, hint: 'CSV import / export' },
];

/**
 * Left navigation. Static column on desktop (lg+),
 * slide-in drawer with overlay on smaller screens.
 */
export default function Sidebar({ page, onNavigate, mobileOpen, onCloseMobile }) {
  const { datasetStats } = useDashboard();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950/95 backdrop-blur-md transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:bg-slate-950/70 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <Logo />
          <button
            type="button"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="label px-3 pb-2">Dashboard</p>
          {NAV_ITEMS.map((item) => {
            const active = page === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:outline-none ${
                  active
                    ? 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
              </button>
            );
          })}
        </nav>

        {/* Dataset snapshot + disclaimer */}
        <div className="space-y-3 border-t border-slate-800 px-4 py-4">
          <p className="label">Dataset</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Total', value: datasetStats.total },
              { label: 'Imported', value: datasetStats.imported },
              { label: 'Simulated', value: datasetStats.simulated },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/60 px-1 py-2">
                <div className="text-sm font-bold text-slate-100 tabular-nums">{formatNumber(s.value)}</div>
                <div className="text-[9px] tracking-wider text-slate-500 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Demo, imported and simulated records only. The live feed is a local simulation — not
            connected to real social media platforms.
          </p>
        </div>
      </aside>
    </>
  );
}
