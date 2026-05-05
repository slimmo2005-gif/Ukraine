# Windsurf Prompt: Ukraine Territory Data Processor

## Objective
Create a Python script that downloads the DeepStateMap Ukraine GeoJSON data daily, calculates territory control areas by oblast (province), and outputs a simplified JSON file that can be consumed by a React frontend.

## Output File Format

Create daily JSON files in this exact format:

```json
{
  "date": "2026-05-02",
  "source": "deepstate",
  "total_russian_controlled_km2": 95234.5,
  "total_ukrainian_controlled_km2": 504123.2,
  "total_disputed_km2": 3421.8,
  "total_area_km2": 602779.5,
  "russian_change_km2": 12.4,
  "ukrainian_change_km2": 1.2,
  "disputed_change_km2": 0.5,
  "oblasts": [
    {
      "oblast": "donetsk",
      "russian_controlled_km2": 18234.5,
      "ukrainian_controlled_km2": 7265.5,
      "disputed_km2": 1000.0,
      "total_area_km2": 26500.0,
      "russian_change_km2": 12.4,
      "ukrainian_change_km2": -5.2,
      "disputed_change_km2": 0.8
    },
    {
      "oblast": "luhansk",
      "russian_controlled_km2": 10234.0,
      "ukrainian_controlled_km2": 6000.0,
      "disputed_km2": 500.0,
      "total_area_km2": 16734.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "kharkiv",
      "russian_controlled_km2": 2500.0,
      "ukrainian_controlled_km2": 28657.0,
      "disputed_km2": 200.0,
      "total_area_km2": 31357.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 6.4,
      "disputed_change_km2": -0.3
    },
    {
      "oblast": "zaporizhzhia",
      "russian_controlled_km2": 18000.0,
      "ukrainian_controlled_km2": 9134.0,
      "disputed_km2": 800.0,
      "total_area_km2": 27934.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "kherson",
      "russian_controlled_km2": 12000.0,
      "ukrainian_controlled_km2": 16822.0,
      "disputed_km2": 300.0,
      "total_area_km2": 29122.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "sumy",
      "russian_controlled_km2": 800.0,
      "ukrainian_controlled_km2": 22752.0,
      "disputed_km2": 100.0,
      "total_area_km2": 23652.0,
      "russian_change_km2": -8.0,
      "ukrainian_change_km2": 8.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "mykolaiv",
      "russian_controlled_km2": 1500.0,
      "ukrainian_controlled_km2": 23100.0,
      "disputed_km2": 50.0,
      "total_area_km2": 24650.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "crimea",
      "russian_controlled_km2": 27000.0,
      "ukrainian_controlled_km2": 0.0,
      "disputed_km2": 0.0,
      "total_area_km2": 27000.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "sevastopol",
      "russian_controlled_km2": 864.0,
      "ukrainian_controlled_km2": 0.0,
      "disputed_km2": 0.0,
      "total_area_km2": 864.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "dnipro",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 31923.0,
      "disputed_km2": 0.0,
      "total_area_km2": 31923.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "kyiv",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 28131.0,
      "disputed_km2": 0.0,
      "total_area_km2": 28131.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "odesa",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 33310.0,
      "disputed_km2": 0.0,
      "total_area_km2": 33310.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "lviv",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 21833.0,
      "disputed_km2": 0.0,
      "total_area_km2": 21833.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "vinnytsia",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 26513.0,
      "disputed_km2": 0.0,
      "total_area_km2": 26513.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "poltava",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 28748.0,
      "disputed_km2": 0.0,
      "total_area_km2": 28748.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "cherkasy",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 20900.0,
      "disputed_km2": 0.0,
      "total_area_km2": 20900.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "zhytomyr",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 29832.0,
      "disputed_km2": 0.0,
      "total_area_km2": 29832.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "rivne",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 20047.0,
      "disputed_km2": 0.0,
      "total_area_km2": 20047.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "ivano-frankivsk",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 13928.0,
      "disputed_km2": 0.0,
      "total_area_km2": 13928.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "ternopil",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 13823.0,
      "disputed_km2": 0.0,
      "total_area_km2": 13823.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "khmelnytskyi",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 20645.0,
      "disputed_km2": 0.0,
      "total_area_km2": 20645.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "volyn",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 20144.0,
      "disputed_km2": 0.0,
      "total_area_km2": 20144.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "zakarpattia",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 12877.0,
      "disputed_km2": 0.0,
      "total_area_km2": 12877.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "chernivtsi",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 8097.0,
      "disputed_km2": 0.0,
      "total_area_km2": 8097.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "kirovohrad",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 24588.0,
      "disputed_km2": 0.0,
      "total_area_km2": 24588.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "chernihiv",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 31865.0,
      "disputed_km2": 0.0,
      "total_area_km2": 31865.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "luhansk_city",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 0.0,
      "disputed_km2": 0.0,
      "total_area_km2": 0.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    },
    {
      "oblast": "donetsk_city",
      "russian_controlled_km2": 0.0,
      "ukrainian_controlled_km2": 0.0,
      "disputed_km2": 0.0,
      "total_area_km2": 0.0,
      "russian_change_km2": 0.0,
      "ukrainian_change_km2": 0.0,
      "disputed_change_km2": 0.0
    }
  ],
  "last_updated": "2026-05-02T14:30:00Z"
}
```

## Oblast Keys (24 oblasts + Crimea + Sevastopol)

