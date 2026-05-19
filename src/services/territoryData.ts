import { EXCLUDED_DATES } from '@/config/excludedDates';
import type { DailyTerritoryData } from '@/types';
import { mapPool } from '@/utils/parallelFetch';

/** Parallel fetches when loading bundled or remote JSON. */
const DATA_FETCH_CONCURRENCY = 12;

/** Daily history depth: must reach early 2022 for pre-war + multi-year monthly comparison (~5.5y). */
export const DAILY_HISTORY_LOOKBACK_DAYS = 2000;

const DATA_REPO_RAW_BASE_URL = 'https://raw.githubusercontent.com/slimmo2005-gif/ukraine-territory-data';
const DATA_REPO_API_BASE_URL = 'https://api.github.com/repos/slimmo2005-gif/ukraine-territory-data/contents';
const DATA_REPO_BRANCHES = ['master', 'main'] as const;

const REMOTE_DATA_DIRECTORIES = ['data', 'data/history'];
const REMOTE_WEEKLY_DIRECTORY = 'data/history/weekly';
const REMOTE_YEARLY_DIRECTORIES = ['data/history/yearly', 'data/history/annual'] as const;

/** Same-origin bundle (populated by scripts/sync-territory-data.mjs before deploy). */
const BUNDLE_BASE = `${import.meta.env.BASE_URL}data`;

export interface TerritoryDataManifest {
  version: number;
  syncedAt: string;
  sourceRepo: string;
  branch: string;
  daily: string[];
  weekly: string[];
  yearly: string[];
  stats?: {
    dailyDownloaded: number;
    weeklyDownloaded: number;
    yearlyDownloaded: number;
  };
}

export type TerritoryDataLoadSource = 'bundled' | 'remote' | 'none';

export interface TerritoryDataLoadResult {
  daily: DailyTerritoryData[];
  weekly: DailyTerritoryData[];
  yearly: DailyTerritoryData[];
  source: TerritoryDataLoadSource;
  manifest: TerritoryDataManifest | null;
  /** Set when bundled manifest exists but fetches failed (e.g. stale deploy). */
  warning: string | null;
}

function toDateKey(value: string): string {
  const trimmed = value.trim();
  const isoDateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (isoDateOnlyMatch) {
    return isoDateOnlyMatch[1];
  }
  const isoDateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoDateTimeMatch) {
    return isoDateTimeMatch[1];
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

async function fetchJsonFromUrl(url: string, dateKeyForLog: string): Promise<DailyTerritoryData | null> {
  try {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as DailyTerritoryData;
    if (EXCLUDED_DATES.has(toDateKey(data.date))) {
      return null;
    }
    return data;
  } catch (error) {
    console.error(`Failed to fetch data for ${dateKeyForLog}:`, error);
    return null;
  }
}

export async function fetchTerritoryManifest(): Promise<TerritoryDataManifest | null> {
  try {
    const res = await fetch(`${BUNDLE_BASE}/manifest.json`, { cache: 'default' });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as TerritoryDataManifest;
  } catch {
    return null;
  }
}

function filterDatesInRange(dateKeys: string[], startKey: string, endKey: string): string[] {
  return dateKeys.filter((d) => d >= startKey && d <= endKey).sort();
}

async function loadBundledSeries(
  kind: 'daily' | 'weekly' | 'yearly',
  dateKeys: string[],
): Promise<DailyTerritoryData[]> {
  const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
    const url = `${BUNDLE_BASE}/${kind}/${dateKey}.json`;
    return fetchJsonFromUrl(url, dateKey);
  });
  return rows.filter((row): row is DailyTerritoryData => row !== null);
}

type DirectoryJsonListing = { dateKeys: string[]; branch: string };

async function discoverJsonDateKeysInDirectory(directory: string): Promise<DirectoryJsonListing | null> {
  for (const branch of DATA_REPO_BRANCHES) {
    try {
      const response = await fetch(`${DATA_REPO_API_BASE_URL}/${directory}?ref=${branch}`, {
        cache: 'default',
      });
      if (!response.ok) {
        continue;
      }
      const entries = (await response.json()) as { name: string; type: string }[];
      const dateKeys: string[] = [];
      for (const entry of entries) {
        if (entry.type !== 'file') continue;
        const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
        if (!match) continue;
        const dateKey = match[1];
        if (EXCLUDED_DATES.has(dateKey)) continue;
        dateKeys.push(dateKey);
      }
      dateKeys.sort();
      return { dateKeys, branch };
    } catch {
      // Try next branch.
    }
  }
  return null;
}

