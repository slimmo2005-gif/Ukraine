import { useState, useMemo, useEffect } from 'react';
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
} from '@/utils/calculations';
import type { DataSource, ViewLevel, OblastKey, DailyTerritoryData } from '@/types';

/**
 * Fetch territory data from GitHub repository
 * Repo: https://github.com/slimmo2005-gif/ukraine-territory-data
 */
const DATA_REPO_BASE_URL = 'https://raw.githubusercontent.com/slimmo2005-gif/ukraine-territory-data/master/data';

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

async function fetchDataForDate(dateString: string): Promise<DailyTerritoryData | null> {
  if (EXCLUDED_DATES.has(toDateKey(dateString))) {
    console.log(`Skipping excluded date ${dateString}`);
    return null;
  }

  try {
    const url = `${DATA_REPO_BASE_URL}/${dateString}.json?ts=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Data not yet available for ${dateString}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as DailyTerritoryData;
    if (EXCLUDED_DATES.has(toDateKey(data.date))) {
      console.log(`Skipping excluded payload date ${data.date}`);
      return null;
    }
    return data;
  } catch (error) {
    console.error(`Failed to fetch data for ${dateString}:`, error);
    return null;
  }
}

async function fetchDateRange(startDate: Date, endDate: Date): Promise<DailyTerritoryData[]> {
  const data: DailyTerritoryData[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = await fetchDataForDate(dateStr);
    
    if (dayData) {
      data.push(dayData);
    }
    
    current.setDate(current.getDate() + 1);
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
function App() {
  // State
  const [dataSource, setDataSource] = useState<DataSource>('deepstate');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('total');
  const [selectedOblast, setSelectedOblast] = useState<OblastKey>('donetsk');
  const [historicalData, setHistoricalData] = useState<DailyTerritoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMapDate, setSelectedMapDate] = useState<string>('');

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
          setSelectedMapDate(data[data.length - 1].date);
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

  // Get metrics based on view level
  const metrics = useMemo(() => {
    if (viewLevel === 'total') {
      const today = getTodayMetrics(currentData);
      const week7 = get7DaySummary(currentData);
      const current = getCurrentControlTotals(currentData);
      return { today, week7, current, isOblast: false };
    } else {
      // Oblast-level metrics
      const oblastData = getOblastData(currentData, selectedOblast);
      const today = oblastData[oblastData.length - 1];
      
      return {
        today: {
          russianControlled: today.russianControlled,
          ukrainianControlled: today.ukrainianControlled,
          disputed: today.disputed,
          russianChange: today.russianChange,
          ukrainianChange: today.ukrainianChange,
          disputedChange: today.disputedChange,
        },
        week7: {
          russianAvg: 0, // Calculated differently for oblast
          ukrainianAvg: 0,
          disputedAvg: today.disputed,
        },
        current: {
          russianControlled: today.russianControlled,
          ukrainianControlled: today.ukrainianControlled,
          disputed: today.disputed,
          totalArea: today.totalArea,
        },
        isOblast: true,
      };
    }
  }, [currentData, viewLevel, selectedOblast]);

  // Current day's data for oblast breakdown (only if data exists)
  const todayData = currentData.length > 0 ? currentData[currentData.length - 1] : null;

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
        <section className="mb-8">
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

        {/* Metrics + Oblast Overview */}
        <section className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">
              {viewLevel === 'total' ? 'Ukraine Territory Control' : `${OBLAST_NAMES[selectedOblast]} Oblast Control`}
            </h2>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              currentData.length > 0 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {currentData.length > 0 ? 'LIVE DATA' : 'NO DATA'}
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
                const netChange = metrics.today.russianChange - metrics.today.ukrainianChange;

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Russian Controlled</span>
                      <div className="text-right">
                        <span className="text-red-400 font-medium">{formatPercent(russianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.russianControlled)})</span>
                        <p className="text-xs text-red-400/80">{formatDeltaKm2(metrics.today.russianChange)} today</p>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ukrainian Controlled</span>
                      <div className="text-right">
                        <span className="text-blue-400 font-medium">{formatPercent(ukrainianPct)}</span>
                        <span className="text-gray-500 text-sm ml-2">({formatKm2(ukrainianTotal)})</span>
                        <p className="text-xs text-blue-400/80">{formatDeltaKm2(metrics.today.ukrainianChange)} today</p>
                      </div>
                    </div>
                    {(metrics.current.disputed > 0 || disputedPct > 0.1) && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disputed/Contested</span>
                        <div className="text-right">
                          <span className="text-amber-400 font-medium">{formatPercent(disputedPct)}</span>
                          <span className="text-gray-500 text-sm ml-2">({formatKm2(metrics.current.disputed)})</span>
                          <p className="text-xs text-amber-400/80">{formatDeltaKm2(metrics.today.disputedChange)} today</p>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-osint-border pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Total Area</span>
                        <span className="text-white font-bold">{formatKm2(totalArea)}</span>
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-400 font-medium">Net Change</span>
                        <span className={netChange >= 0 ? 'text-red-400 font-semibold' : 'text-blue-400 font-semibold'}>
                          {formatDeltaKm2(netChange)} {netChange >= 0 ? '(Russian advantage)' : '(Ukrainian advantage)'}
                        </span>
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
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Russian</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Ukrainian</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Disputed</th>
                        <th className="text-right py-2 px-3 text-gray-400 font-medium">Russian %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeOblasts.map((oblast) => {
                        const disputed = oblast.disputed_controlled_km2 || 0;
                        const denominator = Math.max(
                          oblast.total_area_km2,
                          oblast.russian_controlled_km2 + oblast.ukrainian_controlled_km2 + disputed,
                          1,
                        );
                        const russianPct = (oblast.russian_controlled_km2 / denominator) * 100;

                        return (
                          <tr key={oblast.oblast} className="border-b border-osint-border/50 hover:bg-white/5">
                            <td className="py-2 px-3 text-white">
                              {OBLAST_NAMES[oblast.oblast]}
                            </td>
                            <td className="py-2 px-3 text-right text-red-400">
                              {formatKm2(oblast.russian_controlled_km2)}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-400">
                              {formatKm2(oblast.ukrainian_controlled_km2)}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-400">
                              {disputed > 0 ? formatKm2(disputed) : '-'}
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
              data={currentData}
              title="Territory Control Over Time"
              chartType="control"
            />
            <ChartSection
              data={currentData}
              title="Daily Changes"
              chartType="change"
            />
          </div>
        </section>

        {/* Map Section */}
        <section className="mb-10">
          <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
            <h3 className="text-lg font-semibold text-white mb-4">
              Frontline Map
            </h3>
            <TerritoryMap
              data={currentData}
              selectedDate={selectedMapDate}
              onDateChange={setSelectedMapDate}
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
                Last updated: {todayData ? new Date(todayData.last_updated).toLocaleString() : 'N/A'} • {currentData.length} days loaded
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
    </div>
  );
}

export default App;
