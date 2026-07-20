import type { CasePriority } from '@/types/case.types'

export type PipelineStage =
  | 'nuevo'
  | 'pending_review'
  | 'validating'
  | 'awaiting_info'
  | 'assigned'
  | 'accepted'
  | 'in_attention'
  | 'resolved'
  | 'archived'

export interface PipelineTransition {
  from: PipelineStage
  to: PipelineStage
  timestamp: Date
  actor?: string
  reason?: string
}

export interface OpsCaseRecord {
  id: string
  title: string
  priority: CasePriority
  location: string
  zone: string
  lat?: number
  lng?: number
  reportedBy: string
  reportedAt: Date
  stage: PipelineStage
  description: string
  contactPhone: string
  contactEmail?: string
  notes?: string
  assignedTo?: string
  assignedCenterId?: string
  suggestedCenterId?: string
  suggestedCenterName?: string
  category?: string
  affectedCount?: number
  timeline: PipelineTransition[]
  createdAt: Date
  updatedAt: Date
}

export type OpsSummaryMetric =
  | 'critical'
  | 'new'
  | 'in_review'
  | 'in_attention'
  | 'avg_response'
  | 'centers_saturated'
  | 'centers_available'

export interface OpsSummaryItem {
  id: OpsSummaryMetric
  label: string
  value: string | number
  tone: 'critical' | 'warning' | 'info' | 'operational' | 'neutral'
}

export interface AssignmentSuggestion {
  centerId: string
  centerName: string
  distance: string
  saturation: 'low' | 'medium' | 'high' | 'critical'
  status: string
  score: number
}

export interface OpsNotification {
  id: string
  title: string
  message: string
  type: 'new_case' | 'update' | 'assignment' | 'alert' | 'system'
  read: boolean
  caseId?: string
  createdAt: Date
}
