import { useState } from 'react';
import type { DailyTerritoryData, TimeRange } from '@/types';
import { TimeRangeToggle } from './TimeRangeToggle';
import { TerritoryChart } from './TerritoryChart';

/**
 * ChartSection - Territory control over time with monthly / yearly toggle
 */
interface ChartSectionProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  yearlySnapshotData: DailyTerritoryData[];
  selectedDate: string;
  title: string;
}

export function ChartSection({
  dailyData,
  weeklySnapshotData,
  yearlySnapshotData,
  selectedDate,
  title,
}: ChartSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <TimeRangeToggle value={timeRange} onChange={setTimeRange} />
      </div>
      {timeRange === 'monthly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          Bars show the <strong>last 12 calendar months</strong> on or before your selected date, each as a
          percentage of total Ukraine area (from daily snapshots). Labels use an extra decimal in monthly
          view; hover shows km² with the same precision.
        </p>
      )}
      {timeRange === 'yearly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          <strong>Pre-war</strong> uses the first week of Jan 2022 (daily or weekly snapshot, else weekly
          interpolation). Other columns prefer yearly repo anchors, else last weekly snapshot per year, else
          daily averages. Hover shows km².
        </p>
      )}
      <TerritoryChart
        dailyData={dailyData}
        weeklySnapshotData={weeklySnapshotData}
        yearlySnapshotData={yearlySnapshotData}
        selectedDate={selectedDate}
        timeRange={timeRange}
      />
    </div>
  );
}
