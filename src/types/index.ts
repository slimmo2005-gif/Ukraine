/**
 * Core data types for the Ukraine War Territory Tracker
 * All measurements are in square kilometers (km²)
 */

// Ukrainian Oblasts (Provinces)
export type OblastKey = 
  | 'donetsk' 
  | 'luhansk' 
  | 'zaporizhzhia' 
  | 'kharkiv' 
  | 'kherson' 
  | 'sumy'
  | 'crimea'
  | 'dnipropetrovsk'
  | 'mykolaiv'
  | 'odesa'
  | 'kyiv'
  | 'zhytomyr'
  | 'cherkasy'
  | 'poltava'
  | 'dnipropetrovsk'
  | 'vinnytsia'
  | 'khmelnytskyi'
  | 'ivano-frankivsk'
  | 'lviv'
  | 'rivne'
  | 'ternopil'
  | 'zakarpattia'
  | 'volyn'
  | 'chernivtsi'
  | 'kirovohrad'
  | 'chernihiv';

// Territory control status
export type ControlStatus = 'russian' | 'ukrainian' | 'disputed';

// Data sources for tracking
export type DataSource = 'deepstate' | 'isw' | 'combined';

// Territory control for a single oblast
export interface OblastControl {
  oblast: OblastKey;
  russian_controlled_km2: number;
  ukrainian_controlled_km2: number;
  disputed_controlled_km2: number;
  total_area_km2: number;
  // Change from previous day
  russian_change_km2?: number;
  ukrainian_change_km2?: number;
  disputed_change_km2?: number;
}

/** Weekly snapshot provenance (see data/history/weekly/*.json). */
export type TerritorySnapshotSource = 'wayback' | 'daily_nearest' | 'weekly_nearest';

// Daily data structure - per data source
export interface DailyTerritoryData {
  date: string; // ISO 8601 format: YYYY-MM-DD
  source: DataSource;
  /** Present on weekly/yearly history files from the extractor. */
  granularity?: 'daily' | 'weekly' | 'yearly';
  snapshot_source?: TerritorySnapshotSource;
  wayback_timestamp?: string;
  wayback_capture_date?: string;
  /** Daily file date when snapshot_source is daily_nearest. */
  derived_from_daily?: string;
  /** Other weekly anchor date when snapshot_source is weekly_nearest. */
  derived_from_weekly?: string;
  // Total Ukraine numbers
  total_russian_controlled_km2: number;
  total_ukrainian_controlled_km2: number;
  total_disputed_km2: number;
  total_area_km2: number;
  // Per-oblast breakdown
  oblasts: OblastControl[];
  // Daily changes (calculated from previous day)
  russian_change_km2: number;
  ukrainian_change_km2: number;
  disputed_change_km2: number;
  // Metadata
  notes?: string;
  last_updated: string; // ISO timestamp
}

// View level for UI
export type ViewLevel = 'total' | 'oblast';

// Time range for charts
export type TimeRange = 'daily' | 'weekly' | 'yearly';

// Metric display props - updated for 3-way control display
export interface MetricCardProps {
  title: string;
  russianValue: number;
  ukrainianValue: number;
  disputedValue?: number;
  unit: string;
  russianChange?: number;
  ukrainianChange?: number;
  disputedChange?: number;
  showNetChange?: boolean;
}

// Chart data point - showing control levels
export interface ChartDataPoint {
  date: string;
  formattedDate: string;
  // Control amounts
  russianControlled: number;
  ukrainianControlled: number;
  disputed: number;
  // Daily changes
  russianChange: number;
  ukrainianChange: number;
  disputedChange: number;
  /** Provenance line for weekly repo snapshots (tooltips). */
  snapshotMeta?: string;
}

// Aggregated data for weekly/monthly views
export interface AggregatedData {
  period: string;
  russianAvg: number;
  ukrainianAvg: number;
  disputedAvg: number;
  russianChangeSum: number;
  ukrainianChangeSum: number;
  disputedChangeSum: number;
  daysCount: number;
}

// Data source info for display
export interface DataSourceInfo {
  id: DataSource;
  name: string;
  description: string;
  color: string;
}

// Oblast info for display
export interface OblastInfo {
  key: OblastKey;
  name: string;
  center: [number, number]; // lat, lng
  totalAreaKm2: number;
}

// Legacy types (kept for backward compatibility)
export interface FrontData {
  donetsk: number;
  kharkiv: number;
  zaporizhzhia: number;
  luhansk: number;
  kherson: number;
  sumy: number;
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
      oblast: OblastKey;
      controllingParty: ControlStatus;
      areaKm2?: number;
    };
  }>;
}

export interface MapLayerConfig {
  date: string;
  visible: boolean;
  opacity: number;
}
