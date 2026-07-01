import { useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useFaro } from '@/store/faro-context'
import { useCoordinatorAssignment } from '@/store/coordinator-context'
import { siteToNeedableType } from '@/lib/site-utils'
import { SITE_META } from '@/lib/status-config'

/** Vincula al coordinador con un centro registrado (asignación local o perfil Supabase). */
export function CoordinatorSetupScreen() {
  const { sites } = useFaro()
  const { bindAssignment } = useCoordinatorAssignment()
  const [selectedId, setSelectedId] = useState('')

  const registeredSites = useMemo(
    () => sites.filter((s) => s.type !== 'organization').sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [sites],
  )

  const handleConfirm = () => {
    const site = registeredSites.find((s) => s.id === selectedId)
    if (!site) return
    bindAssignment({
      siteId: site.id,
      siteType: siteToNeedableType(site),
      siteName: site.name,
    })
  }

  return (
    <ScreenScaffold title="Panel coordinador" subtitle="Acceso operativo">
      <div className="space-y-4 pt-2">
        <GlassCard className="space-y-2">
          <p className="text-[15px] font-medium text-ink">Selecciona tu centro asignado</p>
          <p className="text-sm text-ink-muted">
            Solo puedes administrar centros registrados en FARO. Si tu centro no aparece, pide a
            un administrador que lo registre y te asigne.
          </p>
        </GlassCard>

        {registeredSites.length === 0 ? (
          <GlassCard className="text-sm text-ink-muted">
            No hay centros registrados todavía. Registra el primero desde acciones de coordinación.
          </GlassCard>
        ) : (
          <>
            <div className="space-y-1.5">
              {registeredSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedId(site.id)}
                  className={`flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                    selectedId === site.id
                      ? 'border-info/50 bg-info/10'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                  }`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{site.name}</span>
                    <span className="block text-xs text-ink-subtle">
                      {SITE_META[site.type]?.label ?? 'Centro'} · {site.zone}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <EmergencyButton
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!selectedId}
              onClick={handleConfirm}
            >
              Entrar al panel
            </EmergencyButton>
          </>
        )}
      </div>
    </ScreenScaffold>
  )
}
