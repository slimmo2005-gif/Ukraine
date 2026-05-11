import { useMemo } from 'react';
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
  LabelList,
} from 'recharts';
import type { DailyTerritoryData, ChartDataPoint, AggregatedData, TimeRange } from '@/types';
import {
  aggregateMonthly,
  aggregateYearly,
  aggregatedToControlChartPoints,
  calculateYearlyRepoControlChartData,
  calculateYearlyRepoChangeChartData,
  calculateYearlyFromWeeklyYearEndControlChartData,
  calculateYearlyFromWeeklyYearEndChangeChartData,
} from '@/utils/calculations';

type StackedControlBarPoint = ChartDataPoint & {
  russianPct: number;
  ukrainianPct: number;
  disputedPct: number;
  russianKm2: number;
  ukrainianKm2: number;
  disputedKm2: number;
};

function buildStackedPercentPoints(points: ChartDataPoint[]): StackedControlBarPoint[] {
  return points.map((p) => {
    const r = p.russianControlled;
    const u = p.ukrainianControlled;
    const d = p.disputed;
    const total = r + u + d;
    const inv = total > 0 ? 100 / total : 0;
    return {
      ...p,
      russianPct: r * inv,
      ukrainianPct: u * inv,
      disputedPct: d * inv,
      russianKm2: r,
      ukrainianKm2: u,
      disputedKm2: d,
    };
  });
}

const PCT_LABEL_MIN = 1.2;

function formatPctLabel(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value) || value < PCT_LABEL_MIN) {
    return '';
  }
  return `${value.toFixed(1)}%`;
}

function formatKm2(v: number): string {
  if (Math.abs(v) >= 1000) {
    return Math.round(v).toLocaleString();
  }
  return v.toFixed(1);
}

/**
 * TerritoryChart - Multi-mode chart component for territorial control
 * Control: stacked bars by % of Ukraine (labels %, tooltip km²)
 * Change: monthly / yearly period changes
 */
interface TerritoryChartProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  yearlySnapshotData: DailyTerritoryData[];
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
  const chartCutoffDate =
    (selectedDate && selectedDate.trim()) ||
    (dailyData.length > 0 ? dailyData[dailyData.length - 1].date : '') ||
    (weeklySnapshotData.length > 0
      ? weeklySnapshotData[weeklySnapshotData.length - 1].date
      : '') ||
    '9999-12-31';

  const yearlySnapshotsUpToDate = useMemo(
    () =>
      [...yearlySnapshotData]
        .filter((y) => y.date <= chartCutoffDate)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [yearlySnapshotData, chartCutoffDate],
  );

  const yearlyFromWeeklyControl = useMemo(
    () => calculateYearlyFromWeeklyYearEndControlChartData(weeklySnapshotData, chartCutoffDate),
    [weeklySnapshotData, chartCutoffDate],
  );

  const yearlyFromWeeklyChange = useMemo(
    () => calculateYearlyFromWeeklyYearEndChangeChartData(weeklySnapshotData, chartCutoffDate),
    [weeklySnapshotData, chartCutoffDate],
  );

  const yearlyChangeUsesAggregatedBars =
    timeRange === 'yearly' &&
    chartType === 'change' &&
    yearlySnapshotsUpToDate.length < 2 &&
    yearlyFromWeeklyChange.length < 2;

  const chartData = useMemo((): (ChartDataPoint | AggregatedData)[] => {
    if (timeRange === 'monthly') {
      if (chartType === 'control') {
        return aggregatedToControlChartPoints(aggregateMonthly(dailyData));
      }
      return aggregateMonthly(dailyData);
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
  }, [
    timeRange,
    chartType,
    dailyData,
    yearlySnapshotsUpToDate,
    yearlyFromWeeklyControl,
    yearlyFromWeeklyChange,
  ]);

  const stackedControlData = useMemo(() => {
    if (chartType !== 'control') {
      return [] as StackedControlBarPoint[];
    }
    return buildStackedPercentPoints(chartData as ChartDataPoint[]);
  }, [chartType, chartData]);

  const changeUsesAggregatedBars =
    chartType === 'change' && (timeRange === 'monthly' || yearlyChangeUsesAggregatedBars);

  const ControlPercentTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{
      color: string;
      name: string;
      value: number;
      dataKey?: string | number;
      payload?: StackedControlBarPoint;
    }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) {
      return null;
    }
    const row = payload[0]?.payload;
    if (!row) {
      return null;
    }
    const meta = row.snapshotMeta;
    return (
      <div className="bg-osint-card border border-osint-border p-3 rounded-lg shadow-xl max-w-xs">
        <p className="text-gray-300 font-medium mb-2">{label}</p>
        {payload.map((entry, idx) => {
          const key = String(entry.dataKey ?? '');
          const km =
            key === 'russianPct'
              ? row.russianKm2
              : key === 'ukrainianPct'
                ? row.ukrainianKm2
                : row.disputedKm2;
          const pct = entry.value;
          return (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {pct.toFixed(1)}% ({formatKm2(km)} km²)
            </p>
          );
        })}
        {meta ? (
          <p className="text-gray-500 text-xs mt-2 leading-snug border-t border-osint-border pt-2">
            {meta}
          </p>
        ) : null}
      </div>
    );
  };

  const ChangeTooltip = ({ active, payload, label }: {
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
              {entry.name}: {formatKm2(entry.value)} km²
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

  const controlXKey = 'formattedDate' as const;

  if (chartType === 'control') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={stackedControlData}
          margin={{ top: 16, right: 12, bottom: 8, left: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey={controlXKey}
            stroke="#6b7280"
            fontSize={11}
            tick={{ fill: '#6b7280' }}
            interval={timeRange === 'yearly' ? 'preserveStartEnd' : 0}
            angle={timeRange === 'monthly' ? -35 : 0}
            textAnchor={timeRange === 'monthly' ? 'end' : 'middle'}
            height={timeRange === 'monthly' ? 56 : 36}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{ value: '% of Ukraine', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip content={<ControlPercentTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '12px' }}
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />
          <Bar dataKey="russianPct" name="Russian Controlled" stackId="a" fill="#ef4444" radius={[0, 0, 6, 6]}>
            <LabelList dataKey="russianPct" position="center" fill="#fecaca" formatter={formatPctLabel} fontSize={11} />
          </Bar>
          <Bar dataKey="ukrainianPct" name="Ukrainian Controlled" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]}>
            <LabelList dataKey="ukrainianPct" position="center" fill="#bfdbfe" formatter={formatPctLabel} fontSize={11} />
          </Bar>
          <Bar dataKey="disputedPct" name="Disputed" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]}>
            <LabelList dataKey="disputedPct" position="center" fill="#451a03" formatter={formatPctLabel} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

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
          <Tooltip content={<ChangeTooltip />} />
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
            minTickGap={8}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            label={{ value: 'km²', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
          />
          <Tooltip content={<ChangeTooltip />} />
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
            dot={!yearlyChangeUsesAggregatedBars}
            activeDot={{ r: 6, fill: '#ef4444' }}
          />
          <Line
            type="monotone"
            dataKey="ukrainianChange"
            name="Ukrainian Change"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={!yearlyChangeUsesAggregatedBars}
            activeDot={{ r: 6, fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="disputedChange"
            name="Disputed Change"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={!yearlyChangeUsesAggregatedBars}
            activeDot={{ r: 6, fill: '#f59e0b' }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
