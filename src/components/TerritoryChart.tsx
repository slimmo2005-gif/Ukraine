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
  calculateDailyChangeData,
  aggregateWeekly,
  aggregateYearly,
  aggregatedToControlChartPoints,
  calculateWeeklyRepoControlChartData,
  calculateWeeklyRepoChangeChartData,
  calculateYearlyRepoControlChartData,
  calculateYearlyRepoChangeChartData,
  calculateYearlyFromWeeklyYearEndControlChartData,
  calculateYearlyFromWeeklyYearEndChangeChartData,
} from '@/utils/calculations';

/**
 * TerritoryChart - Multi-mode chart component for territorial control
 * Shows: Control levels (area) or Daily changes (line/bar)
 * Supports: Russian, Ukrainian, and Disputed territory
 */
interface TerritoryChartProps {
  /** Last N days (or loaded window) of daily/history snapshots. */
  dailyData: DailyTerritoryData[];
  /** All `data/history/weekly/*.json` rows, sorted by date ascending (may be empty). */
  weeklySnapshotData: DailyTerritoryData[];
  /** `data/history/yearly` or `annual/` rows when present (may be empty). */
  yearlySnapshotData: DailyTerritoryData[];
  /** Navigator date; yearly series is clipped to anchors on or before this (ISO YYYY-MM-DD). */
  selectedDate: string;
  timeRange: TimeRange;
  chartType: 'control' | 'change';
}

export function TerritoryChart({
  dailyData,
  weeklySnapshotData,
  yearlySnapshotData,
  selectedDate,
  timeRange,
  chartType,
}: TerritoryChartProps) {
  const useRepoWeekly = weeklySnapshotData.length > 0;

  const chartCutoffDate =
    (selectedDate && selectedDate.trim()) ||
    (dailyData.length > 0 ? dailyData[dailyData.length - 1].date : '') ||
    (weeklySnapshotData.length > 0
      ? weeklySnapshotData[weeklySnapshotData.length - 1].date
      : '') ||
    '9999-12-31';

  const yearlySnapshotsUpToDate = [...yearlySnapshotData]
    .filter((y) => y.date <= chartCutoffDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const yearlyFromWeeklyControl = calculateYearlyFromWeeklyYearEndControlChartData(
    weeklySnapshotData,
    chartCutoffDate,
  );
  const yearlyFromWeeklyChange = calculateYearlyFromWeeklyYearEndChangeChartData(
    weeklySnapshotData,
    chartCutoffDate,
  );

  const yearlyChangeUsesAggregatedBars =
    timeRange === 'yearly' &&
    chartType === 'change' &&
    yearlySnapshotsUpToDate.length < 2 &&
    yearlyFromWeeklyChange.length < 2;

  const getChartData = (): (ChartDataPoint | AggregatedData)[] => {
    if (timeRange === 'daily') {
      if (chartType === 'change') {
        return calculateDailyChangeData(dailyData);
      }
      return calculateControlData(dailyData);
    }
    if (timeRange === 'weekly') {
      if (useRepoWeekly) {
        return chartType === 'control'
          ? calculateWeeklyRepoControlChartData(weeklySnapshotData)
          : calculateWeeklyRepoChangeChartData(weeklySnapshotData);
      }
      const agg = aggregateWeekly(dailyData);
      if (chartType === 'control') {
        return aggregatedToControlChartPoints(agg);
      }
      return agg;
    }
    if (chartType === 'control') {
      if (yearlySnapshotsUpToDate.length >= 2) {
        return calculateYearlyRepoControlChartData(yearlySnapshotsUpToDate);
      }
      if (yearlyFromWeeklyControl.length >= 2) {
        return yearlyFromWeeklyControl;
      }
      return aggregatedToControlChartPoints(aggregateYearly(dailyData));
    }
    if (yearlySnapshotsUpToDate.length >= 2) {
      return calculateYearlyRepoChangeChartData(yearlySnapshotsUpToDate);
    }
    if (yearlyFromWeeklyChange.length >= 2) {
      return yearlyFromWeeklyChange;
    }
    return aggregateYearly(dailyData);
  };

  const chartData = getChartData();

  const changeUsesAggregatedBars =
    chartType === 'change' &&
    (yearlyChangeUsesAggregatedBars || (timeRange === 'weekly' && !useRepoWeekly));

  // Number formatter for chart values
  const formatNumber = (v: number) => {
    if (Math.abs(v) >= 1000) {
      return Math.round(v).toLocaleString();
    }
    return v.toFixed(1);
  };

  // Custom tooltip with dark theme
  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ color: string; name: string; value: number; payload?: ChartDataPoint }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const meta = payload[0]?.payload?.snapshotMeta;
      return (
        <div className="bg-osint-card border border-osint-border p-3 rounded-lg shadow-xl max-w-xs">
          <p className="text-gray-300 font-medium mb-2">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)} km²
            </p>
          ))}
          {meta ? (
            <p className="text-gray-500 text-xs mt-2 leading-snug border-t border-osint-border pt-2">
              {meta}
            </p>
          ) : null}
        </div>
      );
    }
    return null;
  };

  // Control charts always use ChartDataPoint with `formattedDate` (including aggregated fallbacks).
  const controlXKey = 'formattedDate' as const;

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
            dataKey={controlXKey}
            stroke="#6b7280"
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            interval={timeRange === 'yearly' ? 'preserveStartEnd' : undefined}
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

  // Bar chart: summed daily deltas per calendar week (fallback) or per calendar month
  if (changeUsesAggregatedBars) {
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

  // Line chart for daily changes or week-over-week changes from weekly JSON
  if (chartType === 'change') {
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
            minTickGap={timeRange === 'weekly' || timeRange === 'yearly' ? 8 : 30}
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
            dot={timeRange === 'weekly' || (timeRange === 'yearly' && !yearlyChangeUsesAggregatedBars)}
            activeDot={{ r: 6, fill: '#ef4444' }}
          />
          <Line
            type="monotone"
            dataKey="ukrainianChange"
            name="Ukrainian Change"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={timeRange === 'weekly' || (timeRange === 'yearly' && !yearlyChangeUsesAggregatedBars)}
            activeDot={{ r: 6, fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="disputedChange"
            name="Disputed Change"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={timeRange === 'weekly' || (timeRange === 'yearly' && !yearlyChangeUsesAggregatedBars)}
            activeDot={{ r: 6, fill: '#f59e0b' }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  throw new Error('TerritoryChart: unhandled chart configuration');
}
