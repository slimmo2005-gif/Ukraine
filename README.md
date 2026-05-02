# Ukraine War Territory Tracker

A clean, modern dashboard for tracking daily and weekly territorial changes in the Russia-Ukraine war.

![Dashboard Preview](https://via.placeholder.com/800x400?text=Dashboard+Preview)

## Features

### Dashboard
- **Real-time Metrics**: Russian/Ukrainian territory gains today
- **7-Day Rolling Average**: Track trends over the past week
- **Cumulative Analysis**: 90-day net territorial changes
- **Front Breakdown**: Activity by region (Donetsk, Luhansk, Zaporizhzhia, etc.)

### Charts
- **Daily Territorial Change Line Chart**: Track day-to-day movements
- **Weekly/Monthly Bar Charts**: Aggregate view with toggle
- **Cumulative Area Chart**: Long-term territorial control trends
- **Interactive Tooltips**: Hover for detailed data points

### Map
- **Interactive Leaflet Map**: OpenStreetMap tiles
- **GeoJSON Frontline Layers**: Simplified territorial control visualization
- **Date Slider**: Historical playback capability
- **Front Toggles**: Show/hide specific fronts
- **Heatmap Overlay**: Activity intensity visualization

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 5 |
| Charts | Recharts |
| Maps | Leaflet + React-Leaflet |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Hosting | GitHub Pages |

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Ukraine.git
cd Ukraine

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder, ready for deployment.

## Deployment to GitHub Pages

### 1. Configure Repository

1. Push this code to a GitHub repository named `Ukraine`
2. Go to **Settings > Pages** in your repository
3. Set **Source** to "GitHub Actions"

### 2. Automatic Deployment

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically:
- Build the project on every push to `main`/`master`
- Deploy to GitHub Pages

### 3. Manual Deployment

```bash
# Build the project
npm run build

# Deploy dist folder to gh-pages branch
# (Use gh-pages npm package or GitHub Actions)
```

### 4. Configure Repository Settings

Go to **Settings > Pages** and ensure:
- Build and deployment source: **GitHub Actions**

Your site will be available at: `https://yourusername.github.io/Ukraine/`

## Architecture

### Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # App header with branding
│   ├── MetricCard.tsx  # KPI display cards
│   ├── TerritoryChart.tsx   # Recharts wrapper
│   ├── TerritoryMap.tsx     # Leaflet map component
│   ├── TimeRangeToggle.tsx  # Chart period selector
│   └── ChartSection.tsx     # Chart container
├── data/               # Static data
│   └── mockData.ts     # 90-day mock dataset
├── types/              # TypeScript interfaces
│   └── index.ts        # All type definitions
├── utils/              # Helper functions
│   ├── calculations.ts # Data aggregation logic
│   └── geoData.ts      # Map/geo utilities
├── App.tsx             # Main application
├── main.tsx            # Entry point
└── index.css           # Tailwind + custom styles
```

### Data Flow

```
mockData.ts → App.tsx → calculations.ts → Components
                              ↓
                    MetricCards, Charts, Map
```

### Key Design Decisions

1. **Static-First**: No backend required - all data in JSON files
2. **Modular Components**: Each component has a single responsibility
3. **Type Safety**: Strong TypeScript interfaces throughout
4. **OSINT Aesthetic**: Dark theme inspired by professional intelligence tools
5. **Future-Proof**: Clear extension points for API integration

## Data Ingestion (Future)

To replace mock data with live data sources:

### 1. Create Data Service

Create `src/services/dataService.ts`:

```typescript
export async function fetchTerritoryData(): Promise<DailyTerritoryData[]> {
  // Option 1: Fetch from your API
  const response = await fetch('https://api.yoursource.com/territory');
  return response.json();
  
  // Option 2: Fetch from static JSON in repo
  const response = await fetch('/data/territory.json');
  return response.json();
  
  // Option 3: Parse from scraped source
  return parseISWReport(await fetchISWData());
}
```

### 2. Update App.tsx

```typescript
import { useEffect, useState } from 'react';
import { fetchTerritoryData } from '@/services/dataService';

function App() {
  const [data, setData] = useState<DailyTerritoryData[]>([]);
  
  useEffect(() => {
    fetchTerritoryData().then(setData);
  }, []);
  
  // ... rest of component
}
```

### 3. Add Refresh Logic

```typescript
// Auto-refresh every 6 hours
useEffect(() => {
  const interval = setInterval(() => {
    fetchTerritoryData().then(setData);
  }, 6 * 60 * 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

### 4. Data Sources to Consider

| Source | Type | Notes |
|--------|------|-------|
| ISW Reports | Scraping/Parsing | Daily updates, detailed |
| NASA FIRMS | API | Fire detection = activity |
| Sentinel Satellite | API | Visual change detection |
| DeepStateMap | Crowdsourced | Community validated |

## GeoJSON Frontline Integration

To use actual frontline GeoJSON data:

1. Place files in `public/geojson/YYYY-MM-DD.json`
2. Update `src/utils/geoData.ts`:

```typescript
export async function fetchFrontlineGeoJSON(date: string): Promise<FrontlineGeoJSON> {
  const response = await fetch(`/geojson/${date}.json`);
  return response.json();
}
```

3. Update `TerritoryMap.tsx` to use async loading

## Customization

### Styling

Modify `tailwind.config.js`:

```javascript
colors: {
  'ukraine-blue': '#0057B7',
  'ukraine-yellow': '#FFDD00',
  // Add custom colors
}
```

### Adding New Metrics

Add to `src/types/index.ts`:

```typescript
export interface DailyTerritoryData {
  // ... existing fields
  casualties?: {
    russian: number;
    ukrainian: number;
  };
}
```

Then update `MetricCard` usage in `App.tsx`.

### Adding New Chart Types

Create a new component in `src/components/`:

```typescript
export function NewChart({ data }: { data: DailyTerritoryData[] }) {
  return (
    <ResponsiveContainer>
      {/* Your Recharts configuration */}
    </ResponsiveContainer>
  );
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a Pull Request

## License

MIT License - See LICENSE file for details

## Acknowledgments

- OpenStreetMap contributors for map tiles
- Institute for the Study of War (ISW) for methodology inspiration
- Ukraine for their resilience

## Disclaimer

This project is for educational and research purposes. Data shown is simulated/mock data for demonstration. For actual territorial information, consult verified OSINT sources.
