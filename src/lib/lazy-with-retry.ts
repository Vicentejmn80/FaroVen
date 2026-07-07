import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed|ChunkLoadError/i

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return CHUNK_ERROR_PATTERN.test(error.message)
}

/**
 * React.lazy con reintento automático ante fallos de chunk (PWA con caché desincronizada).
 * Si el primer intento falla, fuerza recarga limpia una sola vez por sesión.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory()
    } catch (error) {
      if (!isChunkLoadError(error)) throw error

      const retryKey = 'faro:chunk-retry'
      const alreadyRetried = sessionStorage.getItem(retryKey) === '1'
      if (!alreadyRetried) {
        sessionStorage.setItem(retryKey, '1')
        window.location.reload()
        // Devuelve un componente vacío mientras recarga
        return { default: (() => null) as unknown as T }
      }

      sessionStorage.removeItem(retryKey)
      throw error
    }
  })
}

export { isChunkLoadError }
