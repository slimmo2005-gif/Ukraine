import type { DailyTerritoryData, ChartDataPoint, AggregatedData, TimeRange, OblastKey, ViewLevel } from '@/types';

/**
 * Calculates chart data showing control levels and changes over time
 * Used for displaying Russian/Ukrainian/Disputed territory control
 */
export function calculateControlData(data: DailyTerritoryData[]): ChartDataPoint[] {
  return data.map(day => ({
    date: day.date,
    formattedDate: formatDate(day.date),
    // Control amounts - Ukrainian includes uncontested (total - russian - disputed)
    russianControlled: day.total_russian_controlled_km2,
    ukrainianControlled: day.total_area_km2 - day.total_russian_controlled_km2 - day.total_disputed_km2,
    disputed: day.total_disputed_km2,
    // Daily changes
    russianChange: day.russian_change_km2,
    ukrainianChange: day.ukrainian_change_km2,
    disputedChange: day.disputed_change_km2,
  }));
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
    
    const avgRussianChange = window.reduce((sum, d) => sum + d.russian_change_km2, 0) / window.length;
    const avgUkrainianChange = window.reduce((sum, d) => sum + d.ukrainian_change_km2, 0) / window.length;
    const avgDisputedChange = window.reduce((sum, d) => sum + d.disputed_change_km2, 0) / window.length;
    
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
  
  data.forEach(day => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;
    
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
      russianChangeSum: existing.russianChangeSum + day.russian_change_km2,
      ukrainianChangeSum: existing.ukrainianChangeSum + day.ukrainian_change_km2,
      disputedChangeSum: existing.disputedChangeSum + day.disputed_change_km2,
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
  
  data.forEach(day => {
    const key = day.date.substring(0, 7); // YYYY-MM
    
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
      russianChangeSum: existing.russianChangeSum + day.russian_change_km2,
      ukrainianChangeSum: existing.ukrainianChangeSum + day.ukrainian_change_km2,
      disputedChangeSum: existing.disputedChangeSum + day.disputed_change_km2,
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
  const yesterday = data[data.length - 2];
  
  if (!today || !yesterday) {
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
  
  return {
    russianControlled: today.total_russian_controlled_km2,
    ukrainianControlled: ukrainianControlled,
    disputed: today.total_disputed_km2,
    russianChange: today.russian_change_km2,
    ukrainianChange: today.ukrainian_change_km2,
    disputedChange: today.disputed_change_km2,
  };
}

/**
 * Gets 7-day summary statistics
 */
export function get7DaySummary(data: DailyTerritoryData[]) {
  const last7Days = data.slice(-7);
  
  const russianChangeSum = last7Days.reduce((sum, d) => sum + d.russian_change_km2, 0);
  const ukrainianChangeSum = last7Days.reduce((sum, d) => sum + d.ukrainian_change_km2, 0);
  const disputedChangeSum = last7Days.reduce((sum, d) => sum + d.disputed_change_km2, 0);
  
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

/**
 * Get data for a specific oblast over time
 */
export function getOblastData(data: DailyTerritoryData[], oblast: OblastKey) {
  return data.map(day => {
    const oblastData = day.oblasts.find(o => o.oblast === oblast);
    return {
      date: day.date,
      formattedDate: formatDate(day.date),
      russianControlled: oblastData?.russian_controlled_km2 || 0,
      ukrainianControlled: oblastData?.ukrainian_controlled_km2 || 0,
      disputed: oblastData?.disputed_km2 || 0,
      totalArea: oblastData?.total_area_km2 || 0,
      russianChange: oblastData?.russian_change_km2 || 0,
      ukrainianChange: oblastData?.ukrainian_change_km2 || 0,
      disputedChange: oblastData?.disputed_change_km2 || 0,
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
  const date = new Date(dateStr);
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
