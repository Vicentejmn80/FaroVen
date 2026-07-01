'use client'

import { useState } from 'react'
import { EmergencySheet } from '../../../components/sheets/emergency-sheet'

export default function ReportarPage() {
  const [open, setOpen] = useState(false)

  return (
    <section className="space-y-3">
      <div className="glass-card p-4">
        <h1 className="m-0 text-lg font-bold">🚨 Reportar</h1>
        <p className="m-0 mt-2 text-sm text-slate-600">
          Base de flujo rápido. El formulario real conectará optimistic updates con Supabase.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir Emergency Sheet
        </button>
      </div>

      <EmergencySheet open={open} title="Reporte rápido" onClose={() => setOpen(false)}>
        <p className="m-0 text-sm text-slate-600">
          Placeholder: formulario de 10 segundos con envío optimista.
        </p>
      </EmergencySheet>
    </section>
  )
}
