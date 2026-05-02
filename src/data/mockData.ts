import type { DailyTerritoryData, FrontData } from '@/types';

/**
 * Generates 90 days of realistic mock territorial change data
 * Simulates the ebb and flow of frontline movements
 */
export function generateMockData(): DailyTerritoryData[] {
  const data: DailyTerritoryData[] = [];
  const today = new Date();
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate realistic territorial changes
    // Most days have minimal changes, occasional spikes during active operations
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Weekend reporting often shows accumulated changes
    const activityMultiplier = isWeekend ? 1.5 : 1;
    
    // Random events simulation (major offensives, etc.)
    const isMajorEvent = Math.random() < 0.05; // 5% chance of significant activity
    const eventMultiplier = isMajorEvent ? 3 : 1;
    
    // Russian gains typically higher in recent period
    const russianBaseGain = Math.random() * 2 * activityMultiplier * eventMultiplier;
    const ukrainianBaseGain = Math.random() * 1.2 * activityMultiplier * eventMultiplier;
    
    // Add some realistic variance - sometimes Ukraine gains more
    const russianGain = parseFloat((russianBaseGain + (Math.random() * 0.5)).toFixed(1));
    const ukrainianGain = parseFloat((ukrainianBaseGain + (Math.random() * 0.3)).toFixed(1));
    
    // Distribute gains across fronts
    const fronts: Partial<FrontData> = {};
    
    // Donetsk and Luhansk typically see most Russian activity
    fronts.donetsk = parseFloat((russianGain * 0.35 * (0.8 + Math.random() * 0.4)).toFixed(1));
    fronts.luhansk = parseFloat((russianGain * 0.25 * (0.8 + Math.random() * 0.4)).toFixed(1));
    fronts.zaporizhzhia = parseFloat((russianGain * 0.20 * (0.8 + Math.random() * 0.4)).toFixed(1));
    fronts.kharkiv = parseFloat((russianGain * 0.15 * (0.8 + Math.random() * 0.4)).toFixed(1));
    fronts.kherson = parseFloat((russianGain * 0.03 * (0.8 + Math.random() * 0.4)).toFixed(1));
    fronts.sumy = parseFloat((russianGain * 0.02 * (0.8 + Math.random() * 0.4)).toFixed(1));
    
    data.push({
      date: dateStr,
      russian_gain_km2: russianGain,
      ukrainian_gain_km2: ukrainianGain,
      fronts,
      notes: isMajorEvent ? 'Significant frontline activity reported' : undefined
    });
  }
  
  return data;
}

/**
 * Pre-generated static dataset for immediate use
 */
export const mockTerritoryData: DailyTerritoryData[] = generateMockData();
