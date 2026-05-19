/**
 * Copy territory JSON from a local clone of ukraine-territory-data into public/data/.
 * No GitHub REST API — used in CI after `git clone`.
 *
 * Usage: node scripts/bundle-data-from-clone.mjs [path-to-clone]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

const EXCLUDED_DATES = new Set(['2026-05-03']);

const DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;

async function walkJsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walkJsonFiles(full)));
    } else if (ent.isFile() && DATE_FILE.test(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function classifyRepoPath(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  let m = norm.match(/^data\/(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) {
    return { kind: 'daily', dateKey: m[1] };
  }
  m = norm.match(/^data\/history\/(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) {
    return { kind: 'daily', dateKey: m[1] };
  }
  m = norm.match(/^data\/history\/weekly\/(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) {
    return { kind: 'weekly', dateKey: m[1] };
  }
  m = norm.match(/^data\/history\/(?:yearly|annual)\/(\d{4}-\d{2}-\d{2})\.json$/);
  if (m) {
    return { kind: 'yearly', dateKey: m[1] };
  }
  return null;
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function main() {
  const cloneRoot = path.resolve(process.argv[2] || path.join(ROOT, '.data-source'));
  const dataRoot = path.join(cloneRoot, 'data');

  try {
    await fs.access(dataRoot);
  } catch {
    console.error(`No data/ folder in ${cloneRoot}`);
    process.exit(1);
  }

  console.log(`Bundling from ${cloneRoot} …`);
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const allFiles = await walkJsonFiles(dataRoot);
  const daily = new Map();
  const weekly = new Map();
  const yearly = new Map();

  for (const abs of allFiles) {
    const rel = path.relative(cloneRoot, abs);
    const info = classifyRepoPath(rel);
    if (!info || EXCLUDED_DATES.has(info.dateKey)) {
      continue;
    }
    const map = info.kind === 'daily' ? daily : info.kind === 'weekly' ? weekly : yearly;
    if (!map.has(info.dateKey)) {
      map.set(info.dateKey, abs);
    }
  }

  let branch = 'master';
  try {
    const head = await fs.readFile(path.join(cloneRoot, '.git', 'HEAD'), 'utf8');
    const ref = head.trim().replace(/^ref: refs\/heads\//, '');
    if (ref) {
      branch = ref;
    }
  } catch {
    // ignore
  }

  async function installKind(kind, map) {
    const outSub = path.join(OUT_DIR, kind);
    await fs.mkdir(outSub, { recursive: true });
    const dates = [];
    for (const [dateKey, src] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      await copyFile(src, path.join(outSub, `${dateKey}.json`));
      dates.push(dateKey);
    }
    return dates;
  }

  const dailyDates = await installKind('daily', daily);
  const weeklyDates = await installKind('weekly', weekly);
  const yearlyDates = await installKind('yearly', yearly);

  console.log(`Copied ${dailyDates.length} daily, ${weeklyDates.length} weekly, ${yearlyDates.length} yearly`);

  const manifest = {
    version: 1,
    syncedAt: new Date().toISOString(),
    sourceRepo: 'slimmo2005-gif/ukraine-territory-data',
    branch,
    daily: dailyDates,
    weekly: weeklyDates,
    yearly: yearlyDates,
    stats: {
      dailyDownloaded: dailyDates.length,
      weeklyDownloaded: weeklyDates.length,
      yearlyDownloaded: yearlyDates.length,
    },
  };

  await fs.writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  if (dailyDates.length === 0) {
    console.error('No daily JSON files found in clone.');
    process.exit(1);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
