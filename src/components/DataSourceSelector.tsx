import type { DataSource } from '@/types';

/**
 * DataSourceSelector — this app ships DeepState-only data; one option for consistency if reused.
 */
interface DataSourceSelectorProps {
  selectedSource: DataSource;
  onSourceChange: (source: DataSource) => void;
  availableSources?: DataSource[];
}

const SOURCE_INFO: Record<DataSource, { name: string; description: string; color: string }> = {
  deepstate: {
    name: 'DeepStateMap',
    description: 'Crowdsourced territory control (this dashboard uses DeepState only)',
    color: '#0057B7',
  },
};

export function DataSourceSelector({
  selectedSource,
  onSourceChange,
  availableSources = ['deepstate'],
}: DataSourceSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-400 uppercase tracking-wider">Data Source</label>
      <div className="flex flex-wrap gap-2">
        {availableSources.map((source) => {
          const info = SOURCE_INFO[source];
          const isSelected = selectedSource === source;

          return (
            <button
              key={source}
              type="button"
              onClick={() => onSourceChange(source)}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                border flex items-center gap-2
                ${isSelected
                  ? 'bg-opacity-20 text-white border-current'
                  : 'text-gray-400 border-osint-border hover:text-white hover:border-gray-500'
                }
              `}
              style={{
                borderColor: isSelected ? info.color : undefined,
                backgroundColor: isSelected ? `${info.color}20` : undefined,
              }}
              title={info.description}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: info.color }}
              />
              <span>{info.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
