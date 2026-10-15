/**
 * CSV import / export built on Papa Parse.
 *
 * Import pipeline (Bug-1 fix — universal, schema-tolerant uploads):
 *   1. parseCsvInput()        — header-based parse, BOM strip, trim, dedupe,
 *                               comma/semicolon/tab auto-detection (Papa).
 *   2. detectColumnMapping()  — alias-aware header → field mapping
 *                               (date→timestamp, content→text, like_count→likes…).
 *   3. buildRecordsFromMapping() — row validation with safe defaults for
 *                               missing optional columns (never invented metrics
 *                               presented as measurements — every default is
 *                               counted and reported).
 *   4. The UI lets the user override any mapping before touching the dataset.
 *
 * Export side (Bug-2 fix):
 *   - exportFilteredData()      — downloads exactly the filtered records.
 *   - downloadSampleTemplate()  — always downloads the canonical 25-record
 *                                 template, independent of dataset/filters.
 *   Both generate locally in the browser with Blob + object URLs, BOM for
 *   Excel, delayed cleanup and visible error feedback.
 */

import Papa from 'papaparse';
import { CSV_COLUMNS } from './constants.js';
import { classifySentiment } from './sentiment.js';
import { generateSamplePosts } from '../data/samplePosts.js';

/* ------------------------------------------------------------------ */
/* Platform normalisation                                              */
/* ------------------------------------------------------------------ */

/**
 * Map common spellings / domains / abbreviations onto supported platform
 * names. Keys are compared AFTER `platformKey()` normalisation, so case,
 * spaces, hyphens, underscores and punctuation never matter:
 * "Tik Tok", "tik-tok" and "TikTok.com" all reduce to "tiktok".
 */
const PLATFORM_ALIASES = {
  // Instagram
  instagram: 'Instagram', instagramcom: 'Instagram', insta: 'Instagram', ig: 'Instagram',
  // Facebook
  facebook: 'Facebook', facebookcom: 'Facebook', fb: 'Facebook', meta: 'Facebook',
  // TikTok
  tiktok: 'TikTok', tiktokcom: 'TikTok', ticktock: 'TikTok',
  // YouTube
  youtube: 'YouTube', youtubecom: 'YouTube', yt: 'YouTube',
  // LinkedIn
  linkedin: 'LinkedIn', linkedincom: 'LinkedIn', li: 'LinkedIn',
  // X (Twitter always normalises to X — one value everywhere)
  x: 'X', xcom: 'X', twitter: 'X', twittercom: 'X', tw: 'X',
  // Reddit
  reddit: 'Reddit', redditcom: 'Reddit',
  // Pinterest
  pinterest: 'Pinterest', pinterestcom: 'Pinterest',
  // Snapchat
  snapchat: 'Snapchat', snapchatcom: 'Snapchat', snap: 'Snapchat',
  // Threads
  threads: 'Threads', threadscom: 'Threads', thread: 'Threads',
  // explicit unknown
  unknown: 'Unknown',
};

/** Case/space/punctuation-insensitive platform key ("Tik Tok" → "tiktok"). */
function platformKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Recognise a platform value → canonical name, or null when genuinely
 * unknown (callers decide the fallback, e.g. "Unknown" + a warning).
 */
export function recognizePlatform(value) {
  const key = platformKey(value);
  if (!key) return null;
  return PLATFORM_ALIASES[key] || null;
}

/**
 * Robust platform normalisation: canonical name for any recognised spelling,
 * "Unknown" only for genuinely unrecognised values.
 *   normalizePlatform("TikTok") → "TikTok" · normalizePlatform("tik tok") → "TikTok"
 *   normalizePlatform("Twitter") → "X"     · normalizePlatform("mars")   → "Unknown"
 */
export function normalizePlatform(value) {
  return recognizePlatform(value) || 'Unknown';
}

/* ------------------------------------------------------------------ */
/* Header normalisation + alias mapping                                */
/* ------------------------------------------------------------------ */

/** Remove a leading UTF-8 BOM (Papa surfaces it inside the first header). */
export function stripBom(text) {
  return String(text ?? '').replace(/^\uFEFF/, '');
}

/**
 * Canonical header key: BOM-stripped, lower-cased, with spaces / underscores /
 * hyphens / punctuation removed. "Post ID", "post_id" and "Post-ID" → "postid".
 */