async function discoverRemoteDateSources(): Promise<Map<string, string[]>> {
  const dateToUrls = new Map<string, string[]>();
  const listings = await Promise.all(
    REMOTE_DATA_DIRECTORIES.map(async (directory) => ({
      directory,
      listing: await discoverJsonDateKeysInDirectory(directory),
    })),
  );

  for (const { directory, listing } of listings) {
    if (!listing) continue;
    const { dateKeys, branch } = listing;
    for (const dateKey of dateKeys) {
      const url = `${DATA_REPO_RAW_BASE_URL}/${branch}/${directory}/${dateKey}.json`;
      const existing = dateToUrls.get(dateKey) || [];
      existing.push(url);
      dateToUrls.set(dateKey, existing);
    }
  }
  return dateToUrls;
}

async function fetchRemoteDateRange(startDate: Date, endDate: Date): Promise<DailyTerritoryData[]> {
  const startKey = startDate.toISOString().split('T')[0];
  const endKey = endDate.toISOString().split('T')[0];
  const dateSources = await discoverRemoteDateSources();

  const dateKeys = Array.from(dateSources.keys())
    .filter((dateKey) => dateKey >= startKey && dateKey <= endKey)
    .sort();

  if (dateKeys.length === 0) {
    const fallback: { dateKey: string; url: string }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (!EXCLUDED_DATES.has(dateStr)) {
        fallback.push({
          dateKey: dateStr,
          url: `${DATA_REPO_RAW_BASE_URL}/master/data/${dateStr}.json`,
        });
      }
      current.setDate(current.getDate() + 1);
    }
    const rows = await mapPool(fallback, DATA_FETCH_CONCURRENCY, ({ dateKey, url }) =>
      fetchJsonFromUrl(url, dateKey),
    );
    return rows.filter((row): row is DailyTerritoryData => row !== null);
  }

  const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
    const urls = dateSources.get(dateKey) || [];
    for (const url of urls) {
      const dayData = await fetchJsonFromUrl(url, dateKey);
      if (dayData) {
        return dayData;
      }
    }
    return null;
  });
  return rows.filter((row): row is DailyTerritoryData => row !== null);
}

async function fetchRemoteWeeklySnapshotSeries(): Promise<DailyTerritoryData[]> {
  const listing = await discoverJsonDateKeysInDirectory(REMOTE_WEEKLY_DIRECTORY);
  if (!listing) {
    return [];
  }
  const { dateKeys, branch } = listing;
  const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
    const url = `${DATA_REPO_RAW_BASE_URL}/${branch}/${REMOTE_WEEKLY_DIRECTORY}/${dateKey}.json`;
    return fetchJsonFromUrl(url, dateKey);
  });
  return rows.filter((row): row is DailyTerritoryData => row !== null);
}

async function fetchRemoteYearlySnapshotSeries(): Promise<DailyTerritoryData[]> {
  for (const directory of REMOTE_YEARLY_DIRECTORIES) {
    const listing = await discoverJsonDateKeysInDirectory(directory);
    if (!listing) continue;
    const { dateKeys, branch } = listing;
    const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
      const url = `${DATA_REPO_RAW_BASE_URL}/${branch}/${directory}/${dateKey}.json`;
      return fetchJsonFromUrl(url, dateKey);
    });
    const out = rows.filter((row): row is DailyTerritoryData => row !== null);
    if (out.length > 0) {
      return out;
    }
  }
  return [];
}

/**
 * Load territory snapshots: prefer same-origin bundled mirror, then remote GitHub.
 */
export async function loadTerritoryData(endDate: Date = new Date()): Promise<TerritoryDataLoadResult> {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - DAILY_HISTORY_LOOKBACK_DAYS);
  const startKey = startDate.toISOString().split('T')[0];
  const endKey = endDate.toISOString().split('T')[0];

  const manifest = await fetchTerritoryManifest();

  if (manifest && manifest.daily.length > 0) {
    const dailyKeys = filterDatesInRange(manifest.daily, startKey, endKey);
    const [daily, weekly, yearly] = await Promise.all([
      loadBundledSeries('daily', dailyKeys),
      loadBundledSeries('weekly', manifest.weekly),
      loadBundledSeries('yearly', manifest.yearly),
    ]);

    if (daily.length > 0) {
      return {
        daily,
        weekly,
        yearly,
        source: 'bundled',
        manifest,
        warning: null,
      };
    }

    return {
      daily: [],
      weekly: [],
      yearly: [],
      source: 'bundled',
      manifest,
      warning:
        'Bundled data manifest is present but daily files could not be loaded. Try a hard refresh or wait for the next site deploy.',
    };
  }

  const [daily, weekly, yearly] = await Promise.all([
    fetchRemoteDateRange(startDate, endDate),
    fetchRemoteWeeklySnapshotSeries(),
    fetchRemoteYearlySnapshotSeries(),
  ]);

  const source: TerritoryDataLoadSource = daily.length > 0 ? 'remote' : 'none';
  let warning: string | null = null;
  if (source === 'none') {
    warning =
      'Could not reach the territory data repository. Your network may block GitHub raw content (common on corporate networks). The public site bundles data on each deploy — try the hosted dashboard URL instead of a local build.';
  }

  return { daily, weekly, yearly, source, manifest, warning };
}

export function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
