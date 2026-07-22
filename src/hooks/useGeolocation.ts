import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface GeoPosition {
  lat: number
  lng: number
  accuracy: number
}

export function useGeolocation(userId?: string) {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada')
      return
    }

    setLoading(true)

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: GeoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        setPosition(newPos)
        setError(null)
        setLoading(false)

        if (userId) {
          supabase.rpc('update_volunteer_location', {
            p_user_id: userId,
            p_lat: newPos.lat,
            p_lng: newPos.lng,
          }).then()
        }
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Permiso de ubicación denegado')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Ubicación no disponible')
            break
          case err.TIMEOUT:
            setError('Tiempo de espera agotado')
            break
          default:
            setError('Error al obtener ubicación')
        }
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )

    setWatchId(id)
  }, [userId])

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }, [watchId])

  const requestPermission = useCallback(() => {
    startWatching()
  }, [startWatching])

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return { position, error, loading, watching: watchId !== null, startWatching, stopWatching, requestPermission }
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function estimateTravelTime(km: number): string {
  const minutes = Math.round((km / 30) * 60)
  if (minutes < 1) return 'Menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
