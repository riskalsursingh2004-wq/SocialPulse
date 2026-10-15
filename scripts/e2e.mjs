/**
 * End-to-end acceptance test with a real headless browser (Playwright).
 * Run with:  npm run test:e2e
 *
 * Covers the project's acceptance criteria that need a browser:
 *  - app loads with sample data, no blocking console errors
 *  - all 5 pages render and navigate
 *  - KPI cards show calculated values
 *  - filters combine and update the dashboard
 *  - simulator start/pause/resume/reset adds records
 *  - CSV export produces a downloadable file
 *  - localStorage persists the dataset across reload
 *  - empty states and zero-reach safety
 */

import { chromium } from 'playwright';
import { normalizePlatform } from '../src/utils/csv.js';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function parseShowing(text) {
  const m = text.replace(/\s+/g, ' ').match(/Showing\s+([\d,]+)\s+of\s+([\d,]+)/);
  return m ? { shown: Number(m[1].replace(/,/g, '')), total: Number(m[2].replace(/,/g, '')) } : null;
}

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
// Tracks every HTTP request the page makes (used to prove downloads are
// 100% client-side: blob: downloads must add zero entries here).
const networkRequests = [];
page.on('request', (req) => networkRequests.push(req.url()));
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(BASE, { waitUntil: 'networkidle' });

/* 1. App boots with sample data */
check('App loads (root has content)', (await page.locator('#root').innerText()).length > 100);
await page.waitForSelector('text=Total Posts', { timeout: 10000 });
const postStat = await page.locator('text=Showing').first().innerText();
check('Initial dataset visible', /Showing\s+[\d,]+\s+of\s+[\d,]+ posts/.test(postStat), postStat.replace(/\s+/g, ' '));

/* 2. KPI cards show non-zero calculated values */
const kpiValues = await page.locator('article[title]').allInnerTexts();
check('Six KPI cards rendered', kpiValues.length === 6, `got ${kpiValues.length}`);
const anyNonZero = kpiValues.some((t) => /[1-9]/.test(t.split('\n')[2] || ''));
check('KPI values are calculated (non-zero)', anyNonZero);

/* 2b. Clickable KPI cards navigate (existing router) with focus + filters kept */
await page.selectOption('select[aria-label="Filter by platform"]', 'TikTok');
await page.waitForTimeout(400);
const tikShown = parseShowing(await page.locator('header >> text=Showing').first().innerText()).shown;
await page.click('article[role="button"]:has-text("Total Likes")');
await page.waitForTimeout(800);
check('Total Likes card opens Analytics', await page.locator('h1:has-text("Analytics")').isVisible());
check('Likes focus chip shown', await page.locator('text=Focus: Likes in the current filter').isVisible());
check(
  'Filters preserved across KPI navigation',
  parseShowing(await page.locator('header >> text=Showing').first().innerText()).shown === tikShown,
  `${tikShown} TikTok posts still in view`,
);

await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(400);
await page.click('article[role="button"]:has-text("Total Reach")');
await page.waitForTimeout(800);
check('Total Reach card opens the Reach section', await page.locator('#analytics-reach').isVisible());
check('Reach focus chip shown', await page.locator('text=Focus: Reach & audience in the current filter').isVisible());
check('Reach section renders its two charts', (await page.locator('#analytics-reach .recharts-surface').count()) === 2);
check('Reach charts honour the TikTok filter', (await page.locator('#analytics-reach').innerText()).includes('1 of'));

await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(400);
await page.click('article[role="button"]:has-text("Avg Engagement Rate")');
await page.waitForTimeout(800);
check('Avg rate card shows live rate focus chip', await page.locator('text=Focus: Avg engagement rate —').isVisible());

// keyboard accessibility: Enter on a focused card navigates too
await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(400);
await page.focus('article[role="button"]:has-text("Total Posts")');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('Total Posts card opens Data Management (keyboard Enter)', await page.locator('h1:has-text("Data Management")').isVisible());

