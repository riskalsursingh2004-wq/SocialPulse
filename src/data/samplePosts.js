/**
 * Realistic demo dataset generator.
 *
 * - Deterministic: uses a seeded PRNG (mulberry32), so "Reset to demo data"
 *   always produces the same dataset — easy to demo in front of faculty.
 * - Timestamps are spread across the last `daysBack` days so date filters,
 *   time-series charts and previous-period comparisons all have data.
 * - Contains a few zero-reach posts on purpose to prove division-by-zero safety.
 */

import { classifySentiment } from '../utils/sentiment.js';
import { PLATFORMS } from '../utils/constants.js';

/**
 * Demo/simulated posts are only generated for the five real networks.
 * "Unknown" exists solely as an import fallback for CSVs without a platform
 * column, so it must never be picked randomly here.
 */
const CONTENT_PLATFORMS = PLATFORMS.filter((p) => p !== 'Unknown');

/** Small seeded PRNG — same seed → same "random" sequence. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

/* Text templates per sentiment bucket. Placeholders keep variation high. */
const POSITIVE_TEXTS = [
  'Absolutely love the new update! The refreshed dashboard feels so much faster and cleaner. #UX',
  'Great job by the team on this launch — the onboarding flow is amazing and genuinely helpful.',
  'Had an excellent experience with support today. Fast, friendly and solved my problem first try.',
  'This workflow saved me hours this week. Best tool we have added to our stack, fantastic results.',
  'Really impressed with the quality. Beautiful design and the performance improvements are noticeable.',
  'Huge success at our event this weekend — turnout doubled thanks to the campaign. Feeling grateful!',
  'The new analytics views are awesome. Sharing this with the whole team, highly recommend it.',
  'Five stars from me. Reliable, simple and genuinely useful every single day. Love it!',
  'Thrilled to see our post hit 100K reach overnight. Amazing community support — thank you all!',
  'Positive results already: engagement up 24% after switching to this strategy. Winning!',
  'Just recommended this to a friend — great content as always and very helpful explanations.',
  'Wonderful customer service experience. They went above and beyond, appreciate the quick fix.',
];

const NEGATIVE_TEXTS = [
  'The latest update keeps crashing on upload. Pretty disappointed — this is a basic feature.',
  'Terrible support experience today. Waited 40 minutes just to get a rude, unhelpful reply.',
  'Nothing works after the migration. Files are missing and the app is broken. Fix this please.',
  'Boring content lately — same recycled posts every day. Unfollow incoming if this continues.',
  'Worst redesign I have seen in a while. Half the buttons are hidden and the workflow is so bad.',
  'Problem after problem with billing this month. Charged twice and still waiting on a refund.',
  'The video player keeps buffering and then crashes. Useless on mobile data. Very frustrating.',
  'Failed delivery again — my order arrived damaged and customer service never replied. Angry.',
  'Scam promo? The terms are misleading and the discount never applied at checkout. Avoid.',
  'Major issues with the new filter: it returns nothing and freezes the page. Almost unusable.',
  'Delayed by four days with zero updates. Poor communication, will not recommend this service.',
  'My campaign reached almost nobody this week. Something is broken — engagement completely flat.',
];

const NEUTRAL_TEXTS = [
  'Sharing our weekly product update: three fixes shipped and two features are now in testing.',
  'Reminder: the office will be closed on Monday. Normal support hours resume Tuesday morning.',
  'Here is how we organise our content calendar each quarter — thread with the full template. 1/3',
  'New report is live: monthly benchmark data for five industries is now available to download.',
  'We are hiring two open roles on the growth team. Full details and requirements in the link.',
  'Today at 5 PM IST we are hosting a webinar on attribution models. Register from our profile.',
  'Recap of today matches: strong first half, quieter second half. Full statistics in the comments.',
  'A/B test result: variant B got more clicks, variant A got more saves. Data in the dashboard.',
  'Update 2.4.1 is rolling out gradually over the next 48 hours — no action needed from users.',
  'Poll: which format do you prefer for weekly reports, PDF or live dashboard? Vote below.',
  'Our July numbers are in: steady reach, slightly fewer comments, more shares than June.',
  'Documentation refreshed with a new section on rate limits and pagination behaviour.',
];

/** Baseline engagement profile per platform (realistic variation, not identical). */
const PLATFORM_PROFILE = {
  Instagram: { likes: [420, 3600], comments: [0.03, 0.11], shares: [0.02, 0.08], reachMul: [7, 22] },
  Facebook: { likes: [180, 2400], comments: [0.04, 0.14], shares: [0.03, 0.12], reachMul: [6, 18] },
  X: { likes: [90, 1900], comments: [0.05, 0.16], shares: [0.04, 0.15], reachMul: [8, 26] },
  YouTube: { likes: [500, 5800], comments: [0.02, 0.09], shares: [0.01, 0.07], reachMul: [9, 30] },
  LinkedIn: { likes: [70, 1100], comments: [0.03, 0.12], shares: [0.03, 0.13], reachMul: [5, 16] },
  TikTok: { likes: [600, 7200], comments: [0.02, 0.10], shares: [0.05, 0.20], reachMul: [10, 35] },
  Reddit: { likes: [60, 1500], comments: [0.08, 0.25], shares: [0.02, 0.10], reachMul: [6, 20] },
  Pinterest: { likes: [40, 900], comments: [0.01, 0.06], shares: [0.05, 0.18], reachMul: [6, 18] },
  Snapchat: { likes: [30, 800], comments: [0.02, 0.08], shares: [0.02, 0.09], reachMul: [5, 15] },
  Threads: { likes: [50, 1300], comments: [0.04, 0.15], shares: [0.03, 0.12], reachMul: [6, 19] },
};

