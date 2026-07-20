import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion'
import { MapPin, X } from 'lucide-react'
import { CenterQuickSheet } from '@/components/center/center-profile-sections'
import { CenterTrustStrip } from '@/components/trust/center-trust-strip'
import { EmergencyBadge } from './emergency-badge'
import { useFaro } from '@/store/faro-context'
import { useCenterTrust } from '@/hooks/useCenterTrust'
import { buildMapLink, openExternalNavigation } from '@/lib/utils'
import type { Site } from '@/lib/types'

const APPLE_EASE = [0.32, 0.72, 0, 1] as const
const TRANSITION_MS = 0.22

type SheetState = 'collapsed' | 'medium' | 'expanded'

interface SidePanelProps {
  site: Site | null
  onClose: () => void
  onOpenDetail?: (site: Site) => void
}

let rememberedState: SheetState = 'medium'

const PORTAL_ROOT_ID = 'faro-portals'

function getPortalRoot() {
  return document.getElementById(PORTAL_ROOT_ID) ?? document.body
}

function snapHeights(viewportH: number) {
  const maxSheet = Math.round(viewportH * 0.6)
  return {
    collapsed: Math.max(112, Math.round(viewportH * 0.16)),
    medium: Math.round(viewportH * 0.42),
    expanded: maxSheet,
  }
}

function nearestState(y: number, snaps: ReturnType<typeof snapHeights>): SheetState {
  const entries: Array<{ state: SheetState; y: number }> = [
    { state: 'expanded', y: viewportY(snaps.expanded, snaps) },
    { state: 'medium', y: viewportY(snaps.medium, snaps) },
    { state: 'collapsed', y: viewportY(snaps.collapsed, snaps) },
  ]
  entries.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))
  return entries[0].state
}

/** y offset from top of sheet anchor (0 = fully expanded) */
function viewportY(height: number, snaps: ReturnType<typeof snapHeights>) {
  return snaps.expanded - height
}

/**
 * Bottom Sheet estilo Apple Maps — Framer Motion (estable con React 18).
 * Tres estados: colapsado, medio, expandido. Sin overlay que tape el mapa.
 */
export function SidePanel({ site, onClose, onOpenDetail }: SidePanelProps) {
  const { state } = useFaro()
  const trust = useCenterTrust(site)
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 800,
  )
  const dragY = useMotionValue(0)
  const dragging = useRef(false)

  const snaps = useMemo(() => snapHeights(viewportH), [viewportH])

  const heightFor = useCallback(
    (state: SheetState) => {
      if (state === 'collapsed') return snaps.collapsed
      if (state === 'medium') return snaps.medium
      return snaps.expanded
    },
    [snaps],
  )

  const snapTo = useCallback(
    (state: SheetState, immediate = false) => {
      rememberedState = state
      const targetY = viewportY(heightFor(state), snaps)
      if (immediate) {
        dragY.set(targetY)
        return
      }
      animate(dragY, targetY, { duration: TRANSITION_MS, ease: APPLE_EASE })
    },
    [dragY, heightFor, snaps],
  )

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    if (!site) return
    snapTo(rememberedState, true)
    const id = requestAnimationFrame(() => snapTo(rememberedState))
    return () => cancelAnimationFrame(id)
  }, [site?.id, snapTo])

  const onDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    dragging.current = false
    const currentY = dragY.get()
    const projected = currentY + info.velocity.y * 0.18
    if (!site) return

    if (projected > viewportY(snaps.collapsed, snaps) + 80) {
      onClose()
      return
    }

    const target = nearestState(projected, snaps)
    if (target === 'expanded') {
      onOpenDetail?.(site)
      return
    }
    snapTo(target)
  }

  if (!site) return null
  const center = state.centers.find((item) => item.id === site.id)
  const address = center?.location.address ?? site.zone
  const topNeeds = site.needs.slice(0, 3).map((need) => need.item)
  const hiddenNeeds = Math.max(0, site.needs.length - topNeeds.length)
  const confidence = site.verified ? 'Verificado' : 'Pendiente'
  const priorityScore = site.needs.reduce(
    (acc, need) =>
      Math.max(
        acc,
        need.priority === 'critical' ? 3 : need.priority === 'high' ? 2 : need.priority === 'medium' ? 1 : 0,
      ),
    0,
  )
  const priority = priorityScore >= 3 ? 'Alta' : priorityScore >= 2 ? 'Media' : 'Baja'

  const onNavigate = () => {
    openExternalNavigation({
      lat: site.lat,
      lng: site.lng,
      name: site.name,
      address,
    })
  }
  const onShare = async () => {
    const text = `${site.name} · ${address}. Actualizado recientemente en FARO.`
    const url = buildMapLink(site.lat, site.lng) ?? window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: site.name, text, url })
        return
      } catch {
        // fallback below
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
  }

  const sheet = (
    <motion.aside
      role="dialog"
      aria-modal="false"
      aria-label={`Detalle de ${site.name}`}
      className="glass-strong absolute inset-x-0 bottom-0 w-full rounded-t-3xl border-t border-white/10 shadow-[0_-16px_38px_rgba(0,0,0,0.42)]"
      style={{
        height: snaps.expanded,
        y: dragY,
        touchAction: 'none',
      }}
      initial={false}
      drag="y"
      dragConstraints={{
        top: viewportY(snaps.expanded, snaps),
        bottom: viewportY(snaps.collapsed, snaps) + 40,
      }}
      dragElastic={0.04}
      onDragStart={() => {
        dragging.current = true
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Handle + header (zona de arrastre) */}
        <div className="shrink-0 cursor-grab px-4 pt-3 active:cursor-grabbing">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{site.name}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-subtle">
                <MapPin className="h-3 w-3 shrink-0" /> {site.zone}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full p-2 text-ink-subtle transition-colors hover:bg-white/10 hover:text-ink"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <EmergencyBadge status={site.status} />
            <span className="text-sm text-ink-muted">{site.statusLabel}</span>
          </div>
        </div>

        {/* Contenido según estado */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-safe">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: TRANSITION_MS, ease: APPLE_EASE }}
            className="mt-2 pb-4"
          >
            {trust && <CenterTrustStrip snapshot={trust} compact className="mb-3" />}
            <CenterQuickSheet
              site={site}
              address={address}
              confidence={confidence}
              priority={priority}
              topNeeds={topNeeds}
              hiddenNeeds={hiddenNeeds}
              onNavigate={onNavigate}
              onShare={onShare}
              onOpenDetail={() => onOpenDetail?.(site)}
            />
          </motion.div>
        </div>
      </div>
    </motion.aside>
  )

  return createPortal(sheet, getPortalRoot())
}