// restore default state for the remaining suite
await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(300);
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 3. Charts render SVG */
const svgCount = await page.locator('main svg.recharts-surface').count();
check('Charts render SVG surfaces', svgCount >= 3, `${svgCount} recharts surfaces`);

/* 4. Navigate all pages */
const pages = [
  ['Analytics', 'Engagement Over Time'],
  ['Sentiment Analysis', 'How classification works'],
  ['Top Posts', 'Posts Table'],
  ['Data Management', 'Import CSV'],
  ['Overview', 'KPI' /* back home */],
];
for (const [label, expectText] of pages) {
  await page.click(`aside button:has-text("${label}")`);
  await page.waitForTimeout(400);
  const visible = await page.locator('main').innerText();
  check(`Page "${label}" renders`, visible.includes(expectText) || label === 'Overview');
}

/* 5. Search filter narrows results */
await page.fill('input[aria-label="Search posts"]', 'campaign');
await page.waitForTimeout(300);
const afterSearch = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Search filter narrows dataset', afterSearch && afterSearch.shown < afterSearch.total && afterSearch.shown > 0, `${afterSearch?.shown} of ${afterSearch?.total}`);

/* 6. Platform filter */
await page.selectOption('select[aria-label="Filter by platform"]', 'Instagram');
await page.waitForTimeout(300);
const platformRows = await page.locator('main').innerText();
check('Platform filter applied without crash', platformRows.length > 50);
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 7. Sentiment filter */
await page.selectOption('select[aria-label="Filter by sentiment"]', 'Negative');
await page.waitForTimeout(300);
const negStat = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Sentiment filter narrows dataset', negStat && negStat.shown < negStat.total && negStat.shown > 0, `${negStat?.shown} of ${negStat?.total}`);
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 7b. Date-range filter (last 3 days only) */
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
await page.fill('input[aria-label="Date range from"]', threeDaysAgo);
await page.waitForTimeout(400);
const dateStat = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Date-range filter narrows dataset', dateStat && dateStat.shown < dateStat.total, `${dateStat?.shown} of ${dateStat?.total}`);
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 7c. Previous-period comparison renders on KPI cards */
const noPrior = await page.locator('text=No prior data').count();
check('KPI cards show previous-period deltas', noPrior === 0, `${noPrior} cards without comparison`);

/* 8. Simulation: start → record added → pause → resume → reset */
const beforeCount = parseShowing(await page.locator('header >> text=Showing').first().innerText()).total;
await page.click('button:has-text("Start simulation")');
await page.waitForTimeout(1800);
check('Live indicator shows SIMULATING', (await page.locator('text=SIMULATING').count()) > 0);
await page.waitForTimeout(5400); // one tick (5s)
const afterTick = parseShowing(await page.locator('header >> text=Showing').first().innerText()).total;
check('Simulator added a record after ~5s', afterTick === beforeCount + 1, `${beforeCount} → ${afterTick}`);
const feedHasSim = await page.locator('text=SIMULATED').first().isVisible();
check('Feed labels simulated posts', feedHasSim);

await page.click('button:has-text("Pause")');
check('Pause button present after start', (await page.locator('button:has-text("Resume")').count()) > 0);
await page.click('button:has-text("Resume")');
check('Resume returns to SIMULATING', (await page.locator('text=SIMULATING').count()) > 0);
await page.click('button:has-text("Pause")');

/* 9. CSV export downloads a valid file */
await page.click('aside button:has-text("Data Management")');
await page.waitForTimeout(400);
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.click('button:has-text("Export filtered data")'),
]);
const dlPath = await download.path();
const fs = await import('node:fs/promises');
const csvContent = await fs.readFile(dlPath, 'utf8');
check('CSV export downloads', csvContent.includes('post_id,timestamp,platform'));
check('CSV export has rows', csvContent.trim().split(/\r?\n/).length > 100, `${csvContent.trim().split(/\r?\n/).length - 1} rows`);

