/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Cloudflare analytics worker (no trailing slash). */
  readonly VITE_ANALYTICS_API_URL?: string;
}