export function normalizeHeaderKey(header) {
  return stripBom(header).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Alias dictionary: canonical field → common column-name synonyms.
 * Matching is done on normalised keys, so "Created_At", "created at" and
 * "CREATEDAT" are all equivalent. This list is an initial, extensible set —
 * add synonyms here as new datasets appear.
 */
export const COLUMN_ALIASES = {
  postId: [
    'post_id', 'id', 'postid', 'post id', 'tweet_id', 'tweet id', 'post_identifier',
    'post identifier', 'record_id', 'record id',
  ],
  timestamp: [
    'timestamp', 'date', 'datetime', 'date_time', 'created_at', 'created at', 'createdat',
    'published_at', 'published at', 'published date', 'published_date', 'posted_at',
    'posted at', 'time',
  ],
  platform: [
    'platform', 'source', 'network', 'social_network', 'social network',
    'social media platform', 'social_media_platform', 'channel',
  ],
  text: [
    'text', 'content', 'post_text', 'post text', 'posttext', 'message', 'caption',
    'description', 'tweet', 'tweet_text', 'tweet text', 'body',
  ],
  likes: [
    'likes', 'like_count', 'like count', 'likecount', 'total_likes', 'total likes',
    'favorite_count', 'favorite count', 'favoritecount', 'favourite_count',
    'favouritecount', 'favourites', 'favorites', 'likes_count',
  ],
  comments: [
    'comments', 'comment_count', 'comment count', 'commentcount', 'replies',
    'reply_count', 'reply count', 'replycount',
  ],
  shares: [
    'shares', 'share_count', 'share count', 'sharecount', 'reposts', 'retweets',
    'repost_count', 'repost count', 'repostcount', 'retweet_count', 'retweetcount',
  ],
  reach: [
    'reach', 'impressions', 'impression_count', 'impression count', 'impressioncount',
    'views', 'view_count', 'view count', 'viewcount', 'audience_reach',
    'audience reach', 'audiencereach',
  ],
};

/** Canonical template header for each field (used for exact-match preference). */
export const FIELD_CANONICAL_HEADER = {
  postId: 'post_id',
  timestamp: 'timestamp',
  platform: 'platform',
  text: 'text',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  reach: 'reach',
};

/** UI metadata for the mapping dropdowns (order = display order). */
export const MAPPING_FIELDS = [
  { key: 'postId', label: 'Post ID', hint: 'generated when missing' },
  { key: 'timestamp', label: 'Timestamp', hint: 'import time when missing' },
  { key: 'platform', label: 'Platform', hint: 'Unknown when missing' },
  { key: 'text', label: 'Text / content', hint: 'needed for import' },
  { key: 'likes', label: 'Likes', hint: '0 when missing' },
  { key: 'comments', label: 'Comments', hint: '0 when missing' },
  { key: 'shares', label: 'Shares', hint: '0 when missing' },
  { key: 'reach', label: 'Reach', hint: '0 when missing' },
];

/** Precompute normalised alias sets once. */
const ALIAS_SETS = Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [
    field,
    new Set(aliases.map(normalizeHeaderKey).concat(normalizeHeaderKey(FIELD_CANONICAL_HEADER[field]))),
  ]),
);

/** Detection order matters: more specific/generic-id fields claim columns first. */
const DETECTION_ORDER = ['postId', 'timestamp', 'platform', 'text', 'likes', 'comments', 'shares', 'reach'];

/**
 * Auto-map CSV columns to canonical fields.
 * A column can satisfy only one field; when several columns match the same
 * field, the exact canonical name wins and the rest are reported as
 * ambiguities so the UI can surface them (and the user can override).
 *
 * @returns {{ mapping: Record<string, string|null>, ambiguities: Record<string, string[]>, unmatched: string[] }}
 */
export function detectColumnMapping(fields) {
  const headers = (fields || []).map((f) => String(f));
  const used = new Set();
  const mapping = {};
  const ambiguities = {};

  for (const field of DETECTION_ORDER) {
    const matches = headers.filter((h) => !used.has(h) && ALIAS_SETS[field].has(normalizeHeaderKey(h)));
    if (matches.length === 0) {
      mapping[field] = null;
      continue;
    }
    const canonical = normalizeHeaderKey(FIELD_CANONICAL_HEADER[field]);
    const chosen = matches.find((h) => normalizeHeaderKey(h) === canonical) ?? matches[0];
    mapping[field] = chosen;
    used.add(chosen);
    if (matches.length > 1) ambiguities[field] = matches;
  }

  const unmatched = headers.filter((h) => !used.has(h));
  return { mapping, ambiguities, unmatched };
}

/**
 * Import gate (spec rule 1): need a text/content column, OR a recognisable
 * record id plus at least one other meaningful field.
 * @returns {{ ok: boolean, requiresText: boolean, reason: string|null }}
 */
