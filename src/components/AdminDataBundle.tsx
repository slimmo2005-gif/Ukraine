import { useEffect, useState } from 'react';
import {
  fetchTerritoryManifest,
  type TerritoryDataManifest,
} from '@/services/territoryData';

const SYNC_WORKFLOW_URL =
  'https://github.com/slimmo2005-gif/Ukraine/actions/workflows/sync-territory-data.yml';

const PAGES_SETTINGS_URL = 'https://github.com/slimmo2005-gif/Ukraine/settings/pages';
/** Deploy uses peaceiris → gh-pages branch (not GitHub Actions Pages artifact API). */
const GH_PAGES_BRANCH = 'gh-pages';

type Props = {
  /** When the dashboard last loaded territory rows successfully. */
  liveSource: 'bundled' | 'remote' | 'none';
};

export function AdminDataBundle({ liveSource }: Props) {
  const [manifest, setManifest] = useState<TerritoryDataManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await fetchTerritoryManifest();
        if (!cancelled) {
          setManifest(m);
          setManifestError(m ? null : 'No manifest.json on this deployment (data not bundled yet).');
        }
      } catch {
        if (!cancelled) {
          setManifestError('Could not read bundled manifest.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncedLabel = manifest?.syncedAt
    ? new Date(manifest.syncedAt).toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <section className="rounded-lg border border-osint-border bg-osint-dark/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">Territory data bundle</h3>
      <p className="text-xs text-gray-400 leading-relaxed">
        The public site serves JSON from the same domain as the app so corporate networks that block{' '}
        <code className="text-gray-500">raw.githubusercontent.com</code> can still load charts. CI clones{' '}
        <code className="text-gray-500">ukraine-territory-data</code> with git (no GitHub API file downloads)
        daily (~8:00 Melbourne) and on demand, then deploys the <code className="text-gray-500">{GH_PAGES_BRANCH}</code> branch.
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <dt className="text-gray-500">This session loaded from</dt>
        <dd className="text-gray-200">
          {liveSource === 'bundled' && 'Bundled mirror (same origin)'}
          {liveSource === 'remote' && 'Remote GitHub (raw)'}
          {liveSource === 'none' && 'Nothing loaded'}
        </dd>
        <dt className="text-gray-500">Bundle last synced (Melbourne)</dt>
        <dd className="text-gray-200 tabular-nums">{syncedLabel}</dd>
        <dt className="text-gray-500">Daily files in bundle</dt>
        <dd className="text-gray-200 tabular-nums">{manifest?.daily.length ?? '—'}</dd>
        <dt className="text-gray-500">Weekly / yearly in bundle</dt>
        <dd className="text-gray-200 tabular-nums">
          {manifest
            ? `${manifest.weekly.length} / ${manifest.yearly.length}`
            : '—'}
        </dd>
      </dl>
      {manifestError && (
        <p className="text-xs text-amber-400/90">{manifestError}</p>
      )}
      <div className="flex flex-col gap-1">
        <a
          href={SYNC_WORKFLOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-ukraine-blue hover:underline"
        >
          Re-run sync &amp; deploy (GitHub Actions) →
        </a>
        <a
          href={PAGES_SETTINGS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          GitHub Pages → Source: Deploy from branch → {GH_PAGES_BRANCH} / root
        </a>
      </div>
    </section>
  );
}
