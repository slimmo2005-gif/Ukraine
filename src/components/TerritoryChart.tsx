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
  calculateControlData, 
  aggregateWeekly, 
  aggregateMonthly
} from '@/utils/calculations';

/**
 * TerritoryChart - Multi-mode chart component for territorial control
 * Shows: Control levels (area) or Daily changes (line/bar)
 * Supports: Russian, Ukrainian, and Disputed territory
 */
interface TerritoryChartProps {
  data: DailyTerritoryData[];
  timeRange: TimeRange;
  chartType: 'control' | 'change';
}

export function TerritoryChart({ data, timeRange, chartType }: TerritoryChartProps) {
  // Prepare data based on time range
  const getChartData = (): (ChartDataPoint | AggregatedData)[] => {
    if (timeRange === 'daily') {
      return calculateControlData(data);
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
              {entry.name}: {entry.value.toFixed(1)} km²
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Get X axis key based on time range
  const getXKey = () => timeRange === 'daily' ? 'formattedDate' : 'period';

  // CONTROL LEVELS CHART (Area chart showing total control)
  if (chartType === 'control') {
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
            <linearGradient id="colorDisputed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
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
            dataKey="russianControlled"
            name="Russian Controlled"
            stroke="#ef4444"
            fillOpacity={1}
            fill="url(#colorRussian)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="ukrainianControlled"
            name="Ukrainian Controlled"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorUkrainian)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="disputed"
            name="Disputed"
            stroke="#f59e0b"
            fillOpacity={1}
            fill="url(#colorDisputed)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // DAILY CHANGES CHART
  // Bar chart for weekly/monthly aggregated changes
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
          <Bar dataKey="russianChangeSum" name="Russian Change" fill="#ef4444" radius={[2, 2, 0, 0]} />
          <Bar dataKey="ukrainianChangeSum" name="Ukrainian Change" fill="#3b82f6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="disputedChangeSum" name="Disputed Change" fill="#f59e0b" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Daily line chart for changes
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
          dataKey="russianChange"
          name="Russian Change"
          stroke="#ef4444"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#ef4444' }}
        />
        <Line
          type="monotone"
          dataKey="ukrainianChange"
          name="Ukrainian Change"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#3b82f6' }}
        />
        <Line
          type="monotone"
          dataKey="disputedChange"
          name="Disputed Change"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, fill: '#f59e0b' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
