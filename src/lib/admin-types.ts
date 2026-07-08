import type { RegisterSiteType } from '@/repositories/types'

export interface AdminRegistryRow {
  site_type: RegisterSiteType
  site_id: string
  site_name: string
  site_address: string | null
  profile_id: string | null
  auth_user_id: string | null
  coordinator_email: string | null
  coordinator_name: string | null
  is_orphan: boolean
}

export interface AdminCoordinatorRow {
  profile_id: string
  auth_user_id: string
  full_name: string
  email: string
  phone: string | null
  site_type: RegisterSiteType
  site_id: string
  site_name: string | null
  user_status: string
  user_role: string | null
  updated_at: string
}

export interface AdminNotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export type SuperAdminModuleId =
  | 'users'
  | 'coordinators'
  | 'requests'
  | 'hospitals'
  | 'shelters'
  | 'supply_centers'
  | 'needs'
  | 'reports'
  | 'notifications'
  | 'inventory'
  | 'events'
  | 'audit'
  | 'maintenance'
  | 'operational_settings'
  | 'dev_reset'

export interface AdminUpdateProfileInput {
  userId: string
  fullName?: string
  phone?: string
  organizationName?: string
  profession?: string
  specialty?: string
  municipality?: string
  region?: string
}
