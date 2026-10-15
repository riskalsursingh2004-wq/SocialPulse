import { useMemo, useRef, useState } from 'react';
import { CircleCheck, FileText, TriangleAlert, Upload, Wand2, X } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext.jsx';
import {
  MAPPING_FIELDS,
  buildRecordsFromMapping,
  checkMappingCompleteness,
  detectColumnMapping,
  downloadSampleTemplate,
  parseCsvInput,
} from '../../utils/csv.js';
import { CSV_COLUMNS } from '../../utils/constants.js';
import { formatDateTime, formatNumber } from '../../utils/format.js';
import PlatformIcon from '../common/PlatformIcon.jsx';
import Spinner from '../common/Spinner.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';

const PREVIEW_ROWS = 5;

/** Human-readable description of every default that a missing column triggers. */
const DEFAULT_NOTES = {
  postId: 'Post ID → generated automatically',
  timestamp: 'Timestamp → current date/time (generated, not measured)',
  platform: 'Platform → "Unknown"',
  text: 'Text / content → empty (sentiment will be Neutral)',
  likes: 'Likes → 0 (defaulted, not a measured value)',
  comments: 'Comments → 0 (defaulted, not a measured value)',
  shares: 'Shares → 0 (defaulted, not a measured value)',
  reach: 'Reach → 0 (defaulted, not a measured value)',
};

/**
 * Drag-and-drop / file-picker CSV importer.
 *
 * Flow: parse → auto-detect column mapping → **user reviews/edits mapping**
 * (preview of first 5 records + default warnings) → Import / Cancel.
 * The active dataset is never touched until the user confirms.
 */