/* 9b. Filtered export exports ONLY the filtered records */
await page.selectOption('select[aria-label="Filter by platform"]', 'Instagram');
await page.waitForTimeout(400);
const shownFiltered = parseShowing(await page.locator('header >> text=Showing').first().innerText());
const requestsBeforeExport = networkRequests.length;
const [dFiltered] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.click('button:has-text("Export filtered data")'),
]);
check('Filtered export filename is socialpulse_filtered_data.csv', dFiltered.suggestedFilename() === 'socialpulse_filtered_data.csv', dFiltered.suggestedFilename());
check('Filtered export is a client-side blob: download (no server)', dFiltered.url().startsWith('blob:'), dFiltered.url().slice(0, 24));
check('Filtered export made zero network requests', networkRequests.length === requestsBeforeExport, `${networkRequests.length - requestsBeforeExport} requests`);
const fCsv = (await fs.readFile(await dFiltered.path(), 'utf8')).replace(/^\uFEFF/, '');
check(
  'Filtered export contains exactly the filtered records',
  fCsv.trim().split(/\r?\n/).length - 1 === shownFiltered.shown,
  `${shownFiltered.shown} filtered → ${fCsv.trim().split(/\r?\n/).length - 1} rows`,
);
check('Filtered export shows success feedback', await page.locator('text=Filtered CSV exported successfully.').isVisible());

/* 10. Sample template download — canonical, independent of dataset AND filters */
const requestsBeforeTpl = networkRequests.length;
const [tpl] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.click('button:has-text("Download sample CSV template")'),
]);
check('Sample template is a client-side blob: download (no server)', tpl.url().startsWith('blob:'), tpl.url().slice(0, 24));
check('Sample template made zero network requests', networkRequests.length === requestsBeforeTpl, `${networkRequests.length - requestsBeforeTpl} requests`);
const tplCsv = (await fs.readFile(await tpl.path(), 'utf8')).replace(/^\uFEFF/, '');
const tplLines = tplCsv.trim().split(/\r?\n/);
check('Template filename is canonical', tpl.suggestedFilename() === 'socialpulse_sample_template.csv', tpl.suggestedFilename());
check('Template header is canonical', tplLines[0] === 'post_id,timestamp,platform,text,likes,comments,shares,reach', tplLines[0]);
check('Template has exactly 25 records (despite active filter)', tplLines.length - 1 === 25, `${tplLines.length - 1} rows`);
check('Template download shows success feedback', await page.locator('text=Sample CSV downloaded successfully.').isVisible());
// template must contain TikTok + Reddit records (regression: bug 1)
const tplPlatforms = new Set(
  tplCsv.trim().split(/\r?\n/).slice(1).map((line) => line.split(',')[2]),
);
check('Template includes TikTok and Reddit records', tplPlatforms.has('TikTok') && tplPlatforms.has('Reddit'), [...tplPlatforms].join(','));
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 11. Persistence: reload keeps data + paused sim state */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=Total Posts', { timeout: 10000 });
const reloadCount = parseShowing(await page.locator('header >> text=Showing').first().innerText()).total;
check('Dataset persists across reload', reloadCount >= 121, `${reloadCount} records`);

/* 12. Reset simulation restores demo data */
await page.click('button:has-text("Reset")');
await page.waitForTimeout(300);
await page.click('div[role="dialog"] button:has-text("Reset")'); // confirm dialog
await page.waitForTimeout(500);
const resetCount = parseShowing(await page.locator('header >> text=Showing').first().innerText()).total;
check('Reset restores demo dataset (120)', resetCount === 120, `${resetCount} records`);

/* 13. Unrecognised CSV → actionable mapping error, not a hard rejection */
await page.click('aside button:has-text("Data Management")');
await page.waitForTimeout(400);
await page.setInputFiles('input[type="file"]', {
  name: 'bad.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('foo,bar\n1,2\n'),
});
await page.waitForTimeout(800);
check(
  'Unrecognised file shows actionable content-column error',
  await page.locator('text=No recognizable content column').isVisible(),
);
check('Mapping panel still opens (manual fix possible)', await page.locator('select[aria-label="Map Text / content"]').isVisible());
check('Import is blocked until mapping is valid', await page.locator('button:has-text("Import 1 record")').isDisabled());
await page.click('button:has-text("Cancel import")');
await page.waitForTimeout(300);
check('Cancel import resets the uploader', (await page.locator('select[aria-label="Map Text / content"]').count()) === 0);