Use these exact keys:
```python
OBLAST_KEYS = [
    'donetsk', 'luhansk', 'kharkiv', 'zaporizhzhia', 'kherson', 'sumy', 'mykolaiv',
    'crimea', 'sevastopol', 'dnipro', 'kyiv', 'odesa', 'lviv', 'vinnytsia',
    'poltava', 'cherkasy', 'zhytomyr', 'rivne', 'ivano-frankivsk', 'ternopil',
    'khmelnytskyi', 'volyn', 'zakarpattia', 'chernivtsi', 'kirovohrad', 'chernihiv'
]
```

## Oblast Total Areas (km²) - Reference

```python
OBLAST_AREAS = {
    'donetsk': 26517.0,
    'luhansk': 26684.0,
    'kharkiv': 31415.0,
    'zaporizhzhia': 27180.0,
    'kherson': 28461.0,
    'sumy': 23834.0,
    'mykolaiv': 24598.0,
    'crimea': 27000.0,      # Republic of Crimea
    'sevastopol': 864.0,     # City of Sevastopol
    'dnipro': 31923.0,
    'kyiv': 28131.0,
    'odesa': 33310.0,
    'lviv': 21833.0,
    'vinnytsia': 26513.0,
    'poltava': 28748.0,
    'cherkasy': 20900.0,
    'zhytomyr': 29832.0,
    'rivne': 20047.0,
    'ivano-frankivsk': 13928.0,
    'ternopil': 13823.0,
    'khmelnytskyi': 20645.0,
    'volyn': 20144.0,
    'zakarpattia': 12877.0,
    'chernivtsi': 8097.0,
    'kirovohrad': 24588.0,
    'chernihiv': 31865.0
}
```

## Color Coding in DeepState GeoJSON

The `fill` and `stroke` properties indicate control status:
- **Red/Dark colors (#b71c1c, #d32f2f, etc.)**: Russian controlled
- **Blue colors (#1976d2, #2196f3, etc.)**: Ukrainian controlled  
- **Yellow/Orange (#fbc02d, #ff9800, etc.)**: Disputed/contested
- **Gray (#bcaaa4, #9e9e9e, etc.)**: Unknown/unclear status

## Calculation Requirements

1. **Parse GeoJSON polygons** from DeepStateMap API
2. **Calculate polygon areas** using proper geodesic calculations (not planar)
3. **Determine which oblast each polygon belongs to** (spatial intersection with oblast boundaries)
4. **Sum areas by control status per oblast**
5. **Calculate daily changes** by comparing to previous day's file

## File Naming

Save output files as:
```
data/YYYY-MM-DD.json
```

Example: `data/2026-05-02.json`

## Script Structure

Create a Python script with these components:

1. **Data Fetcher**: Download from DeepStateMap API
2. **Area Calculator**: Calculate polygon areas per oblast
3. **Change Calculator**: Compare to previous day and compute deltas
4. **JSON Writer**: Output the formatted JSON file
5. **Main Runner**: Orchestrate the daily process

## Dependencies

```
requests
shapely
pyproj
geojson
```

## DeepStateMap API Endpoint

The raw GeoJSON can be downloaded from:
```
https://deepstatemap.live/api/data.json
```

Or similar endpoint (verify the actual API URL).

## Important Notes

1. **Use proper geodesic area calculations** - Ukraine spans multiple UTM zones, use geographiclib or pyproj for accurate km²
2. **Handle disputed areas carefully** - contested regions may overlap or have unclear boundaries
3. **Changes should be calculated** by comparing the current day to the previous day's data file
4. **If a polygon spans multiple oblasts**, assign it to the oblast containing its centroid, or split the area proportionally
5. **Handle sea areas** - exclude Black Sea/Sea of Azov from land area calculations
6. **Data validation** - ensure russian + ukrainian + disputed ≈ total_area for each oblast (with small margin for measurement error)

## Example Pseudocode

```python
def process_daily_data():
    # 1. Download today's GeoJSON
    geojson = download_deepstate_data()
    
    # 2. Load oblast boundary polygons
    oblast_boundaries = load_oblast_boundaries()
    
    # 3. Process each territory polygon
    oblast_data = defaultdict(lambda: {'russian': 0, 'ukrainian': 0, 'disputed': 0})
    
    for feature in geojson['features']:
        if feature['geometry']['type'] != 'Polygon':
            continue
            
        # Determine control status from fill color
        status = get_control_status(feature['properties'])
        
        # Calculate area
        area_km2 = calculate_area(feature['geometry'])
        
        # Find which oblast this polygon is in
        oblast = find_containing_oblast(feature, oblast_boundaries)
        
        if oblast:
            oblast_data[oblast][status] += area_km2
    
    # 4. Calculate changes from previous day
    yesterday_data = load_yesterday_data()
    changes = calculate_changes(oblast_data, yesterday_data)
    
    # 5. Write output JSON
    output = format_output(oblast_data, changes)
    write_json(output, f"data/{today}.json")
```

## Deliverables

1. **Python script** that runs daily (`process_ukraine_data.py`)
2. **Oblast boundary data** (GeoJSON or shapefile with the 26 regions)
3. **Example output JSON** for at least one day to verify format
4. **README** with setup and run instructions
5. **Requirements.txt** with dependencies

## Output Location

The generated JSON files should be saved to:
```
/path/to/ukraine-tracker/src/data/daily/YYYY-MM-DD.json
```

Or wherever the React frontend is configured to load them from.

---

**Ask clarifying questions if needed before starting implementation.**
