import type { DailyTerritoryData, ChartDataPoint, AggregatedData, TimeRange, OblastKey, ViewLevel } from '@/types';

function getDerivedTotalChanges(data: DailyTerritoryData[], index: number) {
  const day = data[index];
  if (!day) {
    return { russianChange: 0, ukrainianChange: 0, disputedChange: 0 };
  }

  if (index === 0) {
    return {
      russianChange: day.russian_change_km2,
      ukrainianChange: day.ukrainian_change_km2,
      disputedChange: day.disputed_change_km2,
    };
  }

  const previousDay = data[index - 1];
  if (!previousDay) {
    return {
      russianChange: day.russian_change_km2,
      ukrainianChange: day.ukrainian_change_km2,
      disputedChange: day.disputed_change_km2,
    };
  }

  const currentUkrainianControlled =
    day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2;
  const previousUkrainianControlled =
    previousDay.total_area_km2 - previousDay.total_russian_controlled_km2 - previousDay.total_disputed_km2;

  return {
    russianChange: day.total_russian_controlled_km2 - previousDay.total_russian_controlled_km2,
    ukrainianChange: currentUkrainianControlled - previousUkrainianControlled,
    disputedChange: day.total_disputed_km2 - previousDay.total_disputed_km2,
  };
}

function getDerivedOblastChanges(data: DailyTerritoryData[], index: number, oblast: OblastKey) {
  const day = data[index];
  const dayOblast = day?.oblasts.find(o => o.oblast === oblast);
  if (!dayOblast) {
    return { russianChange: 0, ukrainianChange: 0, disputedChange: 0 };
  }

  if (index === 0) {
    return {
      russianChange: dayOblast.russian_change_km2 || 0,
      ukrainianChange: dayOblast.ukrainian_change_km2 || 0,
      disputedChange: dayOblast.disputed_change_km2 || 0,
    };
  }

  const previousDay = data[index - 1];
  const previousOblast = previousDay?.oblasts.find(o => o.oblast === oblast);
  if (!previousOblast) {
    return {
      russianChange: dayOblast.russian_change_km2 || 0,
      ukrainianChange: dayOblast.ukrainian_change_km2 || 0,
      disputedChange: dayOblast.disputed_change_km2 || 0,
    };
  }

  return {
    russianChange: dayOblast.russian_controlled_km2 - previousOblast.russian_controlled_km2,
    ukrainianChange: dayOblast.ukrainian_controlled_km2 - previousOblast.ukrainian_controlled_km2,
    disputedChange: dayOblast.disputed_controlled_km2 - previousOblast.disputed_controlled_km2,
  };
}

/**
 * Calculates chart data showing control levels and changes over time
 * Used for displaying Russian/Ukrainian/Disputed territory control
 */
export function calculateControlData(data: DailyTerritoryData[]): ChartDataPoint[] {
  return data.map((day, index) => {
    const { russianChange, ukrainianChange, disputedChange } = getDerivedTotalChanges(data, index);
    return {
      date: day.date,
      formattedDate: formatDate(day.date),
    // Control amounts - Ukrainian includes uncontested (total - russian - disputed)
      russianControlled: day.total_russian_controlled_km2,
      ukrainianControlled: day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2,
      disputed: day.total_disputed_km2,
    // Daily changes
      russianChange,
      ukrainianChange,
      disputedChange,
    };
  });
}

/**
 * Calculates daily movement directly from consecutive control snapshots.
 * This keeps the Daily Changes chart strictly consistent with control-over-time values.
 */
export function calculateDailyChangeData(data: DailyTerritoryData[]): ChartDataPoint[] {
  const controlData = calculateControlData(data);

  return controlData.map((point, index) => {
    if (index === 0) {
      return point;
    }

    const previousPoint = controlData[index - 1];
    return {
      ...point,
      russianChange: point.russianControlled - previousPoint.russianControlled,
      ukrainianChange: point.ukrainianControlled - previousPoint.ukrainianControlled,
      disputedChange: point.disputed - previousPoint.disputed,
    };
  });
}

/**
 * Calculates 7-day rolling averages for changes
 */
