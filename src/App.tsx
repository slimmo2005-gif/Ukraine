import { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  Cell,
} from 'recharts';
import { Header } from '@/components/Header';
import { DeepStateAttribution } from '@/components/DeepStateAttribution';
import { ChartSection } from '@/components/ChartSection';
import { MonthlyComparisonChart } from '@/components/MonthlyComparisonChart';
import { ViewLevelToggle } from '@/components/ViewLevelToggle';
import { MarimekkoChart, OblastGridView } from '@/components/MarimekkoChart';
import { OBLAST_NAMES } from '@/data/mockData';
import { EXCLUDED_DATES } from '@/config/excludedDates';
import {
  getTodayMetrics,
  get7DaySummary,
  getCurrentControlTotals,
  getOblastData,
  getNetMovementChartRows,
  getOblastRussianChangeKm2,
  getSummaryDeltasNational,
  getSummaryDeltasOblast,
  type NetMovementBarRow,
  type OblastRussianChangePeriod,
  type NetMovementDeltaMode,
} from '@/utils/calculations';
import type { ViewLevel, OblastKey, DailyTerritoryData } from '@/types';
import { mapPool } from '@/utils/parallelFetch';

/** Parallel raw JSON fetches; bounded to avoid browser connection limits and GitHub throttling. */
const DATA_FETCH_CONCURRENCY = 12;

/**
 * Fetch territory data from GitHub repository
 * Repo: https://github.com/slimmo2005-gif/ukraine-territory-data
 */
/** Daily history depth: must reach early 2022 for pre-war + multi-year monthly comparison (~5.5y). */
const DAILY_HISTORY_LOOKBACK_DAYS = 2000;

const DATA_REPO_RAW_BASE_URL = 'https://raw.githubusercontent.com/slimmo2005-gif/ukraine-territory-data';
const DATA_REPO_API_BASE_URL = 'https://api.github.com/repos/slimmo2005-gif/ukraine-territory-data/contents';
const DATA_DIRECTORIES = ['data', 'data/history'];
const DATA_WEEKLY_DIRECTORY = 'data/history/weekly';
/** Tried in order until one lists JSON files (supports yearly vs annual folder names). */
const DATA_YEARLY_DIRECTORIES = ['data/history/yearly', 'data/history/annual'] as const;
const DATA_REPO_BRANCHES = ['master', 'main'];

type DirectoryJsonListing = { dateKeys: string[]; branch: string };

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

async function fetchDataFromUrl(url: string, dateKeyForLog: string): Promise<DailyTerritoryData | null> {
  try {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json() as DailyTerritoryData;
    if (EXCLUDED_DATES.has(toDateKey(data.date))) {
      return null;
    }
    return data;
  } catch (error) {
    console.error(`Failed to fetch data for ${dateKeyForLog}:`, error);
    return null;
  }
}

type DateKeySources = Map<string, string[]>;

