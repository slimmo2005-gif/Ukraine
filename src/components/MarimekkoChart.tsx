import { useMemo } from 'react';
import type { OblastControl, OblastKey } from '@/types';
import { OBLAST_NAMES } from '@/data/mockData';

/**
 * MarimekkoChart - Shows oblast territory control as a mosaic visualization
 * Each rectangle represents an oblast, sized by total area, colored by control status
 */
interface MarimekkoChartProps {
  oblasts: OblastControl[];
}

export function MarimekkoChart({ oblasts }: MarimekkoChartProps) {
  const processedData = useMemo(() => {
    // Sort oblasts by total Russian + Disputed control (most contested first)
    const sorted = [...oblasts]
      .filter(o => o.total_area_km2 > 0)
      .sort((a, b) => {
        const aContested = a.russian_controlled_km2 + a.disputed_km2;
        const bContested = b.russian_controlled_km2 + b.disputed_km2;
        return bContested - aContested;
      });

    const totalArea = sorted.reduce((sum, o) => sum + o.total_area_km2, 0);

    return sorted.map(o => {
      const russianPct = (o.russian_controlled_km2 / o.total_area_km2) * 100;
      const ukrainianPct = (o.ukrainian_controlled_km2 / o.total_area_km2) * 100;
      const disputedPct = (o.disputed_km2 / o.total_area_km2) * 100;
      const uncontestedPct = 100 - russianPct - ukrainianPct - disputedPct;

      const oblastKey = o.oblast as OblastKey;
      return {
        key: o.oblast,
        name: OBLAST_NAMES[oblastKey] || o.oblast,
        totalArea: o.total_area_km2,
        russian: o.russian_controlled_km2,
        ukrainian: o.ukrainian_controlled_km2,
        disputed: o.disputed_km2,
        uncontested: Math.max(0, uncontestedPct / 100 * o.total_area_km2),
        russianPct,
        ukrainianPct,
        disputedPct,
        uncontestedPct: Math.max(0, uncontestedPct),
        widthPct: (o.total_area_km2 / totalArea) * 100,
      };
    });
  }, [oblasts]);

  const formatNumber = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <h3 className="text-lg font-semibold text-white mb-4">
        Territory Control by Oblast (Marimekko View)
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Width = Total Area | Height segments = Control Status
      </p>

      {/* Chart Container */}
      <div className="flex flex-col gap-1">
        {processedData.map((oblast) => (
          <div key={oblast.key} className="flex items-center gap-2">
            {/* Oblast Name */}
            <div className="w-32 text-xs text-gray-400 truncate" title={oblast.name}>
              {oblast.name.replace(' Oblast', '').replace(' Republic of ', '')}
            </div>

            {/* Bar */}
            <div className="flex-1 h-8 flex rounded overflow-hidden" style={{ minWidth: '200px' }}>
              {/* Ukrainian Controlled */}
              {oblast.ukrainianPct > 1 && (
                <div
                  className="h-full bg-blue-500/80 flex items-center justify-center"
                  style={{ width: `${oblast.ukrainianPct}%` }}
                  title={`Ukrainian: ${oblast.ukrainianPct.toFixed(1)}% (${formatNumber(oblast.ukrainian)} km²)`}
                >
                  {oblast.ukrainianPct > 8 && (
                    <span className="text-xs text-white font-medium">{oblast.ukrainianPct.toFixed(0)}%</span>
                  )}
                </div>
              )}

              {/* Russian Controlled */}
              {oblast.russianPct > 1 && (
                <div
                  className="h-full bg-red-500/80 flex items-center justify-center"
                  style={{ width: `${oblast.russianPct}%` }}
                  title={`Russian: ${oblast.russianPct.toFixed(1)}% (${formatNumber(oblast.russian)} km²)`}
                >
                  {oblast.russianPct > 8 && (
                    <span className="text-xs text-white font-medium">{oblast.russianPct.toFixed(0)}%</span>
                  )}
                </div>
              )}

              {/* Disputed */}
              {oblast.disputedPct > 1 && (
                <div
                  className="h-full bg-amber-500/80 flex items-center justify-center"
                  style={{ width: `${oblast.disputedPct}%` }}
                  title={`Disputed: ${oblast.disputedPct.toFixed(1)}% (${formatNumber(oblast.disputed)} km²)`}
                >
                  {oblast.disputedPct > 8 && (
                    <span className="text-xs text-white font-medium">{oblast.disputedPct.toFixed(0)}%</span>
                  )}
                </div>
              )}

              {/* Uncontested */}
              {oblast.uncontestedPct > 1 && (
                <div
                  className="h-full bg-gray-600/50 flex items-center justify-center"
                  style={{ width: `${oblast.uncontestedPct}%` }}
                  title={`Uncontested: ${oblast.uncontestedPct.toFixed(1)}% (${formatNumber(oblast.uncontested)} km²)`}
                >
                  {oblast.uncontestedPct > 15 && (
                    <span className="text-xs text-gray-300 font-medium">{oblast.uncontestedPct.toFixed(0)}%</span>
                  )}
                </div>
              )}
            </div>

            {/* Total Area */}
            <div className="w-20 text-right text-xs text-gray-500">
              {formatNumber(oblast.totalArea)} km²
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-osint-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500/80 rounded"></div>
          <span className="text-xs text-gray-400">Ukrainian Controlled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500/80 rounded"></div>
          <span className="text-xs text-gray-400">Russian Controlled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500/80 rounded"></div>
          <span className="text-xs text-gray-400">Disputed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-600/50 rounded"></div>
          <span className="text-xs text-gray-400">Uncontested</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Alternative Grid View - Shows oblasts as tiles sized by area
 */
export function OblastGridView({ oblasts }: MarimekkoChartProps) {
  const processedData = useMemo(() => {
    return oblasts
      .filter(o => o.total_area_km2 > 0)
      .sort((a, b) => b.total_area_km2 - a.total_area_km2)
      .map(o => {
        const russianPct = (o.russian_controlled_km2 / o.total_area_km2) * 100;
        const ukrainianPct = (o.ukrainian_controlled_km2 / o.total_area_km2) * 100;
        const disputedPct = (o.disputed_km2 / o.total_area_km2) * 100;
        const oblastKey = o.oblast as OblastKey;

        return {
          key: o.oblast,
          name: OBLAST_NAMES[oblastKey] || o.oblast,
          totalArea: o.total_area_km2,
          russianPct,
          ukrainianPct,
          disputedPct,
          primaryController: russianPct > ukrainianPct ? 'russian' : 'ukrainian',
          contested: russianPct > 5 && ukrainianPct > 5,
        };
      });
  }, [oblasts]);

  const formatNumber = (n: number) => Math.round(n).toLocaleString();

  return (
    <div className="bg-osint-card rounded-lg p-6 border border-osint-border">
      <h3 className="text-lg font-semibold text-white mb-4">
        Oblast Overview
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {processedData.map((oblast) => (
          <div
            key={oblast.key}
            className={`p-3 rounded-lg border ${
              oblast.contested
                ? 'bg-amber-500/10 border-amber-500/30'
                : oblast.primaryController === 'russian'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}
          >
            <div className="text-xs text-gray-400 truncate" title={oblast.name}>
              {oblast.name.replace(' Oblast', '')}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {formatNumber(oblast.totalArea)} km²
            </div>
            <div className="mt-1 text-xs">
              {oblast.russianPct > 5 && (
                <span className="text-red-400">{oblast.russianPct.toFixed(0)}% RU</span>
              )}
              {oblast.russianPct > 5 && oblast.ukrainianPct > 5 && (
                <span className="text-gray-500 mx-1">|</span>
              )}
              {oblast.ukrainianPct > 5 && (
                <span className="text-blue-400">{oblast.ukrainianPct.toFixed(0)}% UA</span>
              )}
              {oblast.disputedPct > 2 && (
                <div className="text-amber-400">{oblast.disputedPct.toFixed(0)}% Disputed</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MarimekkoChart;
