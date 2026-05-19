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

const SOURCE_DIRS = {
  daily: ['data', 'data/history'],
  weekly: ['data/history/weekly'],
  yearly: ['data/history/yearly', 'data/history/annual'],
};

const CONCURRENCY = 16;

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    'User-Agent': 'ukraine-territory-sync',
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function resolveBranch() {
  for (const branch of BRANCHES) {
    const res = await fetch(`${API_BASE}/branches/${branch}`, { headers: authHeaders() });
    if (res.ok) {
      return branch;
    }
  }
  throw new Error(`Could not resolve branch on ${SOURCE_REPO}`);
}

/** List YYYY-MM-DD.json files in a repo directory (paginated). */
async function listDateKeysInRepoDir(repoPath, branch) {
  const keys = [];
  let page = 1;
  for (;;) {
    const url = `${API_BASE}/contents/${repoPath}?ref=${branch}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 404) {
        return keys;
      }
      throw new Error(`GitHub API ${res.status} listing ${repoPath}`);
    }
    const entries = await res.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      break;
    }
    for (const entry of entries) {
      if (entry.type !== 'file') continue;
      const m = entry.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (!m) continue;
      if (EXCLUDED_DATES.has(m[1])) continue;
      keys.push(m[1]);
    }
    if (entries.length < 100) {
      break;
    }
    page += 1;
  }
  return keys;
}

/**
 * Merge date keys from multiple source dirs; earlier dirs in array win on conflict.
 */
async function collectDateKeys(kind, branch) {
  const dirs = SOURCE_DIRS[kind];
  const byDate = new Map();
  for (const dir of dirs) {
    const keys = await listDateKeysInRepoDir(dir, branch);
    for (const dateKey of keys) {
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, dir);
      }
    }
  }
  return byDate;
}

async function downloadFile(branch, repoPath, destPath) {
  const url = `${RAW_BASE}/${branch}/${repoPath}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
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

async function syncKind(kind, branch, dateToRepoDir) {
  const outSub = path.join(OUT_DIR, kind);
  await fs.mkdir(outSub, { recursive: true });

  const entries = [...dateToRepoDir.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let ok = 0;
  let fail = 0;

  await mapPool(entries, CONCURRENCY, async ([dateKey, repoDir]) => {
    const repoPath = `${repoDir}/${dateKey}.json`;
    const dest = path.join(outSub, `${dateKey}.json`);
    try {
      await downloadFile(branch, repoPath, dest);
      ok += 1;
    } catch (e) {
      console.warn(`  skip ${kind}/${dateKey}: ${e.message}`);
      fail += 1;
    }
  });

  return { ok, fail, dates: entries.map(([d]) => d) };
}

async function main() {
  console.log('Syncing territory data into public/data/ …');
  const branch = await resolveBranch();
  console.log(`Source: ${SOURCE_REPO} @ ${branch}`);

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [dailyMap, weeklyMap, yearlyMap] = await Promise.all([
    collectDateKeys('daily', branch),
    collectDateKeys('weekly', branch),
    collectDateKeys('yearly', branch),
  ]);

  console.log(`Found ${dailyMap.size} daily, ${weeklyMap.size} weekly, ${yearlyMap.size} yearly files`);

  const daily = await syncKind('daily', branch, dailyMap);
  const weekly = await syncKind('weekly', branch, weeklyMap);
  const yearly = await syncKind('yearly', branch, yearlyMap);

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
