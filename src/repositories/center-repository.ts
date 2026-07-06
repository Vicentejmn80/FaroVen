import type { Center } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import type { HospitalRow, ShelterRow, SupplyCenterRow } from '@/types/supabase'
import { hospitalRowToCenter, shelterRowToCenter, supplyCenterRowToCenter } from './mappers'
import type { RegisterSiteInput, UpdateCenterInput, UpdateSaturationInput } from './types'

export class CenterRepository {
  async list(): Promise<Center[]> {
    const [hospitalsRes, sheltersRes, supplyRes] = await Promise.all([
      supabase.from('hospitals').select('*'),
      supabase.from('shelters').select('*'),
      supabase.from('supply_centers').select('*'),
    ])

    if (hospitalsRes.error) throw hospitalsRes.error
    if (sheltersRes.error) throw sheltersRes.error
    if (supplyRes.error) throw supplyRes.error

    const hospitals = ((hospitalsRes.data ?? []) as HospitalRow[]).map(hospitalRowToCenter)
    const shelters = ((sheltersRes.data ?? []) as ShelterRow[]).map(shelterRowToCenter)
    const supplyCenters = ((supplyRes.data ?? []) as SupplyCenterRow[]).map(supplyCenterRowToCenter)

    return [...hospitals, ...shelters, ...supplyCenters]
  }

  async findById(id: string): Promise<Center | null> {
    const centers = await this.list()
    return centers.find((center) => center.id === id) ?? null
  }

  async create(input: RegisterSiteInput): Promise<Center> {
    const { data, error } = await supabase.rpc('admin_register_center', {
      p_type: input.type,
      p_name: input.name.trim(),
      p_address: input.address?.trim() || null,
      p_municipality: input.municipality?.trim() || null,
      p_state: input.state?.trim() || null,
      p_latitude: input.latitude ?? null,
      p_longitude: input.longitude ?? null,
      p_contact_name: input.contactName?.trim() || null,
      p_phone: input.contactPhone?.trim() || null,
      p_capacity: input.capacity ?? 100,
      p_current_occ: input.currentOcc ?? 0,
      p_schedule: input.schedule?.trim() || null,
      p_notes: input.observations?.trim() || null,
    })
    if (error) throw error
    if (!data || typeof data !== 'object') {
      throw new Error('No se recibió respuesta al registrar el centro.')
    }

    const row = data as unknown
    if (input.type === 'hospital') {
      return hospitalRowToCenter(row as HospitalRow)
    }
    if (input.type === 'shelter') {
      return shelterRowToCenter(row as ShelterRow)
    }
    return supplyCenterRowToCenter(row as SupplyCenterRow)
  }

  async updateSaturation(input: UpdateSaturationInput): Promise<void> {
    const { error } = await supabase
      .from('site_saturation')
      .upsert(
        {
          site_type: input.siteType,
          site_id: input.siteId,
          need_key: input.needKey,
          need_label: input.needLabel,
          level: input.level,
        },
        { onConflict: 'site_type,site_id,need_key' },
      )
    if (error) throw error
  }

  async update(input: UpdateCenterInput): Promise<Center> {
    const base = {
      name: input.name.trim(),
      address: input.address?.trim() || null,
      municipality: input.municipality?.trim() || null,
      state: input.state?.trim() || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contact_name: input.contactName?.trim() || null,
      notes: input.observations?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (input.type === 'hospital') {
      const { data, error } = await supabase
        .from('hospitals')
        .update({
          ...base,
          capacity: input.capacity ?? 100,
          current_occ: input.currentOcc ?? 0,
          phone: input.contactPhone?.trim() || null,
        })
        .eq('id', input.id)
        .select('*')
        .single()
      if (error) throw error
      return hospitalRowToCenter(data as HospitalRow)
    }

    if (input.type === 'shelter') {
      const { data, error } = await supabase
        .from('shelters')
        .update({
          ...base,
          capacity: input.capacity ?? 100,
          current_occ: input.currentOcc ?? 0,
          contact_phone: input.contactPhone?.trim() || null,
        })
        .eq('id', input.id)
        .select('*')
        .single()
      if (error) throw error
      return shelterRowToCenter(data as ShelterRow)
    }

    const { data, error } = await supabase
      .from('supply_centers')
      .update({
        ...base,
        contact_phone: input.contactPhone?.trim() || null,
        schedule: input.schedule?.trim() || 'Por confirmar',
      })
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw error
    return supplyCenterRowToCenter(data as SupplyCenterRow)
  }
}

export const centerRepository = new CenterRepository()
