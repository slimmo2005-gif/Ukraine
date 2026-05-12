import { useMemo } from 'react';
import {
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
import type { DailyTerritoryData, ChartDataPoint, TimeRange } from '@/types';
import {
  aggregateMonthly,
  aggregateYearly,
  aggregatedToControlChartPoints,
  calculateYearlyRepoControlChartData,
  calculateYearlyFromWeeklyYearEndControlChartData,
  getPreWarFirstWeek2022ChartPoint,
} from '@/utils/calculations';

/** Most recent month buckets shown in monthly chart mode */
const MONTHLY_CHART_PERIOD_COUNT = 12;

function takeLastN<T>(rows: T[], n: number): T[] {
  if (rows.length <= n) {
    return rows;
  }
  return rows.slice(-n);
}

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

function formatPctLabel(value: number | undefined, fractionDigits: 1 | 2): string {
  if (value === undefined || Number.isNaN(value) || value < PCT_LABEL_MIN) {
    return '';
  }
  return `${value.toFixed(fractionDigits)}%`;
}

function formatKm2(v: number, fractionDigits: 1 | 2 = 1): string {
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: 0,
    });
  }
  return v.toFixed(fractionDigits);
}

/**
 * Territory control chart — stacked % bars (monthly / yearly + optional Pre-war column).
 */
interface TerritoryChartProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  yearlySnapshotData: DailyTerritoryData[];
  selectedDate: string;
  timeRange: TimeRange;
}

export function TerritoryChart({
  dailyData,
  weeklySnapshotData,
  yearlySnapshotData,
  selectedDate,
  timeRange,
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

  const pctFractionDigits: 1 | 2 = timeRange === 'monthly' ? 2 : 1;
  const kmFractionDigits: 1 | 2 = timeRange === 'monthly' ? 2 : 1;

  const chartData = useMemo((): ChartDataPoint[] => {
    if (timeRange === 'monthly') {
      return takeLastN(
        aggregatedToControlChartPoints(aggregateMonthly(dailyData)),
        MONTHLY_CHART_PERIOD_COUNT,
      );
    }

    let points: ChartDataPoint[];
    if (yearlySnapshotsUpToDate.length >= 2) {
      points = calculateYearlyRepoControlChartData(yearlySnapshotsUpToDate);
    } else if (yearlyFromWeeklyControl.length >= 2) {
      points = yearlyFromWeeklyControl;
    } else {
      points = aggregatedToControlChartPoints(aggregateYearly(dailyData));
    }

    const pre = getPreWarFirstWeek2022ChartPoint(dailyData, weeklySnapshotData);
    if (pre) {
      return [pre, ...points.filter((p) => p.formattedDate !== 'Pre-war')];
    }
    return points;
  }, [timeRange, dailyData, yearlySnapshotsUpToDate, yearlyFromWeeklyControl, weeklySnapshotData]);

  const stackedControlData = useMemo(
    () => buildStackedPercentPoints(chartData),
    [chartData],
  );

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
              {entry.name}: {pct.toFixed(pctFractionDigits)}% ({formatKm2(km, kmFractionDigits)} km²)
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

  const controlXKey = 'formattedDate' as const;

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
          height={timeRange === 'monthly' ? 56 : 40}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tick={{ fill: '#6b7280' }}
          domain={[0, 100]}
          tickFormatter={(v) =>
            timeRange === 'monthly' ? `${Number(v).toFixed(1)}%` : `${v}%`
          }
          label={{ value: '% of Ukraine', angle: -90, position: 'insideLeft', fill: '#6b7280' }}
        />
        <Tooltip content={<ControlPercentTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '12px' }}
          formatter={(value) => <span className="text-gray-300">{value}</span>}
        />
        <Bar dataKey="russianPct" name="Russian Controlled" stackId="a" fill="#ef4444" radius={[0, 0, 6, 6]}>
          <LabelList
            dataKey="russianPct"
            position="center"
            fill="#fecaca"
            formatter={(v: number) => formatPctLabel(v, pctFractionDigits)}
            fontSize={11}
          />
        </Bar>
        <Bar dataKey="ukrainianPct" name="Ukrainian Controlled" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]}>
          <LabelList
            dataKey="ukrainianPct"
            position="center"
            fill="#bfdbfe"
            formatter={(v: number) => formatPctLabel(v, pctFractionDigits)}
            fontSize={11}
          />
        </Bar>
        <Bar dataKey="disputedPct" name="Disputed" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]}>
          <LabelList
            dataKey="disputedPct"
            position="center"
            fill="#451a03"
            formatter={(v: number) => formatPctLabel(v, pctFractionDigits)}
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
