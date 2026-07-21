import type { User } from '@supabase/supabase-js'
import type { SignUpResult } from '@/lib/auth-callback'
import { FARO_ROLES, type FaroRole } from '@/lib/roles'
import { formatAuthError } from '@/lib/auth-errors'
import { countSignupDebug } from '@/lib/signup-debug'
import { supabase } from '@/lib/supabase'
import {
  authAuditRepository,
  coordinatorRequestRepository,
  profileRepository,
} from '@/repositories/auth-repository'
import type {
  ApproveCoordinatorRequestInput,
  CoordinatorRequestRow,
  ProfileRow,
  SubmitCoordinatorRequestInput,
} from '@/repositories/auth-types'

export function resolvePublicRole(profile: ProfileRow | null): FaroRole {
  if (!profile?.role || profile.status !== 'active') return FARO_ROLES.PUBLIC
  // Solicitud pending: permisos efectivos de voluntario (no gestor/coordinador).
  if (profile.role_request_status === 'pending' && profile.pending_role) {
    return FARO_ROLES.VOLUNTEER
  }
  return profile.role
}

async function syncProfileOnSession(user: User, email: string, fullName?: string, phone?: string) {
  await profileRepository.upsertOwn(
    user.id,
    user.email ?? email,
    fullName ?? user.user_metadata?.full_name ?? '',
    phone ?? user.user_metadata?.phone ?? undefined,
  )
  await profileRepository.touchLastLogin(user.id)
}

export const authService = {
  async signInWithPassword(email: string, password: string, captchaToken?: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) throw new Error(formatAuthError(error.message))
    if (data.user && data.session) {
      await syncProfileOnSession(data.user, email)
      await authAuditRepository.log('login', data.user.id)
    }
    return data
  },

  async signUp(
    email: string,
    password: string,
    fullName: string,
    phone: string,
    captchaToken?: string,
  ): Promise<SignUpResult> {
    countSignupDebug('authService.signUp → supabase.auth.signUp', { email })

    const normalizedPhone = phone.trim()
    if (!normalizedPhone) {
      throw new Error('El teléfono es obligatorio.')
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: normalizedPhone },
        emailRedirectTo: redirectTo,
        ...(captchaToken ? { captchaToken } : {}),
      },
    })
    if (error) throw new Error(formatAuthError(error.message))

    const needsEmailConfirmation = Boolean(data.user && !data.session)

    if (data.user && data.session) {
      await syncProfileOnSession(data.user, email, fullName, normalizedPhone)
      await authAuditRepository.log('user_created', data.user.id)
    }

    return {
      user: data.user,
      session: data.session,
      needsEmailConfirmation,
    }
  },

  async verifyEmailOtp(email: string, token: string) {
    let data = null
    let lastError = null

    for (const type of ['signup', 'email'] as const) {
      const result = await supabase.auth.verifyOtp({ email, token, type })
      if (!result.error) {
        data = result.data
        break
      }
      lastError = result.error
    }

    if (!data) throw new Error(formatAuthError(lastError?.message ?? 'Código inválido'))

    if (data.user && data.session) {
      await syncProfileOnSession(data.user, email)
      await authAuditRepository.log('email_confirmed', data.user.id)
    }
    return data
  },

  async resendSignupConfirmation(email: string, captchaToken?: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) throw new Error(formatAuthError(error.message))
  },

  async sendLoginOtp(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) throw new Error(formatAuthError(error.message))
  },

  async resetPassword(email: string, captchaToken?: string) {
    const redirectTo = `${window.location.origin}${window.location.pathname}?auth=recovery`
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      captchaToken,
    })
    if (error) throw new Error(formatAuthError(error.message))
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(formatAuthError(error.message))
  },

  async signOut() {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (userId) await authAuditRepository.log('logout', userId)
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(formatAuthError(error.message))
  },

  async loadProfile(user: User | null): Promise<ProfileRow | null> {
    if (!user) return null
    const existing = await profileRepository.getByUserId(user.id)
    if (existing) return existing
    return profileRepository.upsertOwn(user.id, user.email ?? '', user.user_metadata?.full_name ?? '')
  },

  async selectVolunteerRole(): Promise<ProfileRow> {
    return profileRepository.selectVolunteerRole()
  },

  async requestNetworkRole(role: 'case_manager' | 'coordinator', reason: string): Promise<ProfileRow> {
    return profileRepository.requestNetworkRole(role, reason)
  },

  async submitCoordinatorRequest(input: SubmitCoordinatorRequestInput, userId: string | null) {
    return coordinatorRequestRepository.submit(input, userId)
  },

  async listMyCoordinatorRequests(email: string, userId: string | null): Promise<CoordinatorRequestRow[]> {
    return coordinatorRequestRepository.listMine(email, userId)
  },

  async listPendingCoordinatorRequests(): Promise<CoordinatorRequestRow[]> {
    return coordinatorRequestRepository.listPending()
  },

  async approveCoordinatorRequest(input: ApproveCoordinatorRequestInput) {
    return coordinatorRequestRepository.approve(input)
  },

  async rejectCoordinatorRequest(requestId: string, reviewNotes?: string) {
    return coordinatorRequestRepository.reject(requestId, reviewNotes)
  },

  async requestCoordinatorInfo(requestId: string, message: string) {
    return coordinatorRequestRepository.requestInfo(requestId, message)
  },

  async respondCoordinatorInfo(requestId: string, response: string) {
    return coordinatorRequestRepository.respondInfo(requestId, response)
  },

  async listProfilesForAdmin() {
    return profileRepository.listForAdmin()
  },

  async promoteUserRole(
    userId: string,
    role: 'regional_admin' | 'coordinator' | 'super_admin' | 'case_manager',
  ) {
    const { data, error } = await supabase.rpc('promote_user_role', {
      p_user_id: userId,
      p_role: role,
    })
    if (error) throw new Error(formatAuthError(error.message))
    return data
  },

  async assignCoordinatorRole(
    userId: string,
    siteType: 'hospital' | 'shelter' | 'supply_center',
    siteId: string,
  ) {
    const { data, error } = await supabase.rpc('assign_coordinator_role', {
      p_user_id: userId,
      p_site_type: siteType,
      p_site_id: siteId,
    })
    if (error) throw new Error(formatAuthError(error.message))
    return data
  },

  async listAuthAudit(limit = 50) {
    return authAuditRepository.listRecent(limit)
  },

  async reviewNetworkRoleRequest(userId: string, approve: boolean, reviewNotes?: string) {
    const { data, error } = await supabase.rpc('review_network_role_request', {
      p_user_id: userId,
      p_approve: approve,
      p_review_notes: reviewNotes ?? null,
    })
    if (error) throw new Error(formatAuthError(error.message))
    return data
  },

  async requestNetworkRoleInfo(userId: string, message: string) {
    const { error } = await supabase.rpc('request_network_role_info', {
      p_user_id: userId,
      p_message: message,
    })
    if (error) throw new Error(formatAuthError(error.message))
  },
}
