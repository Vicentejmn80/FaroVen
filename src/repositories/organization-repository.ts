import type { Organization } from '@/domain/models'
import { supabase } from '@/lib/supabase'
import type { OrganizationRow } from '@/types/supabase'
import { organizationRowToOrganization } from './mappers'

export class OrganizationRepository {
  async list(): Promise<Organization[]> {
    const { data, error } = await supabase.from('organizations').select('*')
    if (error) throw error
    return ((data ?? []) as OrganizationRow[]).map(organizationRowToOrganization)
  }
}

export const organizationRepository = new OrganizationRepository()
