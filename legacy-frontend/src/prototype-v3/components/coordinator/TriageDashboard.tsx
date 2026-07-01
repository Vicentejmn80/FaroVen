import { useState } from 'react'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { useLocationNeeds, useQuickUpdate } from '@/hooks/useQuickUpdate'
import { useSiteSaturation, useUpdateSiteSaturation } from '@/hooks/useSiteSaturation'
import type { CoordinatorSiteType, Need, NeedPriority } from '@/lib/types'
import { PRIORITY_LABELS } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import {
  ROLE_ACTIONS,
  SITE_LABELS,
  computeStatus,
  latestNeed,
  sortNeedsByUrgency,
  type ActionId,
} from '../../lib/triage-config'
import { ActionSheet } from './ActionSheet'
import { PrimaryActions } from './PrimaryActions'
import { StatusCard } from './StatusCard'
import { PersonListView } from './PersonListView'

interface TriageDashboardProps {
  notify: (msg: string) => void
  onEditProfile: () => void
  onOpenAdmin: () => void
  onSignOut: () => void
  isAdmin: boolean
}

export function TriageDashboard({
  notify,
  onEditProfile,
  onOpenAdmin,
  onSignOut,
  isAdmin,
}: TriageDashboardProps) {
  const { data: profile } = useCoordinatorProfile()
  const { data: needs = [], dataUpdatedAt } = useLocationNeeds(profile?.site_type, profile?.site_id)
  const { data: notAccepts } = useSiteSaturation()
  const [activeAction, setActiveAction] = useState<ActionId | null>(null)

  if (!profile) return null

  const status = computeStatus(needs, notAccepts)
  const actions = ROLE_ACTIONS[profile.site_type]
  const syncLabel = dataUpdatedAt ? `sincronizado ${timeAgo(new Date(dataUpdatedAt))}` : ''

  const close = () => setActiveAction(null)
  const doneAndClose = (msg: string) => {
    notify(msg)
    close()
  }

  const sheetTitle: Record<ActionId, string> = {
    receive: profile.site_type === 'hospital' ? 'Ingresó inventario' : 'Recibí donaciones',
    saturate: 'Ya no aceptamos',
    need: profile.site_type === 'hospital' ? 'Alerta suministros' : 'Necesitamos urgente',
    persons: profile.site_type === 'hospital' ? 'Registrar pacientes' : 'Registrar personas',
  }

  return (
    <div className="triage">
      <div className="triage-header">
        <div className="triage-header__left">
          <span className="triage-site-name">{profile.site_name}</span>
          <span className="triage-site-type">{SITE_LABELS[profile.site_type]}</span>
        </div>
        <div className="triage-header__right">
          {syncLabel && <span className="triage-sync">{syncLabel}</span>}
          <button type="button" className="triage-header__signout" onClick={onSignOut}>
            Salir
          </button>
        </div>
      </div>

      <StatusCard status={status} hasNeeds={needs.length > 0} notAccepts={notAccepts} />
      <PrimaryActions actions={actions} onAction={setActiveAction} />

      <div className="triage-footer">
        <button type="button" className="triage-footer__link" onClick={onEditProfile}>
          Registro
        </button>
        {isAdmin && (
          <button type="button" className="triage-footer__link" onClick={onOpenAdmin}>
            Admin
          </button>
        )}
      </div>

      {activeAction && (
        <ActionSheet title={sheetTitle[activeAction]} onClose={close}>
          {activeAction === 'receive' && (
            <ReceiveForm
              needs={needs}
              siteType={profile.site_type}
              siteId={profile.site_id}
              onDone={doneAndClose}
            />
          )}
          {activeAction === 'saturate' && profile.site_type === 'supply_center' && (
            <SaturateForm
              siteId={profile.site_id}
              currentItems={notAccepts ?? []}
              onDone={doneAndClose}
            />
          )}
          {activeAction === 'need' && (
            <NeedForm
              needs={needs}
              siteType={profile.site_type}
              siteId={profile.site_id}
              onDone={doneAndClose}
            />
          )}
          {activeAction === 'persons' && (
            <PersonListView
              notify={notify}
              onNeedSite={() => {
                close()
                onEditProfile()
              }}
            />
          )}
        </ActionSheet>
      )}
    </div>
  )
}

interface ReceiveFormProps {
  needs: Need[]
  siteType: CoordinatorSiteType
  siteId: string
  onDone: (msg: string) => void
}