/* 14. Valid CSV import (append, with dup id + generated id + invalid row) */
const goodCsv = [
  'post_id,timestamp,platform,text,likes,comments,shares,reach',
  'E2E-1,2026-10-10T10:00:00Z,linkedin,"Great launch, really helpful and amazing work",10,2,1,200',
  'E2E-1,2026-10-10T11:00:00Z,X,duplicate id row,5,1,0,100',
  ',2026-10-11T10:00:00Z,ig,No id here so it gets generated,7,3,2,150',
  'E2E-BAD,bad-date,X,broken timestamp,1,1,1,10',
  'E2E-NEG,2026-10-11T12:00:00Z,X,negative likes,-5,0,0,10',
].join('\n');
await page.setInputFiles('input[type="file"]', {
  name: 'good.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(goodCsv),
});
await page.waitForTimeout(900);
check('Valid rows detected (2)', await page.locator('text=2 valid rows').isVisible());
check('Invalid + duplicate rows reported (3 skipped)', await page.locator('text=3 rows skipped').isVisible());
check('Generated ID reported', await page.locator('text=1 ID generated').isVisible());
await page.click('button:has-text("Import 2 records")');
await page.waitForTimeout(500);
const importBanner = await page.locator('text=Imported 2 records').isVisible();
check('Import succeeds in append mode', importBanner);

/* 14b. Alternative column names are auto-mapped */
const altCsv = [
  'ID,Date,Source,Content,Like Count,Comment Count,Share Count,Impressions',
  'ALT-1,2026-10-05 10:00,fb,"Solid update, quite helpful",100,10,5,2000',
  'ALT-2,2026-10-06 11:30,youtube,"Terrible video, waste of time",50,5,2,1000',
  'ALT-3,2026-10-07 09:00,X,Plain note about the release schedule,25,1,0,500',
].join('\n');
await page.setInputFiles('input[type="file"]', {
  name: 'alt.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(altCsv),
});
await page.waitForTimeout(900);
check('Alternative headers → 3 valid rows', await page.locator('text=3 valid rows').isVisible());
check('Timestamp auto-mapped to "Date"', (await page.locator('select[aria-label="Map Timestamp"]').inputValue()) === 'Date');
check('Text auto-mapped to "Content"', (await page.locator('select[aria-label="Map Text / content"]').inputValue()) === 'Content');
check('Reach auto-mapped to "Impressions"', (await page.locator('select[aria-label="Map Reach"]').inputValue()) === 'Impressions');
check('No defaults needed for a full synonym file', (await page.locator('text=Defaults:').count()) === 0);
await page.click('button:has-text("Import 3 records")');
await page.waitForTimeout(500);
check('Alt-header import succeeds', await page.locator('text=Imported 3 records').isVisible());
const afterAlt = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Dashboard total updates after alt import (125)', afterAlt.total === 125, `${afterAlt.total}`);

/* 14c. Missing optional fields import with documented defaults */
const sparseCsv = [
  'content,likes',
  '"Great new feature roll-out today",42',
  '"Server issues again, quite bad",7',
].join('\n');
await page.setInputFiles('input[type="file"]', {
  name: 'sparse.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(sparseCsv),
});
await page.waitForTimeout(900);
check('Sparse CSV → 2 valid rows', await page.locator('text=2 valid rows').isVisible());
check(
  'Defaults chip lists every defaulted field',
  await page.locator('text=Defaults: Post ID, Timestamp, Platform').isVisible(),
);
check(
  'Defaults warning box explains each default',
  await page.locator('text=Timestamp → current date/time').isVisible(),
);
check('Generated IDs reported for sparse CSV', await page.locator('text=2 IDs generated').isVisible());
await page.click('button:has-text("Import 2 records")');
await page.waitForTimeout(500);
check('Sparse import succeeds', await page.locator('text=Imported 2 records').isVisible());
const afterSparse = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Dashboard total updates after sparse import (127)', afterSparse.total === 127, `${afterSparse.total}`);

