import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { MetricCard } from '@/components/MetricCard';
import { ChartSection } from '@/components/ChartSection';
import { TerritoryMap } from '@/components/TerritoryMap';
import { mockTerritoryData } from '@/data/mockData';
import { 
  getTodayMetrics, 
  get7DaySummary, 
  getCumulativeTotals 
} from '@/utils/calculations';

/**
 * Main App Component - Ukraine War Territory Tracker Dashboard
 * 
 * Architecture:
 * - Data layer: Static JSON (mock data for now, replaceable with API)
 * - State management: React hooks (useState, useMemo for derived data)
 * - Components: Modular, reusable with clear props interface
 * - Styling: Tailwind CSS with custom OSINT color theme
 * 
 * Future data ingestion points:
 * - Replace mockTerritoryData with fetch from API
 * - Add useEffect for data refresh
 * - Add WebSocket support for real-time updates
 */
function App() {
  // State
  const [data] = useState(mockTerritoryData);
  const [selectedMapDate, setSelectedMapDate] = useState(
    mockTerritoryData[mockTerritoryData.length - 1].date
  );

  // Derived metrics (calculated once per data change)
  const metrics = useMemo(() => {
    const today = getTodayMetrics(data);
    const week7 = get7DaySummary(data);
    const cumulative = getCumulativeTotals(data);
    
    return { today, week7, cumulative };
  }, [data]);

  // Current day's data for front breakdown
  const todayData = data[data.length - 1];

  return (
    <div className="min-h-screen bg-osint-dark text-white">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Overview */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-6 text-white">Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Russian Gain Today"
              value={metrics.today.russianGain}
              unit="km²"
              change={metrics.today.russianChange}
              trend="up"
              color="red"
            />
            <MetricCard
              title="Ukrainian Regain Today"
              value={metrics.today.ukrainianGain}
              unit="km²"
              change={metrics.today.ukrainianChange}
              trend="up"
              color="blue"
            />
            <MetricCard
              title="7-Day Net Change"
              value={metrics.week7.netChange}
              unit="km²"
              changeLabel="Russian advantage"
              trend={metrics.week7.netChange > 0 ? 'up' : 'down'}
              color="neutral"
            />
            <MetricCard
              title="90-Day Net Russian Gain"
              value={metrics.cumulative.netRussianGain}
              unit="km²"
              changeLabel="cumulative"
              trend={metrics.cumulative.netRussianGain > 0 ? 'up' : 'down'}
              color="neutral"
            />
          </div>
        </section>

        {/* Charts Section */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSection
              data={data}
              title="Territorial Change Over Time"
              chartType="change"
            />
            <ChartSection
              data={data}
              title="Cumulative Territory Control"
              chartType="cumulative"
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
              data={data}
              selectedDate={selectedMapDate}
              onDateChange={setSelectedMapDate}
            />
          </div>
        </section>

        {/* Front Breakdown */}
        <section className="mb-10">
          <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
            <h3 className="text-lg font-semibold text-white mb-4">
              Today's Front Activity
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(todayData.fronts).map(([front, value]) => (
                <div 
                  key={front}
                  className="bg-osint-dark p-4 rounded-lg border border-osint-border"
                >
                  <p className="text-xs text-gray-400 uppercase mb-1">
                    {front}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {value?.toFixed(1) || '0.0'} km²
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7-Day Summary */}
        <section className="mb-10">
          <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
            <h3 className="text-lg font-semibold text-white mb-4">
              7-Day Rolling Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-400">
                  {metrics.week7.russianTotal} km²
                </p>
                <p className="text-sm text-gray-400 mt-1">Russian Total</p>
                <p className="text-xs text-gray-500">
                  {metrics.week7.avgDailyRussian} km²/day avg
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">
                  {metrics.week7.ukrainianTotal} km²
                </p>
                <p className="text-sm text-gray-400 mt-1">Ukrainian Total</p>
                <p className="text-xs text-gray-500">
                  {metrics.week7.avgDailyUkrainian} km²/day avg
                </p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold ${
                  metrics.week7.netChange > 0 ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {metrics.week7.netChange > 0 ? '+' : ''}{metrics.week7.netChange} km²
                </p>
                <p className="text-sm text-gray-400 mt-1">Net Change</p>
                <p className="text-xs text-gray-500">
                  Russian advantage
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Source Footer */}
        <footer className="border-t border-osint-border pt-6 mt-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <p className="text-sm text-gray-400">
                Data Source: Mock data for demonstration
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Replace with actual OSINT data feeds
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Built with React + TypeScript + Leaflet + Recharts
              </p>
              <p className="text-xs text-gray-600 mt-1">
                GitHub Pages Ready
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
