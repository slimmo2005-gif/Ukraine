import { useState } from 'react';
import type { DailyTerritoryData, TimeRange } from '@/types';
import { TimeRangeToggle } from './TimeRangeToggle';
import { TerritoryChart } from './TerritoryChart';

/**
 * ChartSection - Container for chart with time range toggle
 * chartType: 'control' shows territory control levels
 * chartType: 'change' shows period changes
 */
interface ChartSectionProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  yearlySnapshotData: DailyTerritoryData[];
  selectedDate: string;
  title: string;
  chartType: 'control' | 'change';
}

export function ChartSection({
  dailyData,
  weeklySnapshotData,
  yearlySnapshotData,
  selectedDate,
  title,
  chartType,
}: ChartSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');

  const resolvedTitle =
    chartType === 'change' && timeRange === 'yearly'
      ? 'Yearly changes'
      : chartType === 'change' && timeRange === 'monthly'
        ? 'Monthly changes'
        : title;

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-white">{resolvedTitle}</h3>
        <TimeRangeToggle value={timeRange} onChange={setTimeRange} />
      </div>
      {timeRange === 'monthly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          {chartType === 'control' ? (
            <>
              Bars show each category as a <strong>percentage of total Ukraine area</strong> for that month
              (from daily snapshots up to your selected date). Labels are %; hover shows km².
            </>
          ) : (
            <>
              Monthly bars sum daily net changes within each calendar month from loaded daily snapshots.
            </>
          )}
        </p>
      )}
      {timeRange === 'yearly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          {chartType === 'control' ? (
            <>
              Yearly bars prefer <code className="text-gray-400">data/history/yearly</code> (or{' '}
              <code className="text-gray-400">annual/</code>) when enough anchors exist; otherwise the last
              weekly snapshot per calendar year. Otherwise averages from loaded dailies. Hover shows km².
            </>
          ) : (
            <>
              Yearly changes prefer yearly repo deltas, else year-over-year from last weekly anchor per year,
              else summed daily changes by calendar year.
            </>
          )}
        </p>
      )}
      <TerritoryChart
        dailyData={dailyData}
        weeklySnapshotData={weeklySnapshotData}
        yearlySnapshotData={yearlySnapshotData}
        selectedDate={selectedDate}
        timeRange={timeRange}
        chartType={chartType}
      />
    </div>
  );
}
