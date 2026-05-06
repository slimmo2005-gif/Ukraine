import type { DailyTerritoryData, OblastControl, OblastKey, DataSource } from '@/types';

// Total area of Ukraine by oblast (approximate km²)
const OBLAST_AREAS: Record<OblastKey, number> = {
  crimea: 27000,
  donetsk: 26500,
  luhansk: 26700,
  zaporizhzhia: 27200,
  kharkiv: 31400,
  dnipropetrovsk: 31900,
  mykolaiv: 24600,
  odesa: 33300,
  kherson: 28500,
  sumy: 23800,
  kyiv: 28100,
  zhytomyr: 29800,
  cherkasy: 20900,
  poltava: 28800,
  vinnytsia: 26500,
  khmelnytskyi: 20600,
  'ivano-frankivsk': 13900,
  lviv: 21800,
  rivne: 20100,
  ternopil: 13800,
  zakarpattia: 12800,
  volyn: 20100,
  chernivtsi: 8100,
  kirovohrad: 24600,
  chernihiv: 31800,
};

// Key oblasts with current conflict activity (simplified for mock data)
const ACTIVE_OBLASTS: OblastKey[] = [
  'donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv', 'kherson', 'sumy'
];

// Initial control baselines (approximate starting control for mock data)
// These represent a snapshot in time and will evolve
const INITIAL_CONTROL: Record<OblastKey, { russian: number; ukrainian: number; disputed: number }> = {
  donetsk: { russian: 18000, ukrainian: 7500, disputed: 1000 },
  luhansk: { russian: 24000, ukrainian: 2000, disputed: 700 },
  zaporizhzhia: { russian: 12000, ukrainian: 14000, disputed: 1200 },
  kharkiv: { russian: 800, ukrainian: 29500, disputed: 1100 },
  kherson: { russian: 15000, ukrainian: 12000, disputed: 1500 },
  sumy: { russian: 200, ukrainian: 22800, disputed: 800 },
  crimea: { russian: 27000, ukrainian: 0, disputed: 0 },
  dnipropetrovsk: { russian: 0, ukrainian: 31900, disputed: 0 },
  mykolaiv: { russian: 2000, ukrainian: 22000, disputed: 600 },
  odesa: { russian: 0, ukrainian: 33300, disputed: 0 },
  kyiv: { russian: 0, ukrainian: 28100, disputed: 0 },
  zhytomyr: { russian: 0, ukrainian: 29800, disputed: 0 },
  cherkasy: { russian: 0, ukrainian: 20900, disputed: 0 },
  poltava: { russian: 0, ukrainian: 28800, disputed: 0 },
  vinnytsia: { russian: 0, ukrainian: 26500, disputed: 0 },
  khmelnytskyi: { russian: 0, ukrainian: 20600, disputed: 0 },
  'ivano-frankivsk': { russian: 0, ukrainian: 13900, disputed: 0 },
  lviv: { russian: 0, ukrainian: 21800, disputed: 0 },
  rivne: { russian: 0, ukrainian: 20100, disputed: 0 },
  ternopil: { russian: 0, ukrainian: 13800, disputed: 0 },
  zakarpattia: { russian: 0, ukrainian: 12800, disputed: 0 },
  volyn: { russian: 0, ukrainian: 20100, disputed: 0 },
  chernivtsi: { russian: 0, ukrainian: 8100, disputed: 0 },
  kirovohrad: { russian: 0, ukrainian: 24600, disputed: 0 },
  chernihiv: { russian: 0, ukrainian: 31800, disputed: 0 },
};

/**
 * Generates 90 days of realistic mock territorial control data
 * Tracks Russian/Ukrainian/Disputed control per oblast over time
 */
