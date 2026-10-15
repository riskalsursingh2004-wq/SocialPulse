/**
 * Simulated real-time feed hook.
 *
 * Adds one SYNTHETIC post every 5 seconds while running. There is no external
 * service involved — everything is local and clearly labelled as simulated.
 *
 * Safety rules enforced here:
 *  - never two intervals at once (ref guard + effect cleanup)
 *  - interval is always cleared when the component unmounts
 *  - status is persisted so a refresh resumes the user's choice
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SIMULATION_INTERVAL_MS, STORAGE_KEYS } from '../utils/constants.js';
import { loadJSON, saveJSON } from '../utils/storage.js';
import { createSimulatedPost } from '../data/samplePosts.js';

export function useSimulation(onPost) {
  const [status, setStatus] = useState(() => {
    const saved = loadJSON(STORAGE_KEYS.simulation, 'idle');
    return saved === 'running' || saved === 'paused' ? saved : 'idle';
  });
  const [lastTickAt, setLastTickAt] = useState(null);

  const timerRef = useRef(null);
  const onPostRef = useRef(onPost);
  // Keep the ref pointed at the latest callback (without touching refs during render).
  useEffect(() => {
    onPostRef.current = onPost;
  }, [onPost]);

  // Persist the user's simulation preference.
  useEffect(() => {
    saveJSON(STORAGE_KEYS.simulation, status);
  }, [status]);

  // Single interval owner. Deps: [status] only → no duplicate timers.
  useEffect(() => {
    if (status !== 'running') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    if (timerRef.current) return undefined; // guard: interval already exists

    timerRef.current = setInterval(() => {
      try {
        onPostRef.current(createSimulatedPost());
        setLastTickAt(Date.now());
      } catch (err) {
        console.error('[SocialPulse] Simulation tick failed:', err);
      }
    }, SIMULATION_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const start = useCallback(() => setStatus('running'), []);
  const pause = useCallback(() => setStatus((s) => (s === 'running' ? 'paused' : s)), []);
  const resume = useCallback(() => setStatus((s) => (s === 'paused' ? 'running' : s)), []);
  const stop = useCallback(() => setStatus('idle'), []);

  return {
    status, // 'idle' | 'running' | 'paused'
    isActive: status === 'running',
    start,
    pause,
    resume,
    stop,
    lastTickAt,
    intervalMs: SIMULATION_INTERVAL_MS,
  };
}