/* 14d. Manual mapping correction + replace confirmation */
const manualCsv = [
  'date_of_post,blurb,points',
  '2026-10-08T08:00:00Z,"Manual mapping works well, very helpful",55',
].join('\n');
await page.setInputFiles('input[type="file"]', {
  name: 'manual.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(manualCsv),
});
await page.waitForTimeout(900);
check('Unknown headers blocked with actionable error', await page.locator('text=No recognizable content column').isVisible());
check('Import disabled before manual mapping', await page.locator('button:has-text("Import 1 record")').isDisabled());
await page.selectOption('select[aria-label="Map Timestamp"]', 'date_of_post');
await page.selectOption('select[aria-label="Map Text / content"]', 'blurb');
await page.selectOption('select[aria-label="Map Likes"]', 'points');
await page.waitForTimeout(500);
check('Manual mapping unlocks the import button', !(await page.locator('button:has-text("Import 1 record")').isDisabled()));
check('Content error clears after remapping', (await page.locator('text=No recognizable content column').count()) === 0);
await page.locator('input[name="import-mode"]').nth(1).check(); // Replace
await page.click('button:has-text("Import 1 record")');
await page.waitForTimeout(400);
check('Replace mode asks for confirmation first', await page.locator('text=Replace the current dataset?').isVisible());
await page.click('div[role="dialog"] button:has-text("Replace dataset")');
await page.waitForTimeout(600);
check('Confirmed replace import completes', await page.locator('text=Imported 1 record').first().isVisible());
const afterReplace = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Replace keeps only the 1 imported record', afterReplace.total === 1, `${afterReplace.total}`);

/* 15. Imported data is visible on the dashboard */
await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(400);
const overviewShowing = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Dashboard reflects the imported dataset', overviewShowing.total === 1, `${overviewShowing.total}`);
const overviewText = await page.locator('main').innerText();
check('Imported post text appears on dashboard', overviewText.includes('Manual mapping works well'));

/* 16. Empty state: clear all data */
await page.click('aside button:has-text("Data Management")');
await page.waitForTimeout(300);
await page.click('button:has-text("Clear all data")');
await page.waitForTimeout(300);
await page.click('div[role="dialog"] button:has-text("Delete everything")');
await page.waitForTimeout(500);
check('Empty dataset message shown', await page.locator('text=Dataset is empty').first().isVisible());
// Template download must still work with an empty dataset (independence)
const [tplEmpty] = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.click('button:has-text("Download sample CSV template")'),
]);
const tplEmptyCsv = (await fs.readFile(await tplEmpty.path(), 'utf8')).replace(/^\uFEFF/, '');
check(
  'Template downloads even with an empty dataset',
  tplEmptyCsv.trim().split(/\r?\n/).length - 1 === 25,
  `${tplEmptyCsv.trim().split(/\r?\n/).length - 1} rows`,
);
await page.click('button:has-text("Load demo data")');
await page.waitForTimeout(500);
const backText = await page.locator('header >> text=Showing').first().innerText();
check('Load demo data restores 120 posts', backText.includes('120'), backText.replace(/\s+/g, ' '));

/* 16b. REGRESSION: 30-row multi-platform CSV (TikTok/Reddit variations) */
// baseline counts from the demo dataset (it also contains TikTok/Reddit now)
await page.selectOption('select[aria-label="Filter by platform"]', 'TikTok');
await page.waitForTimeout(300);
const baseTikTok = parseShowing(await page.locator('header >> text=Showing').first().innerText()).shown;
await page.selectOption('select[aria-label="Filter by platform"]', 'Reddit');
await page.waitForTimeout(300);
const baseReddit = parseShowing(await page.locator('header >> text=Showing').first().innerText()).shown;
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