export function calculateRollingAverage(
  data: DailyTerritoryData[], 
  days: number = 7
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const startIdx = Math.max(0, i - days + 1);
    const window = data.slice(startIdx, i + 1);

    const windowWithIndices = window.map((d, idx) => ({ day: d, sourceIndex: startIdx + idx }));
    const avgRussianChange =
      windowWithIndices.reduce((sum, item) => sum + getDerivedTotalChanges(data, item.sourceIndex).russianChange, 0) / window.length;
    const avgUkrainianChange =
      windowWithIndices.reduce((sum, item) => sum + getDerivedTotalChanges(data, item.sourceIndex).ukrainianChange, 0) / window.length;
    const avgDisputedChange =
      windowWithIndices.reduce((sum, item) => sum + getDerivedTotalChanges(data, item.sourceIndex).disputedChange, 0) / window.length;
    
    result.push({
      date: data[i].date,
      formattedDate: formatDate(data[i].date),
      // Show current control levels - Ukrainian includes uncontested
      russianControlled: data[i].total_russian_controlled_km2,
      ukrainianControlled: data[i].total_area_km2 - data[i].total_russian_controlled_km2 - data[i].total_disputed_km2,
      disputed: data[i].total_disputed_km2,
      // Show rolling average changes
      russianChange: parseFloat(avgRussianChange.toFixed(2)),
      ukrainianChange: parseFloat(avgUkrainianChange.toFixed(2)),
      disputedChange: parseFloat(avgDisputedChange.toFixed(2)),
    });
  }
  
  return result;
}

/**
 * Aggregates daily data into weekly averages and change sums
 */
export function aggregateWeekly(data: DailyTerritoryData[]): AggregatedData[] {
  const weekly: Map<string, { 
    russianControlSum: number; 
    ukrainianControlSum: number; 
    disputedControlSum: number;
    totalAreaSum: number;
    russianChangeSum: number;
    ukrainianChangeSum: number;
    disputedChangeSum: number;
    days: number;
  }> = new Map();
  
  data.forEach((day, index) => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;
    const { russianChange, ukrainianChange, disputedChange } = getDerivedTotalChanges(data, index);
    
    const existing = weekly.get(key) || { 
      russianControlSum: 0, ukrainianControlSum: 0, disputedControlSum: 0, totalAreaSum: 0,
      russianChangeSum: 0, ukrainianChangeSum: 0, disputedChangeSum: 0,
      days: 0 
    };
    
    // Ukrainian controlled = total - russian - disputed (includes uncontested)
    const ukrainianControlled = day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2;
    
    weekly.set(key, {
      russianControlSum: existing.russianControlSum + day.total_russian_controlled_km2,
      ukrainianControlSum: existing.ukrainianControlSum + ukrainianControlled,
      disputedControlSum: existing.disputedControlSum + day.total_disputed_km2,
      totalAreaSum: existing.totalAreaSum + day.total_area_km2,
      russianChangeSum: existing.russianChangeSum + russianChange,
      ukrainianChangeSum: existing.ukrainianChangeSum + ukrainianChange,
      disputedChangeSum: existing.disputedChangeSum + disputedChange,
      days: existing.days + 1,
    });
  });
  
  return Array.from(weekly.entries()).map(([period, values]) => ({
    period,
    russianAvg: parseFloat((values.russianControlSum / values.days).toFixed(1)),
    ukrainianAvg: parseFloat((values.ukrainianControlSum / values.days).toFixed(1)),
    disputedAvg: parseFloat((values.disputedControlSum / values.days).toFixed(1)),
    russianChangeSum: parseFloat(values.russianChangeSum.toFixed(1)),
    ukrainianChangeSum: parseFloat(values.ukrainianChangeSum.toFixed(1)),
    disputedChangeSum: parseFloat(values.disputedChangeSum.toFixed(1)),
    daysCount: values.days,
  }));
}

/**
 * Aggregates daily data into monthly averages and change sums
 */
export function aggregateMonthly(data: DailyTerritoryData[]): AggregatedData[] {
  const monthly: Map<string, { 
    russianControlSum: number; 
    ukrainianControlSum: number; 
    disputedControlSum: number;
    totalAreaSum: number;
    russianChangeSum: number;
    ukrainianChangeSum: number;
    disputedChangeSum: number;
    days: number;
  }> = new Map();
  
  data.forEach((day, index) => {
    const key = day.date.substring(0, 7); // YYYY-MM
    const { russianChange, ukrainianChange, disputedChange } = getDerivedTotalChanges(data, index);
    
    const existing = monthly.get(key) || { 
      russianControlSum: 0, ukrainianControlSum: 0, disputedControlSum: 0, totalAreaSum: 0,
      russianChangeSum: 0, ukrainianChangeSum: 0, disputedChangeSum: 0,
      days: 0 
    };
    
    // Ukrainian controlled = total - russian - disputed (includes uncontested)
    const ukrainianControlled = day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2;
    
    monthly.set(key, {
      russianControlSum: existing.russianControlSum + day.total_russian_controlled_km2,
      ukrainianControlSum: existing.ukrainianControlSum + ukrainianControlled,
      disputedControlSum: existing.disputedControlSum + day.total_disputed_km2,
      totalAreaSum: existing.totalAreaSum + day.total_area_km2,
      russianChangeSum: existing.russianChangeSum + russianChange,
      ukrainianChangeSum: existing.ukrainianChangeSum + ukrainianChange,
      disputedChangeSum: existing.disputedChangeSum + disputedChange,
      days: existing.days + 1,
    });
  });
  
  return Array.from(monthly.entries()).map(([period, values]) => ({
    period,
    russianAvg: parseFloat((values.russianControlSum / values.days).toFixed(1)),
    ukrainianAvg: parseFloat((values.ukrainianControlSum / values.days).toFixed(1)),
    disputedAvg: parseFloat((values.disputedControlSum / values.days).toFixed(1)),
    russianChangeSum: parseFloat(values.russianChangeSum.toFixed(1)),
    ukrainianChangeSum: parseFloat(values.ukrainianChangeSum.toFixed(1)),
    disputedChangeSum: parseFloat(values.disputedChangeSum.toFixed(1)),
    daysCount: values.days,
  }));
}

