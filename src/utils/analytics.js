/**
 * Analytics calculations — kept 100% separate from the UI.
 *
 * Core formulas (see README):
 *   Total Engagement      = likes + comments + shares
 *   Engagement Rate (%)   = (likes + comments + shares) / reach × 100
 *   Average Engagement    = arithmetic mean of per-post rates, excluding reach = 0
 *   Total Reach           = sum of reach (CUMULATIVE, not unique audience)
 *
 * Every function here is pure + deterministic: same input → same output.
 */

import { PLATFORMS, SENTIMENTS } from './constants.js';
import { dayKey } from './format.js';

/* ---------------------------------- */
/* Per-post metrics                   */
/* ---------------------------------- */

export function engagementOf(post) {
  return (Number(post.likes) || 0) + (Number(post.comments) || 0) + (Number(post.shares) || 0);
}

/** Engagement rate in %. Returns null when reach is 0 (division-by-zero guard). */
export function engagementRateOf(post) {
  const reach = Number(post.reach) || 0;
  if (reach <= 0) return null;
  return (engagementOf(post) / reach) * 100;
}

/* ---------------------------------- */
/* KPI aggregation                    */
/* ---------------------------------- */

export function computeKpis(posts) {
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalReach = 0;
  let rateSum = 0;
  let rateCount = 0;

  for (const p of posts) {
    totalLikes += Number(p.likes) || 0;
    totalComments += Number(p.comments) || 0;
    totalShares += Number(p.shares) || 0;
    totalReach += Number(p.reach) || 0;
    const rate = engagementRateOf(p);
    if (rate !== null) {
      rateSum += rate;
      rateCount += 1;
    }
  }

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    totalShares,
    totalReach, // cumulative reach across posts (may double-count people)
    totalEngagement: totalLikes + totalComments + totalShares,
    avgEngagementRate: rateCount > 0 ? rateSum / rateCount : 0,
    ratedPosts: rateCount,
  };
}

/* ---------------------------------- */
/* Filtering (single source of truth) */
/* ---------------------------------- */

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

