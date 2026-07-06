/** Metadatos de build para panel de salud del sistema. */
export const APP_VERSION = '1.0.0'
export const APP_BUILD = import.meta.env.MODE === 'production' ? 'production' : 'development'

/** Código visible en la app: FARO-YYMMDD-NNN (NNN = commits del repo al compilar). */
export function getAppReleaseCode(): string {
  if (typeof __FARO_RELEASE_CODE__ !== 'undefined' && __FARO_RELEASE_CODE__) {
    return __FARO_RELEASE_CODE__
  }
  return 'FARO-dev'
}
