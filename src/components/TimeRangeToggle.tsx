import type { TimeRange } from '@/types';

/**
 * TimeRangeToggle - Toggle between daily, weekly, and yearly views
 */
interface TimeRangeToggleProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeToggle({ value, onChange }: TimeRangeToggleProps) {
  const ranges: { key: TimeRange; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="flex items-center gap-1 bg-osint-card p-1 rounded-lg border border-osint-border">
      {ranges.map((range) => (
        <button
          key={range.key}
          onClick={() => onChange(range.key)}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
            ${value === range.key
              ? 'bg-ukraine-blue text-white shadow-md'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
          `}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
