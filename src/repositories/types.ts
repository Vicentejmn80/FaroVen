export type RegisterSiteType = 'hospital' | 'shelter' | 'supply_center'

export interface RegisterSiteInput {
  type: RegisterSiteType
  name: string
  address?: string
  municipality?: string
  state?: string
  latitude?: number
  longitude?: number
  capacity?: number
  currentOcc?: number
  contactName?: string
  contactPhone?: string
  schedule?: string
  observations?: string
}

export interface RegisterNeedInput {
  needableType: RegisterSiteType
  needableId: string
  itemName: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  qtyRequired: number
  qtyReceived?: number
}

export interface UpdateSaturationInput {
  siteId: string
  siteType: RegisterSiteType
  currentOcc: number
  capacity?: number
}

export interface AdjustNeedStockInput {
  needId: string
  qtyReceived: number
  notes?: string
}

export interface UpdateNeedInput {
  id: string
  itemName?: string
  priority?: 'critical' | 'high' | 'medium' | 'low'
  qtyRequired?: number
  qtyReceived?: number
  notes?: string
}

export type DbReportStatus = 'pending' | 'under_review' | 'verified' | 'dismissed'

export interface ReviewReportInput {
  id: string
  status: DbReportStatus
  reviewNotes?: string
}

export interface CoordinatorAssignment {
  siteId: string
  siteType: RegisterSiteType
  siteName: string
}

export interface SubmitReportInput {
  description: string
  siteType?: RegisterSiteType
  siteId?: string
  siteLabel?: string
  latitude?: number
  longitude?: number
  contactInfo?: string
}
