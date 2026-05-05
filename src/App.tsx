import { useState, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { MetricCard } from '@/components/MetricCard';
import { ChartSection } from '@/components/ChartSection';
import { TerritoryMap } from '@/components/TerritoryMap';
import { DataSourceSelector } from '@/components/DataSourceSelector';
import { ViewLevelToggle } from '@/components/ViewLevelToggle';
import { MarimekkoChart, OblastGridView } from '@/components/MarimekkoChart';
import { OBLAST_NAMES } from '@/data/mockData';
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

async function fetchDataForDate(dateString: string): Promise<DailyTerritoryData | null> {
  try {
    const url = `${DATA_REPO_BASE_URL}/${dateString}.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Data not yet available for ${dateString}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data as DailyTerritoryData;
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
  const activeOblasts = todayData?.oblasts?.filter(o => 
    o.russian_controlled_km2 > 0 || o.disputed_km2 > 0
  ).sort((a, b) => b.russian_controlled_km2 - a.russian_controlled_km2) || [];

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

        {/* Metrics Overview */}
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
            <MetricCard
              title={viewLevel === 'total' ? 'Total Territory Control' : 'Oblast Territory Control'}
              russianValue={metrics.today.russianControlled}
              ukrainianValue={metrics.today.ukrainianControlled}
              disputedValue={metrics.today.disputed}
              unit="km²"
              russianChange={metrics.today.russianChange}
              ukrainianChange={metrics.today.ukrainianChange}
              disputedChange={metrics.today.disputedChange}
              showNetChange={true}
            />
            
            {/* Summary Stats */}
            <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
              <h3 className="text-lg font-semibold text-white mb-4">
                {viewLevel === 'total' ? 'Territory Breakdown' : 'Oblast Details'}
              </h3>
              {(() => {
                const totalArea = metrics.current.totalArea || 1;
                const russianPct = (metrics.current.russianControlled / totalArea) * 100;
                const disputedPct = (metrics.current.disputed / totalArea) * 100;
                // Ukrainian includes both controlled + uncontested (not contested = all other land)
                const ukrainianPct = 100 - russianPct - disputedPct;
                
                const formatLarge = (n: number) => Math.round(n).toLocaleString();
                const ukrainianTotal = totalArea - metrics.current.russianControlled - metrics.current.disputed;
                
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Russian Controlled</span>
                      <div className="text-right">
                        <span className="text-red-400 font-medium">{russianPct.toFixed(1)}%</span>
                        <span className="text-gray-500 text-sm ml-2">({formatLarge(metrics.current.russianControlled)} km²)</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ukrainian Controlled</span>
                      <div className="text-right">
                        <span className="text-blue-400 font-medium">{ukrainianPct.toFixed(1)}%</span>
                        <span className="text-gray-500 text-sm ml-2">({formatLarge(ukrainianTotal)} km²)</span>
                      </div>
                    </div>
                    {(metrics.current.disputed > 0 || disputedPct > 0.1) && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Disputed/Contested</span>
                        <div className="text-right">
                          <span className="text-amber-400 font-medium">{disputedPct.toFixed(1)}%</span>
                          <span className="text-gray-500 text-sm ml-2">({formatLarge(metrics.current.disputed)} km²)</span>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-osint-border pt-3 mt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-medium">Total Area</span>
                        <span className="text-white font-bold">
                          {formatLarge(totalArea)} km²
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
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

        {/* Oblast Breakdown (only in total view) */}
        {viewLevel === 'total' && (
          <section className="mb-10">
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
                    {activeOblasts.map((oblast) => (
                      <tr key={oblast.oblast} className="border-b border-osint-border/50 hover:bg-white/5">
                        <td className="py-2 px-3 text-white">
                          {OBLAST_NAMES[oblast.oblast]}
                        </td>
                        <td className="py-2 px-3 text-right text-red-400">
                          {oblast.russian_controlled_km2.toFixed(1)} km²
                        </td>
                        <td className="py-2 px-3 text-right text-blue-400">
                          {oblast.ukrainian_controlled_km2.toFixed(1)} km²
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400">
                          {oblast.disputed_km2 > 0 ? `${oblast.disputed_km2.toFixed(1)} km²` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-white">
                          {((oblast.russian_controlled_km2 / oblast.total_area_km2) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
