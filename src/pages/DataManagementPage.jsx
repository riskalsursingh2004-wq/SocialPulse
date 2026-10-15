import { useMemo, useState } from 'react';
import { Database, Download, FileText, HardDrive, Info, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext.jsx';
import Card from '../components/common/Card.jsx';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import CsvUploader from '../components/csv/CsvUploader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import { downloadSampleTemplate, exportFilteredData } from '../utils/csv.js';
import { CSV_COLUMNS, STORAGE_KEYS } from '../utils/constants.js';
import { estimateStorageUsage } from '../utils/storage.js';
import { formatDate, formatNumber } from '../utils/format.js';

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="card p-4" title={hint}>
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <Icon size={14} className="text-slate-500" />
      </div>
      <p className="mt-1.5 text-lg font-bold break-words text-white tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Data Management — CSV import (drag & drop), validation, preview,
 * export, sample template, reset/clear actions and storage info.
 */
export default function DataManagementPage() {
  const {
    posts,
    filteredPosts,
    datasetStats,
    importResult,
    setImportResult,
    resetToDemo,
    clearImportedData,
    clearAllData,
  } = useDashboard();

  const [confirm, setConfirm] = useState(null); // 'reset' | 'clearImported' | 'clearAll'
  const [exportMsg, setExportMsg] = useState(null); // { ok, text }
  const [templateMsg, setTemplateMsg] = useState(null); // { ok, text } — independent of export

  // Cheap: only iterates this app's localStorage keys; called each render on purpose
  // so the figure stays in sync after every import/reset.
  const storageBytes = estimateStorageUsage();
  const dateSpan = useMemo(() => {
    const times = posts.map((p) => Date.parse(p.timestamp)).filter((t) => !Number.isNaN(t));
    if (times.length === 0) return null;
    return { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) };
  }, [posts]);

  /**
   * Export the currently filtered records only.
   * Completely separate from downloadSampleTemplate() — different data
   * source, different handler, different message.
   */
  const handleExport = () => {
    const res = exportFilteredData(filteredPosts);
    // Exact, non-blocking user feedback (no raw JS errors surfaced)
    setExportMsg(
      res.ok
        ? { ok: true, text: 'Filtered CSV exported successfully.' }
        : { ok: false, text: 'Unable to download CSV. Please try again.' },
    );
    window.setTimeout(() => setExportMsg(null), 6000);
  };

  /**
   * Download the canonical 25-record sample template.
   * Generated locally from a fixed seed — works even when the dataset is
   * empty, filters match nothing, or the simulator is paused.
   */
  const handleTemplate = () => {
    const res = downloadSampleTemplate();
    // Exact, non-blocking user feedback (no raw JS errors surfaced)
    setTemplateMsg(
      res.ok
        ? { ok: true, text: 'Sample CSV downloaded successfully.' }
        : { ok: false, text: 'Unable to download CSV. Please try again.' },
    );
    window.setTimeout(() => setTemplateMsg(null), 6000);
  };

  const confirmDialogs = {
    reset: {
      title: 'Reset to demo data?',
      message:
        'The current dataset will be replaced by the original 120-post demo dataset. This cannot be undone.',
      confirmLabel: 'Reset to demo',
      onConfirm: () => {
        setConfirm(null);
        setImportResult(null);
        resetToDemo();
      },
    },
    clearImported: {
      title: 'Clear imported data?',
      message:
        'Uploaded CSV records and simulated posts will be removed. The original demo posts are kept. This cannot be undone.',
      confirmLabel: 'Clear imported',
      onConfirm: () => {
        setConfirm(null);
        setImportResult(null);
        clearImportedData();
      },
    },
    clearAll: {
      title: 'Clear ALL data?',
      message: 'The entire dataset will be deleted (including demo posts). Every page will show its empty state.',
      confirmLabel: 'Delete everything',
      onConfirm: () => {
        setConfirm(null);
        setImportResult(null);
        clearAllData();
      },
    },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-white md:text-xl">Data Management</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Import CSV files, export the filtered dataset, and manage local storage.
        </p>
      </div>

      {/* Dataset stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile icon={Database} label="Total records" value={formatNumber(posts.length)} hint="All records in the active dataset" />
        <StatTile icon={FileText} label="Demo posts" value={formatNumber(datasetStats.demo)} hint="Original seeded demo records" />
        <StatTile icon={Upload} label="Imported" value={formatNumber(datasetStats.imported)} hint="Records uploaded from CSV files" />
        <StatTile icon={HardDrive} label="Simulated" value={formatNumber(datasetStats.simulated)} hint="Synthetic posts added by the simulator" />
        <StatTile
          icon={Info}
          label="Date span"
          value={dateSpan ? `${formatDate(dateSpan.from).replace(/, \d{4}$/, '')} → ${formatDate(dateSpan.to)}` : '—'}
          hint="Earliest to latest timestamp in the dataset"
        />
        <StatTile
          icon={HardDrive}
          label="Storage used"
          value={`${(storageBytes / 1024).toFixed(1)} KB`}
          hint="Bytes used by SocialPulse keys in localStorage (quota ≈ 5 MB)"
        />
      </div>

      {/* Importer */}
      <Card
        title="Import CSV"
        subtitle={`Any header names accepted (aliases auto-mapped) · canonical: ${CSV_COLUMNS.join(', ')}`}
        actions={
          importResult ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setImportResult(null)}
            >
              Dismiss
            </button>
          ) : null
        }
      >
        <CsvUploader />
      </Card>

      {/* Export / template / destructive actions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Export & Template" subtitle="Download data as CSV (RFC 4180 quoting, commas preserved)">
          <div className="space-y-3">
            <button type="button" className="btn-primary w-full" onClick={handleExport} disabled={filteredPosts.length === 0}>
              <Download size={15} />
              Export filtered data ({formatNumber(filteredPosts.length)} records)
            </button>
            {exportMsg && (
              <p className={`text-xs ${exportMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{exportMsg.text}</p>
            )}

            <button type="button" className="btn-secondary w-full" onClick={handleTemplate}>
              <FileText size={15} />
              Download sample CSV template (25 records)
            </button>
            {templateMsg && (
              <p className={`text-xs ${templateMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{templateMsg.text}</p>
            )}
            <p className="text-[11px] leading-relaxed text-slate-500">
              <strong className="font-semibold text-slate-400">Export filtered data</strong> respects all active
              filters (platform, dates, sentiment, search).{' '}
              <strong className="font-semibold text-slate-400">Sample template</strong> is always the same canonical
              25-record file — independent of your dataset and filters.
            </p>
          </div>
        </Card>

        <Card title="Danger Zone" subtitle="Destructive actions ask for confirmation first">
          <div className="space-y-3">
            <button type="button" className="btn-secondary w-full" onClick={() => setConfirm('reset')}>
              <RotateCcw size={15} />
              Reset to demo data
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setConfirm('clearImported')}>
              <Trash2 size={15} />
              Clear imported data (keeps demo posts)
            </button>
            <button type="button" className="btn-danger w-full" onClick={() => setConfirm('clearAll')}>
              <Trash2 size={15} />
              Clear all data
            </button>
          </div>
        </Card>
      </div>

      {/* Persistence info */}
      <Card title="Persistence" subtitle="Where your data lives">
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs leading-relaxed text-slate-400">
          <p>
            The active dataset and your filter selections are saved in your browser's{' '}
            <code className="text-indigo-300">localStorage</code> and survive a refresh — no server or account needed.
          </p>
          <ul className="mt-2 space-y-1 text-slate-500">
            <li>
              <code className="text-slate-400">{STORAGE_KEYS.posts}</code> — active dataset (capped at 600 records so
              the simulated feed cannot grow forever)
            </li>
            <li>
              <code className="text-slate-400">{STORAGE_KEYS.filters}</code> — active filters
            </li>
            <li>
              <code className="text-slate-400">{STORAGE_KEYS.simulation}</code> — simulation start/pause preference
            </li>
          </ul>
          <p className="mt-2 text-slate-500">
            If storage is corrupted or unavailable, the app falls back to the demo dataset instead of crashing.
          </p>
        </div>

        {posts.length === 0 && (
          <EmptyState
            compact
            icon={Database}
            title="Dataset is empty"
            message="Load the demo dataset to get started again."
            action={
              <button type="button" className="btn-primary" onClick={resetToDemo}>
                Load demo data
              </button>
            }
          />
        )}
      </Card>

      {confirm && confirmDialogs[confirm] && (
        <ConfirmDialog
          open
          title={confirmDialogs[confirm].title}
          message={confirmDialogs[confirm].message}
          confirmLabel={confirmDialogs[confirm].confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmDialogs[confirm].onConfirm}
        />
      )}
    </div>
  );
}
