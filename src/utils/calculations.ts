import type {
  DailyTerritoryData,
  ChartDataPoint,
  AggregatedData,
  TimeRange,
  OblastKey,
  OblastControl,
  ViewLevel,
} from '@/types';

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

/** Short provenance text for weekly JSON rows (tooltips / quality hints). */
export function describeWeeklyRowProvenance(day: DailyTerritoryData): string | undefined {
  if (day.granularity !== 'weekly' && !day.snapshot_source) {
    return undefined;
  }
  const parts: string[] = [];
  if (day.snapshot_source === 'wayback') {
    parts.push('Internet Archive snapshot of DeepState API');
    if (day.wayback_capture_date) {
      parts.push(`capture ${day.wayback_capture_date}`);
    } else if (day.wayback_timestamp) {
      parts.push(`timestamp ${day.wayback_timestamp}`);
    }
  } else if (day.snapshot_source === 'daily_nearest' && day.derived_from_daily) {
    parts.push(`Anchor label ${day.date}; values from daily ${day.derived_from_daily}`);
  } else if (day.snapshot_source === 'weekly_nearest' && day.derived_from_weekly) {
    parts.push(`Anchor label ${day.date}; bridged from weekly ${day.derived_from_weekly}`);
  } else if (day.snapshot_source) {
    parts.push(`Source: ${day.snapshot_source}`);
  }
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Week-over-week change series from weekly history files (uses JSON *_change_km2; earliest week may be 0).
 */
export function calculateWeeklyRepoChangeChartData(weekly: DailyTerritoryData[]): ChartDataPoint[] {
  return weekly.map((day) => {
    const ukrainianControlled =
      day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2;
    return {
      date: day.date,
      formattedDate: formatDate(day.date),
      russianControlled: day.total_russian_controlled_km2,
      ukrainianControlled,
      disputed: day.total_disputed_km2,
      russianChange: day.russian_change_km2 ?? 0,
      ukrainianChange: day.ukrainian_change_km2 ?? 0,
      disputedChange: day.disputed_change_km2 ?? 0,
      snapshotMeta: describeWeeklyRowProvenance(day),
    };
  });
}

/** Control levels for weekly repo snapshots (adjacent points are ~7d apart); adds provenance for tooltips. */
export function calculateWeeklyRepoControlChartData(weekly: DailyTerritoryData[]): ChartDataPoint[] {
  const base = calculateControlData(weekly);
  return base.map((point, i) => ({
    ...point,
    snapshotMeta: describeWeeklyRowProvenance(weekly[i]),
  }));
}

/** Map aggregated periods to control chart points (Area chart expects russianControlled, not russianAvg). */
export function aggregatedToControlChartPoints(agg: AggregatedData[]): ChartDataPoint[] {
  return agg.map((a) => {
    const isIsoWeek = /^\d{4}-W\d{2}$/.test(a.period);
    const formattedDate = isIsoWeek ? a.period : formatPeriod(a.period, 'monthly');
    return {
      date: a.period,
      formattedDate,
      russianControlled: a.russianAvg,
      ukrainianControlled: a.ukrainianAvg,
      disputed: a.disputedAvg,
      russianChange: a.russianChangeSum,
      ukrainianChange: a.ukrainianChangeSum,
      disputedChange: a.disputedChangeSum,
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

function getNationalDeltaWindowed(
  data: DailyTerritoryData[],
  endIndex: number,
  daysBack: number,
): { russianChange: number; ukrainianChange: number; disputedChange: number } {
  if (endIndex < 0 || endIndex >= data.length) {
    return { russianChange: 0, ukrainianChange: 0, disputedChange: 0 };
  }
  const endDay = data[endIndex];
  const endDate = parseLocalDateKey(endDay.date);
  const windowStart = new Date(endDate);
  windowStart.setDate(windowStart.getDate() - daysBack);
  const startKey = formatLocalDateKey(windowStart);

  let startIdx = 0;
  for (let i = 0; i <= endIndex; i++) {
    if (data[i].date >= startKey) {
      startIdx = i;
      break;
    }
  }

  const start = data[startIdx];
  const end = data[endIndex];
  const r0 = start.total_russian_controlled_km2;
  const r1 = end.total_russian_controlled_km2;
  const u0 = start.total_area_km2 - r0 - start.total_disputed_km2;
  const u1 = end.total_area_km2 - r1 - end.total_disputed_km2;
  return {
    russianChange: r1 - r0,
    ukrainianChange: u1 - u0,
    disputedChange: end.total_disputed_km2 - start.total_disputed_km2,
  };
}

function getOblastDeltaWindowed(
  data: DailyTerritoryData[],
  endIndex: number,
  oblast: OblastKey,
  daysBack: number,
): { russianChange: number; ukrainianChange: number; disputedChange: number } {
  if (endIndex < 0 || endIndex >= data.length) {
    return { russianChange: 0, ukrainianChange: 0, disputedChange: 0 };
  }
  const endDay = data[endIndex];
  const endDate = parseLocalDateKey(endDay.date);
  const windowStart = new Date(endDate);
  windowStart.setDate(windowStart.getDate() - daysBack);
  const startKey = formatLocalDateKey(windowStart);

  let startIdx = 0;
  for (let i = 0; i <= endIndex; i++) {
    if (data[i].date >= startKey) {
      startIdx = i;
      break;
    }
  }

  const startRow = data[startIdx].oblasts.find((o) => o.oblast === oblast);
  const endRow = data[endIndex].oblasts.find((o) => o.oblast === oblast);
  return {
    russianChange: (endRow?.russian_controlled_km2 ?? 0) - (startRow?.russian_controlled_km2 ?? 0),
    ukrainianChange: (endRow?.ukrainian_controlled_km2 ?? 0) - (startRow?.ukrainian_controlled_km2 ?? 0),
    disputedChange: (endRow?.disputed_controlled_km2 ?? 0) - (startRow?.disputed_controlled_km2 ?? 0),
  };
}

function snapshotsOnOrBefore(
  snapshots: DailyTerritoryData[],
  selectedDate: string,
): DailyTerritoryData[] {
  return snapshots.filter((w) => w.date <= selectedDate).sort((a, b) => a.date.localeCompare(b.date));
}

function weeklyAnchorsOnOrBefore(
  weeklySnapshots: DailyTerritoryData[],
  selectedDate: string,
): DailyTerritoryData[] {
  return snapshotsOnOrBefore(weeklySnapshots, selectedDate);
}

function yearlyAnchorsOnOrBefore(
  yearlySnapshots: DailyTerritoryData[],
  selectedDate: string,
): DailyTerritoryData[] {
  return snapshotsOnOrBefore(yearlySnapshots, selectedDate);
}

/**
 * Latest weekly snapshot date per calendar year (only years with ≥1 weekly file on/before `selectedDate`).
 */
function getLastWeeklyAnchorPerYear(
  weeklySnapshots: DailyTerritoryData[],
  selectedDate: string,
): { year: number; anchor: DailyTerritoryData }[] {
  const sorted = [...weeklySnapshots].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = sorted.filter((w) => w.date <= selectedDate);
  const byYear = new Map<number, DailyTerritoryData>();
  for (const w of filtered) {
    const y = parseInt(w.date.slice(0, 4), 10);
    if (Number.isNaN(y)) continue;
    const prev = byYear.get(y);
    if (!prev || w.date > prev.date) {
      byYear.set(y, w);
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, anchor]) => ({ year, anchor }));
}

export type OblastRussianChangePeriod = 'day' | 'week' | 'month' | 'year';

/** Net-movement chart: bar height is Russian Δ or Ukrainian Δ (not composite net). */
export type NetMovementDeltaMode = 'russian' | 'ukrainian';

/** Deltas under Territory Breakdown; aligns with Net movement Day / Week / Month / Year. */
export interface SummaryDeltaLine {
  russianChange: number;
  ukrainianChange: number;
  disputedChange: number;
  compareSuffix: string;
}

export function getSummaryDeltasNational(
  dataUpToSelected: DailyTerritoryData[],
  weeklySnapshots: DailyTerritoryData[],
  yearlySnapshots: DailyTerritoryData[],
  period: OblastRussianChangePeriod,
  selectedDate: string,
  endIndex: number,
  previousDailyDateLabel: string | null,
  isLive: boolean,
): SummaryDeltaLine {
  if (endIndex < 0 || dataUpToSelected.length === 0) {
    return {
      russianChange: 0,
      ukrainianChange: 0,
      disputedChange: 0,
      compareSuffix: '',
    };
  }

  if (period === 'day') {
    const { russianChange, ukrainianChange, disputedChange } = getDerivedTotalChanges(
      dataUpToSelected,
      endIndex,
    );
    const compareSuffix = isLive
      ? 'vs previous day'
      : previousDailyDateLabel
        ? `vs ${previousDailyDateLabel}`
        : 'vs previous available date';
    return { russianChange, ukrainianChange, disputedChange, compareSuffix };
  }

  if (period === 'week' && weeklySnapshots.length > 0) {
    const anchors = weeklyAnchorsOnOrBefore(weeklySnapshots, selectedDate);
    if (anchors.length === 0) {
      const w = getNationalDeltaWindowed(dataUpToSelected, endIndex, 7);
      return {
        ...w,
        compareSuffix: '~7 days (no weekly anchor on or before this date)',
      };
    }
    const latest = anchors[anchors.length - 1];
    const prev = anchors.length >= 2 ? anchors[anchors.length - 2] : null;
    return {
      russianChange: latest.russian_change_km2 ?? 0,
      ukrainianChange: latest.ukrainian_change_km2 ?? 0,
      disputedChange: latest.disputed_change_km2 ?? 0,
      compareSuffix: prev
        ? `WoW vs ${prev.date} (weekly anchor ${latest.date})`
        : `first weekly anchor (${latest.date})`,
    };
  }

  if (period === 'week') {
    const w = getNationalDeltaWindowed(dataUpToSelected, endIndex, 7);
    return {
      ...w,
      compareSuffix: '~7 days (first snapshot in window)',
    };
  }

  if (period === 'month') {
    const m = getNationalDeltaWindowed(dataUpToSelected, endIndex, 30);
    return {
      ...m,
      compareSuffix: '~30 days (first snapshot in window)',
    };
  }

  if (period === 'year' && yearlySnapshots.length > 0) {
    const anchors = yearlyAnchorsOnOrBefore(yearlySnapshots, selectedDate);
    if (anchors.length === 0) {
      const yoy = tryNationalYoYFromWeekly(weeklySnapshots, selectedDate);
      if (yoy) {
        return yoy;
      }
      const w = getNationalDeltaWindowed(dataUpToSelected, endIndex, 365);
      return {
        ...w,
        compareSuffix: '~365 days (no yearly anchor on or before this date)',
      };
    }
    const latest = anchors[anchors.length - 1];
    const prev = anchors.length >= 2 ? anchors[anchors.length - 2] : null;
    return {
      russianChange: latest.russian_change_km2 ?? 0,
      ukrainianChange: latest.ukrainian_change_km2 ?? 0,
      disputedChange: latest.disputed_change_km2 ?? 0,
      compareSuffix: prev
        ? `YoY vs ${prev.date} (yearly anchor ${latest.date})`
        : `first yearly anchor (${latest.date})`,
    };
  }

  if (period === 'year') {
    const yoy = tryNationalYoYFromWeekly(weeklySnapshots, selectedDate);
    if (yoy) {
      return yoy;
    }
    const w = getNationalDeltaWindowed(dataUpToSelected, endIndex, 365);
    return {
      ...w,
      compareSuffix: '~365 days (first snapshot in window)',
    };
  }

  return {
    russianChange: 0,
    ukrainianChange: 0,
    disputedChange: 0,
    compareSuffix: '',
  };
}

export function getSummaryDeltasOblast(
  dataUpToSelected: DailyTerritoryData[],
  weeklySnapshots: DailyTerritoryData[],
  yearlySnapshots: DailyTerritoryData[],
  period: OblastRussianChangePeriod,
  selectedDate: string,
  endIndex: number,
  oblast: OblastKey,
  previousDailyDateLabel: string | null,
  isLive: boolean,
): SummaryDeltaLine {
  if (endIndex < 0 || dataUpToSelected.length === 0) {
    return {
      russianChange: 0,
      ukrainianChange: 0,
      disputedChange: 0,
      compareSuffix: '',
    };
  }

  if (period === 'day') {
    const { russianChange, ukrainianChange, disputedChange } = getDerivedOblastChanges(
      dataUpToSelected,
      endIndex,
      oblast,
    );
    const compareSuffix = isLive
      ? 'vs previous day'
      : previousDailyDateLabel
        ? `vs ${previousDailyDateLabel}`
        : 'vs previous available date';
    return { russianChange, ukrainianChange, disputedChange, compareSuffix };
  }

  if (period === 'week' && weeklySnapshots.length > 0) {
    const anchors = weeklyAnchorsOnOrBefore(weeklySnapshots, selectedDate);
    if (anchors.length === 0) {
      const w = getOblastDeltaWindowed(dataUpToSelected, endIndex, oblast, 7);
      return {
        ...w,
        compareSuffix: '~7 days (no weekly anchor on or before this date)',
      };
    }
    const latest = anchors[anchors.length - 1];
    const prev = anchors.length >= 2 ? anchors[anchors.length - 2] : null;
    const row = latest.oblasts.find((o) => o.oblast === oblast);
    return {
      russianChange: row?.russian_change_km2 ?? 0,
      ukrainianChange: row?.ukrainian_change_km2 ?? 0,
      disputedChange: row?.disputed_change_km2 ?? 0,
      compareSuffix: prev
        ? `WoW vs ${prev.date} (weekly ${latest.date})`
        : `first weekly anchor (${latest.date})`,
    };
  }

  if (period === 'week') {
    const w = getOblastDeltaWindowed(dataUpToSelected, endIndex, oblast, 7);
    return {
      ...w,
      compareSuffix: '~7 days (first snapshot in window)',
    };
  }

  if (period === 'month') {
    const m = getOblastDeltaWindowed(dataUpToSelected, endIndex, oblast, 30);
    return {
      ...m,
      compareSuffix: '~30 days (first snapshot in window)',
    };
  }

  if (period === 'year' && yearlySnapshots.length > 0) {
    const anchors = yearlyAnchorsOnOrBefore(yearlySnapshots, selectedDate);
    if (anchors.length === 0) {
      const yoy = tryOblastYoYFromWeekly(weeklySnapshots, selectedDate, oblast);
      if (yoy) {
        return yoy;
      }
      const w = getOblastDeltaWindowed(dataUpToSelected, endIndex, oblast, 365);
      return {
        ...w,
        compareSuffix: '~365 days (no yearly anchor on or before this date)',
      };
    }
    const latest = anchors[anchors.length - 1];
    const prev = anchors.length >= 2 ? anchors[anchors.length - 2] : null;
    const row = latest.oblasts.find((o) => o.oblast === oblast);
    return {
      russianChange: row?.russian_change_km2 ?? 0,
      ukrainianChange: row?.ukrainian_change_km2 ?? 0,
      disputedChange: row?.disputed_change_km2 ?? 0,
      compareSuffix: prev
        ? `YoY vs ${prev.date} (yearly ${latest.date})`
        : `first yearly anchor (${latest.date})`,
    };
  }

  if (period === 'year') {
    const yoy = tryOblastYoYFromWeekly(weeklySnapshots, selectedDate, oblast);
    if (yoy) {
      return yoy;
    }
    const w = getOblastDeltaWindowed(dataUpToSelected, endIndex, oblast, 365);
    return {
      ...w,
      compareSuffix: '~365 days (first snapshot in window)',
    };
  }

  return {
    russianChange: 0,
    ukrainianChange: 0,
    disputedChange: 0,
    compareSuffix: '',
  };
}

/**
 * Change in Russian-controlled km² for one oblast at `endIndex` in `data` (sorted by date).
 * - day: vs previous snapshot (derived delta; first day uses JSON fallback).
 * - week / month / year: vs earliest snapshot on or after (end − 7 / − 30 / − 365 calendar days), within loaded data.
 * - year (optional): YoY from yearly JSON when present; else YoY from weekly year-end anchors (same as summary); else ~365d window.
 */
export function getOblastRussianChangeKm2(
  data: DailyTerritoryData[],
  oblast: OblastKey,
  period: OblastRussianChangePeriod,
  endIndex: number,
  options?: {
    yearlySnapshots?: DailyTerritoryData[];
    weeklySnapshots?: DailyTerritoryData[];
    selectedDate?: string;
  },
): number {
  if (endIndex < 0 || endIndex >= data.length) {
    return 0;
  }
  if (period === 'day') {
    return getDerivedOblastChanges(data, endIndex, oblast).russianChange;
  }

  if (
    period === 'year' &&
    options?.yearlySnapshots &&
    options.yearlySnapshots.length > 0 &&
    options.selectedDate
  ) {
    const anchors = yearlyAnchorsOnOrBefore(options.yearlySnapshots, options.selectedDate);
    if (anchors.length > 0) {
      const latest = anchors[anchors.length - 1];
      const row = latest.oblasts.find((o) => o.oblast === oblast);
      return row?.russian_change_km2 ?? 0;
    }
  }

  if (
    period === 'year' &&
    options?.weeklySnapshots &&
    options.weeklySnapshots.length >= 2 &&
    options.selectedDate
  ) {
    const rows = getLastWeeklyAnchorPerYear(options.weeklySnapshots, options.selectedDate);
    if (rows.length >= 2) {
      return deltaRussianOblastPair(
        rows[rows.length - 2].anchor,
        rows[rows.length - 1].anchor,
        oblast,
      );
    }
  }

  const daysBack = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : 30;
  const endDay = data[endIndex];
  const endDate = parseLocalDateKey(endDay.date);
  const windowStart = new Date(endDate);
  windowStart.setDate(windowStart.getDate() - daysBack);
  const startKey = formatLocalDateKey(windowStart);

  let startIdx = 0;
  for (let i = 0; i <= endIndex; i++) {
    if (data[i].date >= startKey) {
      startIdx = i;
      break;
    }
  }

  const startRow = data[startIdx].oblasts.find((o) => o.oblast === oblast);
  const endRow = data[endIndex].oblasts.find((o) => o.oblast === oblast);
  const r0 = startRow?.russian_controlled_km2 ?? 0;
  const r1 = endRow?.russian_controlled_km2 ?? 0;
  return r1 - r0;
}

function shiftCalendarMonth(year: number, month1Based: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month1Based - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** Last fully completed calendar month relative to `referenceDate` (current calendar month excluded). Month is 1–12. */
function getLastCompletedYearMonth(referenceDate: Date): { year: number; month: number } {
  const y = referenceDate.getFullYear();
  const m0 = referenceDate.getMonth(); // 0-based (May = 4)
  if (m0 === 0) {
    return { year: y - 1, month: 12 };
  }
  return { year: y, month: m0 }; // previous month in 1-based form (e.g. May → April = 4)
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCompletedMonthLabel(year: number, month: number): string {
  return `${SHORT_MONTH[month - 1]} ${String(year).slice(-2)}`;
}

export interface CompletedMonthNetRow {
  year: number;
  month: number;
  monthKey: string;
  label: string;
  russianDeltaKm2: number;
  ukrainianDeltaKm2: number;
  /** Denominator for % of Ukraine (last day of month snapshot or weekly bridge end). */
  areaDenominatorKm2: number;
  snapshotCount: number;
  startDate: string | null;
  endDate: string | null;
  /** When daily has fewer than two points in the month, deltas may come from weekly anchors (interp at month bounds). */
  source?: 'daily' | 'weekly_bridge';
}

function firstDayKeyOfMonth(year: number, month1: number): string {
  return `${year}-${String(month1).padStart(2, '0')}-01`;
}

function lastDayKeyOfMonth(year: number, month1: number): string {
  const day = new Date(year, month1, 0).getDate();
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Russian and Ukrainian deltas for a calendar month using interpolated weekly state at month start/end. */
function tryMonthNetFromWeekly(
  weeklySortedAsc: DailyTerritoryData[],
  year: number,
  month1: number,
  oblast?: OblastKey,
): {
  russianDeltaKm2: number;
  ukrainianDeltaKm2: number;
  areaDenominatorKm2: number;
  startDate: string;
  endDate: string;
} | null {
  if (weeklySortedAsc.length < 2) {
    return null;
  }
  const sorted = [...weeklySortedAsc].sort((a, b) => a.date.localeCompare(b.date));
  const startKey = firstDayKeyOfMonth(year, month1);
  const endKey = lastDayKeyOfMonth(year, month1);
  const startState = interpolateTerritoryAtDate(sorted, startKey);
  const endState = interpolateTerritoryAtDate(sorted, endKey);
  if (!startState || !endState) {
    return null;
  }
  const russianDeltaKm2 = oblast
    ? deltaRussianOblastPair(startState, endState, oblast)
    : deltaRussianNationalPair(startState, endState);
  const ukrainianDeltaKm2 = oblast
    ? deltaUkrainianOblastPair(startState, endState, oblast)
    : deltaUkrainianNationalPair(startState, endState);
  const areaDenominatorKm2 = Math.max(endState.total_area_km2, 1);
  return {
    russianDeltaKm2,
    ukrainianDeltaKm2,
    areaDenominatorKm2,
    startDate: startKey,
    endDate: endKey,
  };
}

function nationalDerivedUkrainianKm2(d: DailyTerritoryData): number {
  return d.total_area_km2 - d.total_russian_controlled_km2 - d.total_disputed_km2;
}

function deltaRussianNationalPair(start: DailyTerritoryData, end: DailyTerritoryData): number {
  return end.total_russian_controlled_km2 - start.total_russian_controlled_km2;
}

function deltaUkrainianNationalPair(start: DailyTerritoryData, end: DailyTerritoryData): number {
  return nationalDerivedUkrainianKm2(end) - nationalDerivedUkrainianKm2(start);
}

function deltaRussianOblastPair(
  start: DailyTerritoryData,
  end: DailyTerritoryData,
  oblast: OblastKey,
): number {
  const a = start.oblasts.find((o) => o.oblast === oblast);
  const b = end.oblasts.find((o) => o.oblast === oblast);
  return (b?.russian_controlled_km2 ?? 0) - (a?.russian_controlled_km2 ?? 0);
}

function deltaUkrainianOblastPair(
  start: DailyTerritoryData,
  end: DailyTerritoryData,
  oblast: OblastKey,
): number {
  const a = start.oblasts.find((o) => o.oblast === oblast);
  const b = end.oblasts.find((o) => o.oblast === oblast);
  return (b?.ukrainian_controlled_km2 ?? 0) - (a?.ukrainian_controlled_km2 ?? 0);
}

function pairDelta(
  start: DailyTerritoryData,
  end: DailyTerritoryData,
  mode: NetMovementDeltaMode,
  oblast?: OblastKey,
): number {
  if (oblast) {
    return mode === 'ukrainian'
      ? deltaUkrainianOblastPair(start, end, oblast)
      : deltaRussianOblastPair(start, end, oblast);
  }
  return mode === 'ukrainian'
    ? deltaUkrainianNationalPair(start, end)
    : deltaRussianNationalPair(start, end);
}

function tryNationalYoYFromWeekly(
  weeklySnapshots: DailyTerritoryData[],
  selectedDate: string,
): SummaryDeltaLine | null {
  if (weeklySnapshots.length < 2 || !selectedDate) {
    return null;
  }
  const rows = getLastWeeklyAnchorPerYear(weeklySnapshots, selectedDate);
  if (rows.length < 2) {
    return null;
  }
  const prev = rows[rows.length - 2];
  const last = rows[rows.length - 1];
  return {
    russianChange: deltaRussianNationalPair(prev.anchor, last.anchor),
    ukrainianChange: deltaUkrainianNationalPair(prev.anchor, last.anchor),
    disputedChange: last.anchor.total_disputed_km2 - prev.anchor.total_disputed_km2,
    compareSuffix: `YoY vs ${prev.anchor.date} → ${last.anchor.date} (weekly year-end anchors)`,
  };
}

function tryOblastYoYFromWeekly(
  weeklySnapshots: DailyTerritoryData[],
  selectedDate: string,
  oblast: OblastKey,
): SummaryDeltaLine | null {
  if (weeklySnapshots.length < 2 || !selectedDate) {
    return null;
  }
  const rows = getLastWeeklyAnchorPerYear(weeklySnapshots, selectedDate);
  if (rows.length < 2) {
    return null;
  }
  const prev = rows[rows.length - 2];
  const last = rows[rows.length - 1];
  const aRow = prev.anchor.oblasts.find((o) => o.oblast === oblast);
  const bRow = last.anchor.oblasts.find((o) => o.oblast === oblast);
  return {
    russianChange: (bRow?.russian_controlled_km2 ?? 0) - (aRow?.russian_controlled_km2 ?? 0),
    ukrainianChange: (bRow?.ukrainian_controlled_km2 ?? 0) - (aRow?.ukrainian_controlled_km2 ?? 0),
    disputedChange: (bRow?.disputed_controlled_km2 ?? 0) - (aRow?.disputed_controlled_km2 ?? 0),
    compareSuffix: `YoY vs ${prev.anchor.date} → ${last.anchor.date} (weekly year-end)`,
  };
}

/**
 * Six most recent completed calendar months (e.g. with data ending May 2026 → Nov 2025 … Apr 2026),
 * each with Russian and Ukrainian controlled-area deltas from first to last snapshot in that month.
 * When a month has fewer than two daily snapshots but `weeklySnapshots` has ≥2 anchors, deltas are estimated
 * from interpolated weekly state at the first and last calendar day of that month.
 */
export function getLastSixCompletedMonthsNetMovement(
  data: DailyTerritoryData[],
  oblast?: OblastKey,
  weeklySnapshots?: DailyTerritoryData[],
): CompletedMonthNetRow[] {
  if (data.length < 1) {
    return [];
  }

  const endDay = data[data.length - 1];
  const ref = parseLocalDateKey(endDay.date);
  const { year: anchorY, month: anchorM } = getLastCompletedYearMonth(ref);

  const rows: CompletedMonthNetRow[] = [];
  for (let i = 0; i < 6; i++) {
    const { year, month } = shiftCalendarMonth(anchorY, anchorM, -5 + i);
    const key = monthKey(year, month);
    const inMonth = data.filter((d) => d.date.startsWith(key));

    let russianDeltaKm2 = 0;
    let ukrainianDeltaKm2 = 0;
    let areaDenominatorKm2 = 0;
    let startDate: string | null = null;
    let endDate: string | null = null;
    let snapshotCount = inMonth.length;
    let source: CompletedMonthNetRow['source'] = 'daily';

    if (inMonth.length >= 2) {
      const start = inMonth[0];
      const end = inMonth[inMonth.length - 1];
      startDate = start.date;
      endDate = end.date;
      russianDeltaKm2 = oblast
        ? deltaRussianOblastPair(start, end, oblast)
        : deltaRussianNationalPair(start, end);
      ukrainianDeltaKm2 = oblast
        ? deltaUkrainianOblastPair(start, end, oblast)
        : deltaUkrainianNationalPair(start, end);
      areaDenominatorKm2 = Math.max(end.total_area_km2, 1);
    } else if (weeklySnapshots && weeklySnapshots.length >= 2) {
      const bridged = tryMonthNetFromWeekly(weeklySnapshots, year, month, oblast);
      if (bridged) {
        russianDeltaKm2 = bridged.russianDeltaKm2;
        ukrainianDeltaKm2 = bridged.ukrainianDeltaKm2;
        areaDenominatorKm2 = bridged.areaDenominatorKm2;
        startDate = bridged.startDate;
        endDate = bridged.endDate;
        snapshotCount = 2;
        source = 'weekly_bridge';
      }
    } else if (inMonth.length === 1) {
      startDate = inMonth[0].date;
      endDate = inMonth[0].date;
    }

    rows.push({
      year,
      month,
      monthKey: key,
      label: formatCompletedMonthLabel(year, month),
      russianDeltaKm2,
      ukrainianDeltaKm2,
      areaDenominatorKm2,
      snapshotCount,
      startDate,
      endDate,
      source,
    });
  }

  return rows;
}

export interface NetMovementBarRow {
  periodLabel: string;
  netKm2: number;
  fullNet: number | null;
  pct: number | null;
  hasData: boolean;
  /** Extra context in tooltips (e.g. linear interpolation to viewed date). */
  tooltipNote?: string;
}

function utcDayNumberFromDateKey(dateKey: string): number {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    return Date.parse(dateKey) / 86400000;
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear blend / extrapolate of territory state between two snapshots in time.
 * `t` is 0 at `older` and 1 at `newer`; values outside [0,1] extrapolate.
 */
export function interpolateTerritoryBetween(
  older: DailyTerritoryData,
  newer: DailyTerritoryData,
  t: number,
  targetDate: string,
): DailyTerritoryData {
  const keys = new Set<OblastKey>();
  for (const o of older.oblasts) {
    keys.add(o.oblast);
  }
  for (const o of newer.oblasts) {
    keys.add(o.oblast);
  }

  const oblasts: OblastControl[] = [];
  for (const oblast of keys) {
    const a = older.oblasts.find((o) => o.oblast === oblast);
    const b = newer.oblasts.find((o) => o.oblast === oblast);
    const r0 = a?.russian_controlled_km2 ?? 0;
    const r1 = b?.russian_controlled_km2 ?? 0;
    const u0 = a?.ukrainian_controlled_km2 ?? 0;
    const u1 = b?.ukrainian_controlled_km2 ?? 0;
    const d0 = a?.disputed_controlled_km2 ?? 0;
    const d1 = b?.disputed_controlled_km2 ?? 0;
    const ta0 = a?.total_area_km2 ?? 0;
    const ta1 = b?.total_area_km2 ?? 0;
    oblasts.push({
      oblast,
      russian_controlled_km2: lerpNum(r0, r1, t),
      ukrainian_controlled_km2: lerpNum(u0, u1, t),
      disputed_controlled_km2: lerpNum(d0, d1, t),
      total_area_km2: lerpNum(ta0, ta1, t),
    });
  }

  const tr0 = older.total_russian_controlled_km2;
  const tr1 = newer.total_russian_controlled_km2;
  const tu0 = older.total_ukrainian_controlled_km2;
  const tu1 = newer.total_ukrainian_controlled_km2;
  const td0 = older.total_disputed_km2;
  const td1 = newer.total_disputed_km2;
  const ta0 = older.total_area_km2;
  const ta1 = newer.total_area_km2;

  return {
    ...newer,
    date: targetDate,
    granularity: newer.granularity,
    total_russian_controlled_km2: lerpNum(tr0, tr1, t),
    total_ukrainian_controlled_km2: lerpNum(tu0, tu1, t),
    total_disputed_km2: lerpNum(td0, td1, t),
    total_area_km2: lerpNum(ta0, ta1, t),
    oblasts,
    russian_change_km2: 0,
    ukrainian_change_km2: 0,
    disputed_change_km2: 0,
    notes: 'interpolated',
  };
}

/**
 * State at `targetDate` along the weekly anchor timeline: exact anchor match, lerp between
 * surrounding anchors, or linear extrapolation using the two nearest anchors (requires ≥2 points).
 */
export function interpolateTerritoryAtDate(
  weeklySortedAsc: DailyTerritoryData[],
  targetDate: string,
): DailyTerritoryData | null {
  const sorted = [...weeklySortedAsc].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return null;
  }
  if (sorted.length === 1) {
    const only = sorted[0];
    return { ...only, date: targetDate };
  }

  const tDay = utcDayNumberFromDateKey(targetDate);

  for (const row of sorted) {
    if (row.date === targetDate) {
      return { ...row };
    }
  }

  let lo = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].date <= targetDate) {
      lo = i;
    }
  }

  if (lo < 0) {
    const a = sorted[0];
    const b = sorted[1];
    const t0 = utcDayNumberFromDateKey(a.date);
    const t1 = utcDayNumberFromDateKey(b.date);
    const span = t1 - t0 || 1;
    const t = (tDay - t0) / span;
    return interpolateTerritoryBetween(a, b, t, targetDate);
  }

  if (lo === sorted.length - 1) {
    const b = sorted[lo];
    const a = sorted[lo - 1];
    const t0 = utcDayNumberFromDateKey(a.date);
    const t1 = utcDayNumberFromDateKey(b.date);
    const span = t1 - t0 || 1;
    const t = (tDay - t0) / span;
    return interpolateTerritoryBetween(a, b, t, targetDate);
  }

  const a = sorted[lo];
  const b = sorted[lo + 1];
  const t0 = utcDayNumberFromDateKey(a.date);
  const t1 = utcDayNumberFromDateKey(b.date);
  const span = t1 - t0 || 1;
  const t = (tDay - t0) / span;
  return interpolateTerritoryBetween(a, b, t, targetDate);
}

export interface WeeklyNetMovementSegment {
  start: DailyTerritoryData;
  end: DailyTerritoryData;
  periodLabel: string;
  interpolatedEnd: boolean;
}

/** Build weekly WoW net segments; last segment may end at linearly interpolated/extrapolated state for `selectedDate`. */
export function buildWeeklyHistoryNetSegments(
  weeklySortedAsc: DailyTerritoryData[],
  selectedDate: string,
): WeeklyNetMovementSegment[] {
  const sorted = [...weeklySortedAsc].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return [];
  }

  const endState = interpolateTerritoryAtDate(sorted, selectedDate);
  if (!endState) {
    return [];
  }

  const segments: WeeklyNetMovementSegment[] = [];
  const firstDate = sorted[0].date;

  if (selectedDate < firstDate) {
    segments.push({
      start: endState,
      end: sorted[0],
      periodLabel: `${formatDate(selectedDate)}→${formatDate(sorted[0].date)}`,
      interpolatedEnd: true,
    });
    return segments;
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].date <= selectedDate) {
      segments.push({
        start: sorted[i - 1],
        end: sorted[i],
        periodLabel: formatDate(sorted[i].date),
        interpolatedEnd: false,
      });
    }
  }

  let lastAnchor = sorted[0];
  for (const w of sorted) {
    if (w.date <= selectedDate) {
      lastAnchor = w;
    }
  }

  const onAnchor = lastAnchor.date === selectedDate;
  if (!onAnchor) {
    segments.push({
      start: lastAnchor,
      end: endState,
      periodLabel: `→ ${formatDate(selectedDate)}`,
      interpolatedEnd: true,
    });
  }

  return segments;
}

/**
 * Territory-change bars from `data/history/weekly` anchors (WoW), optionally ending with a segment
 * to the viewed date via linear interpolation/extrapolation between nearest anchors.
 */
export function getWeeklyHistoryNetMovementRows(
  weeklySortedAsc: DailyTerritoryData[],
  selectedDate: string,
  oblast: OblastKey | undefined,
  maxBars: number,
  deltaMode: NetMovementDeltaMode,
  anchorKind: 'weekly' | 'yearly' = 'weekly',
): NetMovementBarRow[] {
  const segments = buildWeeklyHistoryNetSegments(weeklySortedAsc, selectedDate);
  if (segments.length === 0) {
    return [];
  }

  const anchorWord = anchorKind === 'yearly' ? 'yearly' : 'weekly';
  const lastBars = segments.slice(-maxBars);
  const out: NetMovementBarRow[] = [];

  for (const seg of lastBars) {
    const netKm2 = pairDelta(seg.start, seg.end, deltaMode, oblast);
    const totalUkraine = Math.max(seg.end.total_area_km2, 1);
    const pct = (netKm2 / totalUkraine) * 100;
    out.push({
      periodLabel: seg.periodLabel,
      netKm2,
      fullNet: netKm2,
      pct,
      hasData: true,
      tooltipNote: seg.interpolatedEnd
        ? `Linear blend or extrapolation along time between the two nearest ${anchorWord} JSON anchors (state at the viewed date is estimated, not a file row).`
        : undefined,
    });
  }

  return out;
}

function weekBucketKeyFromDateString(dateStr: string): string {
  const d = parseLocalDateKey(dateStr);
  const y = d.getFullYear();
  const w = getWeekNumber(d);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

function formatWeekAxisLabel(weekKey: string): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  return `W${Number(m[2])} '${m[1].slice(-2)}`;
}

function getYoYNetMovementRowsFromWeekly(
  weeklySortedAsc: DailyTerritoryData[],
  selectedDate: string,
  oblast: OblastKey | undefined,
  maxBars: number,
  deltaMode: NetMovementDeltaMode,
): NetMovementBarRow[] {
  const rows = getLastWeeklyAnchorPerYear(weeklySortedAsc, selectedDate);
  if (rows.length < 2) {
    return [];
  }
  const pairs: NetMovementBarRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const start = rows[i - 1].anchor;
    const end = rows[i].anchor;
    const netKm2 = pairDelta(start, end, deltaMode, oblast);
    const totalUkraine = Math.max(end.total_area_km2, 1);
    pairs.push({
      periodLabel: String(rows[i].year),
      netKm2,
      fullNet: netKm2,
      pct: (netKm2 / totalUkraine) * 100,
      hasData: true,
      tooltipNote:
        'Year-over-year change between last weekly snapshots of consecutive calendar years (used when dedicated yearly JSON is unavailable).',
    });
  }
  return pairs.slice(-maxBars);
}

