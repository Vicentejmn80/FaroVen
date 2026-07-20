import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { fieldClassName } from '@/components/faro/flow-sheet'

export interface ReportContactData {
  name: string
  phone: string
  email: string
}

interface ReportContactSheetProps {
  open: boolean
  onClose: () => void
  onContinue: (contact: ReportContactData) => void
}

/**
 * Captura puntual de contacto para un reporte — no crea cuenta.
 */
export function ReportContactSheet({ open, onClose, onContinue }: ReportContactSheetProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleContinue = () => {
    const phoneOk = phone.trim().length >= 7
    const emailOk = email.trim().includes('@')
    if (!phoneOk && !emailOk) {
      setError('Indica un teléfono o un correo para poder contactarte sobre este reporte.')
      return
    }
    setError(null)
    onContinue({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/55"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-contact-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-lg px-3 pb-safe"
          >
            <div className="rounded-t-[20px] border border-[#1C2B40] border-b-0 bg-[#12233A] px-5 pb-6 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#223652]" />
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 id="report-contact-title" className="text-lg font-semibold text-[#F2F6FA]">
                    Datos de contacto
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-[#8CA0B8]">
                    Solo para este reporte. No se crea una cuenta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="tap-target flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#223652] text-[#7690AC]"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#F2F6FA]">Nombre (opcional)</span>
                  <input
                    className={fieldClassName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#F2F6FA]">Teléfono</span>
                  <input
                    className={fieldClassName}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0414-0000000"
                    autoComplete="tel"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-[#F2F6FA]">Correo</span>
                  <input
                    className={fieldClassName}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    autoComplete="email"
                  />
                </label>
                {error && <p className="text-sm text-[#F7C1C1]">{error}</p>}
                <EmergencyButton variant="primary" size="lg" className="w-full !bg-[#2DD4BF] !text-[#0B1626] !shadow-none hover:!bg-[#2DD4BF]/90" onClick={handleContinue}>
                  Continuar al reporte
                </EmergencyButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