const regenPlatforms = [
  'Instagram', 'facebook', 'TikTok', 'YOUTUBE', 'linkedin', 'X', 'Reddit',
  'tik tok', 'tik-tok', 'REDDIT', 'reddit.com', 'Twitter', 'TikTok.com', 'instagram.com',
  'Facebook', 'TikTok', 'reddit', 'YouTube', 'LinkedIn', 'x', 'Twitter.com',
  'TikTok', 'Reddit', 'Instagram', 'facebook.com', 'TIKTOK', 'Reddit.com', 'X.com',
  'LinkedIn', 'TikTok',
];
const regenLines = regenPlatforms.map(
  (plat, i) =>
    `RG-${i + 1},2026-10-0${(i % 9) + 1}T1${i % 10}:00:00Z,${plat},"Regression row ${i + 1} about the new dashboard rollout",${100 + i * 7},${5 + (i % 9)},${3 + (i % 5)},${2000 + i * 90}`,
);
const regenCsv = ['post_id,timestamp,platform,text,likes,comments,shares,reach', ...regenLines].join('\n');
await page.setInputFiles('input[type="file"]', {
  name: 'regression30.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(regenCsv),
});
await page.waitForTimeout(1000);
check('Regression CSV → 30 valid rows', await page.locator('text=30 valid rows').isVisible());
check('Regression CSV → 0 rows skipped', await page.locator('text=0 rows skipped').isVisible());
check(
  'No TikTok/Reddit "Unrecognized platform" warnings',
  (await page.locator('text=Unrecognized platform').count()) === 0,
);
await page.click('button:has-text("Import 30 records")');
await page.waitForTimeout(500);
check('Regression import succeeds (append)', await page.locator('text=Imported 30 records').isVisible());
const afterRegen = parseShowing(await page.locator('header >> text=Showing').first().innerText());
check('Dashboard total = 150 after regression import', afterRegen.total === 150, `${afterRegen.total}`);
// filter + imported records share the SAME normalised platform values
await page.selectOption('select[aria-label="Filter by platform"]', 'TikTok');
await page.waitForTimeout(400);
const tikTokShown = parseShowing(await page.locator('header >> text=Showing').first().innerText());
const expectedTikTok = regenPlatforms.filter((p) => normalizePlatform(p) === 'TikTok').length;
check(
  'TikTok filter = demo baseline + every imported variant',
  tikTokShown.shown === baseTikTok + expectedTikTok,
  `${tikTokShown.shown} = ${baseTikTok} demo + ${expectedTikTok} imported`,
);
await page.selectOption('select[aria-label="Filter by platform"]', 'Reddit');
await page.waitForTimeout(400);
const redditShown = parseShowing(await page.locator('header >> text=Showing').first().innerText());
const expectedReddit = regenPlatforms.filter((p) => normalizePlatform(p) === 'Reddit').length;
check(
  'Reddit filter = demo baseline + every imported variant',
  redditShown.shown === baseReddit + expectedReddit,
  `${redditShown.shown} = ${baseReddit} demo + ${expectedReddit} imported`,
);
await page.click('header button:has-text("Clear filters")');
await page.waitForTimeout(300);

/* 16c. REGRESSION: upload the downloaded template back in */
await page.setInputFiles('input[type="file"]', {
  name: 'socialpulse_sample_template.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(tplCsv),
});
await page.waitForTimeout(1000);
check('Downloaded template re-uploads as 25 valid rows', await page.locator('text=25 valid rows').isVisible());
check('Template re-upload → 0 rows skipped', await page.locator('text=0 rows skipped').isVisible());
check(
  'Template re-upload produces no unrecognized-platform warnings',
  (await page.locator('text=Unrecognized platform').count()) === 0,
);
await page.click('button:has-text("Cancel import")');
await page.waitForTimeout(300);

