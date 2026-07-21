import { useState } from 'react'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { cn } from '@/lib/utils'
import { useSubmitRoleRequest } from '@/hooks/useRoleRequestMutations'
import { validateRoleRequestForm } from '@/domain/role-request.service'
import { RequestedRole, REQUESTED_ROLES } from '@/domain/role-request.types'
import { formatRequestedRoleLabel } from '@/domain/role-request.service'
import type { SubmitRoleRequestInput } from '@/repositories/auth-types'

const SITE_TYPES = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'shelter', label: 'Refugio' },
  { value: 'supply_center', label: 'Centro de suministro' },
] as const

export function RoleRequestForm({ onDone }: { onDone?: () => void }) {
  const [form, setForm] = useState<Partial<SubmitRoleRequestInput>>({
    requestedRole: 'case_manager',
    fullName: '',
    email: '',
    phone: '',
    organization: '',
    requestedSiteType: undefined,
    requestedSiteId: '',
    roleTitle: '',
    reason: '',
    experience: '',
    availabilityHours: 10,
  })
  const [errors, setErrors] = useState<string[]>([])
  const [success, setSuccess] = useState(false)
  const submit = useSubmitRoleRequest()

  const update = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async () => {
    const validation = validateRoleRequestForm(form)
    setErrors(validation.errors)
    if (!validation.valid) return

    try {
      await submit.mutateAsync(form as SubmitRoleRequestInput)
      setSuccess(true)
      onDone?.()
    } catch {
      setErrors(['Error al enviar la solicitud. Intenta de nuevo.'])
    }
  }

  if (success) {
    return (
      <GlassCard className="p-6 text-center">
        <p className="text-lg font-semibold text-ink mb-2">Solicitud enviada</p>
        <p className="text-sm text-ink-subtle mb-4">Un administrador revisará tu solicitud. Te notificaremos cuando haya una respuesta.</p>
        <EmergencyButton variant="primary" size="sm" onClick={onDone}>Volver</EmergencyButton>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <h2 className="text-base font-semibold text-ink mb-4">Solicitar nuevo rol</h2>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Rol deseado</span>
            <div className="flex gap-2">
              {REQUESTED_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => update('requestedRole', role)}
                  className={cn(
                    'flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                    form.requestedRole === role
                      ? 'border-info/50 bg-info/10 text-info'
                      : 'border-white/[0.06] text-ink-subtle hover:bg-white/[0.04]',
                  )}
                >
                  {formatRequestedRoleLabel(role as RequestedRole)}
                </button>
              ))}
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-subtle">Nombre completo</span>
              <input
                value={form.fullName ?? ''}
                onChange={(e) => update('fullName', e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-subtle">Correo electrónico</span>
              <input
                value={form.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-subtle">Teléfono</span>
              <input
                value={form.phone ?? ''}
                onChange={(e) => update('phone', e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-ink-subtle">Organización</span>
              <input
                value={form.organization ?? ''}
                onChange={(e) => update('organization', e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
              />
            </label>
          </div>

          {form.requestedRole === 'coordinator' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink-subtle">Tipo de centro</span>
                <select
                  value={form.requestedSiteType ?? ''}
                  onChange={(e) => update('requestedSiteType', e.target.value || undefined)}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/50"
                >
                  <option value="">Seleccionar...</option>
                  {SITE_TYPES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-ink-subtle">ID del centro</span>
                <input
                  value={form.requestedSiteId ?? ''}
                  onChange={(e) => update('requestedSiteId', e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
                />
              </label>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Rol o cargo</span>
            <input
              value={form.roleTitle ?? ''}
              onChange={(e) => update('roleTitle', e.target.value)}
              placeholder="Ej: Coordinador logístico"
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Experiencia relevante</span>
            <textarea
              value={form.experience ?? ''}
              onChange={(e) => update('experience', e.target.value)}
              rows={3}
              placeholder="Cuéntanos sobre tu experiencia en emergencias, gestión, voluntariado..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">¿Por qué deseas este rol?</span>
            <textarea
              value={form.reason ?? ''}
              onChange={(e) => update('reason', e.target.value)}
              rows={3}
              placeholder="Explícanos tu motivación..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-subtle">Disponibilidad semanal (horas)</span>
            <input
              type="number"
              value={form.availabilityHours ?? 10}
              onChange={(e) => update('availabilityHours', parseInt(e.target.value) || 0)}
              min={1}
              max={168}
              className="h-10 w-24 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-ink outline-none focus:border-info/50"
            />
          </label>
        </div>
      </GlassCard>

      {errors.length > 0 && (
        <GlassCard className="p-3 bg-critical/10 border-critical/20">
          <ul className="space-y-1">
            {errors.map((err) => <li key={err} className="text-xs text-critical">{err}</li>)}
          </ul>
        </GlassCard>
      )}

      <EmergencyButton
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={submit.isPending}
      >
        {submit.isPending ? 'Enviando...' : 'Enviar solicitud'}
      </EmergencyButton>
    </div>
  )
}