function parseDayInput(value) {
  if (!value) return null;
  // "YYYY-MM-DD" parsed by Date() is UTC — build a local date instead.
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Apply every active filter. Posts with unparseable timestamps are excluded
 * so downstream charts/aggregations can never crash on bad dates.
 */
export function applyFilters(posts, filters) {
  const { search = '', platform = 'All', sentiment = 'All', dateFrom = '', dateTo = '' } = filters || {};
  const query = String(search).trim().toLowerCase();
  const from = parseDayInput(dateFrom);
  const to = parseDayInput(dateTo);
  const fromTime = from ? from.getTime() : null;
  const toTime = to ? endOfLocalDay(to).getTime() : null;

  return posts.filter((p) => {
    const ts = Date.parse(p.timestamp);
    if (Number.isNaN(ts)) return false;
    if (platform !== 'All' && p.platform !== platform) return false;
    if (sentiment !== 'All' && p.sentiment !== sentiment) return false;
    if (fromTime !== null && ts < fromTime) return false;
    if (toTime !== null && ts > toTime) return false;
    if (query) {
      const haystack = `${p.text || ''} ${p.postId || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function countActiveFilters(filters) {
  if (!filters) return 0;
  let n = 0;
  if (filters.search?.trim()) n += 1;
  if (filters.platform && filters.platform !== 'All') n += 1;
  if (filters.sentiment && filters.sentiment !== 'All') n += 1;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  return n;
}

/* ---------------------------------- */
/* Chart aggregations                 */
/* ---------------------------------- */

/** Aggregate likes/comments/shares/post-count per calendar day (ascending). */
export function aggregateByDay(posts) {
  const buckets = new Map();
  for (const p of posts) {
    const key = dayKey(p.timestamp);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: key, likes: 0, comments: 0, shares: 0, reach: 0, posts: 0, engagement: 0 };
      buckets.set(key, bucket);
    }
    const likes = Number(p.likes) || 0;
    const comments = Number(p.comments) || 0;
    const shares = Number(p.shares) || 0;
    bucket.likes += likes;
    bucket.comments += comments;
    bucket.shares += shares;
    bucket.reach += Number(p.reach) || 0;
    bucket.posts += 1;
    bucket.engagement += likes + comments + shares;
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Engagement per platform — all 5 platforms always present (zero-filled). */
export function aggregateByPlatform(posts) {
  const map = new Map(PLATFORMS.map((p) => [p, { platform: p, engagement: 0, posts: 0, likes: 0, comments: 0, shares: 0, reach: 0 }]));
  for (const p of posts) {
    const row = map.get(p.platform);
    if (!row) continue;
    row.likes += Number(p.likes) || 0;
    row.comments += Number(p.comments) || 0;
    row.shares += Number(p.shares) || 0;
    row.reach += Number(p.reach) || 0;
    row.engagement += engagementOf(p);
    row.posts += 1;
  }
  return [...map.values()];
}

/** Counts + percentages per sentiment label (always 3 entries). */
export function sentimentBreakdown(posts) {
  const counts = { Positive: 0, Neutral: 0, Negative: 0 };
  for (const p of posts) {
    const label = SENTIMENTS.includes(p.sentiment) ? p.sentiment : 'Neutral';
    counts[label] += 1;
  }
  const total = posts.length;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
  return {
    total,
    counts,
    percentages: {
      Positive: pct(counts.Positive),
      Neutral: pct(counts.Neutral),
      Negative: pct(counts.Negative),
    },
  };
}

/** Per-day sentiment counts (for the stacked sentiment-trend chart). */
export function aggregateSentimentByDay(posts) {
  const buckets = new Map();
  for (const p of posts) {
    const key = dayKey(p.timestamp);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: key, Positive: 0, Neutral: 0, Negative: 0, total: 0 };
      buckets.set(key, bucket);
    }
    const label = SENTIMENTS.includes(p.sentiment) ? p.sentiment : 'Neutral';
    bucket[label] += 1;
    bucket.total += 1;
  }
  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Totals for the engagement-breakdown chart. */
export function engagementBreakdown(posts) {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  for (const p of posts) {
    likes += Number(p.likes) || 0;
    comments += Number(p.comments) || 0;
    shares += Number(p.shares) || 0;
  }
  return [
    { name: 'Likes', value: likes },
    { name: 'Comments', value: comments },
    { name: 'Shares', value: shares },
  ];
}

/* ---------------------------------- */
/* Period comparison (previous period) */
/* ---------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the "current" window:
 *  - with an active date filter → that range (previous = preceding equal window)
 *  - without → the RECENT HALF of the available data, so a meaningful
 *    previous window (the earlier half) always exists when the data
 *    spans more than one day.
 * Returns null when the data cannot be split (no comparison possible).
 */
export function resolvePeriod(posts, filters) {
  const timestamps = posts.map((p) => Date.parse(p.timestamp)).filter((t) => !Number.isNaN(t));
  if (timestamps.length === 0) return null;

  const dataFrom = startOfLocalDay(new Date(Math.min(...timestamps)));
  const dataTo = endOfLocalDay(new Date(Math.max(...timestamps)));

  if (filters?.dateFrom || filters?.dateTo) {
    const from = parseDayInput(filters.dateFrom) || dataFrom;
    const to = parseDayInput(filters.dateTo) || dataTo;
    const days = Math.max(1, Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS) + 1);
    return {
      current: { from, to },
      previous: {
        from: startOfLocalDay(new Date(startOfLocalDay(from).getTime() - days * DAY_MS)),
        to: endOfLocalDay(new Date(startOfLocalDay(from).getTime() - DAY_MS)),
      },
      days,
      label: 'selected range vs the previous equivalent range',
    };
  }

  // No date filter → split the dataset's own span in half so both windows
  // contain data (min timestamp is in the earlier half, max in the recent half).
  const spanDays = Math.round((startOfLocalDay(dataTo).getTime() - startOfLocalDay(dataFrom).getTime()) / DAY_MS);
  if (spanDays < 1) return null;

  const midFrom = new Date(startOfLocalDay(dataFrom).getTime() + Math.ceil(spanDays / 2) * DAY_MS);
  if (midFrom.getTime() > startOfLocalDay(dataTo).getTime()) return null;

  return {
    current: { from: midFrom, to: dataTo },
    previous: { from: dataFrom, to: endOfLocalDay(new Date(midFrom.getTime() - DAY_MS)) },
    days: Math.round((startOfLocalDay(dataTo).getTime() - startOfLocalDay(midFrom).getTime()) / DAY_MS) + 1,
    label: 'recent half of your data vs the earlier half',
  };
}

function inWindow(posts, from, to) {
  const fromTime = from.getTime();
  const toTime = to.getTime();
  return posts.filter((p) => {
    const ts = Date.parse(p.timestamp);
    return !Number.isNaN(ts) && ts >= fromTime && ts <= toTime;
  });
}

/**
 * Compare KPIs of the current period vs the previous equivalent period.
 * Returns null when there is not enough dated data in the previous window.
 *
 * @param {Array} basePosts posts with platform/sentiment/search filters applied
 *                         (date filter applied internally so both windows match)
 * @param {Object} filters active filter state
 */
export function computePeriodComparison(basePosts, filters) {
  const period = resolvePeriod(basePosts, filters);
  if (!period) return null;

  const currentPosts = inWindow(basePosts, period.current.from, period.current.to);
  const previousPosts = inWindow(basePosts, period.previous.from, period.previous.to);
  if (previousPosts.length === 0 || currentPosts.length === 0) return null;

  const current = computeKpis(currentPosts);
  const previous = computeKpis(previousPosts);

  const delta = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

  return {
    period,
    label: period.label,
    current,
    previous,
    deltas: {
      totalPosts: delta(current.totalPosts, previous.totalPosts),
      totalLikes: delta(current.totalLikes, previous.totalLikes),
      totalComments: delta(current.totalComments, previous.totalComments),
      totalShares: delta(current.totalShares, previous.totalShares),
      totalReach: delta(current.totalReach, previous.totalReach),
      avgEngagementRate: delta(current.avgEngagementRate, previous.avgEngagementRate),
    },
  };
}

/* ---------------------------------- */
/* Sorting / top posts                */
/* ---------------------------------- */

export function totalEngagementOf(post) {
  return engagementOf(post);
}

/**
 * Generic deterministic sorter. `key` is a metric name, `dir` is 'asc'|'desc'.
 * Posts with a null engagement rate always sink to the bottom.
 */
export function sortPosts(posts, key, dir = 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  const value = (p) => {
    switch (key) {
      case 'rate':
        return engagementRateOf(p);
      case 'engagement':
        return engagementOf(p);
      case 'likes':
        return Number(p.likes) || 0;
      case 'comments':
        return Number(p.comments) || 0;
      case 'shares':
        return Number(p.shares) || 0;
      case 'reach':
        return Number(p.reach) || 0;
      case 'date':
        return Date.parse(p.timestamp) || 0;
      case 'platform':
        return p.platform || '';
      case 'sentiment':
        return p.sentiment || '';
      case 'postId':
        return p.postId || '';
      default:
        return 0;
    }
  };

  return [...posts].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // null rates (zero reach) always last, regardless of direction
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'string') return sign * va.localeCompare(vb);
    return sign * (va - vb);
  });
}
