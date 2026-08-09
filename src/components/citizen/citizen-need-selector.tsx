import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useItemsCatalogSearch } from '@/hooks/useItemsCatalog'
import type { ItemsCatalogSearchResult } from '@/repositories/items-catalog-repository'

const PORTAL_ROOT_ID = 'faro-portals'

const COMMON_NEEDS = [
  { id: 'agua', label: 'Agua', query: 'Agua potable' },
  { id: 'alimentos', label: 'Alimentos', query: 'Alimentos' },
  { id: 'medicinas', label: 'Medicinas', query: 'Medicinas' },
  { id: 'refugio', label: 'Refugio', query: 'Refugio' },
  { id: 'ropa', label: 'Ropa', query: 'Ropa' },
  { id: 'energia', label: 'Energía', query: 'Energía' },
  { id: 'otro', label: 'Otro', query: '' },
] as const

function getPortalRoot() {
  return document.getElementById(PORTAL_ROOT_ID) ?? document.body
}

function inferResourceCategory(result: ItemsCatalogSearchResult): string {
  const s = `${result.canonicalName} ${result.key}`.toLowerCase()
  if (/agua|potable|sanit|higiene/.test(s)) return 'Agua y saneamiento'
  if (/alimento|comida|arroz|harina|nutri/.test(s)) return 'Alimentos'
  if (/medic|salud|farmaci|curaci|botiqu/.test(s)) return 'Salud'
  if (/refug|vivienda|techo|alberg/.test(s)) return 'Refugio'
  if (/ropa|vest|abrigo|calzado/.test(s)) return 'Ropa y abrigo'
  if (/energ|generador|luz|electric|combust/.test(s)) return 'Energía'
  return 'Otros recursos'
}

function groupResults(results: ItemsCatalogSearchResult[]) {
  const map = new Map<string, ItemsCatalogSearchResult[]>()
  for (const r of results) {
    const cat = inferResourceCategory(r)
    const list = map.get(cat) ?? []
    list.push(r)
    map.set(cat, list)
  }
  return Array.from(map.entries())
}

export interface CitizenNeedSelectorProps {
  itemQuery: string
  itemId: string | null
  peopleCount: string
  onItemQueryChange: (value: string) => void
  onItemIdChange: (id: string | null) => void
  onPeopleCountChange: (value: string) => void
}

