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
  data: DailyTerritoryData[];
  title: string;
  chartType: 'control' | 'change';
}

export function ChartSection({ data, title, chartType }: ChartSectionProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <TimeRangeToggle value={timeRange} onChange={setTimeRange} />
      </div>
      <TerritoryChart 
        data={data} 
        timeRange={timeRange} 
        chartType={chartType}
      />
    </div>
  );
}