/**
 * Build the demo dataset.
 * @param {number} count how many posts (>= 100 per project spec)
 * @param {number} seed PRNG seed
 * @param {number} nowMs reference "now" so timestamps land in recent days
 */
export function generateSamplePosts(count = 120, seed = 1337, nowMs = Date.now()) {
  const rng = mulberry32(seed);
  const posts = [];
  const daysBack = 21;

  for (let i = 0; i < count; i += 1) {
    const platform = CONTENT_PLATFORMS[Math.floor(rng() * CONTENT_PLATFORMS.length)];

    // Sentiment mix ≈ 55% positive / 30% neutral / 15% negative
    const roll = rng();
    const texts = roll < 0.55 ? POSITIVE_TEXTS : roll < 0.85 ? NEUTRAL_TEXTS : NEGATIVE_TEXTS;
    const text = pick(rng, texts);

    // Spread timestamps uniformly across the last N days (even, natural cadence)
    const dayOffset = Math.floor(rng() * daysBack);
    const base = nowMs - dayOffset * 86400000;
    const d = new Date(base);
    d.setHours(randInt(rng, 7, 22), randInt(rng, 0, 59), randInt(rng, 0, 59), 0);
    // Never emit a future timestamp (today's posts are clamped to the past)
    if (d.getTime() > nowMs) d.setTime(nowMs - randInt(rng, 5, 360) * 60000);

    const profile = PLATFORM_PROFILE[platform];
    let likes = randInt(rng, profile.likes[0], profile.likes[1]);
    if (rng() < 0.08) likes = Math.round(likes * (2.5 + rng() * 3)); // occasional viral post
    const comments = Math.max(0, Math.round(likes * (profile.comments[0] + rng() * (profile.comments[1] - profile.comments[0]))));
    const shares = Math.max(0, Math.round(likes * (profile.shares[0] + rng() * (profile.shares[1] - profile.shares[0]))));

    // Every ~37th post has reach 0 → exercises safe division in KPIs
    const zeroReach = i % 37 === 13;
    const reach = zeroReach ? 0 : Math.max(likes + comments + shares, Math.round(likes * (profile.reachMul[0] + rng() * (profile.reachMul[1] - profile.reachMul[0]))));

    const sentiment = classifySentiment(text).label;

    posts.push({
      postId: `SP-${String(1001 + i)}`,
      timestamp: d.toISOString(),
      platform,
      text,
      likes,
      comments,
      shares,
      reach,
      sentiment,
      isSimulated: false,
      source: 'demo',
    });
  }

  // Newest first
  posts.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return posts;
}

/* ---------------------------------- */
/* Simulated live-feed posts          */
/* ---------------------------------- */

const SIM_TEMPLATES = [
  { bucket: 'Positive', text: 'Loving the new feature drop — this is a great quality-of-life change, amazing work!' },
  { bucket: 'Positive', text: 'Just tried the updated app: fast, clean and genuinely helpful. Highly recommend!' },
  { bucket: 'Positive', text: 'Our campaign hit a new record today. Fantastic results and a happy team!' },
  { bucket: 'Neutral', text: 'Quick update: we have published this week\'s report with reach and engagement breakdowns.' },
  { bucket: 'Neutral', text: 'Scheduling note — tomorrow\'s live session moves to 6 PM IST. Details on the page.' },
  { bucket: 'Neutral', text: 'New case study is up: how a small team grew engagement with a 3-post-per-week cadence.' },
  { bucket: 'Negative', text: 'Seeing constant crashes when opening the analytics tab. This is really frustrating and broken.' },
  { bucket: 'Negative', text: 'Support ticket open for 3 days with no reply. Terrible experience so far, very disappointed.' },
  { bucket: 'Negative', text: 'The latest post reached almost nobody — something feels wrong with distribution today.' },
  { bucket: 'Positive', text: 'Thanks for the detailed tutorial — very helpful for beginners. Saved as our go-to reference!' },
  { bucket: 'Neutral', text: 'Platform comparison numbers for this week are now available in the dashboard export.' },
  { bucket: 'Positive', text: 'Shout-out to the community: 1,000 followers today. Wonderful progress, grateful for the support!' },
];

/**
 * Create one synthetic post for the simulated feed.
 * ALWAYS flagged `isSimulated: true` — the UI labels these clearly.
 * Uses Math.random on purpose (unlike the seeded demo data).
 */
export function createSimulatedPost() {
  const template = pick(Math.random, SIM_TEMPLATES);
  const platform = CONTENT_PLATFORMS[Math.floor(Math.random() * CONTENT_PLATFORMS.length)];

  const likes = randIntFake(12, 900);
  const comments = randIntFake(0, Math.max(1, Math.round(likes * 0.12)));
  const shares = randIntFake(0, Math.max(1, Math.round(likes * 0.09)));
  const reach = Math.random() < 0.06 ? 0 : Math.max(likes + comments + shares, likes * randIntFake(6, 24));

  return {
    postId: `SIM-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e6).toString(36).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    platform,
    text: template.text,
    likes,
    comments,
    shares,
    reach: Math.round(reach),
    sentiment: classifySentiment(template.text).label,
    isSimulated: true,
    source: 'simulation',
  };
}

/* helper that works with plain Math.random (no seeded rng needed here) */
function randIntFake(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
