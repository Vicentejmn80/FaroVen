'use client'

import { useState } from 'react'
import { EmergencySheet } from '../sheets/emergency-sheet'
import { supabase } from '../../lib/supabase/client'

interface CommandPanelProps {
  open: boolean
  onClose: () => void
}

const QUICK_ACTIONS = [
  {
    id: 'incident',
    emoji: '🚨',
    title: 'Incidente crítico',
    description: 'Publicar saturación roja inmediata.',
    payload: {
      centro_tipo: 'hospital',
      saturacion: 'rojo',
      insumos_criticos: ['triaje', 'emergencia'],
      personas_count: 0,
    },
  },
  {
    id: 'supply',
    emoji: '📦',
    title: 'Pulso de acopio',
    description: 'Actualizar estado de capacidad (amarillo).',
    payload: {
      centro_tipo: 'acopio',
      saturacion: 'amarillo',
      insumos_criticos: ['agua', 'medicinas'],
      personas_count: null,
    },
  },
  {
    id: 'shelter',
    emoji: '🏠',
    title: 'Pulso de refugio',
    description: 'Marcar refugio operativo (verde).',
    payload: {
      centro_tipo: 'refugio',
      saturacion: 'verde',
      insumos_criticos: [],
      personas_count: 0,
    },
  },
] as const

export function CommandPanel({ open, onClose }: CommandPanelProps) {
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const sendQuickPulse = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const optimisticId = `opt-${Date.now()}-${action.id}`
    setSendingId(action.id)
    setFeedback('Enviando...')

    window.dispatchEvent(
      new CustomEvent('operational-report:optimistic', {
        detail: {
          id: optimisticId,
          siteLabel: action.title,
          saturation: action.payload.saturacion,
        },
      })
    )

    const { error } = await supabase.from('operational_reports').insert({
      ...action.payload,
      timestamp: new Date().toISOString(),
    })

    if (error) {
      window.dispatchEvent(
        new CustomEvent('operational-report:rollback', {
          detail: { id: optimisticId },
        })
      )
      setFeedback('No se pudo enviar. Reintenta.')
      setSendingId(null)
      return
    }

    window.dispatchEvent(
      new CustomEvent('operational-report:confirm', {
        detail: { id: optimisticId },
      })
    )
    setFeedback('Enviado ✓')
    setSendingId(null)
  }

  return (
    <EmergencySheet open={open} onClose={onClose} title="Comandos del coordinador">
      <div id="command-panel-sheet" className="space-y-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => void sendQuickPulse(action)}
            className="block rounded-2xl border border-white/20 bg-white/75 p-3 shadow-sm backdrop-blur-md transition active:scale-[0.99]"
          >
            <p className="m-0 text-sm font-semibold text-slate-900">
              <span aria-hidden>{action.emoji}</span> {action.title}
            </p>
            <p className="m-0 mt-1 text-xs text-slate-600">{action.description}</p>
            {sendingId === action.id && (
              <p className="m-0 mt-2 text-[11px] font-semibold text-slate-500">Enviando...</p>
            )}
          </button>
        ))}
        {feedback && <p className="m-0 pt-1 text-xs text-slate-500">{feedback}</p>}
      </div>
    </EmergencySheet>
  )
}