function getCalendarYearNetMovementFromDaily(
  data: DailyTerritoryData[],
  oblast: OblastKey | undefined,
  mode: NetMovementDeltaMode,
  maxYears: number,
): NetMovementBarRow[] {
  const yearSet = new Set<number>();
  for (const d of data) {
    const y = parseInt(d.date.slice(0, 4), 10);
    if (!Number.isNaN(y)) yearSet.add(y);
  }
  const years = [...yearSet].sort((a, b) => a - b);
  const sliceYears = years.slice(-maxYears);
  const out: NetMovementBarRow[] = [];
  for (const y of sliceYears) {
    const prefix = `${y}-`;
    const inYear = data.filter((d) => d.date.startsWith(prefix));
    if (inYear.length >= 2) {
      const a = inYear[0];
      const b = inYear[inYear.length - 1];
      const netKm2 = pairDelta(a, b, mode, oblast);
      const totalUkraine = Math.max(b.total_area_km2, 1);
      out.push({
        periodLabel: String(y),
        netKm2,
        fullNet: netKm2,
        pct: (netKm2 / totalUkraine) * 100,
        hasData: true,
        tooltipNote:
          'First vs last daily snapshot in this calendar year (fallback when no yearly history JSON is loaded).',
      });
    } else {
      out.push({
        periodLabel: String(y),
        netKm2: 0,
        fullNet: null,
        pct: null,
        hasData: false,
      });
    }
  }
  return out;
}

