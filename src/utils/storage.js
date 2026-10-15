/**
 * Safe localStorage wrappers.
 * Corrupted / missing / quota-exceeded storage must never break the app —
 * every failure falls back gracefully (and is logged for the developer).
 */

import { STORAGE_KEYS } from './constants.js';

export function loadJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[SocialPulse] Failed to read "${key}" from localStorage:`, err);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[SocialPulse] Failed to write "${key}" to localStorage:`, err);
    return false;
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[SocialPulse] Failed to remove "${key}":`, err);
  }
}

/** Shape check for a stored post — filters out corrupted entries. */
export function isValidStoredPost(p) {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.postId !== 'string' || !p.postId) return false;
  if (typeof p.timestamp !== 'string' || Number.isNaN(Date.parse(p.timestamp))) return false;
  if (typeof p.platform !== 'string' || !p.platform) return false;
  if (typeof p.text !== 'string') return false;
  for (const field of ['likes', 'comments', 'shares', 'reach']) {
    const v = p[field];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return false;
  }
  return true;
}

/**
 * Load the persisted dataset. Returns null when nothing valid is stored
 * (caller then falls back to freshly generated demo data).
 */
export function loadStoredPosts() {
  const raw = loadJSON(STORAGE_KEYS.posts, null);
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter(isValidStoredPost);
  if (valid.length !== raw.length) {
    console.warn(`[SocialPulse] Dropped ${raw.length - valid.length} corrupted record(s) from storage.`);
  }
  return valid.length > 0 ? valid : null;
}

/** Rough localStorage usage in bytes (for the Data Management page). */
export function estimateStorageUsage() {
  try {
    let bytes = 0;
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith('socialpulse.')) continue;
      const value = window.localStorage.getItem(key) || '';
      bytes += (key.length + value.length) * 2; // UTF-16 = 2 bytes per unit
    }
    return bytes;
  } catch {
    return 0;
  }
}
