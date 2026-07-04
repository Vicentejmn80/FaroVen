/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_SIGNUP_DEBUG?: string
  readonly VITE_ONESIGNAL_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __FARO_BUILD_DATE__: string
declare const __FARO_BUILD_COMMIT__: string

interface Window {
  __faroUpdateSW?: (reloadPage?: boolean) => Promise<void>
}
