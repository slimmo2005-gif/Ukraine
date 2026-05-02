import type { DailyTerritoryData, ChartDataPoint, AggregatedData, TimeRange } from '@/types';

/**
 * Calculates cumulative totals from daily data
 */
export function calculateCumulativeData(data: DailyTerritoryData[]): ChartDataPoint[] {
  let cumulativeRussian = 0;
  let cumulativeUkrainian = 0;
  
  return data.map(day => {
    cumulativeRussian += day.russian_gain_km2;
    cumulativeUkrainian += day.ukrainian_gain_km2;
    
    return {
      date: day.date,
      formattedDate: formatDate(day.date),
      russianGain: day.russian_gain_km2,
      ukrainianGain: day.ukrainian_gain_km2,
      netChange: day.russian_gain_km2 - day.ukrainian_gain_km2,
      cumulativeRussian: parseFloat(cumulativeRussian.toFixed(1)),
      cumulativeUkrainian: parseFloat(cumulativeUkrainian.toFixed(1)),
    };
  });
}

/**
 * Calculates 7-day rolling averages
 */
export function calculateRollingAverage(
  data: DailyTerritoryData[], 
  days: number = 7
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const startIdx = Math.max(0, i - days + 1);
    const window = data.slice(startIdx, i + 1);
    
    const avgRussian = window.reduce((sum, d) => sum + d.russian_gain_km2, 0) / window.length;
    const avgUkrainian = window.reduce((sum, d) => sum + d.ukrainian_gain_km2, 0) / window.length;
    
    // Calculate cumulative up to this point
    const cumulativeRussian = data.slice(0, i + 1).reduce((sum, d) => sum + d.russian_gain_km2, 0);
    const cumulativeUkrainian = data.slice(0, i + 1).reduce((sum, d) => sum + d.ukrainian_gain_km2, 0);
    
    result.push({
      date: data[i].date,
      formattedDate: formatDate(data[i].date),
      russianGain: parseFloat(avgRussian.toFixed(2)),
      ukrainianGain: parseFloat(avgUkrainian.toFixed(2)),
      netChange: parseFloat((avgRussian - avgUkrainian).toFixed(2)),
      cumulativeRussian: parseFloat(cumulativeRussian.toFixed(1)),
      cumulativeUkrainian: parseFloat(cumulativeUkrainian.toFixed(1)),
    });
  }
  
  return result;
}

/**
 * Aggregates daily data into weekly totals
 */
export function aggregateWeekly(data: DailyTerritoryData[]): AggregatedData[] {
  const weekly: Map<string, { russian: number; ukrainian: number; days: number }> = new Map();
  
  data.forEach(day => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const key = `${year}-W${week.toString().padStart(2, '0')}`;
    
    const existing = weekly.get(key) || { russian: 0, ukrainian: 0, days: 0 };
    weekly.set(key, {
      russian: existing.russian + day.russian_gain_km2,
      ukrainian: existing.ukrainian + day.ukrainian_gain_km2,
      days: existing.days + 1,
    });
  });
  
  return Array.from(weekly.entries()).map(([period, values]) => ({
    period,
    russianTotal: parseFloat(values.russian.toFixed(1)),
    ukrainianTotal: parseFloat(values.ukrainian.toFixed(1)),
    netChange: parseFloat((values.russian - values.ukrainian).toFixed(1)),
    daysCount: values.days,
  }));
}

/**
 * Aggregates daily data into monthly totals
 */
export function aggregateMonthly(data: DailyTerritoryData[]): AggregatedData[] {
  const monthly: Map<string, { russian: number; ukrainian: number; days: number }> = new Map();
  
  data.forEach(day => {
    const key = day.date.substring(0, 7); // YYYY-MM
    
    const existing = monthly.get(key) || { russian: 0, ukrainian: 0, days: 0 };
    monthly.set(key, {
      russian: existing.russian + day.russian_gain_km2,
      ukrainian: existing.ukrainian + day.ukrainian_gain_km2,
      days: existing.days + 1,
    });
  });
  
  return Array.from(monthly.entries()).map(([period, values]) => ({
    period,
    russianTotal: parseFloat(values.russian.toFixed(1)),
    ukrainianTotal: parseFloat(values.ukrainian.toFixed(1)),
    netChange: parseFloat((values.russian - values.ukrainian).toFixed(1)),
    daysCount: values.days,
  }));
}

/**
 * Gets today's metrics from the dataset
 */
export function getTodayMetrics(data: DailyTerritoryData[]) {
  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  
  if (!today || !yesterday) {
    return {
      russianGain: 0,
      ukrainianGain: 0,
      russianChange: 0,
      ukrainianChange: 0,
    };
  }
  
  return {
    russianGain: today.russian_gain_km2,
    ukrainianGain: today.ukrainian_gain_km2,
    russianChange: today.russian_gain_km2 - yesterday.russian_gain_km2,
    ukrainianChange: today.ukrainian_gain_km2 - yesterday.ukrainian_gain_km2,
  };
}

/**
 * Gets 7-day summary statistics
 */
export function get7DaySummary(data: DailyTerritoryData[]) {
  const last7Days = data.slice(-7);
  
  const russianTotal = last7Days.reduce((sum, d) => sum + d.russian_gain_km2, 0);
  const ukrainianTotal = last7Days.reduce((sum, d) => sum + d.ukrainian_gain_km2, 0);
  
  return {
    russianTotal: parseFloat(russianTotal.toFixed(1)),
    ukrainianTotal: parseFloat(ukrainianTotal.toFixed(1)),
    netChange: parseFloat((russianTotal - ukrainianTotal).toFixed(1)),
    avgDailyRussian: parseFloat((russianTotal / 7).toFixed(2)),
    avgDailyUkrainian: parseFloat((ukrainianTotal / 7).toFixed(2)),
  };
}

/**
 * Gets cumulative totals
 */
export function getCumulativeTotals(data: DailyTerritoryData[]) {
  const russianTotal = data.reduce((sum, d) => sum + d.russian_gain_km2, 0);
  const ukrainianTotal = data.reduce((sum, d) => sum + d.ukrainian_gain_km2, 0);
  
  return {
    russianTotal: parseFloat(russianTotal.toFixed(1)),
    ukrainianTotal: parseFloat(ukrainianTotal.toFixed(1)),
    netRussianGain: parseFloat((russianTotal - ukrainianTotal).toFixed(1)),
  };
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
