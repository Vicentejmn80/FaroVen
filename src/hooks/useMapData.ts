import { useMemo } from 'react'
import type { GeoCoordinates, Need, Report } from '@/domain/models'
import type { Site } from '@/lib/types'
import { FARO_ROLES, type FaroRole } from '@/lib/roles'
import { useFaro } from '@/store/faro-context'

export type MissionStatus = 'open' | 'assigned' | 'in_progress' | 'completed'
export type MissionPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Mission {
  id: string
  title: string
  requiredSkill?: string | null
  status: MissionStatus
  priority: MissionPriority
  location: GeoCoordinates
  createdAt: Date
}

export type MapDataMode = 'missions' | 'cases' | 'sites'

export interface MapDataResult {
  mode: MapDataMode
  missions: Mission[]
  cases: Report[]
  sites: Site[]
  needs: Need[]
  isLoading: boolean
  loadError: string | null
}

interface UseMapDataParams {
  userRole: FaroRole | string
  userId?: string | null
  location?: GeoCoordinates | null
}

/**
 * Hook centralizado para datos del mapa según rol.
 * Voluntario → misiones; gestor de casos → reportes; coordinador/admin → centros.
 */
export function useMapData({ userRole, userId, location }: UseMapDataParams): MapDataResult {
  const role = normalizeRole(userRole)

  if (role === FARO_ROLES.VOLUNTEER) {
    return useMissionsData(location, userId)
  }

  if (role === FARO_ROLES.CASE_MANAGER) {
    return useCasesData(location, userId)
  }

  return useSitesData()
}

function useSitesData(): MapDataResult {
  const { sites, state, isLoading, loadError } = useFaro()
  return useMemo(
    () => ({
      mode: 'sites',
      missions: [],
      cases: [],
      sites,
      needs: state.needs,
      isLoading,
      loadError,
    }),
    [sites, state.needs, isLoading, loadError],
  )
}

function useCasesData(_location?: GeoCoordinates | null, _userId?: string | null): MapDataResult {
  const { sites, state, isLoading, loadError } = useFaro()
  return useMemo(
    () => ({
      mode: 'cases',
      missions: [],
      cases: state.reports,
      sites,
      needs: state.needs,
      isLoading,
      loadError,
    }),
    [sites, state.needs, state.reports, isLoading, loadError],
  )
}

function useMissionsData(_location?: GeoCoordinates | null, _userId?: string | null): MapDataResult {
  const { sites, state, isLoading, loadError } = useFaro()

  // TODO: reemplazar por fuente real de misiones cuando el backend esté listo.
  return useMemo(
    () => ({
      mode: 'missions',
      missions: [],
      cases: [],
      sites,
      needs: state.needs,
      isLoading,
      loadError,
    }),
    [sites, state.needs, isLoading, loadError],
  )
}

function normalizeRole(role: FaroRole | string): FaroRole | string {
  if (!role) return role
  if (role === 'case_manager' || role === FARO_ROLES.CASE_MANAGER) return FARO_ROLES.CASE_MANAGER
  if (role === 'volunteer' || role === FARO_ROLES.VOLUNTEER) return FARO_ROLES.VOLUNTEER
  return role
}
