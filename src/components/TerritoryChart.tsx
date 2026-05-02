import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { DailyTerritoryData, ChartDataPoint, AggregatedData, TimeRange } from '@/types';
import { 
  calculateCumulativeData, 
  aggregateWeekly, 
  aggregateMonthly
} from '@/utils/calculations';

/**
 * TerritoryChart - Multi-mode chart component for territorial changes
 * Supports: daily line, weekly/monthly bar, and cumulative area charts
 */
interface TerritoryChartProps {
  data: DailyTerritoryData[];
  timeRange: TimeRange;
  chartType: 'change' | 'cumulative';
}

export function TerritoryChart({ data, timeRange, chartType }: TerritoryChartProps) {
  // Prepare data based on time range
  const getChartData = (): (ChartDataPoint | AggregatedData)[] => {
    if (timeRange === 'daily') {
      return chartType === 'cumulative' 
        ? calculateCumulativeData(data)
        : data.map(d => ({
            date: d.date,
            formattedDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            russianGain: d.russian_gain_km2,
            ukrainianGain: d.ukrainian_gain_km2,
            netChange: d.russian_gain_km2 - d.ukrainian_gain_km2,
            cumulativeRussian: 0,
            cumulativeUkrainian: 0,
          }));
    }
    if (timeRange === 'weekly') {
      return aggregateWeekly(data);
    }
    return aggregateMonthly(data);
  };

  const chartData = getChartData();

  // Custom tooltip with dark theme
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-osint-card border border-osint-border p-3 rounded-lg shadow-xl">
          <p className="text-gray-300 font-medium mb-2">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)} km²
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get data keys for aggregated views
  const getRussianKey = () => timeRange === 'daily' ? 'russianGain' : 'russianTotal';
  const getUkrainianKey = () => timeRange === 'daily' ? 'ukrainianGain' : 'ukrainianTotal';
  const getXKey = () => timeRange === 'daily' ? 'formattedDate' : 'period';

  // Render different chart types
  if (chartType === 'cumulative') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="colorRussian" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorUkrainian" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis 
            dataKey={getXKey()} 
            stroke="#6b7280" 
            fontSize={12}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="cumulativeRussian"
            name="Russian Cumulative"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorRussian)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="cumulativeUkrainian"
            name="Ukrainian Cumulative"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorUkrainian)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart for weekly/monthly, Line chart for daily
  if (timeRange !== 'daily') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis 
            dataKey="period" 
            stroke="#6b7280" 
            fontSize={11}
            tick={{ fill: '#6b7280' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />
          <Bar dataKey={getRussianKey()} name="Russian Gain" fill="#ef4444" radius={[2, 2, 0, 0]} />
          <Bar dataKey={getUkrainianKey()} name="Ukrainian Gain" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Daily line chart
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
        <XAxis 
          dataKey="formattedDate" 
          stroke="#6b7280" 
          fontSize={12}
          tick={{ fill: '#6b7280' }}
          interval="preserveStartEnd"
          minTickGap={30}
        />
        <YAxis 
          stroke="#6b7280" 
          fontSize={12}
          tick={{ fill: '#6b7280' }}
          label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value) => <span className="text-gray-300">{value}</span>}
        />
        <Line
          type="monotone"
          dataKey="russianGain"
          name="Russian Gain"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#ef4444' }}
        />
        <Line
          type="monotone"
          dataKey="ukrainianGain"
          name="Ukrainian Gain"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
