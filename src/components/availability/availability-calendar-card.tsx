import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Check, X, Calendar } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { useAuth } from '@/store/auth-context'
import { useWeeklyAvailability, useCoverageSummary, useToggleSlot } from '@/hooks/useAvailability'
import { cn } from '@/lib/utils'
import { HOURS } from '@/domain/availability.types'
import type { AvailabilityDay, AvailabilitySlot } from '@/domain/availability.types'

function DayCard({
  day,
  selected,
  onClick,
}: {
  day: AvailabilityDay
  selected: boolean
  onClick: () => void
}) {
  const hasHours = day.totalHours > 0

  return (
    <button type="button" onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-2xl p-2.5 transition-all min-w-[52px]',
        selected
          ? 'bg-info/15 ring-1 ring-info/40'
          : 'bg-white/[0.04] hover:bg-white/[0.06]',
        day.isToday && !selected && 'ring-1 ring-white/[0.08]',
      )}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-ink-subtle">{day.dayName}</span>
      <span className={cn(
        'text-lg font-semibold leading-none',
        day.isToday ? 'text-info' : 'text-ink',
      )}>{day.dayNumber}</span>
      {hasHours ? (
        <span className="flex items-center gap-0.5 text-[10px] text-operational">
          <Check className="h-3 w-3" strokeWidth={2.5} />
          {day.totalHours}h
        </span>
      ) : day.isFuture ? (
        <span className="text-[10px] text-ink-faint">—</span>
      ) : null}
    </button>
  )
}

function HourSelectorModal({
  day,
  slots,
  userId,
  onClose,
}: {
  day: { date: string; dayName: string; dayNumber: number }
  slots: AvailabilitySlot[]
  userId: string
  onClose: () => void
}) {
  const toggleMutation = useToggleSlot(userId)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle')

  const slotMap = useMemo(() => {
    const map = new Map<number, boolean>()
    for (const s of slots) {
      map.set(s.hour, s.available)
    }
    return map
  }, [slots])

  const availableCount = useMemo(() => {
    let count = 0
    slotMap.forEach((v) => { if (v) count++ })
    return count
  }, [slotMap])

  const handleToggle = useCallback(async (hour: number) => {
    setSavingState('saving')
    try {
      await toggleMutation.mutateAsync({ date: day.date, hour })
      setSavingState('synced')
      setTimeout(() => setSavingState('idle'), 1500)
    } catch {
      setSavingState('error')
      setTimeout(() => setSavingState('idle'), 3000)
    }
  }, [day.date, toggleMutation])

  const dateObj = new Date(day.date + 'T12:00:00')
  const fullLabel = dateObj.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })

  const [visible, setVisible] = useState(true)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => { setVisible(false); setTimeout(onClose, 250) }}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="glass-strong mx-auto w-full max-w-sm rounded-3xl p-5 shadow-2xl">
            <div className="mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold text-ink">{fullLabel}</p>
                  <p className="text-sm text-ink-subtle mt-0.5">
                    Selecciona las horas durante las cuales FARO puede contar contigo
                  </p>
                </div>
                <button type="button" onClick={() => { setVisible(false); setTimeout(onClose, 250) }}
                  className="rounded-full p-1.5 text-ink-subtle hover:bg-white/10 hover:text-ink transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-ink-subtle">
                <span>{availableCount} horas seleccionadas</span>
                <span className="text-ink-faint">&middot;</span>
                {savingState === 'saving' && <span className="text-info">Guardando…</span>}
                {savingState === 'synced' && <span className="text-operational">Sincronizado</span>}
                {savingState === 'error' && <span className="text-critical">Error al guardar</span>}
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-0.5 pr-1">
              {HOURS.map((hour) => {
                const isAvailable = slotMap.get(hour) ?? false
                return (
                  <button key={hour} type="button" onClick={() => handleToggle(hour)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all',
                      isAvailable
                        ? 'bg-info/10 text-ink'
                        : 'text-ink-subtle hover:bg-white/[0.04]',
                    )}>
                    <span className="text-sm font-medium tabular-nums">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                    <motion.span
                      key={isAvailable ? 'on' : 'off'}
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold',
                        isAvailable
                          ? 'bg-info text-white'
                          : 'bg-white/[0.06] text-ink-faint',
                      )}>
                      {isAvailable ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" />}
                    </motion.span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <p className="text-xs text-ink-subtle text-center">
                {availableCount > 0
                  ? `FARO puede contar contigo ${availableCount} horas este día`
                  : 'Sin disponibilidad para este día'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AvailabilityCalendarCard() {
  const { profile } = useAuth()
  const userId = profile?.id
  const userName = profile?.full_name ?? ''

  const { data: week, isLoading } = useWeeklyAvailability(userId)
  const { data: coverage } = useCoverageSummary(userId, userName)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const selectedDay = useMemo(
    () => week?.days.find((d) => d.date === selectedDate) ?? null,
    [week, selectedDate],
  )

  if (isLoading) {
    return (
      <GlassCard className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-20 w-[52px] animate-pulse rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </GlassCard>
    )
  }

  if (!week) return null

  const today = week.days.find((d) => d.isToday)
  const nextAvailability = coverage?.nextAvailability

  return (
    <>
      <GlassCard className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-info" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink">Disponibilidad Operacional</p>
            </div>
            <p className="text-xs text-ink-subtle">Esta semana</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-info">{week.totalHours}</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-subtle">horas disponibles</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {week.days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              selected={selectedDate === day.date}
              onClick={() => setSelectedDate(day.date)}
            />
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-3 space-y-1">
          {nextAvailability ? (
            <div className="flex items-center gap-2 text-xs text-ink-subtle">
              <Calendar className="h-3.5 w-3.5 text-operational" strokeWidth={1.75} />
              <span>
                Próxima disponibilidad:{' '}
                <strong className="text-ink">
                  {new Date(nextAvailability.date + 'T' + String(nextAvailability.hour).padStart(2, '0') + ':00:00')
                    .toLocaleDateString('es-VE', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                </strong>
              </span>
            </div>
          ) : (
            <p className="text-xs text-ink-subtle">No registraste disponibilidad para esta semana</p>
          )}

          {today && today.totalHours > 0 && (
            <div className="flex items-center gap-2 text-xs text-ink-subtle">
              <Check className="h-3.5 w-3.5 text-operational" strokeWidth={2.5} />
              <span>
                Hoy disponible:{' '}
                <strong className="text-ink">
                  {today.slots
                    .filter((s) => s.available)
                    .map((s) => `${String(s.hour).padStart(2, '0')}:00`)
                    .join(', ')}
                </strong>
              </span>
            </div>
          )}

          {today && today.totalHours === 0 && (
            <p className="text-xs text-ink-muted">No registraste disponibilidad para hoy.</p>
          )}
        </div>
      </GlassCard>

      <AnimatePresence>
        {selectedDay && selectedDate && (
          <HourSelectorModal
            key={selectedDate}
            day={{ date: selectedDate, dayName: selectedDay.dayName, dayNumber: selectedDay.dayNumber }}
            slots={selectedDay.slots}
            userId={userId!}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
