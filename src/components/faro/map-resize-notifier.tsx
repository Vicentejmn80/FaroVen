import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/**
 * Recalcula el tamaño del mapa cuando el contenedor cambia (resize, breakpoints, tabs).
 * Evita mapa en blanco o tiles desalineados tras cambiar dimensiones del padre.
 */
export function MapResizeNotifier() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const wrapper = container.parentElement
    if (!wrapper) return

    const invalidate = () => {
      requestAnimationFrame(() => {
        if (!map.getContainer().isConnected) return
        map.invalidateSize({ animate: false })
      })
    }

    // Primer paint tras montar
    invalidate()
    const mountTimer = window.setTimeout(invalidate, 120)

    const observer = new ResizeObserver(invalidate)
    observer.observe(wrapper)

    window.addEventListener('resize', invalidate)
    document.addEventListener('visibilitychange', invalidate)

    return () => {
      window.clearTimeout(mountTimer)
      observer.disconnect()
      window.removeEventListener('resize', invalidate)
      document.removeEventListener('visibilitychange', invalidate)
    }
  }, [map])

  return null
}
