'use client'

interface HeaderMinimalistaProps {
  statusLabel?: 'online' | 'degraded' | 'offline'
  onOpenCommandPanel?: () => void
  isCommandPanelOpen?: boolean
}

const STATUS_STYLES: Record<NonNullable<HeaderMinimalistaProps['statusLabel']>, string> = {
  online: 'bg-semantic-operational',
  degraded: 'bg-semantic-alert',
  offline: 'bg-semantic-saturated',
}

export function HeaderMinimalista({
  statusLabel = 'online',
  onOpenCommandPanel,
  isCommandPanelOpen = false,
}: HeaderMinimalistaProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-white/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[500px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[statusLabel]}`} />
          <p className="m-0 text-sm font-semibold text-slate-800">FaroVen Operativo</p>
        </div>
        <button
          type="button"
          onClick={onOpenCommandPanel}
          aria-expanded={isCommandPanelOpen}
          aria-controls="command-panel-sheet"
          aria-label="Abrir acciones rápidas de coordinador"
          className="rounded-xl border border-white/20 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-[0.98]"
        >
          Comandos
        </button>
      </div>
    </header>
  )
}
