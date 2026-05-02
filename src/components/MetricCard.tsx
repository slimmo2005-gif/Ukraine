import type { MetricCardProps } from '@/types';

/**
 * MetricCard - Displays a key metric with trend indicator
 * 
 * Props:
 * - title: Label for the metric
 * - value: The numeric value to display
 * - unit: Unit of measurement (e.g., "km²")
 * - change: Optional change value from previous period
 * - changeLabel: Label describing the change (e.g., "vs yesterday")
 * - trend: Visual indicator direction
 * - color: Color theme for the card
 */
export function MetricCard({
  title,
  value,
  unit,
  change,
  changeLabel = 'vs yesterday',
  trend,
  color,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return 'border-l-ukraine-blue bg-gradient-to-br from-blue-900/20 to-slate-800';
      case 'yellow':
        return 'border-l-ukraine-yellow bg-gradient-to-br from-yellow-900/20 to-slate-800';
      case 'red':
        return 'border-l-russian-red bg-gradient-to-br from-red-900/20 to-slate-800';
      default:
        return 'border-l-gray-500 bg-gradient-to-br from-gray-800/50 to-slate-800';
    }
  };

  const getTrendColor = () => {
    // For territory gains, "up" for Russian is typically negative (red)
    // "up" for Ukrainian is typically positive (blue)
    if (trend === 'up') {
      return color === 'red' ? 'text-red-400' : 'text-green-400';
    }
    if (trend === 'down') {
      return color === 'blue' ? 'text-red-400' : 'text-green-400';
    }
    return 'text-gray-400';
  };

  const formatValue = (v: number): string => {
    if (v === 0) return '0';
    if (v < 0.1) return v.toFixed(2);
    if (v < 1) return v.toFixed(1);
    return v.toFixed(1);
  };

  return (
    <div
      className={`p-6 rounded-lg border-l-4 shadow-lg backdrop-blur-sm ${getColorClasses()}`}
    >
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">
          {formatValue(value)}
        </span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      {change !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-sm ${getTrendColor()}`}>
          <span>{getTrendIcon()}</span>
          <span className="font-medium">
            {change > 0 ? '+' : ''}{formatValue(change)} {unit}
          </span>
          <span className="text-gray-500 ml-1">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