async function discoverJsonDateKeysInDirectory(directory: string): Promise<DirectoryJsonListing | null> {
  for (const branch of DATA_REPO_BRANCHES) {
    try {
      const response = await fetch(`${DATA_REPO_API_BASE_URL}/${directory}?ref=${branch}`, {
        cache: 'default',
      });
      if (!response.ok) {
        continue;
      }
      const entries = await response.json() as { name: string; type: string }[];
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

async function discoverDateSources(): Promise<DateKeySources> {
  const dateToUrls: DateKeySources = new Map();

  const listings = await Promise.all(
    DATA_DIRECTORIES.map(async (directory) => ({
      directory,
      listing: await discoverJsonDateKeysInDirectory(directory),
    })),
  );

  for (const { directory, listing } of listings) {
    if (!listing) {
      continue;
    }
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

/** All weekly anchors under data/history/weekly/ (UTC 7-day series from 2026-01-01), ascending by date key. */
async function fetchWeeklySnapshotSeries(): Promise<DailyTerritoryData[]> {
  const listing = await discoverJsonDateKeysInDirectory(DATA_WEEKLY_DIRECTORY);
  if (!listing) {
    return [];
  }
  const { dateKeys, branch } = listing;
  const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
    const url = `${DATA_REPO_RAW_BASE_URL}/${branch}/${DATA_WEEKLY_DIRECTORY}/${dateKey}.json`;
    return fetchDataFromUrl(url, dateKey);
  });
  return rows.filter((row): row is DailyTerritoryData => row !== null);
}

/** Yearly anchors under data/history/yearly or annual/, ascending by date key (when present). */
async function fetchYearlySnapshotSeries(): Promise<DailyTerritoryData[]> {
  for (const directory of DATA_YEARLY_DIRECTORIES) {
    const listing = await discoverJsonDateKeysInDirectory(directory);
    if (!listing) {
      continue;
    }
    const { dateKeys, branch } = listing;
    const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, async (dateKey) => {
      const url = `${DATA_REPO_RAW_BASE_URL}/${branch}/${directory}/${dateKey}.json`;
      return fetchDataFromUrl(url, dateKey);
    });
    const out = rows.filter((row): row is DailyTerritoryData => row !== null);
    if (out.length > 0) {
      return out;
    }
  }
  return [];
}

async function fetchDateRange(startDate: Date, endDate: Date): Promise<DailyTerritoryData[]> {
  const startKey = startDate.toISOString().split('T')[0];
  const endKey = endDate.toISOString().split('T')[0];

  const dateSources = await discoverDateSources();

  const dateKeys = Array.from(dateSources.keys())
    .filter((dateKey) => dateKey >= startKey && dateKey <= endKey)
    .sort();

  if (dateKeys.length === 0) {
    const fallback: { dateKey: string; url: string }[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      if (!EXCLUDED_DATES.has(dateStr)) {
        fallback.push({ dateKey: dateStr, url: `${DATA_REPO_RAW_BASE_URL}/master/data/${dateStr}.json` });
      }
      current.setDate(current.getDate() + 1);
    }
    const rows = await mapPool(fallback, DATA_FETCH_CONCURRENCY, ({ dateKey, url }) =>
      fetchDataFromUrl(url, dateKey),
    );
    return rows.filter((row): row is DailyTerritoryData => row !== null);
  }

  async function fetchFirstForDateKey(dateKey: string): Promise<DailyTerritoryData | null> {
    const urls = dateSources.get(dateKey) || [];
    for (const url of urls) {
      const dayData = await fetchDataFromUrl(url, dateKey);
      if (dayData) {
        return dayData;
      }
    }
    return null;
  }

  const rows = await mapPool(dateKeys, DATA_FETCH_CONCURRENCY, (dateKey) => fetchFirstForDateKey(dateKey));
  return rows.filter((row): row is DailyTerritoryData => row !== null);
}

function getDateDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Main App Component - Ukraine War Territory Tracker Dashboard
 * 
 * Features:
 * - Territory data from DeepStateMap (GitHub snapshots)
 * - Total Ukraine or Oblast-level view
 * - Russian/Ukrainian/Disputed territory control display
 * - Historical control tracking over time
 * 
 * Architecture:
 * - Data layer: Fetched from GitHub repo (slimmo2005-gif/ukraine-territory-data)
 * - State: React hooks for view level, data source, selected oblast
 * - Components: Modular with clear props interface
 * - Calculations: Derived from per-oblast data using useMemo
 */
function formatLongDate(dateKey: string): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(dateKey: string): string {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateKey;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Recharts `<Bar label={…} />` passes geometry + payload per cell; show signed km² only (no %). */
function renderNetMovementBarValueLabel(rows: NetMovementBarRow[], deltaMode: NetMovementDeltaMode) {
  return (raw: unknown) => {
    const p = raw as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      index?: number;
      payload?: NetMovementBarRow;
    };
    const x = Number(p.x ?? 0);
    const y = Number(p.y ?? 0);
    const width = Number(p.width ?? 0);
    const height = Number(p.height ?? 0);
    const payload = (p.payload as NetMovementBarRow | undefined) ?? (typeof p.index === 'number' ? rows[p.index] : undefined);
    const cx = x + width / 2;

    if (!payload?.hasData || payload.fullNet === null) {
      return (
        <text x={cx} y={y - 4} textAnchor="middle" fill="#6b7280" fontSize={10}>
          —
        </text>
      );
    }

    const net = payload.fullNet;
    const text = `${net >= 0 ? '+' : ''}${Math.round(net).toLocaleString()}`;
    const fill =
      deltaMode === 'russian'
        ? net > 0
          ? '#f87171'
          : net < 0
            ? '#60a5fa'
            : '#d1d5db'
        : net > 0
          ? '#60a5fa'
          : net < 0
            ? '#f87171'
            : '#d1d5db';
    const above = net >= 0;
    const labelY = above ? y - 8 : y + Math.max(height, 0) + 14;

    return (
      <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fontWeight={600} fill={fill}>
        {text}
      </text>
    );
  };
}

function App() {
  // State
  const [viewLevel, setViewLevel] = useState<ViewLevel>('total');
  const [selectedOblast, setSelectedOblast] = useState<OblastKey>('donetsk');
  const [historicalData, setHistoricalData] = useState<DailyTerritoryData[]>([]);
  const [weeklySnapshotData, setWeeklySnapshotData] = useState<DailyTerritoryData[]>([]);
  const [yearlySnapshotData, setYearlySnapshotData] = useState<DailyTerritoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showHistoryHelp, setShowHistoryHelp] = useState<boolean>(false);
  const [oblastRussianChangePeriod, setOblastRussianChangePeriod] =
    useState<OblastRussianChangePeriod>('day');
  const [netMovementPeriod, setNetMovementPeriod] = useState<OblastRussianChangePeriod>('month');
  const [netMovementDeltaMode, setNetMovementDeltaMode] = useState<NetMovementDeltaMode>('russian');

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const endDate = new Date();
        const startDate = getDateDaysAgo(DAILY_HISTORY_LOOKBACK_DAYS);
        
        const [data, weekly, yearly] = await Promise.all([
          fetchDateRange(startDate, endDate),
          fetchWeeklySnapshotSeries(),
          fetchYearlySnapshotSeries(),
        ]);

        setHistoricalData(data);
        setWeeklySnapshotData(weekly);
        setYearlySnapshotData(yearly);
        if (data.length > 0) {
          setSelectedDate(data[data.length - 1].date);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Only use real data from GitHub repo - no fallback to mock data
  const currentData = useMemo(() => {
    return historicalData;
  }, [historicalData]);

  // Available date keys (sorted ascending) for navigation.
  const availableDates = useMemo(() => currentData.map((d) => d.date), [currentData]);
  const latestAvailableDate = availableDates[availableDates.length - 1] || '';
  const earliestAvailableDate = availableDates[0] || '';

  const selectedIndex = useMemo(() => {
    if (!selectedDate) return -1;
    return availableDates.indexOf(selectedDate);
  }, [availableDates, selectedDate]);

  const isLive = !!selectedDate && selectedDate === latestAvailableDate;

  const selectedDateData = selectedIndex >= 0 ? currentData[selectedIndex] : null;
  const previousDateData = selectedIndex > 0 ? currentData[selectedIndex - 1] : null;
  const previousDateLabel = previousDateData ? formatShortDate(previousDateData.date) : null;

  // Slice data up to selected date so existing metric helpers and charts respect "time travel".
  const dataUpToSelected = useMemo(() => {
    if (selectedIndex < 0) return [] as DailyTerritoryData[];
    return currentData.slice(0, selectedIndex + 1);
  }, [currentData, selectedIndex]);

  const goToPreviousAvailableDate = () => {
    if (selectedIndex > 0) setSelectedDate(availableDates[selectedIndex - 1]);
  };
  const goToNextAvailableDate = () => {
    if (selectedIndex >= 0 && selectedIndex < availableDates.length - 1) {
      setSelectedDate(availableDates[selectedIndex + 1]);
    }
  };
  const goToLatest = () => {
    if (latestAvailableDate) setSelectedDate(latestAvailableDate);
  };
  const handleDirectDateChange = (newDate: string) => {
    if (!newDate) return;
    if (availableDates.includes(newDate)) {
      setSelectedDate(newDate);
      return;
    }
    // Snap to nearest available date (prefer earlier).
    const earlier = [...availableDates].reverse().find((d) => d <= newDate);
    const later = availableDates.find((d) => d >= newDate);
    setSelectedDate(earlier || later || latestAvailableDate);
  };

  const summaryEndIndex = dataUpToSelected.length - 1;

  // Get metrics based on view level - operates on data up to selected date.
  const metrics = useMemo(() => {
    if (viewLevel === 'total') {
      const today = getTodayMetrics(dataUpToSelected);
      const week7 = get7DaySummary(dataUpToSelected);
      const current = getCurrentControlTotals(dataUpToSelected);
      const deltaLine = getSummaryDeltasNational(
        dataUpToSelected,
        weeklySnapshotData,
        yearlySnapshotData,
        netMovementPeriod,
        selectedDate,
        summaryEndIndex,
        previousDateLabel,
        isLive,
      );
      return { today, week7, current, deltaLine, isOblast: false };
    } else {
      // Oblast-level metrics
      const oblastData = getOblastData(dataUpToSelected, selectedOblast);
      const today = oblastData[oblastData.length - 1];
      const deltaLine = getSummaryDeltasOblast(
        dataUpToSelected,
        weeklySnapshotData,
        yearlySnapshotData,
        netMovementPeriod,
        selectedDate,
        summaryEndIndex,
        selectedOblast,
        previousDateLabel,
        isLive,
      );

      return {
        today: {
          russianControlled: today?.russianControlled || 0,
          ukrainianControlled: today?.ukrainianControlled || 0,
          disputed: today?.disputed || 0,
          russianChange: today?.russianChange || 0,
          ukrainianChange: today?.ukrainianChange || 0,
          disputedChange: today?.disputedChange || 0,
        },
        week7: {
          russianAvg: 0,
          ukrainianAvg: 0,
          disputedAvg: today?.disputed || 0,
        },
        current: {
          russianControlled: today?.russianControlled || 0,
          ukrainianControlled: today?.ukrainianControlled || 0,
          disputed: today?.disputed || 0,
          totalArea: today?.totalArea || 0,
        },
        deltaLine,
        isOblast: true,
      };
    }
  }, [
    dataUpToSelected,
    viewLevel,
    selectedOblast,
    weeklySnapshotData,
    yearlySnapshotData,
    netMovementPeriod,
    selectedDate,
    summaryEndIndex,
    previousDateLabel,
    isLive,
  ]);

  const netMovementChartRows = useMemo(
    () =>
      getNetMovementChartRows(
        dataUpToSelected,
        netMovementPeriod,
        viewLevel === 'oblast' ? selectedOblast : undefined,
        {
          weeklySnapshots: weeklySnapshotData,
          yearlySnapshots: yearlySnapshotData,
          selectedDate,
          deltaMode: netMovementDeltaMode,
        },
      ),
    [
      dataUpToSelected,
      netMovementPeriod,
      viewLevel,
      selectedOblast,
      weeklySnapshotData,
      yearlySnapshotData,
      selectedDate,
      netMovementDeltaMode,
    ],
  );

  const netMovementYDomain = useMemo((): [number, number] => {
    const nets = netMovementChartRows
      .filter((r) => r.hasData && r.fullNet !== null)
      .map((r) => Math.abs(r.fullNet as number));
    const maxAbs = nets.length > 0 ? Math.max(...nets, 50) : 50;
    const pad = Math.ceil(maxAbs * 0.12);
    const yMax = maxAbs + pad;
    return [-yMax, yMax];
  }, [netMovementChartRows]);

  // Use the selected date snapshot for the per-date breakdown panels.
  const todayData = selectedDateData;

  // Active oblasts for display
  const activeOblasts = useMemo(() => {
    if (!todayData?.oblasts) {
      return [];
    }

    const oblasts = todayData.oblasts;
    const crimeaRow = oblasts.find((o) => o.oblast.toLowerCase() === 'crimea');

    const filtered = oblasts
      .filter((o) => o.oblast.toLowerCase() !== 'crimea')
      .filter((o) => o.russian_controlled_km2 > 0 || o.disputed_controlled_km2 > 0)
      .sort((a, b) => b.russian_controlled_km2 - a.russian_controlled_km2);

    return crimeaRow ? [crimeaRow, ...filtered] : filtered;
  }, [todayData]);

  const oblastTableRuTotals = useMemo(() => {
    if (!activeOblasts.length || !dataUpToSelected.length) {
      return { totalRuKm2: 0, totalDeltaRuKm2: 0 };
    }
    const endIdx = dataUpToSelected.length - 1;
    let totalRuKm2 = 0;
    let totalDeltaRuKm2 = 0;
    for (const oblast of activeOblasts) {
      totalRuKm2 += oblast.russian_controlled_km2;
      totalDeltaRuKm2 += getOblastRussianChangeKm2(
        dataUpToSelected,
        oblast.oblast,
        oblastRussianChangePeriod,
        endIdx,
        {
          yearlySnapshots: yearlySnapshotData,
          weeklySnapshots: weeklySnapshotData,
          selectedDate,
        },
      );
    }
    return { totalRuKm2, totalDeltaRuKm2 };
  }, [
    activeOblasts,
    dataUpToSelected,
    oblastRussianChangePeriod,
    yearlySnapshotData,
    weeklySnapshotData,
    selectedDate,
  ]);

  const formatKm2 = (value: number) => `${Math.round(value).toLocaleString()} km²`;
  const formatPercent = (value: number) => `${Math.round(value).toLocaleString()}%`;
  const formatPercentOneDecimal = (value: number) => `${value.toFixed(1)}%`;
  const formatDeltaKm2 = (value: number) => `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString()} km²`;

  const dataQualityWarnings = useMemo(() => {
    if (!todayData?.oblasts?.length) {
      return [] as string[];
    }

    const warnings: string[] = [];
    const oblastRows = todayData.oblasts;

    // Basic row-level checks.
    for (const row of oblastRows) {
      const disputed = row.disputed_controlled_km2 || 0;
      const total = row.total_area_km2 || 0;
      const rowSum = row.russian_controlled_km2 + row.ukrainian_controlled_km2 + disputed;

      if (row.russian_controlled_km2 < 0 || row.ukrainian_controlled_km2 < 0 || disputed < 0) {
        warnings.push(`Negative control area detected in ${OBLAST_NAMES[row.oblast] || row.oblast}.`);
      }

      if (total > 0 && rowSum > total * 1.01) {
        warnings.push(`${OBLAST_NAMES[row.oblast] || row.oblast} control sum exceeds total area.`);
      }
    }

    // Heuristic checks for obviously suspicious frontline distribution.
    const byKey = Object.fromEntries(oblastRows.map((o) => [o.oblast, o]));
    const pct = (key: string) => {
      const row = byKey[key];
      if (!row || !row.total_area_km2) return null;
      return (row.russian_controlled_km2 / row.total_area_km2) * 100;
    };

    const crimeaPct = pct('crimea');
    const luhanskPct = pct('luhansk');
    const donetskPct = pct('donetsk');
    const zaporizhzhiaPct = pct('zaporizhzhia');
    const khersonPct = pct('kherson');

    if (crimeaPct !== null && crimeaPct < 90) {
      warnings.push('Crimea Russian control is unexpectedly low (<90%).');
    }
    if (luhanskPct !== null && luhanskPct < 85) {
      warnings.push('Luhansk Russian control is unexpectedly low (<85%).');
    }
    if (donetskPct !== null && donetskPct < 40) {
      warnings.push('Donetsk Russian control is unexpectedly low (<40%).');
    }
    if (zaporizhzhiaPct !== null && zaporizhzhiaPct > 80) {
      warnings.push('Zaporizhzhia Russian control is unexpectedly high (>80%).');
    }
    if (khersonPct !== null && khersonPct < 5) {
      warnings.push('Kherson Russian control is unexpectedly low (<5%).');
    }

    return warnings.slice(0, 5);
  }, [todayData]);

  return (
    <div className="min-h-screen bg-osint-dark text-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DeepStateAttribution />

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ukraine-blue mx-auto mb-4"></div>
              <p className="text-gray-400">Loading territory data...</p>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!isLoading && currentData.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center bg-osint-card rounded-lg p-8 border border-osint-border">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
              <p className="text-gray-400 mb-4">The data repository doesn&apos;t have any territory data yet.</p>
              <p className="text-sm text-gray-500">
                Expected: <code className="bg-osint-dark px-2 py-1 rounded">2026-05-03.json</code> and <code className="bg-osint-dark px-2 py-1 rounded">2026-05-04.json</code>
              </p>
              <p className="text-xs text-gray-600 mt-4">
                Data source:{' '}
                <a 
                  href="https://github.com/slimmo2005-gif/ukraine-territory-data" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-ukraine-blue hover:underline"
                >
                  github.com/slimmo2005-gif/ukraine-territory-data
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-8">
            <p className="text-red-400 text-sm">
              <span className="font-semibold">Error:</span> {error}
            </p>
            <p className="text-red-400/70 text-xs mt-1">
              Using fallback mock data. Data source: GitHub repo may not have data yet.
            </p>
          </div>
        )}

        {/* Data Quality Warning */}
        {!isLoading && !error && dataQualityWarnings.length > 0 && (
          <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4 mb-8">
            <p className="text-amber-300 text-sm font-semibold mb-2">Data Quality Warning</p>
            <ul className="text-amber-200/90 text-xs space-y-1">
              {dataQualityWarnings.map((warning, idx) => (
                <li key={idx}>- {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Dashboard Content - Only show when data exists */}
        {currentData.length > 0 && (
          <>
        {/* Controls Bar */}
        <section className="mb-6">
          <div className="bg-osint-card rounded-lg p-4 border border-osint-border">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
              <p className="text-sm text-gray-400">
                Data source:{' '}
                <span className="font-medium text-white">DeepStateMap</span>
              </p>
              <ViewLevelToggle
                viewLevel={viewLevel}
                selectedOblast={selectedOblast}
                onViewLevelChange={setViewLevel}
                onOblastChange={setSelectedOblast}
              />
            </div>
          </div>
        </section>

        {/* Date Navigator */}
        <section className="mb-8">
          <div className="bg-osint-card rounded-lg p-4 border border-osint-border">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-gray-500">Viewing date</span>
                <span className="text-sm font-semibold text-white">
                  {selectedDate ? formatLongDate(selectedDate) : 'Pick a date'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    isLive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                  title={isLive ? 'Showing the latest available snapshot' : 'Showing a historical snapshot'}
                >
                  {isLive ? 'LIVE' : 'HISTORICAL'}
                </span>
                {!isLive && previousDateLabel && (
                  <span className="text-xs text-gray-500">
                    Compared with previous available date: {previousDateLabel}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousAvailableDate}
                  disabled={selectedIndex <= 0}
                  className="px-3 py-1.5 text-xs rounded border border-osint-border bg-osint-dark text-gray-200 hover:bg-osint-card disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous available date"
                  title="Previous available date"
                >
                  &larr; Prev
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  min={earliestAvailableDate}
                  max={latestAvailableDate}
                  onChange={(e) => handleDirectDateChange(e.target.value)}
                  className="px-2 py-1.5 text-xs rounded border border-osint-border bg-osint-dark text-gray-100"
                  aria-label="Pick any date"
                  title="Pick any date (will snap to the nearest available snapshot)"
                />
                <button
                  type="button"
                  onClick={goToNextAvailableDate}
                  disabled={selectedIndex < 0 || selectedIndex >= availableDates.length - 1}
                  className="px-3 py-1.5 text-xs rounded border border-osint-border bg-osint-dark text-gray-200 hover:bg-osint-card disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next available date"
                  title="Next available date"
                >
                  Next &rarr;
                </button>
                <button
                  type="button"
                  onClick={goToLatest}
                  disabled={isLive}
                  className="px-3 py-1.5 text-xs rounded border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Jump back to the latest available snapshot"
                >
                  Jump to latest
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistoryHelp(true)}
                  className="px-3 py-1.5 text-xs rounded border border-osint-border bg-osint-dark text-gray-200 hover:bg-osint-card"
                  title="How history works"
                  aria-label="How history works"
                >
                  ?
                </button>
              </div>
            </div>
            {!selectedDateData && selectedDate && (
              <p className="mt-3 text-xs text-amber-300">
                No archived snapshot is available for this date. Try a nearby date or use Prev/Next.
              </p>
            )}
          </div>
        </section>

        {/* Metrics + Oblast Overview */}
        <section className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">
              {viewLevel === 'total' ? 'Ukraine Territory Control' : `${OBLAST_NAMES[selectedOblast]} Oblast Control`}
            </h2>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isLive
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {isLive ? 'LIVE DATA' : `HISTORICAL: ${selectedDate ? formatShortDate(selectedDate) : '—'}`}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
              <h3 className="text-lg font-semibold text-white mb-1">Territory Breakdown</h3>
              <p className="text-[11px] text-gray-500 mb-4 leading-snug">
                Δ lines follow Area change <span className="text-gray-400">View</span> (
                {netMovementPeriod === 'day'
                  ? 'Day'
                  : netMovementPeriod === 'week'
                    ? 'Week'
                    : netMovementPeriod === 'month'
                      ? 'Month'
                      : 'Year'}
                {netMovementPeriod === 'week' && weeklySnapshotData.length > 0
                  ? ': WoW uses weekly history files when available'
                  : ''}
                {netMovementPeriod === 'year' && yearlySnapshotData.length > 0
                  ? ': YoY uses yearly history files when available'
                  : ''}
                {netMovementPeriod === 'year' &&
                yearlySnapshotData.length === 0 &&
                weeklySnapshotData.length >= 2
                  ? ': YoY uses weekly year-end anchors when yearly files are absent'
                  : ''}
                ).
              </p>
              {(() => {
                const totalArea = metrics.current.totalArea || 1;
                const russianPct = (metrics.current.russianControlled / totalArea) * 100;
                const disputedPct = (metrics.current.disputed / totalArea) * 100;
                const ukrainianPct = 100 - russianPct - disputedPct;
                const ukrainianTotal = totalArea - metrics.current.russianControlled - metrics.current.disputed;

                const { compareSuffix, ...deltas } = metrics.deltaLine;
                const deltaSuffix = compareSuffix;

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Russian Controlled</span>
                      <div className="text-right">
                        <span className="text-red-400 font-medium">{formatPercentOneDecimal(russianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.russianControlled)})</span>
                        <p className="text-xs text-red-400/80">{formatDeltaKm2(deltas.russianChange)} {deltaSuffix}</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ukrainian Controlled</span>
                      <div className="text-right">
                        <span className="text-blue-400 font-medium">{formatPercentOneDecimal(ukrainianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(ukrainianTotal)})</span>
                        <p className="text-xs text-blue-400/80">{formatDeltaKm2(deltas.ukrainianChange)} {deltaSuffix}</p>
                      </div>
                    </div>
                    {(metrics.current.disputed > 0 || disputedPct > 0.1) && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disputed/Contested</span>
                        <div className="text-right">
                          <span className="text-amber-400 font-medium">{formatPercentOneDecimal(disputedPct)}</span>
                          <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.disputed)})</span>
                          <p className="text-xs text-amber-400/80">{formatDeltaKm2(deltas.disputedChange)} {deltaSuffix}</p>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-osint-border pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Total Area</span>
                        <span className="text-white font-bold">{formatKm2(totalArea)}</span>
                      </div>
                      <div className="mt-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
                          <p className="text-gray-400 font-medium">Area change</p>
                          <div className="flex flex-wrap gap-3 items-center">
                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                                View
                              </span>
                              <select
                                value={netMovementPeriod}
                                onChange={(e) =>
                                  setNetMovementPeriod(e.target.value as OblastRussianChangePeriod)
                                }
                                className="min-w-[7.5rem] bg-osint-dark border border-osint-border rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ukraine-blue/40"
                                aria-label="Area change time range"
                              >
                                <option value="day">Day</option>
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                                <option value="year">Year</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                                Metric
                              </span>
                              <select
                                value={netMovementDeltaMode}
                                onChange={(e) =>
                                  setNetMovementDeltaMode(e.target.value as NetMovementDeltaMode)
                                }
                                className="min-w-[8rem] bg-osint-dark border border-osint-border rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-ukraine-blue/40"
                                aria-label="Area change metric"
                              >
                                <option value="russian">Russian Δ</option>
                                <option value="ukrainian">Ukrainian Δ</option>
                              </select>
                            </label>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2 leading-snug">
                          {netMovementDeltaMode === 'russian'
                            ? 'Bars show change in Russian-controlled km² for each period. Red = gain, blue = loss vs segment start.'
                            : 'Bars show change in Ukrainian-held km² (oblast rows use reported Ukrainian area; national uses total − Russian − disputed). Blue = gain, red = loss.'}{' '}
                          Hover for % of Ukraine.
                          {netMovementPeriod === 'day' &&
                            ' Day: last up to 14 snapshots vs previous available snapshot.'}
                          {netMovementPeriod === 'week' &&
                            (weeklySnapshotData.length >= 2
                              ? ' Week: weekly history anchors (WoW); tail may use interpolation to your viewed date.'
                              : ' Week: last 6 ISO weeks with data, first vs last snapshot in each week.')}
                          {netMovementPeriod === 'month' &&
                            ' Month: six completed calendar months; sparse months may use weekly interpolation at month bounds.'}
                          {netMovementPeriod === 'year' &&
                            (yearlySnapshotData.length >= 2
                              ? ' Year: yearly history anchors (YoY); tail may use interpolation to your viewed date.'
                              : weeklySnapshotData.length >= 2
                                ? ' Year: YoY between last weekly snapshot of each calendar year (up to six year transitions). 2022 uses 22 Feb as the series start (invasion-era) through the last 2022 anchor. Daily fallback uses the same 2022 start when weekly history is unavailable.'
                                : ' Year: last six calendar years from loaded dailies (first vs last snapshot per year).')}
                        </p>
                        <div
                          className={`w-full ${netMovementPeriod === 'day' ? 'h-[200px]' : 'h-[172px]'}`}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={netMovementChartRows}
                              margin={{
                                top: 28,
                                right: 8,
                                left: 8,
                                bottom: netMovementPeriod === 'day' ? 36 : 4,
                              }}
                              barCategoryGap="18%"
                            >
                              <XAxis
                                dataKey="periodLabel"
                                tick={{ fill: '#9ca3af', fontSize: netMovementPeriod === 'day' ? 9 : 11 }}
                                stroke="#475569"
                                axisLine={{ stroke: '#475569' }}
                                tickLine={false}
                                angle={netMovementPeriod === 'day' ? -42 : 0}
                                textAnchor={netMovementPeriod === 'day' ? 'end' : 'middle'}
                                interval={netMovementPeriod === 'day' ? 0 : 'preserveStartEnd'}
                                minTickGap={netMovementPeriod === 'day' ? 4 : 24}
                              />
                              <YAxis hide domain={netMovementYDomain} />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null;
                                  const p = payload[0].payload as NetMovementBarRow;
                                  if (!p.hasData || p.fullNet === null) {
                                    return (
                                      <div className="bg-osint-card border border-osint-border p-2 rounded-lg text-xs text-gray-400">
                                        {netMovementPeriod === 'week'
                                          ? 'Need 2+ snapshots in week'
                                          : netMovementPeriod === 'month'
                                            ? 'Need 2+ snapshots in month'
                                            : netMovementPeriod === 'year'
                                              ? 'Need 2+ snapshots or yearly anchors'
                                              : 'No value'}
                                      </div>
                                    );
                                  }
                                  const v = p.fullNet;
                                  return (
                                    <div className="bg-osint-card border border-osint-border p-2 rounded-lg shadow-xl text-xs max-w-xs">
                                      <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">
                                        {netMovementDeltaMode === 'russian'
                                          ? 'Δ Russian-controlled'
                                          : 'Δ Ukrainian-held'}
                                      </p>
                                      <p className="text-gray-200 font-medium">
                                        {v >= 0 ? '+' : ''}
                                        {Math.round(v).toLocaleString()} km²
                                      </p>
                                      <p className="text-gray-400 mt-1">{(p.pct ?? 0).toFixed(2)}% of Ukraine</p>
                                      {p.tooltipNote ? (
                                        <p className="text-gray-500 mt-2 leading-snug border-t border-osint-border pt-2">
                                          {p.tooltipNote}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                }}
                              />
                              <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
                              <Bar
                                dataKey="netKm2"
                                maxBarSize={44}
                                radius={[2, 2, 0, 0]}
                                label={renderNetMovementBarValueLabel(
                                  netMovementChartRows,
                                  netMovementDeltaMode,
                                )}
                              >
                                {netMovementChartRows.map((entry, barIdx) => {
                                  const RUSSIAN_BAR = '#ef4444';
                                  const UKRAINIAN_BAR = '#3b82f6';
                                  let fill = '#64748b';
                                  let opacity = 0.35;
                                  if (entry.hasData && entry.fullNet !== null) {
                                    opacity = 1;
                                    if (netMovementDeltaMode === 'russian') {
                                      if (entry.fullNet > 0) fill = RUSSIAN_BAR;
                                      else if (entry.fullNet < 0) fill = UKRAINIAN_BAR;
                                      else fill = '#94a3b8';
                                    } else {
                                      if (entry.fullNet > 0) fill = UKRAINIAN_BAR;
                                      else if (entry.fullNet < 0) fill = RUSSIAN_BAR;
                                      else fill = '#94a3b8';
                                    }
                                  }
                                  return (
                                    <Cell key={`${entry.periodLabel}-${barIdx}`} fill={fill} fillOpacity={opacity} />
                                  );
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {viewLevel === 'total' && (
              <div className="bg-osint-card rounded-lg px-2.5 py-4 sm:px-3 border border-osint-border">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-white leading-tight pr-1">
                    Oblast Breakdown - Russian Controlled Territory
                  </h3>
                  <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0 min-w-0">
                    <label className="flex items-center gap-1.5 flex-nowrap min-w-0 justify-end">
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 whitespace-nowrap shrink-0">
                        Δ RU
                      </span>
                      <select
                        value={oblastRussianChangePeriod}
                        onChange={(e) =>
                          setOblastRussianChangePeriod(e.target.value as OblastRussianChangePeriod)
                        }
                        title="Period for Russian Δ column"
                        className="max-w-[11rem] bg-osint-dark border border-osint-border rounded-md px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-ukraine-blue/40"
                        aria-label="Period for oblast Russian delta"
                      >
                        <option value="day">Day</option>
                        <option value="week">Week (~7d)</option>
                        <option value="month">Month (~30d)</option>
                        <option value="year">Year (~365d)</option>
                      </select>
                    </label>
                    <p className="text-[9px] text-gray-600 text-left sm:text-right leading-tight max-w-[18rem]">
                      {oblastRussianChangePeriod === 'day' && 'Previous available snapshot.'}
                      {oblastRussianChangePeriod === 'week' && 'Earliest snapshot on or after 7 days before viewed date.'}
                      {oblastRussianChangePeriod === 'month' && 'Earliest snapshot on or after 30 days before viewed date.'}
                      {oblastRussianChangePeriod === 'year' &&
                        (yearlySnapshotData.length > 0
                          ? 'YoY from yearly history when available; else weekly year-end YoY or ~365d window.'
                          : weeklySnapshotData.length >= 2
                            ? 'YoY vs prior year using last weekly snapshot per calendar year; else ~365d window.'
                            : 'Earliest snapshot on or after 365 days before viewed date.')}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-0.5">
                  <table className="w-full table-fixed text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-osint-border">
                        <th className="text-left py-1.5 px-1 text-gray-400 font-medium w-[20%]" title="Oblast">
                          Oblast
                        </th>
                        <th
                          className="text-right py-1.5 px-0.5 text-gray-400 font-medium w-[13%]"
                          title="Russian (km²)"
                        >
                          RU
                        </th>
                        <th
                          className="text-right py-1.5 px-0.5 text-gray-400 font-medium w-[11%]"
                          title="Δ Russian (km²)"
                        >
                          ΔRU
                        </th>
                        <th
                          className="text-right py-1.5 px-0.5 text-gray-400 font-medium w-[15%]"
                          title="Ukrainian (km²)"
                        >
                          UA
                        </th>
                        <th
                          className="text-right py-1.5 px-0.5 text-gray-400 font-medium w-[9%]"
                          title="Disputed (km²)"
                        >
                          Dis
                        </th>
                        <th
                          className="text-right py-1.5 px-0.5 text-gray-400 font-medium w-[15%]"
                          title="Total (km²)"
                        >
                          Tot
                        </th>
                        <th
                          className="text-right py-1.5 px-1 text-gray-400 font-medium w-[17%]"
                          title="Russian %"
                        >
                          RU%
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOblasts.map((oblast) => {
                        const disputed = oblast.disputed_controlled_km2 || 0;
                        const fallbackControlledTotal =
                          oblast.russian_controlled_km2 + oblast.ukrainian_controlled_km2 + disputed;
                        const oblastTotal = oblast.total_area_km2 > 0 ? oblast.total_area_km2 : fallbackControlledTotal;
                        const russianPct = (oblast.russian_controlled_km2 / Math.max(oblastTotal, 1)) * 100;
                        const endIdx = dataUpToSelected.length > 0 ? dataUpToSelected.length - 1 : -1;
                        const dRussian =
                          endIdx >= 0
                            ? getOblastRussianChangeKm2(
                                dataUpToSelected,
                                oblast.oblast,
                                oblastRussianChangePeriod,
                                endIdx,
                                {
                                  yearlySnapshots: yearlySnapshotData,
                                  weeklySnapshots: weeklySnapshotData,
                                  selectedDate,
                                },
                              )
                            : 0;
                        const dRuClass =
                          dRussian > 0 ? 'text-red-400' : dRussian < 0 ? 'text-blue-400' : 'text-gray-500';
                        const dRuText = `${dRussian >= 0 ? '+' : ''}${Math.round(dRussian).toLocaleString()}`;
                        const oblastLabel = OBLAST_NAMES[oblast.oblast] || oblast.oblast;

                        return (
                          <tr key={oblast.oblast} className="border-b border-osint-border/50 hover:bg-white/5">
                            <td
                              className="py-1.5 px-1 text-white truncate max-w-0"
                              title={oblastLabel}
                            >
                              {oblastLabel}
                            </td>
                            <td className="py-1.5 px-0.5 text-right tabular-nums text-red-400">
                              {Math.round(oblast.russian_controlled_km2).toLocaleString()}
                            </td>
                            <td className={`py-1.5 px-0.5 text-right tabular-nums font-medium ${dRuClass}`}>
                              {dRuText}
                            </td>
                            <td className="py-1.5 px-0.5 text-right tabular-nums text-blue-400">
                              {Math.round(oblast.ukrainian_controlled_km2).toLocaleString()}
                            </td>
                            <td className="py-1.5 px-0.5 text-right tabular-nums text-amber-400">
                              {disputed > 0 ? Math.round(disputed).toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-0.5 text-right tabular-nums text-gray-300">
                              {Math.round(oblastTotal).toLocaleString()}
                            </td>
                            <td className="py-1.5 px-1 text-right tabular-nums text-white">
                              {formatPercent(russianPct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-osint-border bg-white/[0.03]">
                        <td className="py-1.5 px-1 text-gray-300 font-medium">Total</td>
                        <td className="py-1.5 px-0.5 text-right tabular-nums font-medium text-red-400">
                          {Math.round(oblastTableRuTotals.totalRuKm2).toLocaleString()}
                        </td>
                        <td
                          className={`py-1.5 px-0.5 text-right tabular-nums font-medium ${
                            oblastTableRuTotals.totalDeltaRuKm2 > 0
                              ? 'text-red-400'
                              : oblastTableRuTotals.totalDeltaRuKm2 < 0
                                ? 'text-blue-400'
                                : 'text-gray-500'
                          }`}
                        >
                          {oblastTableRuTotals.totalDeltaRuKm2 >= 0 ? '+' : ''}
                          {Math.round(oblastTableRuTotals.totalDeltaRuKm2).toLocaleString()}
                        </td>
                        <td className="py-1.5 px-0.5 text-right text-gray-600">—</td>
                        <td className="py-1.5 px-0.5 text-right text-gray-600">—</td>
                        <td className="py-1.5 px-0.5 text-right text-gray-600">—</td>
                        <td className="py-1.5 px-1 text-right text-gray-600">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div
                  className="mt-3 pt-3 border-t border-osint-border/60 text-[10px] sm:text-[11px] text-gray-500 leading-snug space-y-1.5"
                  aria-label="Column legend"
                >
                  <p className="text-gray-400 font-medium text-[10px] uppercase tracking-wide">
                    Legend
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1 list-none p-0 m-0">
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-sm bg-red-400" aria-hidden />
                      <span>
                        <span className="text-gray-300">RU</span> — Russian-controlled area (km²) for the
                        viewed date.
                      </span>
                    </li>
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 flex h-2 w-2 shrink-0 rounded-sm border border-gray-500 bg-osint-dark" aria-hidden />
                      <span>
                        <span className="text-gray-300">ΔRU</span> — Change in Russian-controlled area for
                        the selected period (Day / Week / Month).{' '}
                        <span className="text-red-400">Red</span> = net gain,{' '}
                        <span className="text-blue-400">blue</span> = net loss, gray = no change.
                      </span>
                    </li>
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-sm bg-blue-400" aria-hidden />
                      <span>
                        <span className="text-gray-300">UA</span> — Ukrainian-controlled area (km²).
                      </span>
                    </li>
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-sm bg-amber-400" aria-hidden />
                      <span>
                        <span className="text-gray-300">Dis</span> — Disputed / contested area (km²); “—” if
                        none reported.
                      </span>
                    </li>
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-sm bg-gray-400" aria-hidden />
                      <span>
                        <span className="text-gray-300">Tot</span> — Total oblast land area (km²).
                      </span>
                    </li>
                    <li className="flex gap-1.5 items-start">
                      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-sm bg-white" aria-hidden />
                      <span>
                        <span className="text-gray-300">RU%</span> — Russian share of oblast area (RU ÷ Tot).
                      </span>
                    </li>
                  </ul>
                  <p className="text-gray-600 pt-0.5">
                    <span className="text-gray-300">Total row</span> — Sum of RU and ΔRU across the oblasts
                    shown in the table (same rows as above).
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Charts Section */}
        <section className="mb-10">
          <div className="grid grid-cols-1 gap-6">
            <ChartSection
              dailyData={dataUpToSelected}
              weeklySnapshotData={weeklySnapshotData}
              yearlySnapshotData={yearlySnapshotData}
              selectedDate={selectedDate || latestAvailableDate}
              title="Territory Control Over Time"
              oblast={viewLevel === 'oblast' ? selectedOblast : undefined}
            />
            <MonthlyComparisonChart
              fullDailyData={currentData}
              weeklySnapshotData={weeklySnapshotData}
              selectedDate={selectedDate || latestAvailableDate}
              oblast={viewLevel === 'oblast' ? selectedOblast : undefined}
            />
          </div>
        </section>

        {/* Marimekko Chart (only in oblast view with data) */}
        {viewLevel === 'oblast' && todayData && (
          <section className="mb-10">
            <MarimekkoChart oblasts={todayData.oblasts} />
          </section>
        )}

        {/* Oblast Grid View (only in oblast view with data) */}
        {viewLevel === 'oblast' && todayData && (
          <section className="mb-10">
            <OblastGridView oblasts={todayData.oblasts} />
          </section>
        )}

        {/* Data Source Footer */}
        <footer className="border-t border-osint-border pt-6 mt-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-sm text-gray-400">
                Data Source: DeepStateMap
              </p>
              <p className="text-xs text-gray-500 mt-2 max-w-xl leading-relaxed">
                DeepState / DeepStateMap:{' '}
                <a
                  href="https://deepstatemap.live/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ukraine-blue hover:underline"
                >
                  map
                </a>
                {' · '}
                <a
                  href="https://deepstateua.shop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ukraine-blue hover:underline"
                >
                  shop
                </a>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Snapshot date: {selectedDate ? formatShortDate(selectedDate) : 'N/A'}
                {todayData ? ` • Source updated: ${new Date(todayData.last_updated).toLocaleString()}` : ''}
                {' '}• {currentData.length} daily snapshots loaded
                {weeklySnapshotData.length > 0
                  ? ` • ${weeklySnapshotData.length} weekly anchors`
                  : ''}
                {yearlySnapshotData.length > 0
                  ? ` • ${yearlySnapshotData.length} yearly anchors`
                  : ''}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                <a 
                  href="https://github.com/slimmo2005-gif/ukraine-territory-data/tree/master" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-ukraine-blue transition-colors"
                >
                  github.com/slimmo2005-gif/ukraine-territory-data
                </a>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Built with React + TypeScript + Recharts
              </p>
              <p className="text-xs text-gray-600 mt-1">
                View: {viewLevel === 'total' ? 'Total Ukraine' : OBLAST_NAMES[selectedOblast]}
              </p>
            </div>
          </div>
        </footer>
          </>
        )}
      </main>

      {showHistoryHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowHistoryHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-help-title"
        >
          <div
            className="max-w-md w-full bg-osint-card border border-osint-border rounded-lg shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h4 id="history-help-title" className="text-base font-semibold text-white">
                How history works
              </h4>
              <button
                type="button"
                className="text-gray-400 hover:text-white text-sm"
                onClick={() => setShowHistoryHelp(false)}
                aria-label="Close how history works"
              >
                Close
              </button>
            </div>
            <ul className="text-sm text-gray-300 space-y-2 list-disc pl-5">
              <li>Source: DeepStateMap snapshots.</li>
              <li>Historical files are preprocessed for consistency.</li>
              <li>Some dates are missing because no source snapshot exists for that day.</li>
              <li>
                Weekly charts (when available) use <code className="text-gray-400">data/history/weekly/</code>:
                one point every 7 days in UTC from 2026-01-01, with week-over-week deltas vs the prior weekly
                file. Anchor dates are labels; tooltips note Wayback or derived-from-daily/weekly when the
                extractor filled a point from a nearby capture.
              </li>
              <li>
                Yearly series (when available) use <code className="text-gray-400">data/history/yearly/</code>:
                year-over-year deltas vs the prior yearly anchor. Without those files, the app falls back to
                calendar-year ranges from daily snapshots.
              </li>
              <li>Values are estimates from map geometry — not official government accounting.</li>
              <li>Use Prev / Next to step between available dates, or pick any date and we&apos;ll snap to the nearest snapshot.</li>
              <li>Click &quot;Jump to latest&quot; to return to the live view.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