export default function CsvUploader() {
  const { posts, importRecords, importResult, setImportResult } = useDashboard();

  const [dragActive, setDragActive] = useState(false);
  const [busyPhase, setBusyPhase] = useState(''); // '' | 'Parsing file…' | 'Validating…'
  const [fileError, setFileError] = useState('');
  const [sizeWarning, setSizeWarning] = useState('');
  const [fileData, setFileData] = useState(null); // { fileName, size, rows, fields, parseWarnings, ambiguities, unmatched }
  const [mapping, setMapping] = useState(null); // { field: header | null }
  const [mode, setMode] = useState('append');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [lastImport, setLastImport] = useState(null); // defaults summary of the last import
  const [templateMsg, setTemplateMsg] = useState(null);
  const inputRef = useRef(null);

  /* ---------- derived validation (revalidates whenever mapping changes) ---------- */
  const validation = useMemo(() => {
    if (!fileData || !mapping) return null;
    try {
      return buildRecordsFromMapping(fileData.rows, mapping);
    } catch (err) {
      console.error('[SocialPulse] CSV validation failed:', err);
      return { failed: String(err?.message || err) };
    }
  }, [fileData, mapping]);

  const completeness = useMemo(() => (mapping ? checkMappingCompleteness(mapping) : null), [mapping]);

  const unmappedFields = useMemo(
    () => (mapping ? MAPPING_FIELDS.filter((f) => !mapping[f.key]) : []),
    [mapping],
  );

  /* ---------- state helpers ---------- */
  const resetState = () => {
    setFileError('');
    setSizeWarning('');
    setFileData(null);
    setMapping(null);
    setLastImport(null);
    setTemplateMsg(null);
    setImportResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  /* ---------- parse + auto-map (no dataset changes here) ---------- */
  const handleFile = async (file) => {
    if (!file) return;
    setFileError('');
    setSizeWarning('');
    setFileData(null);
    setMapping(null);
    setLastImport(null);
    setImportResult(null);

    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFileError(`"${file.name}" is not a CSV file. Please upload a UTF-8 .csv file.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError(
        `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB (limit 10 MB). ` +
          'Please split it into smaller CSV files.',
      );
      return;
    }
    if (file.size > 1024 * 1024) {
      setSizeWarning(
        `Large file (${(file.size / 1024 / 1024).toFixed(1)} MB) — parsing and validation may take a moment.`,
      );
    }

    setBusyPhase('Parsing file…');
    // Give the browser a frame to paint the busy state before heavy work.
    await new Promise((r) => window.setTimeout(r, 15));

    try {
      const { rows, fields, parseWarnings, error } = await parseCsvInput(file);
      if (error) {
        setFileError(error);
        return;
      }

      const detected = detectColumnMapping(fields);
      setFileData({
        fileName: file.name,
        size: file.size,
        rows,
        fields,
        parseWarnings: parseWarnings || [],
        ambiguities: detected.ambiguities,
        unmatched: detected.unmatched,
      });
      // Mapping panel opens even when nothing was auto-recognised, so the user
      // can map columns by hand. The "no content column" message below is
      // derived from the current mapping — it appears/disappears live as the
      // user edits the dropdowns.
      setMapping(detected.mapping);
      setFileError('');
    } catch (err) {
      console.error('[SocialPulse] CSV parse failed:', err);
      setFileError(`Could not read the file: ${err?.message || 'unknown error'}`);
    } finally {
      setBusyPhase('');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const updateMapping = (field, header) => {
    setMapping((prev) => ({ ...prev, [field]: header || null }));
  };

  /* ---------- import (only after explicit confirmation) ---------- */
  const doImport = () => {
    if (!validation || validation.failed || validation.records.length === 0) return;
    const result = importRecords(validation.records, mode);
    setLastImport({
      imported: result.imported,
      capped: Boolean(result.capped),
      defaultedFields: validation.defaultedFields,
      generatedIds: validation.generatedIds,
      warnings: validation.warnings.length,
      emptyRows: validation.emptyRows,
    });
  };

  const onImportClick = () => {
    if (!validation || validation.failed || validation.records.length === 0) return;
    if (mode === 'replace' && posts.length > 0) {
      setConfirmReplace(true); // spec: confirm before replacing existing data
    } else {
      doImport();
    }
  };

  const onTemplate = () => {
    const res = downloadSampleTemplate();
    setTemplateMsg(
      res.ok
        ? { ok: true, text: 'Sample CSV downloaded successfully.' }
        : { ok: false, text: 'Unable to download CSV. Please try again.' },
    );
    window.setTimeout(() => setTemplateMsg(null), 6000);
  };

  const canImport =
    Boolean(validation) &&
    !validation.failed &&
    validation.records.length > 0 &&
    Boolean(completeness?.ok);

  const defaultedLabels = unmappedFields.map((f) => f.label);

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-150 ${
          dragActive ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
        }`}
      >
        <span className="mb-3 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-indigo-300">
          <Upload size={22} strokeWidth={1.8} />
        </span>
        <p className="text-sm font-semibold text-slate-200">Drag &amp; drop your CSV here</p>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
          Column names are matched automatically — <code className="text-slate-400">date</code>,{' '}
          <code className="text-slate-400">content</code>, <code className="text-slate-400">like_count</code>,{' '}
          <code className="text-slate-400">created_at</code>… all work, in any order, any capitalisation.
          <br />
          Canonical header: <code className="text-slate-400">{CSV_COLUMNS.join(', ')}</code> — you can remap every
          column before importing.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <label className="btn-primary cursor-pointer">
            <FileText size={15} />
            Choose file
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={onTemplate}>
            Download sample template
          </button>
        </div>

        {templateMsg && (
          <p className={`mt-2 text-xs ${templateMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
            {templateMsg.text}
          </p>
        )}

        {busyPhase && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <Spinner size={13} /> {busyPhase}
          </p>
        )}
        {fileData && !busyPhase && (
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <FileText size={13} /> {fileData.fileName} ({formatNumber(fileData.rows.length)} rows,{' '}
            {fileData.fields.length} columns)
            <button
              type="button"
              className="cursor-pointer text-slate-500 underline-offset-2 hover:text-rose-300 hover:underline"
              onClick={resetState}
            >
              clear
            </button>
          </p>
        )}
      </div>

      {/* File-level errors / warnings */}
      {fileError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-700/60 bg-rose-950/50 px-3 py-2.5 text-xs text-rose-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Import problem</p>
            <p className="mt-0.5 leading-relaxed">{fileError}</p>
          </div>
        </div>
      )}

      {sizeWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          {sizeWarning}
        </div>
      )}

      {fileData && fileData.parseWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Parser notes</p>
            <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-amber-300/80">
              {fileData.parseWarnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Validation crash guard (should never trigger — row builders are defensive) */}
      {validation?.failed && (
        <div className="rounded-lg border border-rose-700/60 bg-rose-950/50 px-3 py-2.5 text-xs text-rose-200">
          <p className="font-semibold">Validation failed</p>
          <p className="mt-1 leading-relaxed">
            {validation.failed} — please check the file or use the sample template as a reference.
          </p>
        </div>
      )}

      {/* ---------- Mapping + preview + import (dataset untouched until confirmed) ---------- */}
      {fileData && mapping && validation && !validation.failed && (
        <div className="space-y-3">
          {/* Mapping dropdowns */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="label flex items-center gap-1.5">
                <Wand2 size={13} className="text-indigo-300" /> Column mapping
              </p>
              <span className="text-[10px] text-slate-500">
                Revalidated live — change any dropdown and the preview updates
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    className="mb-1 block text-[11px] font-semibold text-slate-400"
                    htmlFor={`map-${field.key}`}
                  >
                    {field.label}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    aria-label={`Map ${field.label}`}
                    className="select"
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => updateMapping(field.key, e.target.value)}
                  >
                    <option value="">— Not mapped —</option>
                    {fileData.fields.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Ambiguity notes (auto-mapping picked one of several candidates) */}
            {Object.entries(fileData.ambiguities).length > 0 && (
              <ul className="mt-2.5 space-y-1 text-[11px] text-amber-300/90">
                {Object.entries(fileData.ambiguities).map(([field, matches]) => (
                  <li key={field}>
                    <TriangleAlert size={11} className="mr-1 inline" />
                    Multiple columns matched{' '}
                    <strong>{MAPPING_FIELDS.find((f) => f.key === field)?.label || field}</strong>:{' '}
                    {matches.join(', ')} → using “{mapping[field]}”. Change the dropdown if that is wrong.
                  </li>
                ))}
              </ul>
            )}

            {fileData.unmatched.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                Unmapped columns ({fileData.unmatched.join(', ')}) are preserved as metadata on each record.
              </p>
            )}
          </div>

          {/* Warnings for fields that will receive default values */}
          {unmappedFields.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <TriangleAlert size={13} /> Defaults that will apply
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-amber-300/80">
                {unmappedFields.map((f) => (
                  <li key={f.key}>{DEFAULT_NOTES[f.key]}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Import gate: no usable content column */}
          {completeness && !completeness.ok && (
            <div className="rounded-lg border border-rose-700/60 bg-rose-950/50 px-3 py-2.5 text-xs text-rose-200">
              <p className="font-semibold">No recognizable content column</p>
              <p className="mt-1 leading-relaxed">
                Map one of your columns to <strong>Text / content</strong> above (or map <strong>Post ID</strong>{' '}
                plus at least one other field), or{' '}
                <button type="button" className="cursor-pointer underline underline-offset-2" onClick={onTemplate}>
                  download the sample template
                </button>{' '}
                to see the expected format.
              </p>
            </div>
          )}

          {/* Validation summary chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
              {formatNumber(validation.records.length)} valid row{validation.records.length === 1 ? '' : 's'}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 font-semibold ${
                validation.errors.length > 0
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {formatNumber(validation.errors.length)} row{validation.errors.length === 1 ? '' : 's'} skipped
            </span>
            {validation.generatedIds > 0 && (
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 font-semibold text-indigo-300">
                {validation.generatedIds} ID{validation.generatedIds === 1 ? '' : 's'} generated
              </span>
            )}
            {defaultedLabels.length > 0 && (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300"
                title={`Defaults: ${defaultedLabels.join(', ')}`}
              >
                Defaults: {defaultedLabels.join(', ')}
              </span>
            )}
            {validation.emptyRows > 0 && (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 font-semibold text-slate-400">
                {validation.emptyRows} empty row{validation.emptyRows === 1 ? '' : 's'} ignored
              </span>
            )}
          </div>

          {/* Row-level errors */}
          {validation.errors.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-rose-700/50 bg-rose-950/40 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-200">
                <TriangleAlert size={13} /> Skipped rows (showing up to {Math.min(20, validation.errors.length)} of{' '}
                {validation.errors.length})
              </p>
              <ul className="space-y-1 text-[11px] text-rose-300/90">
                {validation.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>
                    <strong>Row {e.row}:</strong> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Row-level warnings (defaults applied per-row) */}
          {validation.warnings.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <TriangleAlert size={13} /> Warnings (showing up to {Math.min(15, validation.warnings.length)} of{' '}
                {validation.warnings.length}) — records still import
              </p>
              <ul className="space-y-1 text-[11px] text-amber-300/80">
                {validation.warnings.slice(0, 15).map((w, i) => (
                  <li key={i}>
                    {w.row ? <strong>Row {w.row}:</strong> : null} {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview of the first five mapped records */}
          {validation.records.length > 0 && (
            <div>
              <p className="label mb-2">
                Preview — first {Math.min(PREVIEW_ROWS, validation.records.length)} of{' '}
                {formatNumber(validation.records.length)} records (after mapping)
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-950/70 text-[10px] tracking-wider text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">post_id</th>
                      <th className="px-3 py-2">timestamp</th>
                      <th className="px-3 py-2">platform</th>
                      <th className="px-3 py-2 text-right">likes</th>
                      <th className="px-3 py-2 text-right">reach</th>
                      <th className="px-3 py-2">text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.records.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={r.postId} className="border-t border-slate-800/70">
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{r.postId}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-300">{formatDateTime(r.timestamp)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-slate-300">
                            <PlatformIcon platform={r.platform} size="sm" />
                            {r.platform}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{formatNumber(r.likes)}</td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{formatNumber(r.reach)}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-slate-400" title={r.text}>
                          {r.text || <span className="text-amber-400/80">(empty — defaulted)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import mode + actions */}
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="space-y-2">
              <p className="label">Import mode</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'append', label: 'Append', hint: 'Add rows; duplicate post_ids are skipped' },
                  { id: 'replace', label: 'Replace', hint: 'Overwrite the current dataset (asks to confirm)' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      mode === opt.id
                        ? 'border-indigo-500/60 bg-indigo-500/10 text-slate-100'
                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="import-mode"
                      className="mt-0.5 accent-indigo-500"
                      checked={mode === opt.id}
                      onChange={() => setMode(opt.id)}
                    />
                    <span>
                      <strong className="block font-semibold">{opt.label}</strong>
                      <span className="text-[10px] text-slate-500">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={resetState}
                title="Discard this file — nothing has been imported yet"
              >
                <X size={15} /> Cancel import
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onImportClick}
                disabled={!canImport}
                title={canImport ? 'Add these records to the dataset' : 'Fix the mapping issues above first'}
              >
                <Upload size={15} />
                Import {formatNumber(validation.records.length)} record
                {validation.records.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import result banner (context) + defaults summary (uploader) */}
      {importResult && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-2.5 text-xs text-emerald-200">
          <CircleCheck size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              Imported {formatNumber(importResult.imported)} record{importResult.imported === 1 ? '' : 's'} (
              {importResult.mode} mode).
            </p>
            {importResult.skipped > 0 && (
              <p className="mt-0.5 text-emerald-300/80">
                Skipped {formatNumber(importResult.skipped)} duplicate post_id{importResult.skipped === 1 ? '' : 's'}.
              </p>
            )}
            {importResult.capped && (
              <p className="mt-0.5 text-amber-300/90">
                Dataset is capped at 600 records — the oldest records were removed.
              </p>
            )}
            {lastImport && (
              <div className="mt-1 rounded border border-emerald-700/40 bg-emerald-900/30 px-2 py-1.5 text-[11px] text-emerald-300/90">
                <p className="font-semibold text-emerald-200">Import summary</p>
                <p className="mt-0.5">
                  Imported {formatNumber(lastImport.imported)} · skipped {formatNumber(importResult.skipped)} ·{' '}
                  {lastImport.generatedIds} generated ID{lastImport.generatedIds === 1 ? '' : 's'}
                  {lastImport.warnings > 0 ? ` · ${lastImport.warnings} warning${lastImport.warnings === 1 ? '' : 's'}` : ''}
                  {lastImport.emptyRows > 0 ? ` · ${lastImport.emptyRows} empty rows ignored` : ''}
                </p>
                {Object.keys(lastImport.defaultedFields).length > 0 && (
                  <p className="mt-0.5 text-amber-300/90">
                    Defaults applied —{' '}
                    {Object.entries(lastImport.defaultedFields)
                      .map(([f, n]) => `${f} ×${n}`)
                      .join(', ')}
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              className="mt-1.5 cursor-pointer text-emerald-300 underline-offset-2 hover:underline"
              onClick={resetState}
            >
              Clear uploader
            </button>
          </div>
        </div>
      )}

      {/* Replace confirmation (dataset changes only after this) */}
      <ConfirmDialog
        open={confirmReplace}
        title="Replace the current dataset?"
        message={`This will overwrite ${formatNumber(posts.length)} existing record${posts.length === 1 ? '' : 's'} with the ${formatNumber(validation?.records?.length || 0)} imported record${validation?.records?.length === 1 ? '' : 's'}. This cannot be undone.`}
        confirmLabel="Replace dataset"
        onCancel={() => setConfirmReplace(false)}
        onConfirm={() => {
          setConfirmReplace(false);
          doImport();
        }}
      />
    </div>
  );
}
