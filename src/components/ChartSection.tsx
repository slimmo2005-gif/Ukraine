import { useState } from 'react';
import type { DailyTerritoryData, TimeRange } from '@/types';
import { TimeRangeToggle } from './TimeRangeToggle';
import { TerritoryChart } from './TerritoryChart';

/**
 * ChartSection - Container for chart with time range toggle
 * chartType: 'control' shows territory control levels
 * chartType: 'change' shows daily/period changes
 */
interface ChartSectionProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  title: string;
  chartType: 'control' | 'change';
}

export function ChartSection({
  dailyData,
  weeklySnapshotData,
  title,
  chartType,
}: ChartSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const usingRepoWeekly = timeRange === 'weekly' && weeklySnapshotData.length > 0;

  const resolvedTitle =
    chartType === 'change' && timeRange === 'weekly'
      ? usingRepoWeekly
        ? 'Week-over-week changes'
        : 'Weekly changes (from daily)'
      : title;

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-white">{resolvedTitle}</h3>
        <TimeRangeToggle value={timeRange} onChange={setTimeRange} />
      </div>
      {timeRange === 'weekly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          {usingRepoWeekly ? (
            <>
              Weekly series uses <code className="text-gray-400">data/history/weekly/</code> anchors every
              7 days in UTC from 2026-01-01 (not every calendar week). Changes are week-over-week vs the
              prior anchor in that series. Hover points for Wayback / derived-from notes when present.
            </>
          ) : (
            <>
              No weekly snapshot files found yet; showing ISO-week sums from loaded daily snapshots instead.
            </>
          )}
        </p>
      )}
      <TerritoryChart
        dailyData={dailyData}
        weeklySnapshotData={weeklySnapshotData}
        timeRange={timeRange}
        chartType={chartType}
      />
    </div>
  );
}
