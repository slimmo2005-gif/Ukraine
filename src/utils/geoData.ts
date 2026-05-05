import type { FrontKey, FrontlineGeoJSON } from '@/types';

type LatLngTuple = [number, number];

/**
 * Approximate center coordinates for major front regions
 * Used for map positioning and frontline visualization
 */
export const FRONT_CENTERS: Record<FrontKey, LatLngTuple> = {
  donetsk: [48.0159, 37.8028],
  luhansk: [48.5740, 39.3078],
  zaporizhzhia: [47.8388, 35.1396],
  kharkiv: [49.9935, 36.2304],
  kherson: [46.6354, 32.6169],
  sumy: [50.9077, 34.7981],
};

/**
 * Simplified bounding boxes for front regions
 * Format: [southWest, northEast]
 */
export const FRONT_BOUNDS: Record<FrontKey, [LatLngTuple, LatLngTuple]> = {
  donetsk: [[47.2, 36.5], [48.8, 38.5]],
  luhansk: [[48.0, 38.0], [49.4, 40.2]],
  zaporizhzhia: [[46.5, 34.0], [48.3, 36.5]],
  kharkiv: [[49.0, 35.0], [50.5, 37.5]],
  kherson: [[46.0, 31.5], [47.5, 34.0]],
  sumy: [[50.0, 33.5], [51.8, 35.5]],
};

/**
 * Creates a simplified polygon for a front region
 * This is a placeholder for actual GeoJSON frontline data
 */
export function createFrontPolygon(front: FrontKey): number[][][] {
  const bounds = FRONT_BOUNDS[front];
  const [sw, ne] = bounds;
  
  // Create a simple rectangle for the region
  // In production, this would be replaced with actual frontline GeoJSON
  return [[
    [sw[0], sw[1]],
    [sw[0], ne[1]],
    [ne[0], ne[1]],
    [ne[0], sw[1]],
    [sw[0], sw[1]],
  ]];
}

/**
 * Generates mock GeoJSON for frontline visualization
 * This simulates territory control areas
 */
export function generateMockFrontlineGeoJSON(date: string): FrontlineGeoJSON {
  const fronts: FrontKey[] = ['donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv', 'kherson', 'sumy'];
  
  const features = fronts.map(front => {
    // Simulate changing control over time
    const dateSeed = new Date(date).getTime();
    const frontSeed = front.length;
    const randomFactor = (Math.sin(dateSeed + frontSeed) + 1) / 2; // 0-1
    
    let controllingParty: 'russian' | 'ukrainian' | 'disputed';
    if (randomFactor > 0.7) {
      controllingParty = 'russian';
    } else if (randomFactor < 0.3) {
      controllingParty = 'ukrainian';
    } else {
      controllingParty = 'disputed';
    }
    
    // Adjust for known patterns (simplified)
    if (['donetsk', 'luhansk'].includes(front)) {
      controllingParty = Math.random() > 0.3 ? 'russian' : 'disputed';
    }
    
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: createFrontPolygon(front),
      },
      properties: {
        date,
        oblast: front,
        controllingParty,
        areaKm2: Math.floor(Math.random() * 500 + 100),
      },
    };
  });
  
  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Get color for territory control status
 */
export function getControlColor(party: 'russian' | 'ukrainian' | 'disputed'): string {
  switch (party) {
    case 'russian':
      return '#ef4444'; // red-500
    case 'ukrainian':
      return '#3b82f6'; // blue-500
    case 'disputed':
      return '#f59e0b'; // amber-500
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Get fill opacity for map layers
 */
export function getFillOpacity(party: 'russian' | 'ukrainian' | 'disputed'): number {
  return party === 'disputed' ? 0.3 : 0.2;
}