/**
 * Bars for territory controlled-area change: either Δ Russian or Δ Ukrainian per step (national or oblast).
 * Day: last 14 snapshots vs previous. Week: weekly JSON (WoW) when provided, else ISO weeks from dailies.
 * Month: six completed calendar months. Year: yearly JSON (YoY) when provided, else YoY from weekly
 * year-end anchors, else last six calendar years from dailies.
 */
export function getNetMovementChartRows(
  data: DailyTerritoryData[],
  period: OblastRussianChangePeriod,
  oblast?: OblastKey,
  options?: {
    weeklySnapshots?: DailyTerritoryData[];
    yearlySnapshots?: DailyTerritoryData[];
    selectedDate?: string;
    deltaMode?: NetMovementDeltaMode;
  },
): NetMovementBarRow[] {
  if (data.length < 1) {
    return [];
  }

  const mode: NetMovementDeltaMode = options?.deltaMode ?? 'russian';

  if (period === 'day') {
    const maxBars = 14;
    const n = data.length;
    const start = Math.max(0, n - maxBars);
    const out: NetMovementBarRow[] = [];
    for (let i = start; i < n; i++) {
      const day = data[i];
      const d = oblast ? getDerivedOblastChanges(data, i, oblast) : getDerivedTotalChanges(data, i);
      const net = mode === 'ukrainian' ? d.ukrainianChange : d.russianChange;
      const totalUkraine = Math.max(day.total_area_km2, 1);
      const pct = (net / totalUkraine) * 100;
      out.push({
        periodLabel: formatDate(day.date),
        netKm2: net,
        fullNet: net,
        pct,
        hasData: true,
      });
    }
    return out;
  }

  if (period === 'week') {
    const weekly = options?.weeklySnapshots;
    if (weekly && weekly.length >= 2) {
      const sel = options?.selectedDate ?? data[data.length - 1]?.date ?? '';
      const fromRepo = getWeeklyHistoryNetMovementRows(weekly, sel, oblast, 6, mode);
      if (fromRepo.length > 0) {
        return fromRepo;
      }
    }

    const weekKeySet = new Set<string>();
    for (const d of data) {
      weekKeySet.add(weekBucketKeyFromDateString(d.date));
    }
    const weekKeys = [...weekKeySet].sort();
    const lastWeeks = weekKeys.slice(-6);
    const out: NetMovementBarRow[] = [];
    for (const wk of lastWeeks) {
      const inWeek = data.filter((d) => weekBucketKeyFromDateString(d.date) === wk);
      if (inWeek.length >= 2) {
        const a = inWeek[0];
        const b = inWeek[inWeek.length - 1];
        const netKm2 = pairDelta(a, b, mode, oblast);
        const totalUkraine = Math.max(b.total_area_km2, 1);
        out.push({
          periodLabel: formatWeekAxisLabel(wk),
          netKm2: netKm2,
          fullNet: netKm2,
          pct: (netKm2 / totalUkraine) * 100,
          hasData: true,
        });
      } else {
        out.push({
          periodLabel: formatWeekAxisLabel(wk),
          netKm2: 0,
          fullNet: null,
          pct: null,
          hasData: false,
        });
      }
    }
    return out;
  }

  if (period === 'month') {
    const months = getLastSixCompletedMonthsNetMovement(data, oblast, options?.weeklySnapshots);
    return months.map((row) => {
      const [yy, mm] = row.monthKey.split('-');
      const periodLabel = `${SHORT_MONTH[parseInt(mm, 10) - 1]}-${yy.slice(-2)}`;
      const canPlot = row.snapshotCount >= 2 && row.areaDenominatorKm2 > 0;
      const raw =
        mode === 'ukrainian' ? row.ukrainianDeltaKm2 : row.russianDeltaKm2;
      const pct = canPlot ? (raw / row.areaDenominatorKm2) * 100 : null;
      return {
        periodLabel,
        netKm2: canPlot ? raw : 0,
        fullNet: canPlot ? raw : null,
        pct,
        hasData: canPlot,
        tooltipNote:
          row.source === 'weekly_bridge'
            ? 'Estimated from weekly history: interpolated/extrapolated territory at month start vs month end (fewer than 2 daily snapshots in this month).'
            : undefined,
      };
    });
  }

  if (period === 'year') {
    const yearly = options?.yearlySnapshots;
    if (yearly && yearly.length >= 2) {
      const sel = options?.selectedDate ?? data[data.length - 1]?.date ?? '';
      const fromRepo = getWeeklyHistoryNetMovementRows(yearly, sel, oblast, 6, mode, 'yearly');
      if (fromRepo.length > 0) {
        return fromRepo;
      }
    }
    const weekly = options?.weeklySnapshots;
    if (weekly && weekly.length >= 2) {
      const sel = options?.selectedDate ?? data[data.length - 1]?.date ?? '';
      const fromWeeklyYoY = getYoYNetMovementRowsFromWeekly(weekly, sel, oblast, 6, mode);
      if (fromWeeklyYoY.length > 0) {
        return fromWeeklyYoY;
      }
    }
    return getCalendarYearNetMovementFromDaily(data, oblast, mode, 6);
  }

  return [];
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
