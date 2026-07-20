export type CasePriority = 'high' | 'medium' | 'low'

export type CaseStatus = 'pending' | 'review' | 'waiting' | 'followup' | 'resolved'

export interface CaseRecord {
  id: string
  title: string
  priority: CasePriority
  location: string
  reportedBy: string
  reportedAt: Date
  status: CaseStatus
  description: string
  contactPhone: string
  notes?: string
  assignedTo?: string
  createdAt: Date
  updatedAt: Date
}

export type CaseSummaryFilter = 'critical' | 'assigned' | 'followup' | 'resolved'

export interface CaseSummaryItem {
  id: CaseSummaryFilter
  label: string
  value: number
  tone: 'critical' | 'warning' | 'info' | 'operational'
}

export type CaseListFilter = 'all' | 'review' | 'waiting' | 'followup'

export interface CaseFilterItem {
  id: CaseListFilter
  label: string
  count: number
}

export interface CaseActivityItem {
  id: string
  description: string
  createdAt: Date
}
