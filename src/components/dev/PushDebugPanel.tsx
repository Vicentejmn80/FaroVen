import { useCallback, useEffect, useState } from 'react'
import {
  clearPushDebugLogs,
  getPushDebugLogs,
  isPushDebugPanelEnabled,
} from '@/lib/push-debug-buffer'

/** Panel flotante para ver logs push en el teléfono (sin Mac / Web Inspector). */
export function PushDebugPanel() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<string[]>(() => [...getPushDebugLogs()])
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    setLogs([...getPushDebugLogs()])
  }, [])

  useEffect(() => {
    const onLog = () => refresh()
    window.addEventListener('faro:push-debug-log', onLog)
    return () => window.removeEventListener('faro:push-debug-log', onLog)
  }, [refresh])

  const copyLogs = async () => {
    const text = logs.length ? logs.join('\n') : 'Sin logs push todavía.'
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copia estos logs:', text)
    }
  }

  if (!isPushDebugPanelEnabled()) return null

  return (
    <div className="fixed bottom-20 left-3 z-[96] max-w-[94vw] sm:bottom-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-amber-400/40 bg-amber-950/90 px-3 py-2 text-xs font-medium text-amber-100 shadow-lg"
      >
        {open ? 'Ocultar logs push' : `Logs push (${logs.length})`}
      </button>
      {open && (
        <div className="mt-2 max-h-[50vh] w-[min(420px,94vw)] overflow-hidden rounded-2xl border border-amber-400/30 bg-black/90 shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <p className="text-xs font-medium text-amber-100">Debug push (piloto)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  clearPushDebugLogs()
                  refresh()
                }}
                className="text-[11px] text-ink-subtle underline"
              >
                Limpiar
              </button>
              <button type="button" onClick={() => void copyLogs()} className="text-[11px] text-info underline">
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className="max-h-[40vh] overflow-y-auto p-3 font-mono text-[10px] leading-relaxed text-white/90">
            {logs.length === 0 ? (
              <p className="text-ink-subtle">Activa alertas push para ver pasos aquí.</p>
            ) : (
              logs.map((line, i) => (
                <p key={`${i}-${line}`} className="mb-1 break-all">
                  {line}
                </p>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
