import { useEffect, useMemo, useState } from 'react'
import { useCreateReport } from '@/hooks/useReport'
import { useCoordinatorProfile } from '@/hooks/useCoordinatorProfile'
import { REPORT_TYPE_LABELS, type ReportSiteType, type ReportType } from '@/lib/types'
import { useSiteCards, KIND_LABEL, type SiteCardData, type SiteKind } from '../lib/useSiteCards'
import { LocationPicker, type PickedLocation } from './coordinator/LocationPicker'
import { SectionGuide } from './SectionGuide'
import { ViewHint } from './ViewHint'
import { getNavHint } from '../lib/nav-config'

type SiteReportType = 'need_covered' | 'wrong_info' | 'hospital_changed' | 'other'
type SitePickMode = 'registered' | 'other'

const SITE_REPORT_TYPES: SiteReportType[] = ['need_covered', 'wrong_info', 'hospital_changed', 'other']

const TYPE_EXAMPLES: Record<SiteReportType, string> = {
  need_covered: 'Ej. Llegó una donación de agua potable y ya no falta en ese centro.',
  wrong_info: 'Ej. El mapa dice que falta leche, pero allí tienen suficiente stock.',
  hospital_changed: 'Ej. El servicio de urgencias se movió al edificio B del hospital.',
  other: 'Ej. Cerraron temporalmente la entrada por obras o evacuación.',
}

const STEP_LABELS = ['Paso 1 de 3 — ¿Dónde?', 'Paso 2 de 3 — ¿Qué cambió?', 'Paso 3 de 3 — ¿Cómo lo sabes?']

const SOURCE_OPTIONS = [
  ['personal', 'Estuve allí y lo vi con mis propios ojos'],
  ['org', 'Un responsable del sitio u organización me lo confirmó'],
  ['social', 'Lo vi publicado en redes sociales o un chat'],
] as const

const SITE_KIND_ORDER: SiteKind[] = ['hospital', 'shelter', 'supply_center']

function siteKey(kind: SiteKind, id: string) {
  return `${kind}:${id}`
}

interface ReportViewProps {
  presetSite: SiteCardData | null
  notify: (msg: string) => void
  onDone: () => void
  onBack: () => void
}

function initialFormState(presetSite: SiteCardData | null) {
  return {
    step: 1,
    siteMode: 'registered' as SitePickMode,
    selectedSiteKey: presetSite ? siteKey(presetSite.kind, presetSite.id) : '',
    siteSearch: '',
    otherPlaceName: '',
    otherLocation: null as PickedLocation | null,
    type: 'need_covered' as SiteReportType,
    description: '',
    alias: '',
    sourceType: 'personal' as 'personal' | 'org' | 'social',
    contact: '',
  }
}

function siteOptionLabel(site: SiteCardData) {
  const addr = site.address?.trim()
  return addr ? `${site.name} — ${addr}` : site.name
}