/**
 * Gets today's control metrics from the dataset
 */
export function getTodayMetrics(data: DailyTerritoryData[]) {
  const today = data[data.length - 1];

  if (!today) {
    return {
      russianControlled: 0,
      ukrainianControlled: 0,
      disputed: 0,
      russianChange: 0,
      ukrainianChange: 0,
      disputedChange: 0,
    };
  }
  
  // Ukrainian controlled = total - russian - disputed (includes uncontested)
  const ukrainianControlled = today.total_area_km2 - today.total_russian_controlled_km2 - today.total_disputed_km2;
  const todayIndex = data.length - 1;
  const { russianChange, ukrainianChange, disputedChange } = getDerivedTotalChanges(data, todayIndex);
  
  return {
    russianControlled: today.total_russian_controlled_km2,
    ukrainianControlled: ukrainianControlled,
    disputed: today.total_disputed_km2,
    russianChange,
    ukrainianChange,
    disputedChange,
  };
}

/**
 * Gets 7-day summary statistics
 */
export function get7DaySummary(data: DailyTerritoryData[]) {
  const startIndex = Math.max(0, data.length - 7);
  const last7Days = data.slice(startIndex);
  const last7DayIndices = last7Days.map((_, idx) => startIndex + idx);

  const russianChangeSum = last7DayIndices.reduce(
    (sum, dayIndex) => sum + getDerivedTotalChanges(data, dayIndex).russianChange,
    0,
  );
  const ukrainianChangeSum = last7DayIndices.reduce(
    (sum, dayIndex) => sum + getDerivedTotalChanges(data, dayIndex).ukrainianChange,
    0,
  );
  const disputedChangeSum = last7DayIndices.reduce(
    (sum, dayIndex) => sum + getDerivedTotalChanges(data, dayIndex).disputedChange,
    0,
  );
  
  // Average control levels over the period
  // Ukrainian controlled = total - russian - disputed (includes uncontested)
  const russianAvg = last7Days.reduce((sum, d) => sum + d.total_russian_controlled_km2, 0) / 7;
  const ukrainianAvg = last7Days.reduce((sum, d) => sum + (d.total_area_km2 - d.total_russian_controlled_km2 - d.total_disputed_km2), 0) / 7;
  const disputedAvg = last7Days.reduce((sum, d) => sum + d.total_disputed_km2, 0) / 7;
  
  return {
    russianAvg: parseFloat(russianAvg.toFixed(1)),
    ukrainianAvg: parseFloat(ukrainianAvg.toFixed(1)),
    disputedAvg: parseFloat(disputedAvg.toFixed(1)),
    russianChangeSum: parseFloat(russianChangeSum.toFixed(1)),
    ukrainianChangeSum: parseFloat(ukrainianChangeSum.toFixed(1)),
    disputedChangeSum: parseFloat(disputedChangeSum.toFixed(1)),
    netChange: parseFloat((russianChangeSum - ukrainianChangeSum).toFixed(1)),
  };
}

/**
 * Gets current control totals (latest day)
 */
export function getCurrentControlTotals(data: DailyTerritoryData[]) {
  const latest = data[data.length - 1];
  
  if (!latest) {
    return {
      russianControlled: 0,
      ukrainianControlled: 0,
      disputed: 0,
      totalArea: 0,
    };
  }
  
  // Ukrainian controlled = total - russian - disputed (includes uncontested)
  const ukrainianControlled = latest.total_area_km2 - latest.total_russian_controlled_km2 - latest.total_disputed_km2;
  
  return {
    russianControlled: latest.total_russian_controlled_km2,
    ukrainianControlled: ukrainianControlled,
    disputed: latest.total_disputed_km2,
    totalArea: latest.total_area_km2,
  };
}

function parseLocalDateKey(dateKey: string): Date {
  const isoDateOnlyMatch = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnlyMatch) {
    return new Date(
      Number(isoDateOnlyMatch[1]),
      Number(isoDateOnlyMatch[2]) - 1,
      Number(isoDateOnlyMatch[3]),
    );
  }
  return new Date(dateKey);
}

function formatLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface SixMonthNetChangeResult {
  netKm2: number;
  netPctOfTotalUkraine: number;
  totalUkraineAreaKm2: number;
  windowStartDate: string;
  endDate: string;
  snapshotCount: number;
}

/**
 * Net territorial movement over ~6 months: cumulative (Δ Russian controlled − Δ Ukrainian controlled)
 * from the first snapshot on/after (end date − 6 months) through the latest day in `data`.
 * Percent is net km² as a share of total Ukraine area on the end snapshot.
 */
export function getSixMonthNetTerritoryChange(
  data: DailyTerritoryData[],
  oblast?: OblastKey,
): SixMonthNetChangeResult | null {
  if (data.length < 1) {
    return null;
  }

  const endIdx = data.length - 1;
  const endDay = data[endIdx];
  const endDate = parseLocalDateKey(endDay.date);
  const windowStartDate = new Date(endDate);
  windowStartDate.setMonth(windowStartDate.getMonth() - 6);
  const startKey = formatLocalDateKey(windowStartDate);

  let startIdx = data.findIndex((d) => d.date >= startKey);
  if (startIdx < 0) {
    startIdx = 0;
  }
  if (startIdx >= endIdx) {
    const totalUkraineAreaKm2 = endDay.total_area_km2 || 1;
    return {
      netKm2: 0,
      netPctOfTotalUkraine: 0,
      totalUkraineAreaKm2,
      windowStartDate: endDay.date,
      endDate: endDay.date,
      snapshotCount: 1,
    };
  }

  const startDay = data[startIdx];
  const totalUkraineAreaKm2 = Math.max(endDay.total_area_km2, 1);

  let netKm2: number;

  if (oblast) {
    const sRow = startDay.oblasts.find((o) => o.oblast === oblast);
    const eRow = endDay.oblasts.find((o) => o.oblast === oblast);
    const r0 = sRow?.russian_controlled_km2 ?? 0;
    const r1 = eRow?.russian_controlled_km2 ?? 0;
    const u0 = sRow?.ukrainian_controlled_km2 ?? 0;
    const u1 = eRow?.ukrainian_controlled_km2 ?? 0;
    netKm2 = r1 - r0 - (u1 - u0);
  } else {
    const r0 = startDay.total_russian_controlled_km2;
    const r1 = endDay.total_russian_controlled_km2;
    const u0 = startDay.total_area_km2 - r0 - startDay.total_disputed_km2;
    const u1 = endDay.total_area_km2 - r1 - endDay.total_disputed_km2;
    netKm2 = r1 - r0 - (u1 - u0);
  }

  const netPctOfTotalUkraine = (netKm2 / totalUkraineAreaKm2) * 100;

  return {
    netKm2,
    netPctOfTotalUkraine,
    totalUkraineAreaKm2,
    windowStartDate: startDay.date,
    endDate: endDay.date,
    snapshotCount: endIdx - startIdx + 1,
  };
}

/**
 * Get data for a specific oblast over time
 */
export function getOblastData(data: DailyTerritoryData[], oblast: OblastKey) {
  return data.map((day, index) => {
    const oblastData = day.oblasts.find(o => o.oblast === oblast);
    const { russianChange, ukrainianChange, disputedChange } = getDerivedOblastChanges(data, index, oblast);
    return {
      date: day.date,
      formattedDate: formatDate(day.date),
      russianControlled: oblastData?.russian_controlled_km2 || 0,
      ukrainianControlled: oblastData?.ukrainian_controlled_km2 || 0,
      disputed: oblastData?.disputed_controlled_km2 || 0,
      totalArea: oblastData?.total_area_km2 || 0,
      russianChange,
      ukrainianChange,
      disputedChange,
    };
  });
}

/**
 * Filter data by view level (total or specific oblast)
 */
export function getDataForView(data: DailyTerritoryData[], viewLevel: ViewLevel, oblast?: OblastKey): ChartDataPoint[] {
  if (viewLevel === 'total' || !oblast) {
    return calculateControlData(data);
  }
  return getOblastData(data, oblast);
}

/**
 * Formats ISO date string to readable format
 */
export function formatDate(dateStr: string): string {
  // Parse YYYY-MM-DD as a local date to avoid timezone day-shift in labels.
  const isoDateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoDateOnlyMatch
    ? new Date(
        Number(isoDateOnlyMatch[1]),
        Number(isoDateOnlyMatch[2]) - 1,
        Number(isoDateOnlyMatch[3]),
      )
    : new Date(dateStr);

  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Formats period string for display
 */
export function formatPeriod(period: string, range: TimeRange): string {
  if (range === 'weekly') {
    return period; // Already formatted as YYYY-W##
  }
  if (range === 'monthly') {
    const [year, month] = period.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return formatDate(period);
}

/**
 * Gets ISO week number
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
