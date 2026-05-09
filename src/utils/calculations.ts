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

export type OblastRussianChangePeriod = 'day' | 'week' | 'month';

/**
 * Change in Russian-controlled km² for one oblast at `endIndex` in `data` (sorted by date).
 * - day: vs previous snapshot (derived delta; first day uses JSON fallback).
 * - week / month: vs earliest snapshot on or after (end date − 7 / − 30 calendar days), within loaded data.
 */
export function getOblastRussianChangeKm2(
  data: DailyTerritoryData[],
  oblast: OblastKey,
  period: OblastRussianChangePeriod,
  endIndex: number,
): number {
  if (endIndex < 0 || endIndex >= data.length) {
    return 0;
  }
  if (period === 'day') {
    return getDerivedOblastChanges(data, endIndex, oblast).russianChange;
  }

  const daysBack = period === 'week' ? 7 : 30;
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
  netKm2: number;
  netPctOfTotalUkraine: number;
  snapshotCount: number;
  startDate: string | null;
  endDate: string | null;
}

function netMovementNational(startDay: DailyTerritoryData, endDay: DailyTerritoryData): number {
  const r0 = startDay.total_russian_controlled_km2;
  const r1 = endDay.total_russian_controlled_km2;
  const u0 = startDay.total_area_km2 - r0 - startDay.total_disputed_km2;
  const u1 = endDay.total_area_km2 - r1 - endDay.total_disputed_km2;
  return r1 - r0 - (u1 - u0);
}

function netMovementOblast(
  startDay: DailyTerritoryData,
  endDay: DailyTerritoryData,
  oblast: OblastKey,
): number {
  const sRow = startDay.oblasts.find((o) => o.oblast === oblast);
  const eRow = endDay.oblasts.find((o) => o.oblast === oblast);
  const r0 = sRow?.russian_controlled_km2 ?? 0;
  const r1 = eRow?.russian_controlled_km2 ?? 0;
  const u0 = sRow?.ukrainian_controlled_km2 ?? 0;
  const u1 = eRow?.ukrainian_controlled_km2 ?? 0;
  return r1 - r0 - (u1 - u0);
}

/**
 * Six most recent completed calendar months (e.g. with data ending May 2026 → Nov 2025 … Apr 2026),
 * each with net movement (Δ Russian − Δ Ukrainian controlled) from first to last snapshot in that month.
 * Percent uses total Ukraine area on the month's last snapshot.
 */
export function getLastSixCompletedMonthsNetMovement(
  data: DailyTerritoryData[],
  oblast?: OblastKey,
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

    let netKm2 = 0;
    let netPctOfTotalUkraine = 0;
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (inMonth.length >= 2) {
      const start = inMonth[0];
      const end = inMonth[inMonth.length - 1];
      startDate = start.date;
      endDate = end.date;
      netKm2 = oblast ? netMovementOblast(start, end, oblast) : netMovementNational(start, end);
      const totalUkraine = Math.max(end.total_area_km2, 1);
      netPctOfTotalUkraine = (netKm2 / totalUkraine) * 100;
    } else if (inMonth.length === 1) {
      startDate = inMonth[0].date;
      endDate = inMonth[0].date;
    }

    rows.push({
      year,
      month,
      monthKey: key,
      label: formatCompletedMonthLabel(year, month),
      netKm2,
      netPctOfTotalUkraine,
      snapshotCount: inMonth.length,
      startDate,
      endDate,
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
}

function netStepNational(data: DailyTerritoryData[], index: number): number {
  const d = getDerivedTotalChanges(data, index);
  return d.russianChange - d.ukrainianChange;
}

function netStepOblast(data: DailyTerritoryData[], index: number, oblast: OblastKey): number {
  const d = getDerivedOblastChanges(data, index, oblast);
  return d.russianChange - d.ukrainianChange;
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

/**
 * Bars for the territory net-movement chart: Δ Russian − Δ Ukrainian per step (national or oblast).
 * Day: last 14 snapshots. Week: last 6 ISO weeks in data. Month: six completed calendar months.
 */
export function getNetMovementChartRows(
  data: DailyTerritoryData[],
  period: OblastRussianChangePeriod,
  oblast?: OblastKey,
): NetMovementBarRow[] {
  if (data.length < 1) {
    return [];
  }

  if (period === 'day') {
    const maxBars = 14;
    const n = data.length;
    const start = Math.max(0, n - maxBars);
    const out: NetMovementBarRow[] = [];
    for (let i = start; i < n; i++) {
      const day = data[i];
      const net = oblast ? netStepOblast(data, i, oblast) : netStepNational(data, i);
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
        const netKm2 = oblast ? netMovementOblast(a, b, oblast) : netMovementNational(a, b);
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

  const months = getLastSixCompletedMonthsNetMovement(data, oblast);
  return months.map((row) => {
    const [yy, mm] = row.monthKey.split('-');
    const periodLabel = `${SHORT_MONTH[parseInt(mm, 10) - 1]}-${yy.slice(-2)}`;
    const canPlot = row.snapshotCount >= 2;
    return {
      periodLabel,
      netKm2: canPlot ? row.netKm2 : 0,
      fullNet: canPlot ? row.netKm2 : null,
      pct: canPlot ? row.netPctOfTotalUkraine : null,
      hasData: canPlot,
    };
  });
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
