/**
 * Mirror territory JSON from ukraine-territory-data into public/data/
 * for same-origin loading (avoids corporate blocks on raw.githubusercontent.com).
 *
 * Run in CI before `vite build`, or locally: npm run sync-data
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

const SOURCE_REPO = 'slimmo2005-gif/ukraine-territory-data';
const BRANCHES = ['master', 'main'];
const RAW_BASE = `https://raw.githubusercontent.com/${SOURCE_REPO}`;
const API_BASE = `https://api.github.com/repos/${SOURCE_REPO}`;

const EXCLUDED_DATES = new Set(['2026-05-03']);

const CONCURRENCY = 20;
const API_RETRIES = 4;

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    'User-Agent': 'ukraine-territory-sync',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with retries (403/429 rate limits). */
async function fetchApi(url) {
  let lastErr;
  for (let attempt = 0; attempt < API_RETRIES; attempt++) {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.ok) {
      return res;
    }
    if (res.status === 404) {
      return res;
    }
    if (res.status === 403 || res.status === 429) {
      const wait = 2000 * (attempt + 1);
      console.warn(`GitHub API ${res.status}, retry in ${wait}ms …`);
      await sleep(wait);
      lastErr = new Error(`GitHub API ${res.status} ${url}`);
      continue;
    }
    throw new Error(`GitHub API ${res.status} ${url}`);
  }
  throw lastErr ?? new Error(`GitHub API failed ${url}`);
}

async function resolveBranch() {
  for (const branch of BRANCHES) {
    const res = await fetchApi(`${API_BASE}/branches/${branch}`);
    if (res.ok) {
      return branch;
    }
  }
  throw new Error(`Could not resolve branch on ${SOURCE_REPO}`);
}

/**
 * List all JSON snapshot paths via one recursive git tree call (avoids hundreds of Contents API pages).
 */
async function listSnapshotPaths(branch) {
  const refRes = await fetchApi(`${API_BASE}/git/ref/heads/${branch}`);
  if (!refRes.ok) {
    throw new Error(`Could not read ref for branch ${branch}`);
  }
  const ref = await refRes.json();
  const commitSha = ref.object.sha;

  const commitRes = await fetchApi(`${API_BASE}/git/commits/${commitSha}`);
  const commit = await commitRes.json();
  const treeSha = commit.tree.sha;

  const treeRes = await fetchApi(`${API_BASE}/git/trees/${treeSha}?recursive=1`);
  const tree = await treeRes.json();
  if (!Array.isArray(tree.tree)) {
    throw new Error('Unexpected git tree response');
  }

  const daily = new Map();
  const weekly = new Map();
  const yearly = new Map();

  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue;
    const p = entry.path;

    let m = p.match(/^data\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && !EXCLUDED_DATES.has(m[1]) && !daily.has(m[1])) {
      daily.set(m[1], p);
      continue;
    }

    m = p.match(/^data\/history\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && !EXCLUDED_DATES.has(m[1]) && !daily.has(m[1])) {
      daily.set(m[1], p);
      continue;
    }

    m = p.match(/^data\/history\/weekly\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && !EXCLUDED_DATES.has(m[1])) {
      weekly.set(m[1], p);
      continue;
    }

    m = p.match(/^data\/history\/(?:yearly|annual)\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && !EXCLUDED_DATES.has(m[1]) && !yearly.has(m[1])) {
      yearly.set(m[1], p);
    }
  }

  return { daily, weekly, yearly };
}

async function downloadFile(branch, repoPath, destPath) {
  const url = `${RAW_BASE}/${branch}/${repoPath}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const text = await res.text();
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, text, 'utf8');
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function syncKind(kind, branch, dateToRepoPath) {
  const outSub = path.join(OUT_DIR, kind);
  await fs.mkdir(outSub, { recursive: true });

  const entries = [...dateToRepoPath.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let ok = 0;
  let fail = 0;
  const downloadedDates = [];

  await mapPool(entries, CONCURRENCY, async ([dateKey, repoPath]) => {
    const dest = path.join(outSub, `${dateKey}.json`);
    try {
      await downloadFile(branch, repoPath, dest);
      ok += 1;
      downloadedDates.push(dateKey);
    } catch (e) {
      console.warn(`  skip ${kind}/${dateKey}: ${e.message}`);
      fail += 1;
    }
  });

  downloadedDates.sort();
  return { ok, fail, dates: downloadedDates };
}

async function main() {
  console.log('Syncing territory data into public/data/ …');
  const branch = await resolveBranch();
  console.log(`Source: ${SOURCE_REPO} @ ${branch}`);

  const { daily: dailyMap, weekly: weeklyMap, yearly: yearlyMap } = await listSnapshotPaths(branch);
  console.log(`Found ${dailyMap.size} daily, ${weeklyMap.size} weekly, ${yearlyMap.size} yearly in repo tree`);

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const daily = await syncKind('daily', branch, dailyMap);
  console.log(`Daily: ${daily.ok} ok, ${daily.fail} failed`);
  const weekly = await syncKind('weekly', branch, weeklyMap);
  console.log(`Weekly: ${weekly.ok} ok, ${weekly.fail} failed`);
  const yearly = await syncKind('yearly', branch, yearlyMap);
  console.log(`Yearly: ${yearly.ok} ok, ${yearly.fail} failed`);

  const manifest = {
    version: 1,
    syncedAt: new Date().toISOString(),
    sourceRepo: SOURCE_REPO,
    branch,
    daily: daily.dates,
    weekly: weekly.dates,
    yearly: yearly.dates,
    stats: {
      dailyDownloaded: daily.ok,
      weeklyDownloaded: weekly.ok,
      yearlyDownloaded: yearly.ok,
      dailyFailed: daily.fail,
      weeklyFailed: weekly.fail,
      yearlyFailed: yearly.fail,
    },
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  console.log('Manifest written:', manifest.stats);
  if (daily.ok === 0) {
    console.error('No daily files downloaded — check repo access and GITHUB_TOKEN.');
    process.exit(1);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
