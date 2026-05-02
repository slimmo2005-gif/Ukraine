/**
 * Core data types for the Ukraine War Territory Tracker
 * All measurements are in square kilometers (km²)
 */

export interface FrontData {
  donetsk: number;
  kharkiv: number;
  zaporizhzhia: number;
  luhansk: number;
  kherson: number;
  sumy: number;
}

export interface DailyTerritoryData {
  date: string; // ISO 8601 format: YYYY-MM-DD
  russian_gain_km2: number;
  ukrainian_gain_km2: number;
  fronts: Partial<FrontData>;
  notes?: string;
}

export type TimeRange = 'daily' | 'weekly' | 'monthly';

export interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  change?: number;
  changeLabel?: string;
  trend: 'up' | 'down' | 'neutral';
  color: 'blue' | 'yellow' | 'red' | 'neutral';
}

export interface ChartDataPoint {
  date: string;
  formattedDate: string;
  russianGain: number;
  ukrainianGain: number;
  netChange: number;
  cumulativeRussian: number;
  cumulativeUkrainian: number;
}

export interface AggregatedData {
  period: string;
  russianTotal: number;
  ukrainianTotal: number;
  netChange: number;
  daysCount: number;
}

export type FrontKey = keyof FrontData;

export interface FrontlineGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon' | 'MultiPolygon';
      coordinates: number[][][];
    };
    properties: {
      date: string;
      region: FrontKey;
      controllingParty: 'russian' | 'ukrainian' | 'disputed';
      areaKm2?: number;
    };
  }>;
}

export interface MapLayerConfig {
  date: string;
  visible: boolean;
  opacity: number;
}
