import { getAppReleaseCode } from '@/lib/app-meta'

/** Texto de release visible en Perfil y paneles de sistema. */
export function formatBuildVersion(): string {
  try {
    const code = getAppReleaseCode()
    let dateLabel = ''
    if (typeof __FARO_BUILD_DATE__ !== 'undefined' && __FARO_BUILD_DATE__) {
      const parsed = new Date(__FARO_BUILD_DATE__)
      if (!Number.isNaN(parsed.getTime())) {
        dateLabel = parsed.toLocaleDateString('es-VE')
      }
    }
    return dateLabel ? `${code} · ${dateLabel}` : code
  } catch {
    return getAppReleaseCode()
  }
}
