const SESSION_KEY = 'ukraine_analytics_session_id';

export function getAnalyticsBaseUrl(): string | null {
  const raw = import.meta.env.VITE_ANALYTICS_API_URL;
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  return raw.replace(/\/+$/, '');
}

export function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
      return existing;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Fire-and-forget: records one session per tab (worker uses INSERT OR IGNORE). */
export function logPageSessionVisit(): void {
  const base = getAnalyticsBaseUrl();
  if (!base) {
    return;
  }
  const sessionId = getOrCreateSessionId();
  void fetch(`${base}/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  }).catch(() => {
    /* ignore network errors */
  });
}

export type AdminStatsResponse =
  | {
      ok: true;
      totalSessions: number;
      byCountry: { country: string; count: number }[];
      byDay: { day: string; count: number }[];
    }
  | { ok: false; error: string };

export async function fetchAdminStats(password: string): Promise<AdminStatsResponse> {
  const base = getAnalyticsBaseUrl();
  if (!base) {
    return { ok: false, error: 'Analytics API URL is not configured (VITE_ANALYTICS_API_URL).' };
  }
  let res: Response;
  try {
    res = await fetch(`${base}/admin/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return {
      ok: false,
      error:
        'Could not reach the analytics server. The worker may be down or D1 may need setup — see workers/analytics-worker/SETUP.txt.',
    };
  }
  let data: AdminStatsResponse & { error?: string };
  try {
    data = (await res.json()) as AdminStatsResponse & { error?: string };
  } catch {
    return {
      ok: false,
      error: `Analytics server error (HTTP ${res.status}). Database may not be configured on the worker.`,
    };
  }
  if (!data.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    totalSessions: data.totalSessions,
    byCountry: data.byCountry ?? [],
    byDay: data.byDay ?? [],
  };
}