export function ReportView({ presetSite, notify, onDone, onBack }: ReportViewProps) {
  const [form, setForm] = useState(() => initialFormState(presetSite))
  const [submitted, setSubmitted] = useState(false)
  const [showSiteList, setShowSiteList] = useState(false)
  const createReport = useCreateReport()
  const { sites, isLoading: sitesLoading } = useSiteCards()
  const { data: coordinator } = useCoordinatorProfile()

  const {
    step,
    siteMode,
    selectedSiteKey,
    siteSearch,
    otherPlaceName,
    otherLocation,
    type,
    description,
    alias,
    sourceType,
    contact,
  } = form

  const coordinatorSiteKey =
    coordinator?.onboarding_complete && coordinator.site_type && coordinator.site_id
      ? siteKey(coordinator.site_type as SiteKind, coordinator.site_id)
      : null

  useEffect(() => {
    if (presetSite || selectedSiteKey || siteMode !== 'registered') return
    if (coordinatorSiteKey) {
      setForm((prev) => ({ ...prev, selectedSiteKey: coordinatorSiteKey }))
    }
  }, [coordinatorSiteKey, presetSite, selectedSiteKey, siteMode])

  const sitesByKey = useMemo(() => {
    const map = new Map<string, SiteCardData>()
    for (const site of sites) map.set(siteKey(site.kind, site.id), site)
    return map
  }, [sites])

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase()
    const list = q
      ? sites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.address?.toLowerCase().includes(q) ?? false)
        )
      : sites
    return SITE_KIND_ORDER.map((kind) => ({
      kind,
      label: KIND_LABEL[kind],
      sites: list.filter((s) => s.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })).filter((g) => g.sites.length > 0)
  }, [sites, siteSearch])

  const selectedSite = selectedSiteKey ? sitesByKey.get(selectedSiteKey) ?? null : null

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const resetForm = () => {
    setForm(initialFormState(presetSite))
    setSubmitted(false)
    setShowSiteList(false)
  }

  const validateStep1 = () => {
    if (siteMode === 'registered') {
      if (!selectedSiteKey || !selectedSite) {
        notify('Elige un sitio registrado de la lista.')
        return false
      }
      return true
    }
    if (!otherPlaceName.trim()) {
      notify('Indica el nombre del lugar que no está en la lista.')
      return false
    }
    return true
  }

  const next = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !description.trim()) {
      notify('Describe brevemente qué cambió.')
      return
    }
    setField('step', Math.min(3, step + 1) as typeof step)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep1()) {
      setField('step', 1)
      return
    }
    if (!description.trim()) {
      notify('Describe brevemente qué cambió.')
      setField('step', 2)
      return
    }

    const sourceLabel = SOURCE_OPTIONS.find(([value]) => value === sourceType)?.[1] ?? 'Origen no indicado'

    const fullDescription = [`Cambio: ${description.trim()}`, `Origen del reporte: ${sourceLabel}`].join('\n')

    const payload =
      siteMode === 'registered' && selectedSite
        ? {
            type: type as ReportType,
            description: fullDescription,
            reported_by: alias.trim() || 'Ciudadano',
            contact_info: contact.trim() || undefined,
            site_type: selectedSite.kind as ReportSiteType,
            site_id: selectedSite.id,
            site_label: selectedSite.name,
          }
        : {
            type: type as ReportType,
            description: fullDescription,
            reported_by: alias.trim() || 'Ciudadano',
            contact_info: contact.trim() || undefined,
            other_place_name: otherPlaceName.trim(),
            latitude: otherLocation?.latitude ?? null,
            longitude: otherLocation?.longitude ?? null,
          }

    createReport.mutate(payload, {
      onSuccess: () => setSubmitted(true),
      onError: () => notify('No se pudo enviar el reporte. Intenta de nuevo.'),
    })
  }

  const pickSite = (key: string) => {
    setField('selectedSiteKey', key)
    setField('siteSearch', '')
    setShowSiteList(false)
  }

  if (submitted) {
    return (
      <section>
        <div className="pv3-view-header">
          <h2 className="pv3-view-title">Reporte enviado</h2>
        </div>

        <div className="pv3-report-success">
          <div className="pv3-report-success__icon" aria-hidden="true">
            ✓
          </div>
          <h3>Tu reporte está en cola de revisión</h3>
          <p>
            Un coordinador verificará la información antes de publicarla. No reemplaza el dato oficial del
            sitio hasta entonces.
          </p>
          <div className="pv3-form-actions">
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={onDone}>
              Volver al inicio
            </button>
            <button type="button" className="pv3-btn" onClick={resetForm}>
              Enviar otro reporte
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">Reportar un cambio</h2>
          <ViewHint>{getNavHint('report')}</ViewHint>
        </div>
        <button className="pv3-btn" onClick={onBack}>
          Volver a inicio
        </button>
      </div>

      <SectionGuide id="report">
        <p style={{ margin: '0 0 8px' }}>
          <strong>¿Qué es esto?</strong> Reporta un cambio que viste en un hospital, refugio o acopio.
        </p>
        <p style={{ margin: '0 0 6px' }}>
          <strong>¿Cómo funciona?</strong>
        </p>
        <ol className="pv3-report-steps">
          <li>Indica el sitio o zona</li>
          <li>Describe qué cambió y de qué tipo</li>
          <li>Cuéntanos cómo lo sabes</li>
        </ol>
        <p style={{ margin: '8px 0 0' }}>
          Entra en cola de revisión; un coordinador verifica antes de publicarlo.
        </p>
      </SectionGuide>

      <form className="pv3-form" onSubmit={submit}>
        <div className="pv3-step-label">{STEP_LABELS[step - 1]}</div>
        <div className="pv3-progress">
          <span style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="pv3-site-picker">
            <fieldset className="pv3-site-picker__modes">
              <legend>¿Sobre qué sitio?</legend>
              <label className="pv3-option">
                <input
                  type="radio"
                  name="pv3-site-mode"
                  checked={siteMode === 'registered'}
                  onChange={() => setField('siteMode', 'registered')}
                />
                Sitio registrado en FARO
              </label>
              <label className="pv3-option">
                <input
                  type="radio"
                  name="pv3-site-mode"
                  checked={siteMode === 'other'}
                  onChange={() => setField('siteMode', 'other')}
                />
                Otro lugar (no está en la lista)
              </label>
            </fieldset>

            {siteMode === 'registered' && (
              <>
                {presetSite && (
                  <div className="pv3-pill-note">
                    Reportando sobre <strong>{presetSite.name}</strong>. Puedes cambiarlo abajo.
                  </div>
                )}

                {sitesLoading ? (
                  <p className="pv3-site-picker__hint">Cargando sitios…</p>
                ) : (
                  <div className="pv3-site-picker__combobox">
                    <label htmlFor="pv3-site-search">Buscar sitio</label>
                    <input
                      id="pv3-site-search"
                      type="search"
                      value={siteSearch}
                      placeholder="Nombre o dirección…"
                      onChange={(e) => {
                        setField('siteSearch', e.target.value)
                        setShowSiteList(true)
                      }}
                      onFocus={() => setShowSiteList(true)}
                    />

                    {selectedSite && !showSiteList && (
                      <button
                        type="button"
                        className="pv3-site-option pv3-site-option--selected"
                        onClick={() => setShowSiteList(true)}
                      >
                        <span className="pv3-site-option__kind">{KIND_LABEL[selectedSite.kind]}</span>
                        <span className="pv3-site-option__name">{siteOptionLabel(selectedSite)}</span>
                      </button>
                    )}

                    {showSiteList && (
                      <div className="pv3-site-picker__list" role="listbox" aria-label="Sitios registrados">
                        {coordinatorSiteKey && sitesByKey.has(coordinatorSiteKey) && (
                          <div className="pv3-site-picker__group">
                            <p className="pv3-site-picker__group-label">Tu sitio</p>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selectedSiteKey === coordinatorSiteKey}
                              className={`pv3-site-option ${selectedSiteKey === coordinatorSiteKey ? 'pv3-site-option--active' : ''}`}
                              onClick={() => pickSite(coordinatorSiteKey)}
                            >
                              <span className="pv3-site-option__pin">📍</span>
                              <span className="pv3-site-option__name">
                                Mi sitio: {sitesByKey.get(coordinatorSiteKey)!.name}
                              </span>
                            </button>
                          </div>
                        )}

                        {filteredSites.map((group) => (
                          <div key={group.kind} className="pv3-site-picker__group">
                            <p className="pv3-site-picker__group-label">{group.label}</p>
                            {group.sites.map((site) => {
                              const key = siteKey(site.kind, site.id)
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  role="option"
                                  aria-selected={selectedSiteKey === key}
                                  className={`pv3-site-option ${selectedSiteKey === key ? 'pv3-site-option--active' : ''}`}
                                  onClick={() => pickSite(key)}
                                >
                                  <span className="pv3-site-option__name">{siteOptionLabel(site)}</span>
                                </button>
                              )
                            })}
                          </div>
                        ))}

                        {!filteredSites.length && (
                          <p className="pv3-site-picker__hint">No hay coincidencias. Prueba otro término o elige «Otro lugar».</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {siteMode === 'other' && (
              <div className="pv3-site-picker__other">
                <p className="pv3-site-picker__hint">
                  Si no está registrado, describe el lugar. Un administrador lo vinculará.
                </p>
                <label htmlFor="pv3-other-place">Nombre del lugar</label>
                <input
                  id="pv3-other-place"
                  value={otherPlaceName}
                  onChange={(e) => setField('otherPlaceName', e.target.value)}
                  placeholder="Ej. McDonald's Cumbres de Curumo"
                  required={siteMode === 'other'}
                />
                <p className="pv3-site-picker__hint">Ubicación en mapa (opcional)</p>
                <LocationPicker
                  confirmed={otherLocation}
                  onConfirm={(loc) => setField('otherLocation', loc)}
                  onClear={() => setField('otherLocation', null)}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <label htmlFor="pv3-type">¿Qué tipo de cambio?</label>
            <select id="pv3-type" value={type} onChange={(e) => setField('type', e.target.value as SiteReportType)}>
              {SITE_REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {REPORT_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
            <div className="pv3-pill-note pv3-report-examples">{TYPE_EXAMPLES[type]}</div>
            <label htmlFor="pv3-desc">Describe qué cambió</label>
            <textarea
              id="pv3-desc"
              value={description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Sé concreto: qué cambió, cuándo lo notaste y cualquier detalle útil."
            />
          </div>
        )}

        {step === 3 && (
          <div>
            <label>¿Cómo lo sabes?</label>
            <p className="pv3-report-source-hint">Elige la opción que mejor describe tu fuente de información.</p>
            {SOURCE_OPTIONS.map(([value, label]) => (
              <label className="pv3-option" key={value}>
                <input
                  type="radio"
                  name="pv3-source"
                  checked={sourceType === value}
                  onChange={() => setField('sourceType', value)}
                />
                {label}
              </label>
            ))}

            <label htmlFor="pv3-alias">Nombre o alias (opcional)</label>
            <input
              id="pv3-alias"
              value={alias}
              onChange={(e) => setField('alias', e.target.value)}
              placeholder="Ej. Voluntario Ana"
            />

            <label htmlFor="pv3-contact">Contacto (opcional, para verificación)</label>
            <input
              id="pv3-contact"
              value={contact}
              onChange={(e) => setField('contact', e.target.value)}
              placeholder="Teléfono o WhatsApp"
            />

            <div className="pv3-pill-note">
              El reporte queda como <strong>pendiente de verificación</strong>. Se suma a la cola de revisión,
              pero no reemplaza el dato oficial hasta que un coordinador lo apruebe.
            </div>
          </div>
        )}

        <div className="pv3-form-actions">
          <button
            type="button"
            className="pv3-btn"
            onClick={() => setField('step', Math.max(1, step - 1) as typeof step)}
            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
          >
            Paso anterior
          </button>
          {step < 3 ? (
            <button type="button" className="pv3-btn pv3-btn--primary" onClick={next}>
              Siguiente paso
            </button>
          ) : (
            <button type="submit" className="pv3-btn pv3-btn--primary" disabled={createReport.isPending}>
              {createReport.isPending ? 'Enviando…' : 'Enviar reporte'}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
