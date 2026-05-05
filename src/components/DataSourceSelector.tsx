import type { DataSource } from '@/types';

/**
 * DataSourceSelector - Select which data source to display
 * Supports: DeepState Map, Institute for the Study of War (ISW), Combined/Averaged
 */
interface DataSourceSelectorProps {
  selectedSource: DataSource;
  onSourceChange: (source: DataSource) => void;
  availableSources?: DataSource[];
}

const SOURCE_INFO: Record<DataSource, { name: string; description: string; color: string }> = {
  deepstate: {
    name: 'DeepStateMap',
    description: 'Crowdsourced territory control',
    color: '#0057B7',
  },
  isw: {
    name: 'ISW',
    description: 'Institute for the Study of War',
    color: '#3b82f6',
  },
  combined: {
    name: 'Combined',
    description: 'Average of all sources',
    color: '#8b5cf6',
  },
};

export function DataSourceSelector({
  selectedSource,
  onSourceChange,
  availableSources = ['deepstate', 'isw', 'combined'],
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
              {/* Indicator dot */}
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
