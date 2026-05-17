import { useState } from 'react';
import {
  fetchAdminFeedback,
  fetchAdminStats,
  getAnalyticsBaseUrl,
  type AdminFeedbackResponse,
  type AdminStatsResponse,
  type FeedbackItem,
} from '@/lib/analytics';

type AdminTab = 'visitors' | 'feedback';

type Props = {
  onClose: () => void;
  /** When true, render as a page panel instead of a full-screen modal. */
  embedded?: boolean;
};

function countryLabel(code: string): string {
  if (code === 'XX' || !code) {
    return 'Unknown / not via Cloudflare';
  }
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

function formatFeedbackTime(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return createdAt;
  }
}

function FeedbackEntry({ item }: { item: FeedbackItem }) {
  const contacts = [
    item.contactEmail && `Email: ${item.contactEmail}`,
    item.contactWhatsapp && `WhatsApp: ${item.contactWhatsapp}`,
    item.contactDiscord && `Discord: ${item.contactDiscord}`,
  ].filter(Boolean);

  return (
    <article className="rounded border border-osint-border bg-osint-dark/40 p-3 space-y-2">
      <div className="flex justify-between gap-2 text-[11px] text-gray-500">
        <span>{formatFeedbackTime(item.createdAt)}</span>
        <span className="tabular-nums">{item.wordCount} words</span>
      </div>
      <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.message}</p>
      {contacts.length > 0 && (
        <p className="text-xs text-gray-400">{contacts.join(' · ')}</p>
      )}
    </article>
  );
}

export function AdminAnalytics({ onClose, embedded = false }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>('visitors');
  const [stats, setStats] = useState<Extract<AdminStatsResponse, { ok: true }> | null>(null);
  const [feedback, setFeedback] = useState<Extract<AdminFeedbackResponse, { ok: true }> | null>(null);

  const configured = Boolean(getAnalyticsBaseUrl());
  const loaded = stats !== null || feedback !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStats(null);
    setFeedback(null);
    setLoading(true);
    try {
      const [statsResult, feedbackResult] = await Promise.all([
        fetchAdminStats(password),
        fetchAdminFeedback(password),
      ]);
      if (!statsResult.ok) {
        setError(statsResult.error);
        return;
      }
      if (!feedbackResult.ok) {
        setError(feedbackResult.error);
        return;
      }
      setStats(statsResult);
      setFeedback(feedbackResult);
    } catch {
      setError('Could not reach the analytics server. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const inner = (
      <div
        className={`w-full bg-osint-card border border-osint-border rounded-lg shadow-xl p-6 ${embedded ? 'max-w-3xl' : 'max-w-lg my-auto'}`}
        onClick={embedded ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="admin-analytics-title" className="text-lg font-semibold text-white">
              Admin
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Visitor analytics and user feedback (Cloudflare worker — see{' '}
              <code className="text-gray-400">workers/analytics-worker/SETUP.txt</code>).
            </p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-white text-sm shrink-0"
            onClick={onClose}
            aria-label="Close admin"
          >
            Close
          </button>
        </div>

        {!configured && (
          <p className="text-sm text-amber-400/90 mb-4 p-3 rounded border border-amber-500/30 bg-amber-500/10">
            <code className="text-gray-300">VITE_ANALYTICS_API_URL</code> is not set, so visits are not
            recorded and this panel cannot load stats. Add the worker URL at build time, then redeploy the
            site.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="admin-password" className="block text-xs text-gray-400 mb-1">
              Admin password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-osint-dark border border-osint-border text-white text-sm focus:outline-none focus:ring-1 focus:ring-ukraine-blue"
              placeholder="Password from worker secret"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-2 rounded bg-ukraine-blue text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            {loading ? 'Loading…' : 'Load data'}
          </button>
        </form>

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        {loaded && (
          <div className="mt-4 flex gap-2 border-b border-osint-border">
            <button
              type="button"
              onClick={() => setTab('visitors')}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                tab === 'visitors'
                  ? 'border-ukraine-blue text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Visitors
            </button>
            <button
              type="button"
              onClick={() => setTab('feedback')}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                tab === 'feedback'
                  ? 'border-ukraine-blue text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              Feedback{feedback ? ` (${feedback.total})` : ''}
            </button>
          </div>
        )}

        {stats && tab === 'visitors' && (
          <div className="mt-5 pt-4 border-t border-osint-border space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Total sessions</p>
              <p className="text-2xl font-semibold text-white tabular-nums">{stats.totalSessions.toLocaleString()}</p>
              <p className="text-[11px] text-gray-500 mt-1">
                One session = first visit from a browser tab (see sessionStorage). Country uses Cloudflare{' '}
                <code className="text-gray-400">CF-IPCountry</code> when the worker sees the request; traffic
                that does not hit your worker on Cloudflare may show as Unknown.
              </p>
            </div>
            {stats.byDay.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Sessions over time</p>
                <div className="max-h-40 overflow-y-auto rounded border border-osint-border mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-osint-border text-left text-gray-400">
                        <th className="py-2 px-3 font-medium">Date (UTC)</th>
                        <th className="py-2 px-3 font-medium text-right">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byDay.map((row) => (
                        <tr key={row.day} className="border-b border-osint-border/50 last:border-0">
                          <td className="py-1.5 px-3 text-gray-200">{row.day}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-white">
                            {row.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">By country</p>
              <div className="max-h-56 overflow-y-auto rounded border border-osint-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-osint-border text-left text-gray-400">
                      <th className="py-2 px-3 font-medium">Country</th>
                      <th className="py-2 px-3 font-medium text-right">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byCountry.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-4 px-3 text-gray-500 text-center">
                          No data yet.
                        </td>
                      </tr>
                    ) : (
                      stats.byCountry.map((row) => (
                        <tr key={row.country} className="border-b border-osint-border/50 last:border-0">
                          <td className="py-1.5 px-3 text-gray-200">{countryLabel(row.country)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-white">{row.count.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {feedback && tab === 'feedback' && (
          <div className="mt-5 pt-4 border-t border-osint-border space-y-4 max-h-[min(60vh,520px)] overflow-y-auto">
            {feedback.byDay.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No feedback yet.</p>
            ) : (
              feedback.byDay.map((group) => (
                <section key={group.day}>
                  <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2 sticky top-0 bg-osint-card py-1">
                    {group.day}
                    <span className="text-gray-600 font-normal ml-2">
                      ({group.items.length} submission{group.items.length === 1 ? '' : 's'})
                    </span>
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <FeedbackEntry key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </div>
  );

  if (embedded) {
    return inner;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-analytics-title"
      onClick={onClose}
    >
      {inner}
    </div>
  );
}
