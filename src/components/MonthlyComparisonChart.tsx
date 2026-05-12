import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyTerritoryData } from '@/types';
import {
  buildMonthlyComparisonRows,
  type MonthlyComparisonMetric,
} from '@/utils/calculations';

function formatKm2(v: number): string {
  if (Math.abs(v) >= 1000) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return v.toFixed(1);
}

interface MonthlyComparisonChartProps {
  fullDailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  selectedDate: string;
}

const WINDOW_OPTIONS = [6, 12, 18, 24] as const;
const YEAR_OFFSET_OPTIONS = [1, 2, 3, 4] as const;

export function MonthlyComparisonChart({
  fullDailyData,
  weeklySnapshotData,
  selectedDate,
}: MonthlyComparisonChartProps) {
  const [metric, setMetric] = useState<MonthlyComparisonMetric>('russian_gain');
  const [windowMonths, setWindowMonths] = useState<number>(12);
  const [comparePrimaryYearsAgo, setComparePrimaryYearsAgo] = useState<number>(1);
  const [compareSecondaryYearsAgo, setCompareSecondaryYearsAgo] = useState<number>(0);

  const rows = useMemo(
    () =>
      buildMonthlyComparisonRows(fullDailyData, selectedDate, {
        windowMonths,
        comparePrimaryYearsAgo,
        compareSecondaryYearsAgo: compareSecondaryYearsAgo > 0 ? compareSecondaryYearsAgo : null,
        metric,
        weeklySnapshots: weeklySnapshotData,
      }),
    [
      fullDailyData,
      weeklySnapshotData,
      selectedDate,
      windowMonths,
      comparePrimaryYearsAgo,
      compareSecondaryYearsAgo,
      metric,
    ],
  );

  const ComparisonTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; dataKey?: string | number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload?.length || !label) {
      return null;
    }
    const row = rows.find((r) => r.label === label);
    if (!row) {
      return null;
    }
    const unit = metric === 'russian_gain' ? 'Russian Δ' : 'Ukrainian Δ (×−1)';
    return (
      <div className="bg-osint-card border border-osint-border p-3 rounded-lg shadow-xl max-w-xs">
        <p className="text-gray-300 font-medium mb-2">{label}</p>
        {payload.map((entry, idx) => {
          const key = String(entry.dataKey ?? '');
          let present = true;
          if (key === 'compare1Value') {
            present = row.compare1Present;
          }
          if (key === 'compare2Value') {
            present = row.compare2Present;
          }
          return (
            <p key={idx} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {present ? `${formatKm2(entry.value)} km²` : '— (no data in loaded history)'}
            </p>
          );
        })}
        <p className="text-gray-500 text-xs mt-2 border-t border-osint-border pt-2">{unit}</p>
      </div>
    );
  };

  const primaryLabel =
    comparePrimaryYearsAgo === 1
      ? 'Same month, 1 yr ago'
      : `Same month, ${comparePrimaryYearsAgo} yrs ago`;
  const secondaryLegendName =
    compareSecondaryYearsAgo > 0
      ? `Same month, ${compareSecondaryYearsAgo} yr${compareSecondaryYearsAgo > 1 ? 's' : ''} ago (alt)`
      : '';

  /** Recharts draws grouped bars in declaration order: older comparison (larger years back) left, main period right. */
  const comparisonBars = useMemo(() => {
    type DK = 'compare1Value' | 'compare2Value';
    const entries: { dataKey: DK; name: string; yearsAgo: number }[] = [
      { dataKey: 'compare1Value', name: primaryLabel, yearsAgo: comparePrimaryYearsAgo },
    ];
    if (compareSecondaryYearsAgo > 0 && compareSecondaryYearsAgo !== comparePrimaryYearsAgo) {
      entries.push({
        dataKey: 'compare2Value',
        name: secondaryLegendName,
        yearsAgo: compareSecondaryYearsAgo,
      });
    }
    entries.sort((a, b) => b.yearsAgo - a.yearsAgo);
    return entries.map((e, idx, arr) => ({
      ...e,
      fill: arr.length >= 2 && idx === 0 ? '#a855f7' : '#f97316',
    }));
  }, [
    primaryLabel,
    secondaryLegendName,
    comparePrimaryYearsAgo,
    compareSecondaryYearsAgo,
  ]);

  const yLabel =
    metric === 'russian_gain' ? 'Russian Δ (km² / month)' : 'Ukrainian loss (−Δ UA km² / month)';

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Monthly comparison</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMetric('russian_gain')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                metric === 'russian_gain'
                  ? 'bg-ukraine-blue text-white border-ukraine-blue'
                  : 'text-gray-400 border-osint-border hover:text-white'
              }`}
            >
              Russian gain
            </button>
            <button
              type="button"
              onClick={() => setMetric('ukrainian_loss')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                metric === 'ukrainian_loss'
                  ? 'bg-ukraine-blue text-white border-ukraine-blue'
                  : 'text-gray-400 border-osint-border hover:text-white'
              }`}
            >
              Ukrainian loss
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label className="flex flex-col gap-1 text-gray-400">
            <span>Months in main window</span>
            <select
              value={windowMonths}
              onChange={(e) => setWindowMonths(Number(e.target.value))}
              className="monthly-comparison-select w-full rounded-md border border-slate-500 bg-slate-900 px-2 py-2 text-sm text-slate-100 shadow-sm focus:border-ukraine-blue focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
            >
              {WINDOW_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w} months
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-gray-400">
            <span>Compare each month to (years back)</span>
            <select
              value={comparePrimaryYearsAgo}
              onChange={(e) => {
                const v = Number(e.target.value);
                setComparePrimaryYearsAgo(v);
                if (compareSecondaryYearsAgo === v) {
                  setCompareSecondaryYearsAgo(0);
                }
              }}
              className="monthly-comparison-select w-full rounded-md border border-slate-500 bg-slate-900 px-2 py-2 text-sm text-slate-100 shadow-sm focus:border-ukraine-blue focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
            >
              {YEAR_OFFSET_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y} year{y > 1 ? 's' : ''} ago
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-gray-400">
            <span>Second comparison (optional)</span>
            <select
              value={compareSecondaryYearsAgo}
              onChange={(e) => setCompareSecondaryYearsAgo(Number(e.target.value))}
              className="monthly-comparison-select w-full rounded-md border border-slate-500 bg-slate-900 px-2 py-2 text-sm text-slate-100 shadow-sm focus:border-ukraine-blue focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
            >
              <option value={0}>None</option>
              {YEAR_OFFSET_OPTIONS.filter((y) => y !== comparePrimaryYearsAgo).map((y) => (
                <option key={y} value={y}>
                  {y} year{y > 1 ? 's' : ''} ago
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-gray-500 leading-snug self-end">
            Months without daily files use <strong>weekly history interpolation</strong> at month start/end when
            at least two weekly anchors exist. Main window ends on the <strong>selected date month</strong>{' '}
            (inclusive).
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No monthly comparison data for this selection — check the date navigator and loaded history depth.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 48, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
          <XAxis
            dataKey="label"
            stroke="#6b7280"
            fontSize={10}
            tick={{ fill: '#6b7280' }}
            angle={-40}
            textAnchor="end"
            height={70}
            interval={0}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            tick={{ fill: '#6b7280' }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip content={<ComparisonTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '8px' }}
            formatter={(value) => <span className="text-gray-300">{value}</span>}
          />
          {comparisonBars.map((b) => (
            <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name} fill={b.fill} radius={[2, 2, 0, 0]} />
          ))}
          <Bar dataKey="main" name="Main period" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
