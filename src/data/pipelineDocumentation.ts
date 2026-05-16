/**
 * Public-facing pipeline documentation (derived from Ukraine-Data-Pipeline-Documentation.docx).
 * Safe to show in the app — no credentials, secrets, or admin paths.
 */
export type DocSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const PIPELINE_DOC_TITLE = 'How this dashboard gets its data';

export const PIPELINE_DOC_SECTIONS: DocSection[] = [
  {
    id: 'overview',
    title: 'What this dashboard shows',
    paragraphs: [
      'This app tracks how much territory in Ukraine is shown as Russian-controlled, Ukrainian-controlled, or disputed, nationwide and by oblast (province).',
      'The numbers come from DeepStateMap — a crowdsourced war map updated as analysts interpret front lines and control zones.',
      'The dashboard does not scrape DeepState live on every page load. A separate data pipeline downloads the map, turns it into numbers, and saves JSON once per day. This site loads those files and builds charts and tables.',
    ],
    bullets: [
      'Map source: deepstatemap.live',
      'Processed data: public GitHub repo (ukraine-territory-data)',
    ],
  },
  {
    id: 'step1',
    title: 'Step 1 — Getting the map',
    paragraphs: [
      'Each day, the pipeline requests DeepState’s latest map snapshot: colored polygons labeled by control type.',
      'We use DeepState’s public history API, which returns those polygons in standard geographic format (GeoJSON-style features).',
    ],
  },
  {
    id: 'step2',
    title: 'Step 2 — Polygons to square kilometers',
    paragraphs: [
      'Each polygon is classified (Russian-held, Ukrainian-held, or disputed) using DeepState labels and styling.',
      'Area is measured in km² with proper geographic math on the curved Earth, not flat screen pixels.',
      'Polygons outside Ukraine’s area of interest or marked as non-counting overlays are excluded.',
      'National totals are the sum of Russian, Ukrainian, and disputed km² plus a total land denominator.',
    ],
  },
  {
    id: 'step3',
    title: 'Step 3 — Splitting by oblast',
    paragraphs: [
      'A reference map of oblast boundaries is used. For each control polygon:',
    ],
    bullets: [
      'Overlap with each oblast is computed; area is split proportionally where a polygon crosses borders.',
      'If intersection fails, a nearest-oblast fallback is used within a reasonable distance.',
      'Each oblast has a fixed reference total area. If R+U+D exceeds that total, the three categories are scaled down.',
      'Unmapped oblast land is treated as Ukrainian-controlled in our model.',
      'Crimea is handled with a dedicated rule: fully Russian-controlled in processed output.',
      'Output includes 25 oblast rows per daily file.',
    ],
  },
  {
    id: 'step4',
    title: 'Step 4 — Day-to-day changes',
    paragraphs: [
      'Each new day is compared to the previous saved snapshot. Change fields (km² moved between Russian, Ukrainian, and disputed) power “today’s change” and many movement charts.',
    ],
  },
  {
    id: 'step5',
    title: 'Step 5 — History and weekly anchors',
    paragraphs: [
      'Today’s map comes from DeepState’s live API. Older dates may be rebuilt from the Internet Archive (Wayback Machine) when an exact day is missing.',
      'Weekly files under data/history/weekly/ are separate JSON anchors (~every seven days) for longer-range charts.',
      'Yearly files may exist under data/history/yearly/ or annual/; otherwise the app derives year-end style points from weekly anchors.',
    ],
  },
  {
    id: 'step6',
    title: 'Step 6 — What your browser loads',
    paragraphs: [
      'This app lists available date files from the data repo, downloads JSON for each day in the history window (up to ~2000 days), and loads weekly/yearly series in parallel.',
      'Chart math runs in the browser. The simplified map on this site is for context; table and chart numbers come from processed JSON, not from re-drawing every DeepState polygon in the UI.',
    ],
  },
  {
    id: 'limitations',
    title: 'Important limitations',
    paragraphs: [
      'These are geometry-based estimates from a crowdsourced map, not official government statistics or legal borders.',
      'Missing dates mean no snapshot existed or processing failed — the date picker only steps across available files.',
      'Only DeepStateMap is wired into production today.',
    ],
    bullets: [
      'DeepStateMap and its community deserve credit — see footer links.',
      'Questions about methodology? Use feedback channels you trust; this doc is for transparency, not operational security detail.',
    ],
  },
  {
    id: 'technical',
    title: 'Technical summary (for reviewers)',
    paragraphs: [
      'Extraction runs in the ukraine-territory-data repo (Node.js + Turf). This app (React/Vite) only consumes published JSON from GitHub.',
      'Optional visitor analytics use a separate Cloudflare Worker; it does not affect territory numbers.',
    ],
    bullets: [
      'Daily job: fetch GeoJSON → classify → oblast split → validate → write data/YYYY-MM-DD.json',
      'Oblast split: intersect with boundaries, scale to oblast totals, Crimea rule, remainder → Ukrainian',
      'Frontend: parallel fetch with bounded concurrency; calculations in src/utils/calculations.ts',
    ],
  },
];