export function CitizenNeedSelector({
  itemQuery,
  itemId,
  peopleCount,
  onItemQueryChange,
  onItemIdChange,
  onPeopleCountChange,
}: CitizenNeedSelectorProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const peopleRef = useRef<HTMLInputElement>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(itemQuery)
  const [activeChipId, setActiveChipId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [inputRect, setInputRect] = useState<DOMRect | null>(null)
  const pendingAutoPick = useRef<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(itemQuery), 250)
    return () => window.clearTimeout(t)
  }, [itemQuery])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  const { data: itemResults = [], isFetching } = useItemsCatalogSearch(debouncedQuery, { limit: 12 })

  const trimmedQuery = itemQuery.trim()
  const showPicker = pickerOpen && trimmedQuery.length >= 2
  const showGrouped = itemResults.length > 4
  const grouped = useMemo(
    () => (showGrouped ? groupResults(itemResults) : null),
    [itemResults, showGrouped],
  )

  const syncInputRect = useCallback(() => {
    const el = searchRef.current
    if (!el) return
    setInputRect(el.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!showPicker) return
    syncInputRect()
    window.addEventListener('resize', syncInputRect)
    window.addEventListener('scroll', syncInputRect, true)
    return () => {
      window.removeEventListener('resize', syncInputRect)
      window.removeEventListener('scroll', syncInputRect, true)
    }
  }, [showPicker, syncInputRect, keyboardInset])

  const selectCatalogItem = useCallback(
    (result: ItemsCatalogSearchResult) => {
      onItemIdChange(result.itemId)
      onItemQueryChange(result.canonicalName)
      setPickerOpen(false)
      pendingAutoPick.current = null
      window.setTimeout(() => peopleRef.current?.focus(), 80)
    },
    [onItemIdChange, onItemQueryChange],
  )

  const selectCustomText = useCallback(() => {
    onItemIdChange(null)
    setPickerOpen(false)
    pendingAutoPick.current = null
    window.setTimeout(() => peopleRef.current?.focus(), 80)
  }, [onItemIdChange])

  useEffect(() => {
    if (!showPicker || isMobile) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (searchRef.current?.contains(target)) return
      const portal = document.getElementById(PORTAL_ROOT_ID)
      if (portal?.contains(target)) return
      setPickerOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [showPicker, isMobile])

  useEffect(() => {
    const token = pendingAutoPick.current
    if (!token || itemResults.length === 0) return
    const exact = itemResults.find(
      (r) =>
        r.canonicalName.toLowerCase() === token.toLowerCase() ||
        r.matchKind.startsWith('exact'),
    )
    selectCatalogItem(exact ?? itemResults[0])
  }, [itemResults, selectCatalogItem])

  const handleChipClick = (chip: (typeof COMMON_NEEDS)[number]) => {
    setActiveChipId(chip.id)
    if (chip.id === 'otro') {
      onItemIdChange(null)
      onItemQueryChange('')
      setPickerOpen(true)
      window.setTimeout(() => searchRef.current?.focus(), 80)
      return
    }
    pendingAutoPick.current = chip.query
    onItemQueryChange(chip.query)
    onItemIdChange(null)
    setDebouncedQuery(chip.query)
    setPickerOpen(false)
  }

  const renderResultButton = (result: ItemsCatalogSearchResult) => (
    <button
      key={result.itemId}
      type="button"
      onClick={() => selectCatalogItem(result)}
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
        itemId === result.itemId ? 'bg-info/15 ring-1 ring-info/30' : 'hover:bg-white/[0.06]',
      )}
    >
      <p className="text-sm font-medium text-ink">{result.canonicalName}</p>
    </button>
  )

  const pickerBody = (
    <div className="space-y-1">
      {isFetching && itemResults.length === 0 && (
        <p className="px-3 py-2 text-xs text-ink-muted">Buscando recursos…</p>
      )}

      {grouped
        ? grouped.map(([category, items]) => (
            <div key={category} className="space-y-0.5">
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {category}
              </p>
              {items.map(renderResultButton)}
            </div>
          ))
        : itemResults.map(renderResultButton)}

      {trimmedQuery.length >= 2 && (
        <button
          type="button"
          onClick={selectCustomText}
          className="mt-1 w-full rounded-xl border border-dashed border-white/[0.14] px-3 py-2.5 text-left transition-colors hover:border-info/40 hover:bg-info/[0.06]"
        >
          <p className="text-sm font-medium text-info">
            &ldquo;{trimmedQuery}&rdquo; — Usar como otro recurso
          </p>
        </button>
      )}
    </div>
  )

  const portalPicker =
    showPicker &&
    createPortal(
      <>
        {isMobile ? (
          <>
            <button
              type="button"
              aria-label="Cerrar sugerencias"
              className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[1px]"
              onClick={() => setPickerOpen(false)}
            />
            <div
              role="listbox"
              aria-label="Recursos sugeridos"
              className="fixed inset-x-0 z-[91] mx-auto flex max-h-[min(52dvh,420px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0b1424]/98 shadow-2xl backdrop-blur-xl"
              style={{ bottom: keyboardInset }}
            >
              <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
                <p className="text-xs font-medium text-ink-muted">Elige un recurso o usa tu texto</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">{pickerBody}</div>
            </div>
          </>
        ) : (
          inputRect && (
            <div
              role="listbox"
              aria-label="Recursos sugeridos"
              className="fixed z-[91] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0b1424]/98 shadow-2xl backdrop-blur-xl"
              style={{
                top: inputRect.bottom + 8,
                left: inputRect.left,
                width: inputRect.width,
                maxHeight: Math.min(320, window.innerHeight - inputRect.bottom - 24),
              }}
            >
              <div className="overflow-y-auto overscroll-contain p-2">{pickerBody}</div>
            </div>
          )
        )}
      </>,
      getPortalRoot(),
    )

  const hasSelection = trimmedQuery.length >= 2

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="citizen-need-search" className="text-sm font-medium text-ink">
          ¿Qué se necesita? <span className="text-critical">*</span>
        </label>
        <p className="text-xs text-ink-muted">Elige una opción común o escribe para buscar.</p>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {COMMON_NEEDS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => handleChipClick(chip)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
                activeChipId === chip.id
                  ? 'border-info/50 bg-info/15 text-info'
                  : 'border-white/[0.1] bg-white/[0.04] text-ink-subtle hover:border-white/[0.18] hover:text-ink',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <input
          id="citizen-need-search"
          ref={searchRef}
          value={itemQuery}
          onChange={(e) => {
            onItemQueryChange(e.target.value)
            onItemIdChange(null)
            setActiveChipId(null)
            pendingAutoPick.current = null
            setPickerOpen(true)
          }}
          onFocus={() => {
            syncInputRect()
            if (trimmedQuery.length >= 2) setPickerOpen(true)
          }}
          placeholder="Ej: Agua potable, oxígeno, pañales…"
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
          autoComplete="off"
          aria-required="true"
          aria-invalid={!hasSelection}
        />

        {hasSelection && (
          <p className="text-xs text-operational">
            {itemId ? 'Recurso del catálogo seleccionado.' : 'Se registrará como recurso personalizado.'}
          </p>
        )}
        {!hasSelection && (
          <p className="text-xs text-ink-muted">Obligatorio para que el gestor pueda operar tu reporte.</p>
        )}
      </div>

      {portalPicker}

      <div className="space-y-1.5">
        <label htmlFor="citizen-people-count" className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Users className="h-4 w-4 text-ink-muted" />
          ¿Para cuántas personas aproximadamente?
        </label>
        <p className="text-xs text-ink-muted">Opcional, pero ayuda mucho a dimensionar la ayuda.</p>
        <input
          id="citizen-people-count"
          ref={peopleRef}
          type="number"
          inputMode="numeric"
          min={1}
          max={99999}
          value={peopleCount}
          onChange={(e) => onPeopleCountChange(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Ej: 12"
          className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-ink placeholder:text-ink-muted outline-none focus:border-info/50"
        />
      </div>
    </div>
  )
}
