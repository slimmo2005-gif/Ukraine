import type { MetricCardProps } from '@/types';

/**
 * MetricCard - Displays territory control metrics for Russian/Ukrainian/Disputed
 * Shows current control amounts and daily changes
 */
export function MetricCard({
  title,
  russianValue,
  ukrainianValue,
  disputedValue = 0,
  unit,
  russianChange = 0,
  ukrainianChange = 0,
  disputedChange = 0,
  showNetChange = true,
}: MetricCardProps) {
  const formatValue = (v: number): string => {
    if (v === 0) return '0';
    const absV = Math.abs(v);
    // For large numbers (>= 1000), use commas and no decimals
    if (absV >= 1000) {
      return Math.round(absV).toLocaleString();
    }
    // For medium numbers (>= 100), use commas and 1 decimal
    if (absV >= 100) {
      return absV.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }
    // For small numbers, show appropriate decimals
    if (absV < 0.1) return absV.toFixed(2);
    if (absV < 1) return absV.toFixed(1);
    return absV.toFixed(1);
  };

  const formatChange = (v: number): string => {
    if (v === 0) return '0';
    const sign = v > 0 ? '+' : '';
    return `${sign}${formatValue(v)}`;
  };

  const netChange = russianChange - ukrainianChange;

  return (
    <div className="bg-osint-card rounded-lg border border-osint-border p-5 shadow-lg">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        {title}
      </h3>
      
      {/* Russian Control */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-red-400 font-medium">Russian Controlled</span>
          <div className="text-right">
            <span className="text-xl font-bold text-white">
              {formatValue(russianValue)}
            </span>
            <span className="text-xs text-gray-500 ml-1">{unit}</span>
          </div>
        </div>
        {russianChange !== 0 && (
          <div className="text-xs text-red-400 mt-1">
            {formatChange(russianChange)} {unit} today
          </div>
        )}
      </div>

      {/* Ukrainian Control */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-400 font-medium">Ukrainian Controlled</span>
          <div className="text-right">
            <span className="text-xl font-bold text-white">
              {formatValue(ukrainianValue)}
            </span>
            <span className="text-xs text-gray-500 ml-1">{unit}</span>
          </div>
        </div>
        {ukrainianChange !== 0 && (
          <div className="text-xs text-blue-400 mt-1">
            {formatChange(ukrainianChange)} {unit} today
          </div>
        )}
      </div>

      {/* Disputed (if present) */}
      {disputedValue > 0 && (
        <div className="mb-3 pt-2 border-t border-osint-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-400 font-medium">Disputed</span>
            <div className="text-right">
              <span className="text-lg font-semibold text-white">
                {formatValue(disputedValue)}
              </span>
              <span className="text-xs text-gray-500 ml-1">{unit}</span>
            </div>
          </div>
          {disputedChange !== 0 && (
            <div className="text-xs text-amber-400 mt-1">
              {formatChange(disputedChange)} {unit} today
            </div>
          )}
        </div>
      )}

      {/* Net Change */}
      {showNetChange && (
        <div className="mt-4 pt-3 border-t border-osint-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Net Change</span>
            <span className={`text-sm font-bold ${netChange > 0 ? 'text-red-400' : netChange < 0 ? 'text-blue-400' : 'text-gray-400'}`}>
              {netChange > 0 ? '+' : ''}{formatValue(netChange)} {unit}
              {netChange > 0 ? ' (Russian advantage)' : netChange < 0 ? ' (Ukrainian advantage)' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