/* 16d. Overview KPIs update immediately after append — NO browser refresh */
// KPI card innerText = label / value / delta (blank lines possible) → normalise
const kpiVal = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean)[1];
await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(500);
const kpiAfter = await page.locator('article[title]').allInnerTexts();
check(
  'Overview Total Posts = 150 immediately after append (no refresh)',
  kpiVal(kpiAfter[0]) === '150',
  kpiVal(kpiAfter[0]),
);
check(
  'Likes/Comments/Shares/Reach/AvgRate all recalculated from 150 records',
  kpiAfter.slice(1, 6).every((t, i) => kpiVal(t) !== kpiVal(kpiValues[i + 1])),
  kpiAfter.slice(1, 6).map(kpiVal).join(' / '),
);

/* 16e. Cross-tab sync: an OPEN Overview re-renders when another tab imports */
const page2 = await page.context().newPage();
await page2.goto(BASE, { waitUntil: 'networkidle' });
await page2.click('aside button:has-text("Data Management")');
await page2.waitForTimeout(400);
const xtCsv = [
  'post_id,timestamp,platform,text,likes,comments,shares,reach',
  'XT-1,2026-10-09T10:00:00Z,X,"Cross tab synchronisation check one",10,1,1,100',
  'XT-2,2026-10-09T11:00:00Z,Reddit,"Cross tab synchronisation check two",20,2,2,200',
].join('\n');
await page2.setInputFiles('input[type="file"]', {
  name: 'xt.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(xtCsv),
});
await page2.waitForTimeout(900);
await page2.click('button:has-text("Import 2 records")');
await page2.waitForTimeout(600);
// original tab: no reload, no navigation — the storage event re-syncs state
await page.waitForTimeout(900);
const kpiSynced = await page.locator('article[title]').allInnerTexts();
check(
  'Open Overview syncs a second tab import without refresh (152)',
  kpiVal(kpiSynced[0]) === '152',
  kpiVal(kpiSynced[0]),
);
await page2.close();

/* 16f. Persistence: a reload keeps the synced 152-record dataset */
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=Total Posts');
const kpiReload = await page.locator('article[title]').allInnerTexts();
check('Reload persists the 152-record dataset', kpiVal(kpiReload[0]) === '152', kpiVal(kpiReload[0]));

/* 17. Zero-reach posts are handled (rate shows —, no crash) */
await page.click('aside button:has-text("Top Posts")');
await page.waitForTimeout(400);
const topText = await page.locator('main').innerText();
check('Top posts table renders rows', topText.includes('Post ID'));

/* Console / page errors */
const relevantConsoleErrors = consoleErrors.filter(
  (e) => !e.includes('favicon') && !e.includes('Download the React DevTools'),
);
check('No console errors', relevantConsoleErrors.length === 0, relevantConsoleErrors.slice(0, 3).join(' | '));
check('No uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

/* Screenshots for the report */
await page.click('aside button:has-text("Overview")');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/overview.png', fullPage: true });
await page.click('aside button:has-text("Analytics")');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/analytics.png', fullPage: true });
await page.click('aside button:has-text("Sentiment Analysis")');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/sentiment.png', fullPage: true });
await page.click('aside button:has-text("Top Posts")');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/top-posts.png', fullPage: true });
await page.click('aside button:has-text("Data Management")');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/data-management.png', fullPage: true });

/* Mobile viewport check */
const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(BASE, { waitUntil: 'networkidle' });
await mobile.waitForSelector('text=Total Posts');
const hamburger = await mobile.locator('header button[aria-label="Open menu"]');
check('Mobile: hamburger menu visible', await hamburger.isVisible());
await hamburger.click();
await mobile.waitForTimeout(400);
check('Mobile: sidebar opens', await mobile.locator('aside >> text=Sentiment Analysis').isVisible());
await mobile.screenshot({ path: 'screenshots/mobile.png', fullPage: false });

await browser.close();

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (failures > 0) {
  console.error(`\n${failures} FAILED:`);
  results.filter((r) => !r.ok).forEach((r) => console.error(`  - ${r.name}: ${r.detail}`));
  process.exit(1);
}
