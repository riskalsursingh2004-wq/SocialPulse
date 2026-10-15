/**
 * DashboardContext — the single shared source of truth for:
 *   • the active dataset (demo / imported / simulated posts)
 *   • the active filters
 *   • derived values (filtered posts, KPIs, previous-period comparison)
 *   • dataset actions (import, export, reset, clear, refresh)
 *   • the simulated real-time feed
 *
 * Every page and chart reads from this context, so all views always agree.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_FILTERS, MAX_RECORDS, STORAGE_KEYS } from '../utils/constants.js';
import { isValidStoredPost, loadJSON, loadStoredPosts, saveJSON } from '../utils/storage.js';
import { applyFilters, computeKpis, computePeriodComparison, countActiveFilters } from '../utils/analytics.js';
import { generateSamplePosts } from '../data/samplePosts.js';
import { useSimulation } from '../hooks/useSimulation.js';

const DashboardContext = createContext(null);

/** Keep dataset sorted newest-first and bounded in size. */
function normaliseDataset(list) {
  const sorted = [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return sorted.length > MAX_RECORDS ? sorted.slice(0, MAX_RECORDS) : sorted;
}

export function DashboardProvider({ children }) {
  const [posts, setPosts] = useState(() => loadStoredPosts() ?? generateSamplePosts());
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    ...(loadJSON(STORAGE_KEYS.filters, {}) || {}),
  }));
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => Date.now());
  const [importResult, setImportResult] = useState(null); // { imported, skipped, mode, ... }
  const refreshTimerRef = useRef(null);

  // Persist dataset + filters (guarded against quota errors inside saveJSON).
  useEffect(() => {
    saveJSON(STORAGE_KEYS.posts, posts);
  }, [posts]);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.filters, filters);
  }, [filters]);

  // Clear pending refresh timer on unmount.
  useEffect(() => () => window.clearTimeout(refreshTimerRef.current), []);

  /* ---------- cross-tab / cross-window synchronisation ---------- */
  // localStorage is persisted on every change, but WITHOUT this listener any
  // OTHER open tab/window keeps rendering its stale in-memory copy until the
  // user refreshes manually (e.g. Overview left open in one tab while a CSV is
  // imported in another → Overview keeps showing the old record count).
  // The `storage` event fires ONLY in tabs that did not perform the write, so
  // this can never fight with our own save effects or loop.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEYS.posts) {
        const raw = loadJSON(STORAGE_KEYS.posts, null);
        if (Array.isArray(raw)) {
          // [] (cleared in the other tab) is a valid synced state too
          setPosts(normaliseDataset(raw.filter(isValidStoredPost)));
        }
      } else if (event.key === STORAGE_KEYS.filters) {
        const raw = loadJSON(STORAGE_KEYS.filters, null);
        if (raw && typeof raw === 'object') {
          setFilters({ ...DEFAULT_FILTERS, ...raw });
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /* ---------- simulation (one synthetic post / 5s) ---------- */
  const addSimulatedPost = useCallback((post) => {
    setPosts((prev) => normaliseDataset([post, ...prev]));
  }, []);

  const simulation = useSimulation(addSimulatedPost);
  const { stop: stopSimulation } = simulation;

  /* ---------- dataset actions ---------- */

  /**
   * Import validated CSV records.
   * @param {Array} records posts already validated by utils/csv.js
   * @param {'replace'|'append'} mode
   */
  const importRecords = useCallback(
    (records, mode) => {
      if (!Array.isArray(records) || records.length === 0) {
        return { imported: 0, skipped: 0, mode, duplicateIds: 0 };
      }

      if (mode === 'replace') {
        const next = normaliseDataset(records);
        // normaliseDataset caps at MAX_RECORDS — report what actually landed.
        const result = {
          imported: next.length,
          skipped: 0,
          mode,
          capped: next.length < records.length,
        };
        setPosts(next);
        setImportResult(result);
        return result;
      }

      // Append → drop records whose post_id already exists (dedupe).
      const existingIds = new Set(posts.map((p) => p.postId));
      const fresh = records.filter((r) => !existingIds.has(r.postId));
      const skipped = records.length - fresh.length;
      const next = normaliseDataset([...fresh, ...posts]);
      const added = Math.max(0, next.length - posts.length);
      setPosts(next);
      const result = {
        imported: added,
        skipped,
        mode,
        duplicateIds: skipped,
        capped: fresh.length > added, // cap trimmed some incoming/older records
      };
      setImportResult(result);
      return result;
    },
    [posts],
  );

  const resetToDemo = useCallback(() => {
    stopSimulation();
    setPosts(normaliseDataset(generateSamplePosts()));
    setImportResult(null);
  }, [stopSimulation]);

  /** Remove imported + simulated records, keeping the original demo posts. */
  const clearImportedData = useCallback(() => {
    stopSimulation();
    setPosts((prev) => prev.filter((p) => p.source === 'demo'));
    setImportResult(null);
  }, [stopSimulation]);

  /** Wipe everything → dashboard shows its designed empty states. */
  const clearAllData = useCallback(() => {
    stopSimulation();
    setPosts([]);
    setImportResult(null);
  }, [stopSimulation]);

  /** Re-read the persisted dataset (simulates a manual data re-sync). */
  const refresh = useCallback(() => {
    setLoading(true);
    window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      const stored = loadStoredPosts();
      if (stored) setPosts(normaliseDataset(stored));
      setLoading(false);
      setLastRefreshed(Date.now());
    }, 450);
  }, []);

  /* ---------- filters ---------- */

  const updateFilters = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
  }, []);

  /* ---------- derived values (memoised, deterministic) ---------- */

  const filteredPosts = useMemo(() => applyFilters(posts, filters), [posts, filters]);

  const basePosts = useMemo(
    () => applyFilters(posts, { ...filters, dateFrom: '', dateTo: '' }),
    [posts, filters],
  );

  const kpis = useMemo(() => computeKpis(filteredPosts), [filteredPosts]);

  const comparison = useMemo(
    () => computePeriodComparison(basePosts, filters),
    [basePosts, filters],
  );

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const datasetStats = useMemo(
    () => ({
      total: posts.length,
      simulated: posts.filter((p) => p.source === 'simulation').length,
      imported: posts.filter((p) => p.source === 'import').length,
      demo: posts.filter((p) => p.source === 'demo').length,
    }),
    [posts],
  );

  const value = useMemo(
    () => ({
      // data
      posts,
      filteredPosts,
      kpis,
      comparison,
      datasetStats,
      loading,
      lastRefreshed,
      importResult,
      setImportResult,
      // filters
      filters,
      updateFilters,
      clearFilters,
      activeFilterCount,
      // actions
      importRecords,
      resetToDemo,
      clearImportedData,
      clearAllData,
      refresh,
      // simulation
      simulation,
    }),
    [
      posts,
      filteredPosts,
      kpis,
      comparison,
      datasetStats,
      loading,
      lastRefreshed,
      importResult,
      filters,
      updateFilters,
      clearFilters,
      activeFilterCount,
      importRecords,
      resetToDemo,
      clearImportedData,
      clearAllData,
      refresh,
      simulation,
    ],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

/** Access dashboard state. Throws a clear error when used outside the provider. */
export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard() must be used inside <DashboardProvider>.');
  }
  return ctx;
}
