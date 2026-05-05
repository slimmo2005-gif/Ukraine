import type { ViewLevel, OblastKey } from '@/types';
import { OBLAST_NAMES } from '@/data/mockData';

/**
 * ViewLevelToggle - Toggle between Total Ukraine and Province (Oblast) view
 * Includes province selector dropdown when in oblast mode
 */
interface ViewLevelToggleProps {
  viewLevel: ViewLevel;
  selectedOblast?: OblastKey;
  onViewLevelChange: (level: ViewLevel) => void;
  onOblastChange: (oblast: OblastKey) => void;
}

export function ViewLevelToggle({
  viewLevel,
  selectedOblast = 'donetsk',
  onViewLevelChange,
  onOblastChange,
}: ViewLevelToggleProps) {
  const oblasts = Object.entries(OBLAST_NAMES).map(([key, name]) => ({
    key: key as OblastKey,
    name,
  }));

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* View Level Toggle */}
      <div className="flex bg-osint-card p-1 rounded-lg border border-osint-border">
        <button
          onClick={() => onViewLevelChange('total')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${viewLevel === 'total'
              ? 'bg-ukraine-blue text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          Total Ukraine
        </button>
        <button
          onClick={() => onViewLevelChange('oblast')}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${viewLevel === 'oblast'
              ? 'bg-ukraine-blue text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          By Oblast
        </button>
      </div>

      {/* Oblast Selector (only shown in oblast mode) */}
      {viewLevel === 'oblast' && (
        <select
          value={selectedOblast}
          onChange={(e) => onOblastChange(e.target.value as OblastKey)}
          className="bg-osint-card border border-osint-border text-white text-sm rounded-lg px-4 py-2 focus:ring-2 focus:ring-ukraine-blue focus:outline-none"
        >
          <optgroup label="Active Conflict Zones">
            {oblasts
              .filter(o => ['donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv', 'kherson', 'sumy', 'mykolaiv'].includes(o.key))
              .map(({ key, name }) => (
                <option key={key} value={key}>{name}</option>
              ))}
          </optgroup>
          <optgroup label="Other Oblasts">
            {oblasts
              .filter(o => !['donetsk', 'luhansk', 'zaporizhzhia', 'kharkiv', 'kherson', 'sumy', 'mykolaiv'].includes(o.key))
              .map(({ key, name }) => (
                <option key={key} value={key}>{name}</option>
              ))}
          </optgroup>
        </select>
      )}
    </div>
  );
}
