/**
 * Lightweight verification suite — run with:  npm run verify
 * Tests the pure logic layer (no browser needed): sentiment classifier,
 * analytics formulas, filters, CSV validation/export and the demo dataset.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';

import { classifySentiment, normalizeText } from '../src/utils/sentiment.js';
import {
  applyFilters,
  aggregateByDay,
  aggregateByPlatform,
  computeKpis,
  computePeriodComparison,
  engagementRateOf,
  engagementOf,
  sentimentBreakdown,
  sortPosts,
} from '../src/utils/analytics.js';
import {
  buildCanonicalTemplateCsv,
  buildSampleTemplateCsv,
  buildRecordsFromMapping,
  checkMappingCompleteness,
  detectColumnMapping,
  normalizeHeaderKey,
  normalizePlatform,
  recognizePlatform,
  parseCsvInput,
  postsToCsv,
  validateCsvRows,
} from '../src/utils/csv.js';
import { generateSamplePosts, createSimulatedPost } from '../src/data/samplePosts.js';
import { PLATFORMS } from '../src/utils/constants.js';
import * as fmt from '../src/utils/format.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

console.log('\n— Sentiment classifier —');

test('positive text classifies as Positive', () => {
  assert.equal(classifySentiment('I love this, it is amazing and great!').label, 'Positive');
});

test('negative text classifies as Negative', () => {
  assert.equal(classifySentiment('Terrible update, worst ever, so disappointed and angry.').label, 'Negative');
});

test('neutral text classifies as Neutral', () => {
  assert.equal(classifySentiment('The report is published on the website today.').label, 'Neutral');
});

test('tie between positive and negative → Neutral', () => {
  assert.equal(classifySentiment('good but bad').label, 'Neutral');
});

test('case and punctuation are ignored', () => {
  assert.equal(classifySentiment('AMAZING!!! great???').label, 'Positive');
  assert.equal(normalizeText('Wow — GREAT, really?') .includes('great'), true);
});

test('whole-token matching: "best" does not match "bestowed"', () => {
  const r = classifySentiment('The award was bestowed upon the team.');
  assert.equal(r.positive, 0);
  assert.equal(r.label, 'Neutral');
});

test('substring safety: "hate" not inside "Hathaway"', () => {
  assert.equal(classifySentiment('Starring Hathaway in the new film.').negative, 0);
});

test('phrase matching works', () => {
  assert.equal(classifySentiment('I would highly recommend this to anyone').positive >= 1, true);
  assert.equal(classifySentiment('what a waste of time, never again').negative >= 2, true);
});

test('empty / weird input does not crash', () => {
  assert.equal(classifySentiment('').label, 'Neutral');
  assert.equal(classifySentiment(null).label, 'Neutral');
  assert.equal(classifySentiment('!!!???***').label, 'Neutral');
});

console.log('\n— Analytics formulas —');

test('engagement = likes + comments + shares', () => {
  assert.equal(engagementOf({ likes: 10, comments: 5, shares: 2 }), 17);
});

test('engagement rate = engagement / reach × 100', () => {
  const r = engagementRateOf({ likes: 10, comments: 5, shares: 5, reach: 200 });
  assert.equal(r, 10); // 20/200 = 10%
});

test('zero reach → rate null (no division by zero)', () => {
  assert.equal(engagementRateOf({ likes: 5, comments: 0, shares: 0, reach: 0 }), null);
});

test('avg engagement rate excludes zero-reach posts', () => {
  const posts = [
    { likes: 10, comments: 0, shares: 0, reach: 100 }, // 10%
    { likes: 5, comments: 0, shares: 0, reach: 0 }, // excluded
    { likes: 20, comments: 0, shares: 0, reach: 200 }, // 10%
  ];
  const k = computeKpis(posts);
  assert.equal(k.avgEngagementRate, 10);
  assert.equal(k.ratedPosts, 2);
  assert.equal(k.totalReach, 300);
});

test('empty dataset → safe zero KPIs', () => {
  const k = computeKpis([]);
  assert.deepEqual(k, {
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalReach: 0,
    totalEngagement: 0,
    avgEngagementRate: 0,
    ratedPosts: 0,
  });
});

test('combined filters work together', () => {
  const posts = [
    { postId: 'A', timestamp: '2026-10-01T10:00:00Z', platform: 'Instagram', text: 'love it', likes: 1, comments: 0, shares: 0, reach: 10, sentiment: 'Positive' },
    { postId: 'B', timestamp: '2026-10-02T10:00:00Z', platform: 'X', text: 'bad stuff', likes: 1, comments: 0, shares: 0, reach: 10, sentiment: 'Negative' },
    { postId: 'C', timestamp: '2026-10-03T10:00:00Z', platform: 'Instagram', text: 'plain update', likes: 1, comments: 0, shares: 0, reach: 10, sentiment: 'Neutral' },
  ];
  const r = applyFilters(posts, { platform: 'Instagram', sentiment: 'Positive', search: 'love', dateFrom: '', dateTo: '' });
  assert.equal(r.length, 1);
  assert.equal(r[0].postId, 'A');

  const r2 = applyFilters(posts, { platform: 'All', sentiment: 'All', search: '', dateFrom: '2026-10-02', dateTo: '2026-10-03' });
  assert.equal(r2.length, 2);
});

test('posts with invalid timestamps are excluded by filters', () => {
  const posts = [{ postId: 'X', timestamp: 'not-a-date', platform: 'X', text: 't', likes: 1, comments: 0, shares: 0, reach: 1, sentiment: 'Neutral' }];
  assert.equal(applyFilters(posts, {}).length, 0);
});

test('aggregateByDay also sums reach per day', () => {
  const posts = [
    { postId: 'a', timestamp: '2026-10-01T10:00:00Z', platform: 'X', text: 't', likes: 1, comments: 0, shares: 0, reach: 100, sentiment: 'Neutral' },
    { postId: 'b', timestamp: '2026-10-01T23:00:00Z', platform: 'X', text: 't', likes: 2, comments: 0, shares: 0, reach: 50, sentiment: 'Neutral' },
  ];
  const rows = aggregateByDay(posts);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reach, 150);
});

test('aggregateByDay sums match input totals', () => {
  const posts = generateSamplePosts(60, 42);
  const days = aggregateByDay(posts);
  const sumLikes = days.reduce((s, d) => s + d.likes, 0);
  const sumPosts = days.reduce((s, d) => s + d.posts, 0);
  assert.equal(sumLikes, posts.reduce((s, p) => s + p.likes, 0));
  assert.equal(sumPosts, posts.length);
  // ascending order
  assert.deepEqual([...days].sort((a, b) => a.date.localeCompare(b.date)), days);
});

test('aggregateByPlatform zero-fills every supported platform (incl. Unknown)', () => {
  const posts = generateSamplePosts(50, 7);
  const rows = aggregateByPlatform(posts);
  assert.equal(rows.length, PLATFORMS.length);
  assert.ok(rows.every((r) => typeof r.engagement === 'number'));
  // demo data never uses Unknown — it is imported-data only
  assert.equal(rows.find((r) => r.platform === 'Unknown').posts, 0);
  // reach is carried per platform and sums to the dataset total
  const totalReach = rows.reduce((sum, r) => sum + r.reach, 0);
  assert.equal(totalReach, posts.reduce((sum, p) => sum + p.reach, 0));
});

test('sentiment breakdown percentages add up to 100', () => {
  const b = sentimentBreakdown(generateSamplePosts(80, 3));
  const total = b.percentages.Positive + b.percentages.Neutral + b.percentages.Negative;
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('sortPosts sorts by rate and keeps null rates last', () => {
  const posts = [
    { postId: 'a', likes: 50, comments: 0, shares: 0, reach: 100 }, // 50%
    { postId: 'b', likes: 10, comments: 0, shares: 0, reach: 0 }, // null
    { postId: 'c', likes: 5, comments: 0, shares: 0, reach: 100 }, // 5%
  ];
  const sorted = sortPosts(posts, 'rate', 'desc');
  assert.equal(sorted[0].postId, 'a');
  assert.equal(sorted[1].postId, 'c');
  assert.equal(sorted[2].postId, 'b');
});

test('period comparison returns null without previous-period data', () => {
  const posts = generateSamplePosts(30, 11);
  const recent = posts.slice(0, 5);
  const filters = {
    dateFrom: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
  };
  const cmp = computePeriodComparison(recent, filters);
  // previous window likely empty for recent-only slice → null
  assert.ok(cmp === null || typeof cmp.deltas.totalPosts === 'number');
});

test('period comparison produces deltas when data spans periods', () => {
  const posts = generateSamplePosts(120, 1337); // 21 days of data
  const cmp = computePeriodComparison(posts, { dateFrom: '', dateTo: '' });
  assert.ok(cmp !== null);
  assert.equal(cmp.previous.totalPosts > 0, true);
  assert.ok('totalReach' in cmp.deltas);
});

console.log('\n— Period deltas —');

test('formatDelta computes % change between two windows', () => {
  const { formatDelta } = fmt;
  assert.equal(formatDelta(69, 51), '+35.3%');
  assert.equal(formatDelta(50, 100), '-50.0%');
});

test('formatDelta is null without enough data (zero/undefined)', () => {
  const { formatDelta } = fmt;
  assert.equal(formatDelta(100, 0), null);
  assert.equal(formatDelta(undefined, undefined), null);
  assert.equal(formatDelta(50, null), null);
});

test('comparison deltas compare window vs window, not total vs window', () => {
  const posts = generateSamplePosts(120, 1337);
  const cmp = computePeriodComparison(posts, { dateFrom: '', dateTo: '', platform: 'All', sentiment: 'All', search: '' });
  const expected = ((cmp.current.totalPosts - cmp.previous.totalPosts) / cmp.previous.totalPosts) * 100;
  assert.ok(Math.abs(cmp.deltas.totalPosts - expected) < 1e-9);
  // sanity: delta must be based on the two window sizes (sum = total posts)
  assert.equal(cmp.current.totalPosts + cmp.previous.totalPosts, posts.length);
});

console.log('\n— Flexible schemas & defaults —');

test('missing optional columns import with documented defaults', () => {
  const { mapping } = detectColumnMapping(['content', 'likes']);
  const rows = [
    { content: 'Great new feature roll-out today', likes: '42' },
    { content: 'Server issues again, very bad', likes: '7' },
  ];
  const r = buildRecordsFromMapping(rows, mapping);
  assert.equal(r.records.length, 2);
  assert.equal(r.errors.length, 0);
  // defaults are counted, never silent
  assert.equal(r.defaultedFields.timestamp, 2);
  assert.equal(r.defaultedFields.platform, 2);
  assert.equal(r.defaultedFields.comments, 2);
  assert.equal(r.defaultedFields.shares, 2);
  assert.equal(r.defaultedFields.reach, 2);
  assert.equal(r.generatedIds, 2);
  // values really are defaults, not invented measurements
  assert.ok(r.records.every((p) => p.platform === 'Unknown'));
  assert.ok(r.records.every((p) => p.comments === 0 && p.reach === 0));
  assert.ok(r.records.every((p) => p.likes > 0)); // mapped column = real value
  assert.ok(r.records.every((p) => !Number.isNaN(Date.parse(p.timestamp)))); // generated timestamps valid
});

test('manual mapping can assign any column (description → text)', () => {
  const rows = [
    { date_of_post: '2026-10-08T08:00:00Z', blurb: 'Manual mapping works well, very helpful', points: '55' },
  ];
  // no auto-detection succeeds for these headers…
  const auto = detectColumnMapping(Object.keys(rows[0]));
  assert.equal(auto.mapping.text, null);
  // …but an explicit mapping validates fine
  const r = buildRecordsFromMapping(rows, {
    postId: null,
    timestamp: 'date_of_post',
    platform: null,
    text: 'blurb',
    likes: 'points',
    comments: null,
    shares: null,
    reach: null,
  });
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].text, 'Manual mapping works well, very helpful');
  assert.equal(r.records[0].likes, 55);
  assert.equal(r.records[0].sentiment, 'Positive'); // "helpful" matches the lexicon
});

test('metric formats: thousands separators and decimals accepted, negatives rejected', () => {
  const { mapping } = detectColumnMapping(['text', 'likes', 'comments', 'shares', 'reach']);
  const ok = buildRecordsFromMapping(
    [{ text: 'a', likes: '1,200', comments: '12.5', shares: '3', reach: '9,000' }],
    mapping,
  );
  assert.equal(ok.records.length, 1);
  assert.equal(ok.records[0].likes, 1200);
  assert.equal(ok.records[0].comments, 12.5);
  assert.equal(ok.records[0].reach, 9000);
  const bad = buildRecordsFromMapping(
    [{ text: 'a', likes: '-5', comments: 'abc', shares: '', reach: '12x' }],
    mapping,
  );
  assert.equal(bad.records.length, 0);
  assert.equal(bad.errors.length, 3);
});

test('unknown platform value imports as Unknown with a row warning', () => {
  const { mapping } = detectColumnMapping(['text', 'platform']);
  const r = buildRecordsFromMapping([{ text: 'hello', platform: 'mars-network' }], mapping);
  assert.equal(r.records.length, 1);
  assert.equal(r.records[0].platform, 'Unknown');
  assert.equal(r.warnings.length, 1);
  assert.ok(r.warnings[0].message.includes('mars-network'));
});

test('recognised platforms (TikTok/Reddit) import without Unknown warnings', () => {
  const { mapping } = detectColumnMapping(['text', 'platform']);
  const r = buildRecordsFromMapping(
    [
      { text: 'dance challenge upload', platform: 'TikTok' },
      { text: 'subreddit discussion thread', platform: 'reddit' },
      { text: 'old bird app post', platform: 'Twitter.com' },
    ],
    mapping,
  );
  assert.equal(r.records.length, 3);
  assert.equal(r.warnings.length, 0);
  assert.deepEqual(r.records.map((p) => p.platform), ['TikTok', 'Reddit', 'X']);
});

test('unmapped columns are preserved as record metadata', () => {
  const { mapping } = detectColumnMapping(['text', 'likes', 'author', 'language']);
  const r = buildRecordsFromMapping([{ text: 'hi', likes: '1', author: 'sm', language: 'en' }], mapping);
  assert.equal(r.records.length, 1);
  assert.deepEqual(r.records[0].meta, { author: 'sm', language: 'en' });
  // mapped columns are real values — only unmapped ones are flagged as defaults
  assert.equal(r.defaultedFields.likes, undefined);
  assert.equal(r.defaultedFields.text, undefined);
  assert.equal(r.defaultedFields.platform, 1);
  assert.equal(r.defaultedFields.comments, 1);
});

test('empty rows are ignored, not treated as errors', () => {
  const { mapping } = detectColumnMapping(['text', 'likes']);
  const r = buildRecordsFromMapping([{ text: 'x', likes: '1' }, { text: '', likes: '' }], mapping);
  assert.equal(r.records.length, 1);
  assert.equal(r.errors.length, 0);
  assert.equal(r.emptyRows, 1);
});

test('canonical template: exact headers, 25 rows, unique ids, valid dates', () => {
  const csv = buildCanonicalTemplateCsv(25);
  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines[0].replace(/\r$/, ''), 'post_id,timestamp,platform,text,likes,comments,shares,reach');
  assert.equal(lines.length - 1, 25);
  const parsed = Papa.parse(csv, { header: true });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.length, 25);
  const ids = parsed.data.map((r) => r.post_id);
  assert.equal(new Set(ids).size, 25);
  assert.ok(parsed.data.every((r) => !Number.isNaN(Date.parse(r.timestamp))));
  assert.ok(parsed.data.every((r) => Number(r.likes) >= 0 && Number(r.reach) >= 0));
  // several platforms represented
  assert.ok(new Set(parsed.data.map((r) => r.platform)).size >= 3);
  // escaping survives: at least one text with a comma/quote round-trips
  assert.ok(parsed.data.some((r) => r.text.includes(',') || r.text.includes('"')));
  // deterministic: byte-identical on every call (fixed seed + fixed base time)
  assert.equal(buildCanonicalTemplateCsv(25), csv);
  // and identical to the static copy shipped in public/
  const staticCsv = fs.readFileSync(new URL('../public/socialpulse-sample-template.csv', import.meta.url), 'utf8');
  assert.equal(staticCsv.replace(/^\uFEFF/, ''), csv);
});

test('parseCsvInput rejects a single-column (delimiter) file with a clear error', async () => {
  const res = await parseCsvInput('one_column_only\nvalue1\nvalue2');
  assert.ok(res.error && res.error.toLowerCase().includes('separator'));
});

test('parseCsvInput strips BOM and trims headers without touching row data', async () => {
  const res = await parseCsvInput('\uFEFF text , likes \n"hello, ""world""", 5');
  assert.equal(res.error, null);
  assert.deepEqual(res.fields, ['text', 'likes']);
  assert.equal(res.rows[0].text, 'hello, "world"');
});

console.log('\n— Demo dataset —');

test('generates ≥ 100 posts with unique IDs', () => {
  const posts = generateSamplePosts(120);
  assert.ok(posts.length >= 100);
  assert.equal(new Set(posts.map((p) => p.postId)).size, posts.length);
});

test('all demo platforms present with valid values', () => {
  const posts = generateSamplePosts(120);
  const platforms = new Set(posts.map((p) => p.platform));
  assert.equal(platforms.size, PLATFORMS.length - 1); // every real platform, never Unknown
  for (const p of posts) {
    assert.ok(p.likes >= 0 && p.comments >= 0 && p.shares >= 0 && p.reach >= 0);
    assert.ok(!Number.isNaN(Date.parse(p.timestamp)));
    assert.ok(['Positive', 'Neutral', 'Negative'].includes(p.sentiment));
    assert.equal(p.source, 'demo');
  }
});

test('realistic variation (not identical rows)', () => {
  const posts = generateSamplePosts(120);
  const uniqueTexts = new Set(posts.map((p) => p.text));
  const uniqueLikes = new Set(posts.map((p) => p.likes));
  assert.ok(uniqueTexts.size > 20, `only ${uniqueTexts.size} unique texts`);
  assert.ok(uniqueLikes.size > 80, `only ${uniqueLikes.size} unique like counts`);
});

test('contains at least one zero-reach post (edge-case coverage)', () => {
  const posts = generateSamplePosts(120);
  assert.ok(posts.some((p) => p.reach === 0));
});

test('simulated post is flagged and classified', () => {
  const p = createSimulatedPost();
  assert.equal(p.source, 'simulation');
  assert.equal(p.isSimulated, true);
  assert.ok(p.postId.startsWith('SIM-'));
  assert.ok(['Positive', 'Neutral', 'Negative'].includes(p.sentiment));
});

console.log('\n— CSV validation / export —');

test('normalises platform aliases', () => {
  assert.equal(normalizePlatform('fb'), 'Facebook');
  assert.equal(normalizePlatform(' Twitter '), 'X');
  assert.equal(normalizePlatform('INSTAGRAM'), 'Instagram');
  assert.equal(normalizePlatform('tiktok'), 'TikTok'); // now a supported platform
  assert.equal(normalizePlatform('reddit'), 'Reddit');
});

test('normalizePlatform maps every required spelling (case/punct insensitive)', () => {
  const expect = {
    Instagram: ['Instagram', 'instagram', 'INSTAGRAM', 'Instagram.com'],
    Facebook: ['Facebook', 'facebook', 'FACEBOOK', 'Facebook.com'],
    TikTok: ['TikTok', 'tiktok', 'TIKTOK', 'Tik Tok', 'tik-tok', 'TikTok.com'],
    YouTube: ['YouTube', 'youtube', 'YOUTUBE', 'YouTube.com'],
    LinkedIn: ['LinkedIn', 'linkedin', 'LINKEDIN', 'LinkedIn.com'],
    X: ['X', 'x', 'X.com', 'Twitter', 'twitter', 'TWITTER', 'Twitter.com'],
    Reddit: ['Reddit', 'reddit', 'REDDIT', 'Reddit.com'],
    Pinterest: ['Pinterest', 'pinterest', 'PINTEREST'],
    Snapchat: ['snapchat', 'SNAPCHAT'],
    Threads: ['threads', 'THREADS'],
  };
  for (const [canonical, spellings] of Object.entries(expect)) {
    for (const spelling of spellings) {
      assert.equal(normalizePlatform(spelling), canonical, `"${spelling}" should map to ${canonical}`);
    }
  }
});

test('normalizePlatform: only genuinely unknown values become Unknown', () => {
  assert.equal(normalizePlatform('mars'), 'Unknown');
  assert.equal(normalizePlatform('my-space'), 'Unknown');
  // recognizePlatform exposes the raw recognition (null = unrecognised)
  assert.equal(recognizePlatform('mars'), null);
  assert.equal(recognizePlatform('TikTok'), 'TikTok');
  assert.equal(recognizePlatform('Reddit'), 'Reddit');
  // recognised platforms are never Unknown
  assert.notEqual(normalizePlatform('TikTok'), 'Unknown');
  assert.notEqual(normalizePlatform('Reddit'), 'Unknown');
});

test('normalizeHeaderKey strips BOM, case, spaces, underscores and hyphens', () => {
  assert.equal(normalizeHeaderKey('\uFEFFPost ID'), 'postid');
  assert.equal(normalizeHeaderKey('Like Count'), 'likecount');
  assert.equal(normalizeHeaderKey('created-at'), 'createdat');
  assert.equal(normalizeHeaderKey('  DATE_TIME  '), 'datetime');
});

test('detectColumnMapping maps synonym headers to canonical fields', () => {
  const fields = ['ID', 'Date', 'Source', 'Content', 'Like Count', 'Comment Count', 'Share Count', 'Impressions'];
  const { mapping, unmatched } = detectColumnMapping(fields);
  assert.equal(mapping.postId, 'ID');
  assert.equal(mapping.timestamp, 'Date');
  assert.equal(mapping.platform, 'Source');
  assert.equal(mapping.text, 'Content');
  assert.equal(mapping.likes, 'Like Count');
  assert.equal(mapping.comments, 'Comment Count');
  assert.equal(mapping.shares, 'Share Count');
  assert.equal(mapping.reach, 'Impressions');
  assert.equal(unmatched.length, 0);
});

test('detectColumnMapping prefers exact canonical name and reports ambiguity', () => {
  const { mapping, ambiguities } = detectColumnMapping(['date', 'created_at', 'timestamp', 'text']);
  assert.equal(mapping.timestamp, 'timestamp'); // exact canonical wins
  assert.ok(ambiguities.timestamp.includes('date') && ambiguities.timestamp.includes('created_at'));
});

test('unrecognised columns stay unmapped (manual mapping possible)', () => {
  const { mapping, unmatched } = detectColumnMapping(['date_of_post', 'blurb', 'points']);
  assert.equal(mapping.text, null);
  assert.equal(mapping.timestamp, null);
  assert.deepEqual(unmatched, ['date_of_post', 'blurb', 'points']);
});

test('import gate: text required unless id + another meaningful field', () => {
  assert.equal(checkMappingCompleteness({ text: 'content' }).ok, true);
  assert.equal(checkMappingCompleteness({ postId: 'id', likes: 'likes' }).ok, true);
  assert.equal(checkMappingCompleteness({ postId: 'id' }).ok, false);
  assert.equal(checkMappingCompleteness({ likes: 'likes' }).ok, false);
  assert.equal(checkMappingCompleteness({}).reason, 'no-content');
});

test('valid rows import, generated IDs created when missing', () => {
  const rows = [
    { post_id: '', timestamp: '2026-10-01T12:00:00Z', platform: 'instagram', text: 'hello, "world" — quoted', likes: '5', comments: '1', shares: '0', reach: '100' },
    { post_id: 'P2', timestamp: '2026-10-02', platform: 'fb', text: 'second', likes: '10', comments: '2', shares: '1', reach: '200' },
  ];
  const r = validateCsvRows(rows);
  assert.equal(r.records.length, 2);
  assert.equal(r.generatedIds, 1);
  assert.equal(r.records[0].platform, 'Instagram');
  assert.equal(r.records[1].platform, 'Facebook');
  assert.ok(r.records[0].text.includes('"world"'));
});

test('invalid rows are reported without crashing; unknown platform → Unknown + warning', () => {
  const rows = [
    { post_id: 'a', timestamp: 'not-a-date', platform: 'X', text: 't', likes: 1, comments: 0, shares: 0, reach: 10 },
    { post_id: 'b', timestamp: '2026-10-01', platform: 'mars', text: 't', likes: 1, comments: 0, shares: 0, reach: 10 },
    { post_id: 'c', timestamp: '2026-10-01', platform: 'X', text: 't', likes: '-5', comments: 0, shares: 0, reach: 10 },
    { post_id: 'd', timestamp: '2026-10-01', platform: 'X', text: 't', likes: 'abc', comments: 0, shares: 0, reach: 10 },
    { post_id: 'e', timestamp: '2026-10-01', platform: 'X', text: '', likes: 1, comments: 0, shares: 0, reach: 10 },
    { post_id: 'f', timestamp: '2026-10-01T10:00:00Z', platform: 'X', text: 'fine', likes: 1, comments: 0, shares: 0, reach: 10 },
  ];
  const r = validateCsvRows(rows);
  // 'mars' is imported as Unknown with a warning instead of being rejected
  assert.equal(r.records.length, 2);
  assert.equal(r.records.find((p) => p.postId === 'b').platform, 'Unknown');
  assert.equal(r.errors.length, 4);
  assert.ok(r.warnings.some((w) => w.row === 3 && w.message.includes('mars')));
  assert.ok(r.errors.every((e) => typeof e.row === 'number' && e.row >= 2));
});

test('duplicate post_id within file → skipped + reported', () => {
  const row = { post_id: 'DUP', timestamp: '2026-10-01', platform: 'X', text: 't', likes: 1, comments: 0, shares: 0, reach: 10 };
  const r = validateCsvRows([row, { ...row }, { ...row }]);
  assert.equal(r.records.length, 1);
  assert.equal(r.duplicateIds, 2);
});

test('duplicate vs existing dataset IDs are detected', () => {
  const r = validateCsvRows(
    [{ post_id: 'OLD', timestamp: '2026-10-01', platform: 'X', text: 't', likes: 1, comments: 0, shares: 0, reach: 10 }],
    { existingIds: new Set(['OLD']) },
  );
  assert.equal(r.records.length, 0);
  assert.equal(r.duplicateIds, 1);
});

test('CSV round-trip preserves commas and quotation marks', () => {
  const posts = [
    {
      postId: 'RT-1',
      timestamp: '2026-10-01T10:30:00.000Z',
      platform: 'X',
      text: 'He said "hi", then left — with a comma, yes.',
      likes: 3,
      comments: 2,
      shares: 1,
      reach: 99,
      sentiment: 'Neutral',
      source: 'import',
    },
  ];
  const csv = postsToCsv(posts);
  const parsed = Papa.parse(csv, { header: true });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data[0].text, posts[0].text);
  assert.equal(parsed.data[0].post_id, 'RT-1');
  assert.equal(parsed.data[0].reach, '99');
});

test('sample template has ≥ 20 records with correct header', () => {
  const csv = buildSampleTemplateCsv(generateSamplePosts(120), 25);
  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines[0].replace(/\r$/, ''), 'post_id,timestamp,platform,text,likes,comments,shares,reach');
  assert.equal(lines.length - 1, 25);
});

test('template works even when headers-only edge (empty input array)', () => {
  const csv = buildSampleTemplateCsv([], 25);
  assert.ok(csv.includes('post_id'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
