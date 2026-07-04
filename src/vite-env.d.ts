/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_SIGNUP_DEBUG?: string
  readonly VITE_ONESIGNAL_APP_ID?: string
  readonly VITE_PUSH_SUBSCRIBE_TIMEOUT_MS?: string
  readonly VITE_PUSH_INIT_TIMEOUT_MS?: string
  readonly VITE_PUSH_RETRY_ATTEMPTS?: string
  readonly VITE_PUSH_RETRY_BASE_MS?: string
  readonly VITE_PUSH_CIRCUIT_FAILURE_THRESHOLD?: string
  readonly VITE_PUSH_CIRCUIT_COOLDOWN_MS?: string
  readonly VITE_PUSH_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __FARO_BUILD_DATE__: string
declare const __FARO_BUILD_COMMIT__: string

interface Window {
  __faroUpdateSW?: (reloadPage?: boolean) => Promise<void>
}
