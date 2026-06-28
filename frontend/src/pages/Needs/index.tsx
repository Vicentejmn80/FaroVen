import { useNeedsWithLocations } from '@/hooks/useQuickUpdate'
import { NeedCard } from '@/components/needs/need-card'
import { LoadingSpinner } from '@/components/shared/loading-spinner'
import { ErrorMessage } from '@/components/shared/error-message'
import { PRIORITY_LABELS, type NeedPriority } from '@/lib/types'

const PRIORITY_ORDER: NeedPriority[] = ['critical', 'high', 'medium', 'low']
const PRIORITY_ICONS: Record<NeedPriority, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
}

export function NeedsPage() {
  const { data: needs, isLoading, error, refetch } = useNeedsWithLocations()

  const grouped = PRIORITY_ORDER.map((priority) => ({
    priority,
    label: PRIORITY_LABELS[priority],
    icon: PRIORITY_ICONS[priority],
    items: (needs ?? []).filter((n) => n.priority === priority),
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg sm:text-xl font-bold mb-2">Necesidades</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Solo el coordinador del hospital o acopio actualiza estos datos cuando llega ayuda o cambia
        la situación. Si ves &quot;probablemente desactualizado&quot;, confirma con el sitio antes
        de ir.
      </p>

      {isLoading && <LoadingSpinner />}

      {error && <ErrorMessage title="Error al cargar necesidades" onRetry={() => refetch()} />}

      {!isLoading && !error && needs && (
        <>
          {needs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aún no hay necesidades publicadas. Los coordinadores las agregan desde su panel.
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) =>
                group.items.length > 0 ? (
                  <div key={group.priority}>
                    <h2 className="font-semibold mb-3 text-sm sm:text-base">
                      {group.icon} {group.label}
                    </h2>
                    <div className="space-y-2">
                      {group.items.map((need) => (
                        <NeedCard key={need.id} need={need} />
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
