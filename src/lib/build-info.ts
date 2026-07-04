/** Texto de versión seguro en todos los navegadores móviles. */
export function formatBuildVersion(): string {
  try {
    const commit =
      typeof __FARO_BUILD_COMMIT__ !== 'undefined' && __FARO_BUILD_COMMIT__
        ? __FARO_BUILD_COMMIT__
        : 'dev'
    let dateLabel = '—'
    if (typeof __FARO_BUILD_DATE__ !== 'undefined' && __FARO_BUILD_DATE__) {
      const parsed = new Date(__FARO_BUILD_DATE__)
      if (!Number.isNaN(parsed.getTime())) {
        dateLabel = parsed.toLocaleDateString('es-ES')
      }
    }
    return `Versión · commit ${commit} · ${dateLabel}`
  } catch {
    return ''
  }
}