export function checkMappingCompleteness(mapping) {
  const hasText = Boolean(mapping?.text);
  const hasId = Boolean(mapping?.postId);
  const hasOther = ['timestamp', 'platform', 'likes', 'comments', 'shares', 'reach'].some(
    (f) => Boolean(mapping?.[f]),
  );

  if (hasText) return { ok: true, requiresText: false, reason: null };
  if (hasId && hasOther) return { ok: true, requiresText: false, reason: 'no-text' };
  return {
    ok: false,
    requiresText: true,
    reason: 'no-content',
  };
}

/* ------------------------------------------------------------------ */
/* Numeric parsing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Safe metric parsing: accepts "1200", "1,200", "12.5" (dot-decimal).
 * Rejects negatives and non-numeric values with a readable message.
 */
function parseMetric(value, field) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (raw === '') return { error: `"${field}" is empty` };
  if (!/^-?\d*\.?\d+$/.test(raw)) return { error: `"${field}" must be a number (got "${value}")` };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: `"${field}" must be a number (got "${value}")` };
  if (n < 0) return { error: `"${field}" must be non-negative (got "${value}")` };
  return { value: n };
}

/** Generate a unique post id that does not collide with `taken`. */
function generatePostId(taken, index) {
  let id;
  do {
    id = `IMP-${Date.now().toString(36).toUpperCase()}-${index}-${Math.floor(Math.random() * 1e5).toString(36).toUpperCase()}`;
  } while (taken.has(id));
  return id;
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse a CSV File/Text into raw rows + detected columns.
 * - header-based parsing (quoted commas, escaped quotes and multiline fields
 *   are handled by Papa Parse)
 * - UTF-8 BOM stripped from headers, headers trimmed (row data untouched)
 * - duplicate header names deduplicated (likes, likes_2, …)
 * - comma / semicolon / tab delimiters auto-detected by Papa
 * Resolves with { rows, fields, parseWarnings, error? } — never rejects.
 */
export function parseCsvInput(input) {
  return new Promise((resolve) => {
    const seenHeaders = new Set();

    Papa.parse(input, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => {
        let name = stripBom(h).trim();
        if (!name) name = 'column';
        if (seenHeaders.has(name)) {
          let i = 2;
          while (seenHeaders.has(`${name}_${i}`)) i += 1;
          name = `${name}_${i}`;
        }
        seenHeaders.add(name);
        return name;
      },
      complete: (results) => {
        const rows = Array.isArray(results.data) ? results.data : [];
        const fields = results.meta?.fields || [];

        if (fields.length === 0) {
          resolve({
            rows: [],
            fields: [],
            parseWarnings: [],
            error: 'The file is empty or has no readable header row.',
          });
          return;
        }

        const parseWarnings = (results.errors || [])
          .filter((e) => e.code !== 'UndetectableDelimiter')
          .slice(0, 10)
          .map((e) => (e.row !== undefined ? `Row ${e.row + 2}: ${e.message}` : e.message));

        // Likely delimiter problem: one huge column means we couldn't find
        // comma/semicolon/tab separators.
        if (fields.length === 1 && rows.length > 0) {
          resolve({
            rows,
            fields,
            parseWarnings,
            error:
              'Could not detect a comma, semicolon or tab separator — the whole file parsed as a single column. ' +
              'Please save it as a standard UTF-8 CSV (comma, semicolon or tab separated).',
          });
          return;
        }

        if (rows.length === 0) {
          resolve({
            rows: [],
            fields,
            parseWarnings,
            error: 'The file has a header row but no data rows.',
          });
          return;
        }

        resolve({ rows, fields, parseWarnings, error: null });
      },
      error: (err) =>
        resolve({
          rows: [],
          fields: [],
          parseWarnings: [],
          error: `Could not read the file: ${String(err?.message || err)}`,
        }),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Row validation with mapped columns                                  */
/* ------------------------------------------------------------------ */

/**
 * Validate raw CSV rows using an explicit column mapping.
 * Never throws — malformed rows are reported, valid rows still import.
 *
 * Defaults (clearly counted, never presented as measurements):
 *   - timestamp column missing / cell empty → import time (counted + warned)
 *   - platform missing / unknown value      → "Unknown"   (counted + warned)
 *   - likes/comments/shares/reach missing   → 0           (counted as defaulted)
 *   - post_id missing / empty               → generated unique id
 * Unknown columns are preserved on each record under `meta` (first 12).
 *
 * @returns {{
 *   records: Array, errors: Array<{row:number,message:string}>,
 *   warnings: Array<{row:number|null,message:string}>,
 *   skipped: number, generatedIds: number, duplicateIds: number,
 *   emptyRows: number, defaultedFields: Record<string, number>, metaColumns: string[]
 * }}
 */
export function buildRecordsFromMapping(rows, mapping, { existingIds = new Set() } = {}) {
  const errors = [];
  const warnings = [];
  const records = [];
  const seenIds = new Set(existingIds);
  const defaultedFields = {};
  let generatedIds = 0;
  let duplicateIds = 0;
  let emptyRows = 0;

  const col = (field) => (mapping && mapping[field] ? mapping[field] : null);
  const noteDefault = (field) => {
    defaultedFields[field] = (defaultedFields[field] || 0) + 1;
  };

  // Preserve unmapped columns as per-record metadata (capped for storage).
  const mappedHeaders = new Set(Object.values(mapping || {}).filter(Boolean));
  const allHeaders = rows.length > 0 && rows[0] ? Object.keys(rows[0]) : [];
  const metaHeaders = allHeaders.filter((h) => !mappedHeaders.has(h)).slice(0, 12);

  (rows || []).forEach((row, i) => {
    const rowNo = i + 2; // +1 header row, +1 to be 1-indexed for humans

    // Spec E: ignore completely empty rows (not an error).
    if (!row || Object.values(row).every((v) => String(v ?? '').trim() === '')) {
      emptyRows += 1;
      return;
    }

    // ---- text / content ----
    const textCol = col('text');
    let text = '';
    if (textCol) {
      text = String(row[textCol] ?? '');
      if (!text.trim()) {
        errors.push({ row: rowNo, message: 'Text/content is empty — row skipped.' });
        return;
      }
    } else {
      noteDefault('text'); // id-only import: empty content (reported via defaults)
    }

    // ---- timestamp ----
    const tsCol = col('timestamp');
    let ts;
    if (!tsCol) {
      ts = Date.now();
      noteDefault('timestamp');
    } else {
      const raw = String(row[tsCol] ?? '').trim();
      if (!raw) {
        ts = Date.now();
        noteDefault('timestamp');
        warnings.push({ row: rowNo, message: 'Timestamp was empty — generated the import time.' });
      } else {
        const parsed = Date.parse(raw);
        if (Number.isNaN(parsed)) {
          errors.push({
            row: rowNo,
            message: `Invalid timestamp "${raw}" — use a date like 2026-10-01 or 2026-10-01 14:30.`,
          });
          return;
        }
        ts = parsed;
      }
    }

    // ---- platform ----
    const platCol = col('platform');
    let platform = 'Unknown';
    if (!platCol) {
      noteDefault('platform');
    } else {
      const raw = String(row[platCol] ?? '').trim();
      if (!raw) {
        platform = 'Unknown';
        noteDefault('platform');
        warnings.push({ row: rowNo, message: 'Platform was empty — imported as Unknown.' });
      } else {
        const normalised = recognizePlatform(raw);
        if (normalised) {
          platform = normalised;
        } else {
          platform = 'Unknown';
          noteDefault('platform');
          warnings.push({ row: rowNo, message: `Unrecognized platform "${raw}" — imported as Unknown.` });
        }
      }
    }

    // ---- metrics (never invent measurements silently) ----
    const metrics = {};
    let metricFailed = false;
    for (const field of ['likes', 'comments', 'shares', 'reach']) {
      const c = col(field);
      if (!c) {
        metrics[field] = 0;
        noteDefault(field);
        continue;
      }
      const rawCell = String(row[c] ?? '').trim();
      if (rawCell === '') {
        metrics[field] = 0;
        noteDefault(field);
        warnings.push({ row: rowNo, message: `${field} was empty — defaulted to 0 (not a measured value).` });
        continue;
      }
      const parsed = parseMetric(rawCell, field);
      if (parsed.error) {
        errors.push({ row: rowNo, message: parsed.error });
        metricFailed = true;
      } else {
        metrics[field] = parsed.value;
      }
    }
    if (metricFailed) return;

    // ---- post id ----
    const idCol = col('postId');
    let postId = idCol ? String(row[idCol] ?? '').trim() : '';
    if (!postId) {
      generatedIds += 1;
      postId = generatePostId(seenIds, records.length);
    } else if (seenIds.has(postId)) {
      duplicateIds += 1;
      errors.push({ row: rowNo, message: `Duplicate post_id "${postId}" — row skipped.` });
      return;
    }
    seenIds.add(postId);

    const record = {
      postId,
      timestamp: new Date(ts).toISOString(),
      platform,
      text,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      reach: metrics.reach,
      sentiment: classifySentiment(text).label,
      isSimulated: false,
      source: 'import',
    };

    if (metaHeaders.length > 0) {
      const meta = {};
      for (const h of metaHeaders) {
        const v = row[h];
        if (v !== undefined && String(v).trim() !== '') meta[h] = String(v);
      }
      if (Object.keys(meta).length > 0) record.meta = meta;
    }

    records.push(record);
  });

  return {
    records,
    errors,
    warnings,
    skipped: errors.length,
    generatedIds,
    duplicateIds,
    emptyRows,
    defaultedFields,
    metaColumns: metaHeaders,
  };
}

/**
 * Convenience wrapper: auto-detect the mapping from the row keys, then build.
 * (Used by tests and by callers that only have canonical/near-canonical rows.)
 */
export function validateCsvRows(rows, { existingIds = new Set() } = {}) {
  const fields = rows && rows.length > 0 && rows[0] ? Object.keys(rows[0]) : [];
  const { mapping } = detectColumnMapping(fields);
  return buildRecordsFromMapping(rows || [], mapping, { existingIds });
}

/* ------------------------------------------------------------------ */
/* Export / downloads                                                  */
/* ------------------------------------------------------------------ */

/** Convert posts → CSV string (canonical column order, RFC 4180 quoting). */
export function postsToCsv(posts) {
  const rows = posts.map((p) => ({
    post_id: p.postId,
    timestamp: p.timestamp,
    platform: p.platform,
    text: p.text,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    reach: p.reach,
  }));
  const csv = Papa.unparse(rows, { columns: CSV_COLUMNS });
  // Papa returns an empty string for zero rows — emit the header manually
  // so the file is always a valid, importable CSV.
  return csv || CSV_COLUMNS.join(',');
}

/**
 * Trigger a browser download for a text file.
 * - UTF-8 BOM so Excel detects the encoding (import side strips it again)
 * - anchor is removed and the object URL revoked only AFTER the download has
 *   been given time to start (removing synchronously can cancel it in some
 *   browsers) — this was one cause of the "button does nothing" bug
 * - never throws: returns { ok, error? } so callers can show feedback
 */
export function downloadTextFile(content, filename, { bom = true, type = 'text/csv;charset=utf-8' } = {}) {
  try {
    const body = (bom ? '\uFEFF' : '') + String(content ?? '');
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {
        /* element already gone */
      }
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* URL already revoked */
      }
    }, 2500);
    return { ok: true };
  } catch (err) {
    console.error('[SocialPulse] Download failed:', err);
    return { ok: false, error: err?.message || 'unknown error' };
  }
}

/**
 * Export the currently filtered dataset (independent of the template button).
 * @returns {{ ok: boolean, count: number, error?: string }}
 */
export function exportFilteredData(posts, filename = 'socialpulse_filtered_data.csv') {
  const list = Array.isArray(posts) ? posts : [];
  const result = downloadTextFile(postsToCsv(list), filename);
  return result.ok ? { ok: true, count: list.length } : { ok: false, count: 0, error: result.error };
}

/** First `limit` demo records as CSV (used by callers that pass a dataset). */
export function buildSampleTemplateCsv(posts, limit = 25) {
  return postsToCsv(posts.slice(0, limit));
}

/**
 * Canonical 25-record sample template — always the same records, generated
 * locally from a fixed seed. Completely independent of the active dataset,
 * filters and simulation state (Bug-2 fix).
 */
// Fixed reference time + seed → the template file is byte-identical on every
// download and matches the static copy in public/.
const TEMPLATE_NOW_MS = Date.parse('2026-01-05T09:00:00Z');

export function buildCanonicalTemplateCsv(limit = 25) {
  // Seed 424243 verified to cover Instagram, Facebook, TikTok, YouTube,
  // LinkedIn, X and Reddit within the first 25 records (deterministic).
  const pool = generateSamplePosts(Math.max(limit, limit + 5), 424243, TEMPLATE_NOW_MS);
  return postsToCsv(pool.slice(0, limit));
}

/**
 * Download the canonical sample template.
 * @returns {{ ok: boolean, error?: string }}
 */
export function downloadSampleTemplate(limit = 25, filename = 'socialpulse_sample_template.csv') {
  try {
    const csv = buildCanonicalTemplateCsv(limit);
    if (!csv) throw new Error('template generation produced no content');
    return downloadTextFile(csv, filename);
  } catch (err) {
    console.error('[SocialPulse] Template download failed:', err);
    return { ok: false, error: err?.message || 'unknown error' };
  }
}
