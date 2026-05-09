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
import { ChartSection } from '@/components/ChartSection';
import { TerritoryMap } from '@/components/TerritoryMap';
import { DataSourceSelector } from '@/components/DataSourceSelector';
import { ViewLevelToggle } from '@/components/ViewLevelToggle';
import { MarimekkoChart, OblastGridView } from '@/components/MarimekkoChart';
import { OBLAST_NAMES } from '@/data/mockData';
import { EXCLUDED_DATES } from '@/config/excludedDates';
import { 
  getTodayMetrics, 
  get7DaySummary, 
  getCurrentControlTotals,
  getOblastData,
  getLastSixCompletedMonthsNetMovement,
} from '@/utils/calculations';
import type { DataSource, ViewLevel, OblastKey, DailyTerritoryData } from '@/types';

/**
 * Fetch territory data from GitHub repository
 * Repo: https://github.com/slimmo2005-gif/ukraine-territory-data
 */
const DATA_REPO_RAW_BASE_URL = 'https://raw.githubusercontent.com/slimmo2005-gif/ukraine-territory-data';
const DATA_REPO_API_BASE_URL = 'https://api.github.com/repos/slimmo2005-gif/ukraine-territory-data/contents';
const DATA_DIRECTORIES = ['data', 'data/history'];
const DATA_REPO_BRANCHES = ['master', 'main'];

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
    const response = await fetch(url, { cache: 'no-store' });
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

