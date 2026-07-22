export interface HospitalRow {
  id: string
  name: string
  address: string | null
  municipality: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  phone: string | null
  capacity: number | null
  current_occ: number | null
  notes: string | null
  status: string | null
  updated_at: string | null
}

export interface ShelterRow {
  id: string
  name: string
  address: string | null
  municipality: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  contact_phone: string | null
  capacity: number | null
  current_occ: number | null
  notes: string | null
  status: string | null
  updated_at: string | null
}

export interface SupplyCenterRow {
  id: string
  name: string
  address: string | null
  municipality: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
  contact_name: string | null
  contact_phone: string | null
  schedule: string | null
  notes: string | null
  status: string | null
  updated_at: string | null
}

export interface NeedRow {
  id: string
  needable_type: string
  needable_id: string
  item_name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  qty_required: number
  qty_received: number
  pct_covered?: number | null
  status?: string | null
  created_at?: string | null
  updated_at: string | null
  cycle_duration_hours?: number | null
  cycle_number?: number | null
  cycle_started_at?: string | null
  expires_at?: string | null
  closed_at?: string | null
  closure_reason?: string | null
}

export interface ReportRow {
  id: string
  type: string
  description: string
  source?: string | null
  reported_by?: string | null
  contact_info?: string | null
  status: string
  created_at: string
  site_type?: string | null
  site_id?: string | null
  site_label?: string | null
  latitude?: number | null
  longitude?: number | null
  tracking_code?: string | null
}

export interface EventRow {
  id: string
  kind: string
  title: string
  detail: string | null
  status: string
  center_type: string | null
  center_id: string | null
  report_id: string | null
  created_at: string
}

export interface OrganizationRow {
  id: string
  name: string
  type: string | null
  contact: string | null
  logo: string | null
}

export interface CaseRow {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  pipeline_stage: 'nuevo' | 'pending_review' | 'validating' | 'awaiting_info' | 'assigned' | 'accepted' | 'in_attention' | 'resolved' | 'archived'
  latitude: number | null
  longitude: number | null
  address: string | null
  zone: string
  affected_count: number
  reporter_name: string | null
  reporter_phone: string | null
  reporter_email: string | null
  reporter_relationship: string | null
  category: string | null
  assigned_to: string | null
  assigned_center_id: string | null
  assigned_at: string | null
  sla_deadline: string | null
  first_response_at: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CaseEventRow {
  id: string
  case_id: string
  event_type: 'case_submitted' | 'case_review_started' | 'case_validated' | 'case_info_requested' | 'case_info_received' | 'case_assigned' | 'case_accepted' | 'case_attention_started' | 'case_resolved' | 'case_reopened' | 'case_closed' | 'case_dismissed' | 'case_stale_archived' | 'case_unable_to_assign'
  from_stage: string | null
  to_stage: string | null
  actor_id: string | null
  comment: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CaseAssignmentRow {
  id: string
  case_id: string
  center_id: string
  assigned_by: string
  assigned_to: string | null
  status: 'active' | 'accepted' | 'rejected' | 'completed'
  reason: string | null
  assigned_at: string
  accepted_at: string | null
  rejected_at: string | null
}

export interface CenterResourceRow {
  id: string
  center_id: string
  resource_type: 'water' | 'medicine' | 'food' | 'beds' | 'personnel'
  current_level: number
  max_level: number
  unit: string
  updated_at: string
}

export interface SupportRequestRow {
  id: string
  center_id: string
  request_type: 'volunteers' | 'medical' | 'logistics' | 'transport' | 'supplies'
  title: string
  description: string | null
  urgency: 'low' | 'medium' | 'high' | 'critical'
  quantity: number
  duration_hours: number | null
  status: 'open' | 'in_progress' | 'fulfilled' | 'cancelled'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CenterEventRow {
  id: string
  center_id: string
  event_type: 'capacity_updated' | 'resource_updated' | 'case_accepted' | 'case_rejected' | 'case_resolved' | 'support_requested' | 'operational_mode_changed'
  previous_value: string | null
  new_value: string | null
  actor_id: string | null
  actor_name: string | null
  description: string | null
  created_at: string
}

export interface VolunteerRow {
  id: string
  user_id: string
  full_name: string
  phone: string
  zone: string
  latitude: number
  longitude: number
  organization: string | null
  experience: string | null
  availability: 'available' | 'busy' | 'offline' | 'on_mission' | 'unavailable'
  verification_level: 'unverified' | 'basic' | 'advanced' | 'full'
  trust_score: number
  avg_response_minutes: number
  total_missions: number
  completed_missions: number
  service_hours: number
  avg_mission_duration_minutes: number
  specialties: string[]
  centers_collaborated: string[]
  last_activity_at: string | null
  last_location_update: string
  created_at: string
  updated_at: string
}

export interface VolunteerSkillRow {
  id: string
  volunteer_id: string
  skill: string
  proficiency: number
}

export interface VolunteerAvailabilityLogRow {
  id: string
  volunteer_id: string
  status: string
  changed_at: string
}

export interface MissionRow {
  id: string
  support_request_id: string | null
  case_id: string | null
  center_id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  required_skills: string[]
  required_people: number
  assigned_people: number
  status: 'created' | 'matching' | 'assigned' | 'accepted' | 'en_route' | 'on_site' | 'in_progress' | 'completed' | 'verified' | 'archived'
  latitude: number
  longitude: number
  address: string | null
  zone: string
  deadline: string | null
  eta: string | null
  created_by: string
  created_at: string
  updated_at: string
  completed_at: string | null
  verified_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

export interface MissionAssignmentRow {
  id: string
  mission_id: string
  volunteer_id: string
  status: 'assigned' | 'accepted' | 'rejected' | 'preparing' | 'en_route' | 'on_site' | 'in_progress' | 'completed' | 'verified' | 'cancelled' | 'archived'
  assigned_at: string
  responded_at: string | null
  preparing_at: string | null
  arrived_at: string | null
  completed_at: string | null
  verified_at: string | null
  evidence_urls: string[]
  rating: number | null
  feedback: string | null
}

export interface MissionEventRow {
  id: string
  mission_id: string
  event_type: string
  actor_id: string | null
  actor_name: string | null
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
