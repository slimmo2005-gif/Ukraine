import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Rectangle, useMap } from 'react-leaflet';
import type { DailyTerritoryData, FrontKey } from '@/types';
import { FRONT_BOUNDS, generateMockFrontlineGeoJSON, getControlColor, getFillOpacity } from '@/utils/geoData';
import { BrandedVisual } from '@/components/BrandMark';

type LatLngTuple = [number, number];

/**
 * TerritoryMap - Interactive Leaflet map with frontline visualization
 * Shows territorial control areas with date-based toggling
 */
interface TerritoryMapProps {
  data: DailyTerritoryData[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

// Map bounds for Ukraine and surrounding conflict area
const UKRAINE_BOUNDS: [LatLngTuple, LatLngTuple] = [
  [44.0, 22.0], // Southwest
  [52.5, 41.0], // Northeast
];

const UKRAINE_CENTER: LatLngTuple = [48.5, 31.0];

/**
 * MapController - Internal component to handle map state
 */
function MapController() {
  useMap();
  return null;
}

export function TerritoryMap({ data, selectedDate, onDateChange }: TerritoryMapProps) {
  const [activeFronts, setActiveFronts] = useState<FrontKey[]>(['donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv']);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Generate GeoJSON for selected date
  const geoJsonData = useMemo(() => {
    return generateMockFrontlineGeoJSON(selectedDate);
  }, [selectedDate]);

  // Date range for slider
  const dates = useMemo(() => data.map(d => d.date), [data]);
  const selectedIndex = dates.indexOf(selectedDate);

  // GeoJSON style function
  const geoJsonStyle = (feature: {
    properties: {
      region: FrontKey;
      controllingParty: 'russian' | 'ukrainian' | 'disputed';
    };
  }) => {
    const { controllingParty, region } = feature.properties;
    const isActive = activeFronts.includes(region);
    
    return {
      fillColor: getControlColor(controllingParty),
      weight: 2,
      opacity: isActive ? 1 : 0.3,
      color: getControlColor(controllingParty),
      fillOpacity: isActive ? getFillOpacity(controllingParty) : 0.05,
      dashArray: controllingParty === 'disputed' ? '5,5' : undefined,
    };
  };

  // Handle GeoJSON click
  const onGeoJsonClick = (feature: { properties: { region: FrontKey } }) => {
    const region = feature.properties.region;
    setActiveFronts(prev => 
      prev.includes(region) 
        ? prev.filter(f => f !== region)
        : [...prev, region]
    );
  };

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="bg-osint-card p-4 rounded-lg border border-osint-border">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-300">
            Date: {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                showHeatmap 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Heatmap
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={Math.max(0, selectedIndex)}
          onChange={(e) => onDateChange(dates[parseInt(e.target.value)])}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-ukraine-blue"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{new Date(dates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{new Date(dates[dates.length - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Front toggles */}
      <div className="flex flex-wrap gap-2">
        {(['donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv', 'kherson', 'sumy'] as FrontKey[]).map(front => (
          <button
            key={front}
            onClick={() => setActiveFronts(prev => 
              prev.includes(front) 
                ? prev.filter(f => f !== front)
                : [...prev, front]
            )}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeFronts.includes(front)
                ? 'bg-ukraine-blue text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
            }`}
          >
            {front.charAt(0).toUpperCase() + front.slice(1)}
          </button>
        ))}
      </div>

      {/* Map */}
      <BrandedVisual className="h-[500px] rounded-lg overflow-hidden border border-osint-border" watermarkSize="lg">
        <MapContainer
          center={UKRAINE_CENTER}
          zoom={6}
          bounds={UKRAINE_BOUNDS}
          minZoom={5}
          maxZoom={10}
          className="h-full w-full"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController />
          
          {/* Frontline GeoJSON layers */}
          <GeoJSON
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data={geoJsonData as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style={geoJsonStyle as any}
            eventHandlers={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              click: (e: any) => {
                if (e.layer?.feature?.properties?.region) {
                  onGeoJsonClick(e.layer.feature);
                }
              },
            }}
          />
          
          {/* Heatmap overlay (simplified rectangles for active fronts) */}
          {showHeatmap && activeFronts.map(front => {
            const bounds = FRONT_BOUNDS[front];
            return (
              <Rectangle
                key={front}
                bounds={bounds}
                pathOptions={{
                  fillColor: '#f59e0b',
                  fillOpacity: 0.1,
                  color: '#f59e0b',
                  weight: 1,
                  dashArray: '3,3',
                }}
              />
            );
          })}
        </MapContainer>
      </BrandedVisual>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-gray-400">Russian Control</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
          <span className="text-gray-400">Ukrainian Control</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
          <span className="text-gray-400">Disputed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-gray-500 border-dashed"></span>
          <span className="text-gray-400">Click regions to toggle</span>
        </div>
      </div>
    </div>
  );
}