function ReceiveForm({ needs, siteType, siteId, onDone }: ReceiveFormProps) {
  const mutation = useQuickUpdate()
  const urgent = sortNeedsByUrgency(needs).slice(0, 6)
  const defaultNeed = urgent[0] ?? null

  const [selected, setSelected] = useState<Need | null>(defaultNeed)
  const [itemName, setItemName] = useState(defaultNeed?.item_name ?? '')
  const [qty, setQty] = useState(String(defaultNeed?.qty_received ?? 0))
  const [unit, setUnit] = useState(defaultNeed?.unit ?? 'unidades')

  const pick = (n: Need) => {
    setSelected(n)
    setItemName(n.item_name)
    setQty(String(n.qty_received))
    setUnit(n.unit)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) return
    await mutation.mutateAsync({
      needable_type: siteType,
      needable_id: siteId,
      item_name: itemName.trim(),
      priority: selected?.priority ?? 'medium',
      qty_required: selected?.qty_required ?? 100,
      qty_received: Number(qty) || 0,
      unit: unit.trim() || 'unidades',
      notes: selected?.notes ?? undefined,
      existing_need_id: selected?.id,
    })
    onDone(`✓ ${itemName} actualizado`)
  }

  return (
    <form onSubmit={submit} className="triage-form">
      {urgent.length > 0 && (
        <div className="triage-pills">
          {urgent.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`triage-pill triage-pill--${n.priority === 'critical' || n.priority === 'high' ? n.priority : ''} ${selected?.id === n.id ? 'is-active' : ''}`}
              onClick={() => pick(n)}
            >
              {n.item_name}
            </button>
          ))}
        </div>
      )}

      <input
        className="pv3-input"
        value={itemName}
        onChange={(e) => {
          setItemName(e.target.value)
          setSelected(null)
        }}
        placeholder="Insumo"
        required
      />

      <input
        type="number"
        min={0}
        className="triage-qty"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label={`Cantidad recibida (${unit})`}
      />

      <button type="submit" className="triage-submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}

interface SaturateFormProps {
  siteId: string
  currentItems: string[]
  onDone: (msg: string) => void
}

function SaturateForm({ siteId, currentItems, onDone }: SaturateFormProps) {
  const mutation = useUpdateSiteSaturation()
  const [text, setText] = useState(currentItems.join(', '))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await mutation.mutateAsync({ siteId, itemsText: text })
    onDone('✓ Excedentes publicados')
  }

  return (
    <form onSubmit={submit} className="triage-form">
      <textarea
        className="pv3-input"
        style={{ minHeight: 100, resize: 'vertical', fontSize: 15 }}
        placeholder="Ej. cobijas, ropa usada, arroz"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <button type="submit" className="triage-submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}

interface NeedFormProps {
  needs: Need[]
  siteType: CoordinatorSiteType
  siteId: string
  onDone: (msg: string) => void
}

function NeedForm({ needs, siteType, siteId, onDone }: NeedFormProps) {
  const mutation = useQuickUpdate()
  const last = latestNeed(needs)

  const [itemName, setItemName] = useState(last?.item_name ?? '')
  const [priority, setPriority] = useState<NeedPriority>(last?.priority ?? 'critical')
  const [qty, setQty] = useState(String(last?.qty_required ?? 100))
  const [unit, setUnit] = useState(last?.unit ?? 'unidades')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) return
    await mutation.mutateAsync({
      needable_type: siteType,
      needable_id: siteId,
      item_name: itemName.trim(),
      priority,
      qty_required: Number(qty) || 0,
      qty_received: 0,
      unit: unit.trim() || 'unidades',
    })
    onDone(`🆘 ${itemName.trim()} publicado`)
  }

  return (
    <form onSubmit={submit} className="triage-form">
      <input
        className="pv3-input"
        style={{ fontSize: 16, padding: '10px 12px' }}
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        placeholder="¿Qué necesitan?"
        autoFocus
        required
      />

      <div className="triage-pills">
        {(Object.entries(PRIORITY_LABELS) as [NeedPriority, string][]).map(([v, l]) => (
          <button
            key={v}
            type="button"
            className={`triage-pill ${priority === v ? 'is-active' : ''} triage-pill--${v === 'critical' || v === 'high' ? v : ''}`}
            onClick={() => setPriority(v)}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input
          type="number"
          min={0}
          className="pv3-input"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Cantidad necesaria"
        />
        <input
          className="pv3-input"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Unidad"
        />
      </div>

      <button type="submit" className="triage-submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}