async function discoverDateSources(): Promise<DateKeySources> {
  const dateToUrls: DateKeySources = new Map();

  for (const directory of DATA_DIRECTORIES) {
    let entries: { name: string; type: string }[] | null = null;
    let resolvedBranch: string | null = null;

    for (const branch of DATA_REPO_BRANCHES) {
      try {
        const response = await fetch(`${DATA_REPO_API_BASE_URL}/${directory}?ref=${branch}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          continue;
        }
        entries = await response.json() as { name: string; type: string }[];
        resolvedBranch = branch;
        break;
      } catch {
        // Try next branch.
      }
    }

    if (!entries || !resolvedBranch) {
      continue;
    }

    for (const entry of entries) {
      if (entry.type !== 'file') continue;
      const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (!match) continue;
      const dateKey = match[1];
      if (EXCLUDED_DATES.has(dateKey)) continue;
      const url = `${DATA_REPO_RAW_BASE_URL}/${resolvedBranch}/${directory}/${entry.name}`;
      const existing = dateToUrls.get(dateKey) || [];
      existing.push(url);
      dateToUrls.set(dateKey, existing);
    }
  }

  return dateToUrls;
}

async function fetchDateRange(startDate: Date, endDate: Date): Promise<DailyTerritoryData[]> {
  const startKey = startDate.toISOString().split('T')[0];
  const endKey = endDate.toISOString().split('T')[0];

  const dateSources = await discoverDateSources();

  let dateKeys = Array.from(dateSources.keys())
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
    const data: DailyTerritoryData[] = [];
    for (const { dateKey, url } of fallback) {
      const dayData = await fetchDataFromUrl(url, dateKey);
      if (dayData) data.push(dayData);
    }
    return data;
  }

  const data: DailyTerritoryData[] = [];
  for (const dateKey of dateKeys) {
    const urls = dateSources.get(dateKey) || [];
    for (const url of urls) {
      const dayData = await fetchDataFromUrl(url, dateKey);
      if (dayData) {
        data.push(dayData);
        break;
      }
    }
  }

  return data;
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
 * - Multi-source data tracking (DeepState, ISW, Combined)
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

function App() {
  // State
  const [dataSource, setDataSource] = useState<DataSource>('deepstate');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('total');
  const [selectedOblast, setSelectedOblast] = useState<OblastKey>('donetsk');
  const [historicalData, setHistoricalData] = useState<DailyTerritoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showHistoryHelp, setShowHistoryHelp] = useState<boolean>(false);

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch last 90 days of data
        const endDate = new Date();
        const startDate = getDateDaysAgo(90);
        
        const data = await fetchDateRange(startDate, endDate);
        
        setHistoricalData(data);
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

  // Get metrics based on view level - operates on data up to selected date.
  const metrics = useMemo(() => {
    if (viewLevel === 'total') {
      const today = getTodayMetrics(dataUpToSelected);
      const week7 = get7DaySummary(dataUpToSelected);
      const current = getCurrentControlTotals(dataUpToSelected);
      return { today, week7, current, isOblast: false };
    } else {
      // Oblast-level metrics
      const oblastData = getOblastData(dataUpToSelected, selectedOblast);
      const today = oblastData[oblastData.length - 1];
      
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
        isOblast: true,
      };
    }
  }, [dataUpToSelected, viewLevel, selectedOblast]);

  const completedMonthNets = useMemo(
    () =>
      getLastSixCompletedMonthsNetMovement(
        dataUpToSelected,
        viewLevel === 'oblast' ? selectedOblast : undefined,
      ),
    [dataUpToSelected, viewLevel, selectedOblast],
  );

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
              <DataSourceSelector
                selectedSource={dataSource}
                onSourceChange={setDataSource}
              />
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
              <h3 className="text-lg font-semibold text-white mb-4">Territory Breakdown</h3>
              {(() => {
                const totalArea = metrics.current.totalArea || 1;
                const russianPct = (metrics.current.russianControlled / totalArea) * 100;
                const disputedPct = (metrics.current.disputed / totalArea) * 100;
                const ukrainianPct = 100 - russianPct - disputedPct;
                const ukrainianTotal = totalArea - metrics.current.russianControlled - metrics.current.disputed;

                const deltaSuffix = isLive
                  ? 'vs previous day'
                  : previousDateLabel
                    ? `vs ${previousDateLabel}`
                    : 'vs previous available date';

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Russian Controlled</span>
                      <div className="text-right">
                        <span className="text-red-400 font-medium">{formatPercentOneDecimal(russianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.russianControlled)})</span>
                        <p className="text-xs text-red-400/80">{formatDeltaKm2(metrics.today.russianChange)} {deltaSuffix}</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ukrainian Controlled</span>
                      <div className="text-right">
                        <span className="text-blue-400 font-medium">{formatPercentOneDecimal(ukrainianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(ukrainianTotal)})</span>
                        <p className="text-xs text-blue-400/80">{formatDeltaKm2(metrics.today.ukrainianChange)} {deltaSuffix}</p>
                      </div>
                    </div>
                    {(metrics.current.disputed > 0 || disputedPct > 0.1) && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disputed/Contested</span>
                        <div className="text-right">
                          <span className="text-amber-400 font-medium">{formatPercentOneDecimal(disputedPct)}</span>
                          <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.disputed)})</span>
                          <p className="text-xs text-amber-400/80">{formatDeltaKm2(metrics.today.disputedChange)} {deltaSuffix}</p>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-osint-border pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Total Area</span>
                        <span className="text-white font-bold">{formatKm2(totalArea)}</span>
                      </div>
                      <div className="mt-4">
                        <p className="text-gray-400 font-medium mb-1">Monthly net movement</p>
                        <p className="text-xs text-gray-500 mb-3">
                          Last six completed months (e.g. Nov 25–Apr 26 when viewing from May). Each bar:
                          first vs last snapshot in that month (Δ Russian − Δ Ukrainian controlled). Percent
                          is of total Ukraine area on that month&apos;s last snapshot.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                          {completedMonthNets.map((row) => {
                            const net = row.netKm2;
                            const pct = row.netPctOfTotalUkraine;
                            const mag = Math.max(Math.abs(net), 50);
                            const domainMax = Math.ceil(mag * 1.25);
                            const monthDomain: [number, number] = [-domainMax, domainMax];
                            const monthBarData = [{ name: 'Net', value: net }];
                            const canPlot = row.snapshotCount >= 2;

                            return (
                              <div
                                key={row.monthKey}
                                className="rounded-lg border border-osint-border bg-osint-dark/40 p-3"
                              >
                                <p className="text-sm font-semibold text-white mb-1">{row.label}</p>
                                {canPlot ? (
                                  <>
                                    <p
                                      className={`text-xs font-medium mb-2 ${
                                        net >= 0 ? 'text-red-400' : 'text-blue-400'
                                      }`}
                                    >
                                      {net >= 0 ? '+' : ''}
                                      {Math.round(net).toLocaleString()} km²
                                      <span className="text-gray-500 font-normal">
                                        {' '}
                                        ({pct.toFixed(2)}%)
                                      </span>
                                    </p>
                                    <div className="h-24 w-full">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                          layout="vertical"
                                          data={monthBarData}
                                          margin={{ top: 2, right: 8, left: 2, bottom: 2 }}
                                        >
                                          <XAxis
                                            type="number"
                                            domain={monthDomain}
                                            tick={{ fill: '#6b7280', fontSize: 10 }}
                                            stroke="#475569"
                                            tickFormatter={(v) => Math.round(Number(v)).toLocaleString()}
                                          />
                                          <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={36}
                                            tick={{ fill: '#6b7280', fontSize: 10 }}
                                            stroke="#475569"
                                          />
                                          <Tooltip
                                            content={({ active, payload }) => {
                                              if (!active || !payload?.length) return null;
                                              const v = Number(payload[0].value);
                                              return (
                                                <div className="bg-osint-card border border-osint-border p-2 rounded-lg shadow-xl text-xs">
                                                  <p className="text-gray-200 font-medium">
                                                    {v >= 0 ? '+' : ''}
                                                    {Math.round(v).toLocaleString()} km²
                                                  </p>
                                                  <p className="text-gray-400 mt-1">{pct.toFixed(2)}% of Ukraine</p>
                                                </div>
                                              );
                                            }}
                                          />
                                          <ReferenceLine x={0} stroke="#64748b" strokeDasharray="4 4" />
                                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                            <Cell fill={net >= 0 ? '#ef4444' : '#3b82f6'} />
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-gray-500">
                                    {row.snapshotCount === 0
                                      ? 'No snapshots this month in the loaded range.'
                                      : 'Need at least two snapshots in the month to show movement.'}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {viewLevel === 'total' && (
              <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Oblast Breakdown - Russian Controlled Territory
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-osint-border">
                        <th className="text-left py-2 px-3 text-gray-400 font-medium">Oblast</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Russian (km²)</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Ukrainian (km²)</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Disputed (km²)</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Total (km²)</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Russian %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOblasts.map((oblast) => {
                        const disputed = oblast.disputed_controlled_km2 || 0;
                        const fallbackControlledTotal =
                          oblast.russian_controlled_km2 + oblast.ukrainian_controlled_km2 + disputed;
                        const oblastTotal = oblast.total_area_km2 > 0 ? oblast.total_area_km2 : fallbackControlledTotal;
                        const russianPct = (oblast.russian_controlled_km2 / Math.max(oblastTotal, 1)) * 100;

                        return (
                          <tr key={oblast.oblast} className="border-b border-osint-border/50 hover:bg-white/5">
                            <td className="py-2 px-3 text-white">
                              {OBLAST_NAMES[oblast.oblast] || oblast.oblast}
                            </td>
                            <td className="py-2 px-3 text-right text-red-400">
                              {Math.round(oblast.russian_controlled_km2).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-400">
                              {Math.round(oblast.ukrainian_controlled_km2).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-400">
                              {disputed > 0 ? Math.round(disputed).toLocaleString() : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-300">
                              {Math.round(oblastTotal).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-white">
                              {formatPercent(russianPct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Charts Section */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSection
              data={dataUpToSelected}
              title="Territory Control Over Time"
              chartType="control"
            />
            <ChartSection
              data={dataUpToSelected}
              title="Daily Changes"
              chartType="change"
            />
          </div>
        </section>

        {/* Map Section */}
        <section className="mb-10">
          <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-white">Frontline Map</h3>
              <span className="text-xs text-gray-500">
                Map slider mirrors the Date Navigator above. Slide to time-travel.
              </span>
            </div>
            <TerritoryMap
              data={currentData}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
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
                Data Source: {dataSource === 'deepstate' ? 'DeepStateMap' : dataSource === 'isw' ? 'Institute for the Study of War' : 'Combined (Averaged)'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Snapshot date: {selectedDate ? formatShortDate(selectedDate) : 'N/A'}
                {todayData ? ` • Source updated: ${new Date(todayData.last_updated).toLocaleString()}` : ''}
                {' '}• {currentData.length} days loaded
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
                Built with React + TypeScript + Leaflet + Recharts
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
