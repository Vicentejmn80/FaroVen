import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'warning' | 'info'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLE: Record<ToastTone, string> = {
  success: 'bg-operational/15 border-operational/30 text-operational',
  warning: 'bg-warning/15 border-warning/30 text-warning',
  info: 'bg-info/15 border-info/30 text-info',
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  if (tone === 'success') return <CheckCircle2 className="h-4 w-4" />
  if (tone === 'warning') return <AlertTriangle className="h-4 w-4" />
  return <Info className="h-4 w-4" />
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, tone }].slice(-4))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 3400)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-xl px-4 pb-safe">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm backdrop-blur',
                TONE_STYLE[toast.tone],
              )}
              role="status"
              aria-live="polite"
            >
              <ToastIcon tone={toast.tone} />
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
