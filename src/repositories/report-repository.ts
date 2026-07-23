import type { Report } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import type { ReportRow } from '@/types/supabase'
import { reportRowToReport } from './mappers'
import type { SubmitReportInput, ReviewReportInput, RegisterSiteType } from './types'
import { generateTrackingCode } from '@/lib/portal-report-tracking'

export class ReportRepository {
  async list(): Promise<Report[]> {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as ReportRow[]).map(reportRowToReport)
  }

  async create(input: SubmitReportInput): Promise<Report> {
    const { data, error } = await supabase
      .from('reports')
      .insert({
        type: 'other',
        description: input.description.trim(),
        site_type: input.siteType ?? null,
        site_id: input.siteId ?? null,
        site_label: input.siteLabel ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        contact_info: input.contactInfo ?? null,
        status: 'pending',
      })
      .select('*')
      .single()
    if (error) throw error
    return reportRowToReport(data as ReportRow)
  }

  async listBySite(siteType: RegisterSiteType, siteId: string): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('site_type', siteType)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as ReportRow[]).map(reportRowToReport)
  }

  async createPublic(input: {
    description: string
    contactName?: string
    contactPhone?: string
    contactEmail?: string
    location?: string
    category?: string
  }): Promise<{ report: Report; trackingCode: string }> {
    const trackingCode = generateTrackingCode()
    const contactInfo = [input.contactName, input.contactPhone, input.contactEmail].filter(Boolean).join(' | ') || null
    const description = [input.category, input.location, input.description].filter(Boolean).join(' — ')

    const { data, error } = await supabase
      .from('reports')
      .insert({
        type: 'other',
        description,
        contact_info: contactInfo,
        tracking_code: trackingCode,
        status: 'pending',
      })
      .select('*')
      .single()
    if (error) throw error
    return { report: reportRowToReport(data as ReportRow), trackingCode }
  }

  async findByTrackingCode(code: string): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('tracking_code', code.trim().toUpperCase())
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return reportRowToReport(data as ReportRow)
  }

  async updateReview(input: ReviewReportInput): Promise<Report> {
    const payload = {
      status: input.status,
      review_notes: input.reviewNotes?.trim() || null,
      reviewed_at: new Date().toISOString(),
    }

    const { error: updateError, count } = await supabase
      .from('reports')
      .update(payload, { count: 'exact' })
      .eq('id', input.id)

    if (updateError) throw updateError
    if (count === 0) {
      throw new Error(
        'No se pudo revisar el reporte. Ejecuta 20260630240000_coordinator_report_review.sql en Supabase.',
      )
    }

    const { data, error } = await supabase.from('reports').select('*').eq('id', input.id).maybeSingle()
    if (error) throw error
    if (!data) {
      return {
        id: input.id,
        type: 'other',
        description: input.reviewNotes ?? '',
        userId: 'anonymous',
        source: 'Coordinador',
        createdAt: new Date(),
        status: input.status === 'verified' ? 'verified' : 'discarded',
        confidence: 'medium',
        photoUrls: [],
        location: {
          zone: 'Caracas',
          address: '',
          coordinates: { lat: 0, lng: 0 },
        },
      }
    }
    return reportRowToReport(data as ReportRow)
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.rpc('delete_report', { p_report_id: id })
    if (error) throw error
  }

  async findWithAnalysis(id: string): Promise<Report | null> {
    const { data, error } = await supabase.from('reports').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? reportRowToReport(data as ReportRow) : null
  }
}

export const reportRepository = new ReportRepository()
