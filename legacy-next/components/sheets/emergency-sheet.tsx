'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface EmergencySheetProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

export function EmergencySheet({ open, title, children, onClose }: EmergencySheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.section
            className="w-full max-w-[500px] rounded-t-3xl border border-white/20 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sm"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="m-0 text-base font-semibold text-slate-900">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
