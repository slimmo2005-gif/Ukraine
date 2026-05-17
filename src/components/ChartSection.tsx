import { useState } from 'react';
import type { DailyTerritoryData, TimeRange, OblastKey } from '@/types';
import { TimeRangeToggle } from './TimeRangeToggle';
import { TerritoryChart } from './TerritoryChart';
import { BrandedVisual, BrandPanelLogo } from '@/components/BrandMark';

/**
 * ChartSection - Territory control over time with monthly / yearly toggle
 */
interface ChartSectionProps {
  dailyData: DailyTerritoryData[];
  weeklySnapshotData: DailyTerritoryData[];
  yearlySnapshotData: DailyTerritoryData[];
  selectedDate: string;
  title: string;
  /** When set (oblast view), territory chart uses this oblast’s control series. */
  oblast?: OblastKey;
}

export function ChartSection({
  dailyData,
  weeklySnapshotData,
  yearlySnapshotData,
  selectedDate,
  title,
  oblast,
}: ChartSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-white min-w-0">{title}</h3>
        <BrandPanelLogo className="justify-self-center" />
        <div className="flex justify-end">
          <TimeRangeToggle value={timeRange} onChange={setTimeRange} />
        </div>
      </div>
      {timeRange === 'monthly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          Bars show <strong>12 calendar months</strong> through your selected month. Each bar is control at
          month end (or your selected date in the current month): daily snapshot when available, else weekly or
          yearly interpolation. Labels use an extra decimal in monthly view; hover shows km².
        </p>
      )}
      {timeRange === 'yearly' && (
        <p className="text-xs text-gray-500 mb-4 leading-snug">
          <strong>Pre-war</strong> uses the first week of Jan 2022 (daily or weekly snapshot, else weekly
          interpolation). Other columns prefer yearly repo anchors, else last weekly snapshot per year, else
          daily averages. Hover shows km².
        </p>
      )}
      <BrandedVisual className="min-h-[320px]" watermarkSize="md">
        <TerritoryChart
          dailyData={dailyData}
          weeklySnapshotData={weeklySnapshotData}
          yearlySnapshotData={yearlySnapshotData}
          selectedDate={selectedDate}
          timeRange={timeRange}
          oblast={oblast}
        />
      </BrandedVisual>
    </div>
  );
}