export function generateMockControlData(source: DataSource = 'deepstate'): DailyTerritoryData[] {
  const data: DailyTerritoryData[] = [];
  const today = new Date();
  
  // Track current control state that evolves day by day
  let currentControl = JSON.parse(JSON.stringify(INITIAL_CONTROL)) as typeof INITIAL_CONTROL;
  
  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Generate daily changes for active oblasts
    const oblasts: OblastControl[] = [];
    let totalRussianChange = 0;
    let totalUkrainianChange = 0;
    let totalDisputedChange = 0;
    
    for (const oblastKey of Object.keys(OBLAST_AREAS) as OblastKey[]) {
      const totalArea = OBLAST_AREAS[oblastKey];
      const isActive = ACTIVE_OBLASTS.includes(oblastKey);
      
      // Get previous day's control
      const prevControl = currentControl[oblastKey];
      
      // Calculate daily changes (only in active oblasts)
      let russianChange = 0;
      let ukrainianChange = 0;
      let disputedChange = 0;
      
      if (isActive) {
        // Random daily fluctuations - Russian usually gaining small amounts
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const activityMultiplier = isWeekend ? 1.3 : 1;
        
        // Russian typically makes small gains in contested areas
        russianChange = (Math.random() * 3 - 0.5) * activityMultiplier;
        ukrainianChange = (Math.random() * 1.5 - 0.3) * activityMultiplier;
        disputedChange = (Math.random() * 0.5 - 0.25) * activityMultiplier;
        
        // Occasional major events
        if (Math.random() < 0.03) {
          russianChange *= 3;
          ukrainianChange *= 2;
        }
      }
      
      // Update current control
      let newRussian = Math.max(0, Math.min(totalArea, prevControl.russian + russianChange));
      let newUkrainian = Math.max(0, Math.min(totalArea, prevControl.ukrainian + ukrainianChange));
      let newDisputed = Math.max(0, Math.min(totalArea - newRussian - newUkrainian, prevControl.disputed + disputedChange));
      
      // Ensure totals don't exceed oblast area
      const total = newRussian + newUkrainian + newDisputed;
      if (total > totalArea) {
        const factor = totalArea / total;
        newRussian *= factor;
        newUkrainian *= factor;
        newDisputed *= factor;
      }
      
      // Recalculate actual changes
      const actualRussianChange = newRussian - prevControl.russian;
      const actualUkrainianChange = newUkrainian - prevControl.ukrainian;
      const actualDisputedChange = newDisputed - prevControl.disputed;
      
      // Update tracking
      currentControl[oblastKey] = {
        russian: newRussian,
        ukrainian: newUkrainian,
        disputed: newDisputed,
      };
      
      totalRussianChange += actualRussianChange;
      totalUkrainianChange += actualUkrainianChange;
      totalDisputedChange += actualDisputedChange;
      
      oblasts.push({
        oblast: oblastKey,
        russian_controlled_km2: parseFloat(newRussian.toFixed(1)),
        ukrainian_controlled_km2: parseFloat(newUkrainian.toFixed(1)),
        disputed_controlled_km2: parseFloat(newDisputed.toFixed(1)),
        total_area_km2: totalArea,
        russian_change_km2: parseFloat(actualRussianChange.toFixed(1)),
        ukrainian_change_km2: parseFloat(actualUkrainianChange.toFixed(1)),
        disputed_change_km2: parseFloat(actualDisputedChange.toFixed(1)),
      });
    }
    
    // Calculate totals
    const totalRussian = oblasts.reduce((sum, o) => sum + o.russian_controlled_km2, 0);
    const totalUkrainian = oblasts.reduce((sum, o) => sum + o.ukrainian_controlled_km2, 0);
    const totalDisputed = oblasts.reduce((sum, o) => sum + o.disputed_controlled_km2, 0);
    const totalArea = Object.values(OBLAST_AREAS).reduce((sum, a) => sum + a, 0);
    
    const hasSignificantActivity = Math.abs(totalRussianChange) > 5 || Math.abs(totalUkrainianChange) > 3;
    
    data.push({
      date: dateStr,
      source,
      total_russian_controlled_km2: parseFloat(totalRussian.toFixed(1)),
      total_ukrainian_controlled_km2: parseFloat(totalUkrainian.toFixed(1)),
      total_disputed_km2: parseFloat(totalDisputed.toFixed(1)),
      total_area_km2: totalArea,
      oblasts,
      russian_change_km2: parseFloat(totalRussianChange.toFixed(1)),
      ukrainian_change_km2: parseFloat(totalUkrainianChange.toFixed(1)),
      disputed_change_km2: parseFloat(totalDisputedChange.toFixed(1)),
      notes: hasSignificantActivity ? 'Significant frontline activity reported' : undefined,
      last_updated: new Date().toISOString(),
    });
  }
  
  return data;
}

/**
 * Generate data for multiple sources (for testing combined view)
 */
export function generateMultiSourceData(): Record<DataSource, DailyTerritoryData[]> {
  return {
    deepstate: generateMockControlData('deepstate'),
    isw: generateMockControlData('isw'),
    combined: generateMockControlData('combined'),
  };
}

/**
 * Pre-generated static dataset for immediate use
 */
export const mockTerritoryData: DailyTerritoryData[] = generateMockControlData('deepstate');

/**
 * All available mock data sources
 */
export const allMockData = generateMultiSourceData();

/**
 * Oblast display names
 */
export const OBLAST_NAMES: Record<OblastKey, string> = {
  donetsk: 'Donetsk',
  luhansk: 'Luhansk',
  zaporizhzhia: 'Zaporizhzhia',
  kharkiv: 'Kharkiv',
  kherson: 'Kherson',
  sumy: 'Sumy',
  crimea: 'Crimea',
  dnipropetrovsk: 'Dnipropetrovsk',
  mykolaiv: 'Mykolaiv',
  odesa: 'Odesa',
  kyiv: 'Kyiv',
  zhytomyr: 'Zhytomyr',
  cherkasy: 'Cherkasy',
  poltava: 'Poltava',
  vinnytsia: 'Vinnytsia',
  khmelnytskyi: 'Khmelnytskyi',
  'ivano-frankivsk': 'Ivano-Frankivsk',
  lviv: 'Lviv',
  rivne: 'Rivne',
  ternopil: 'Ternopil',
  zakarpattia: 'Zakarpattia',
  volyn: 'Volyn',
  chernivtsi: 'Chernivtsi',
  kirovohrad: 'Kirovohrad',
  chernihiv: 'Chernihiv',
};
