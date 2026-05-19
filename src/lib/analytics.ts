const SESSION_KEY = 'ukraine_analytics_session_id';
/** When set, this browser does not send /visit (owner / test devices). */
const EXCLUDE_KEY = 'ukraine_analytics_exclude';

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

/** True when this browser is opted out of visitor analytics (localStorage). */
export function isAnalyticsExcludedLocally(): boolean {
  try {
    return localStorage.getItem(EXCLUDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAnalyticsExcludedLocally(excluded: boolean): void {
  try {
    if (excluded) {
      localStorage.setItem(EXCLUDE_KEY, '1');
    } else {
      localStorage.removeItem(EXCLUDE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget: records one session per tab (worker uses INSERT OR IGNORE). */
export function logPageSessionVisit(): void {
  const base = getAnalyticsBaseUrl();
  if (!base || isAnalyticsExcludedLocally()) {
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
      excludedDeviceCount: number;
      byCountry: { country: string; count: number }[];
      byDay: { day: string; count: number }[];
    }
  | { ok: false; error: string };

export type DeviceExclusionResult =
  | { ok: true; excluded: boolean; sessionId: string }
  | { ok: false; error: string };

/** Register this browser's session as excluded (or included) on the worker. */
export async function setDeviceSessionExclusion(
  password: string,
  exclude: boolean,
): Promise<DeviceExclusionResult> {
  const base = getAnalyticsBaseUrl();
  if (!base) {
    return { ok: false, error: 'Analytics API URL is not configured.' };
  }
  const sessionId = getOrCreateSessionId();
  const path = exclude ? '/admin/exclude-session' : '/admin/include-session';
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, sessionId }),
    });
  } catch {
    return { ok: false, error: 'Could not reach the analytics server.' };
  }
  let data: DeviceExclusionResult & { error?: string };
  try {
    data = (await res.json()) as DeviceExclusionResult & { error?: string };
  } catch {
    return { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  if (!data.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  setAnalyticsExcludedLocally(exclude);
  return { ok: true, excluded: exclude, sessionId: data.sessionId ?? sessionId };
}

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
    excludedDeviceCount: data.excludedDeviceCount ?? 0,
    byCountry: data.byCountry ?? [],
    byDay: data.byDay ?? [],
  };
}

export type FeedbackSubmitResult = { ok: true } | { ok: false; error: string };

export async function submitFeedback(payload: {
  message: string;
  contactEmail?: string;
  contactWhatsapp?: string;
  contactDiscord?: string;
}): Promise<FeedbackSubmitResult> {
  const base = getAnalyticsBaseUrl();
  if (!base) {
    return { ok: false, error: 'Feedback is not configured on this deployment.' };
  }
  let res: Response;
  try {
    res = await fetch(`${base}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'Could not reach the feedback server.' };
  }
  let data: { ok?: boolean; error?: string };
  try {
    data = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  if (!data.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return { ok: true };
}

export type FeedbackItem = {
  id: number;
  message: string;
  contactEmail: string;
  contactWhatsapp: string;
  contactDiscord: string;
  wordCount: number;
  day: string;
  createdAt: string;
};

export type AdminFeedbackResponse =
  | { ok: true; total: number; byDay: { day: string; items: FeedbackItem[] }[] }
  | { ok: false; error: string };

export async function fetchAdminFeedback(password: string): Promise<AdminFeedbackResponse> {
  const base = getAnalyticsBaseUrl();
  if (!base) {
    return { ok: false, error: 'Analytics API URL is not configured.' };
  }
  let res: Response;
  try {
    res = await fetch(`${base}/admin/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
  } catch {
    return { ok: false, error: 'Could not reach the feedback server.' };
  }
  let data: AdminFeedbackResponse & { error?: string };
  try {
    data = (await res.json()) as AdminFeedbackResponse & { error?: string };
  } catch {
    return { ok: false, error: `Invalid response (HTTP ${res.status})` };
  }
  if (!data.ok) {
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  }
  return {
    ok: true,
    total: data.total ?? 0,
    byDay: data.byDay ?? [],
  };
}
