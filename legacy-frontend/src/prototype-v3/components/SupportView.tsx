import { useState } from 'react'
import { useSupportResources, useSubmitSupportRequest, type SubmitSupportRequestInput } from '@/hooks/useAdmin'
import type { SupportResource, SupportContactMethod } from '@/lib/types'
import { SUPPORT_KIND_LABELS, SUPPORT_KIND_EMOJI } from '@/lib/types'
import { SectionGuide } from './SectionGuide'
import { ViewHint } from './ViewHint'
import { getNavHint } from '../lib/nav-config'

/* ----------------------------------------------------------------- utils */
const MODALITY_LABEL: Record<string, string> = {
  phone: 'Teléfono',
  whatsapp: 'WhatsApp',
  video: 'Video',
  in_person: 'Presencial',
}

function ModalityPills({ list }: { list: string[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {list.map((m) => (
        <span
          key={m}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            background: '#f0f4ff',
            color: '#2c3572',
            border: '1px solid #dde3ff',
            fontWeight: 600,
          }}
        >
          {MODALITY_LABEL[m] ?? m}
        </span>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------- resource card */
function ResourceCard({ res }: { res: SupportResource }) {
  const kindLabel = SUPPORT_KIND_LABELS[res.kind]
  const emoji = SUPPORT_KIND_EMOJI[res.kind]
  const canContact = !!res.contact

  return (
    <div
      className="pv3-card"
      style={{
        border: res.is_emergency ? '1.5px solid #f2b4b4' : undefined,
        background: res.is_emergency ? '#fff9f9' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 12, color: '#6b7686', fontWeight: 600 }}>
            {emoji} {kindLabel}
          </span>
          <h3 style={{ margin: '3px 0 0', fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em' }}>
            {res.name}
          </h3>
        </div>
        {res.is_emergency && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              background: '#f2b4b4',
              color: '#7d1f1f',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Crisis 24/7
          </span>
        )}
      </div>

      {res.description && (
        <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 8px', lineHeight: 1.45 }}>
          {res.description}
        </p>
      )}

      {res.specialties.length > 0 && (
        <p style={{ fontSize: 12, color: '#5f6373', margin: '0 0 6px' }}>
          {res.specialties.join(' · ')}
        </p>
      )}

      {res.availability && (
        <p style={{ fontSize: 12, color: '#9aa3b2' }}>🕐 {res.availability}</p>
      )}

      <ModalityPills list={res.modality} />

      {canContact && (
        <a
          href={
            res.kind === 'crisis_line'
              ? `tel:${res.contact}`
              : res.modality.includes('whatsapp')
                ? `https://wa.me/${(res.contact ?? '').replace(/\D/g, '')}`
                : undefined
          }
          target={res.kind !== 'crisis_line' ? '_blank' : undefined}
          rel="noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 10,
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 13px',
            borderRadius: 8,
            background: res.is_emergency ? '#1a1a2e' : 'transparent',
            color: res.is_emergency ? '#fff' : '#1a1a2e',
            border: '0.5px solid #1a1a2e',
            textDecoration: 'none',
          }}
        >
          {res.is_emergency ? `📞 Llamar a ${res.contact}` : `Contactar · ${res.contact}`}
        </a>
      )}
    </div>
  )
}

/* -------------------------------------------- companion request form */
const FOR_WHOM_OPTIONS = [
  { value: 'self', label: 'Para mí mismo/a' },
  { value: 'child', label: 'Para un niño/a' },
  { value: 'family', label: 'Para mi familia' },
  { value: 'other', label: 'Para otra persona' },
] as const

const TOPIC_OPTIONS = [
  'No sé cómo me siento',
  'Ansiedad o pánico',
  'Duelo / pérdida',
  'Miedo / incertidumbre',
  'No puedo dormir',
  'Situación con niños',
  'Apoyo para familia',
  'Otro',
]

const CONTACT_OPTIONS: { value: SupportContactMethod; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'none', label: 'Solo quiero información, no me contacten' },
]

interface RequestFormProps {
  notify: (msg: string) => void
}

function RequestForm({ notify }: RequestFormProps) {
  const [forWhom, setForWhom] = useState<'self' | 'child' | 'family' | 'other'>('self')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [contactMethod, setContactMethod] = useState<SupportContactMethod>('whatsapp')
  const [contactValue, setContactValue] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [consent, setConsent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useSubmitSupportRequest()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) {
      setError('Debes aceptar el aviso de privacidad.')
      return
    }
    if (contactMethod !== 'none' && !contactValue.trim()) {
      setError('Ingresa tu número o forma de contacto.')
      return
    }
    setError(null)

    const payload: SubmitSupportRequestInput = {
      for_whom: forWhom,
      topic: topic || null,
      description: description.trim() || null,
      contact_method: contactMethod,
      contact_value: contactMethod !== 'none' ? contactValue.trim() : null,
      urgent,
      consent: true,
    }

    try {
      await mutation.mutateAsync(payload)
      setDone(true)
      notify('Solicitud enviada. Un psicólogo/a te contactará pronto.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar. Intenta de nuevo.')
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '28px 14px' }}>
        <p style={{ fontSize: 36 }}>💙</p>
        <h3 style={{ margin: '10px 0 6px', fontSize: 16, fontWeight: 700 }}>
          Solicitud recibida
        </h3>
        <p style={{ fontSize: 13.5, color: '#5f6373', maxWidth: 340, margin: '0 auto 16px' }}>
          Un/a psicólogo/a voluntario/a se pondrá en contacto contigo pronto. Tu información es
          confidencial.
        </p>
        <button
          className="pv3-btn"
          onClick={() => {
            setDone(false)
            setConsent(false)
            setTopic('')
            setDescription('')
            setContactValue('')
          }}
        >
          Nueva solicitud
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div>
        <label className="pv3-label">¿Para quién es?</label>
        <div style={{ display: 'grid', gap: 6, marginTop: 5 }}>
          {FOR_WHOM_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                border: '0.5px solid',
                borderColor: forWhom === o.value ? '#1a1a2e' : 'var(--pv3-line, rgba(26,26,46,.14))',
                borderRadius: 8,
                padding: '9px 11px',
                background: forWhom === o.value ? '#f0f4ff' : '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="forWhom"
                value={o.value}
                checked={forWhom === o.value}
                onChange={() => setForWhom(o.value)}
                style={{ accentColor: '#1a1a2e' }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="pv3-label">¿Qué está pasando? (opcional)</label>
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="pv3-input"
          style={{ marginTop: 5 }}
        >
          <option value="">Elegir (o escribe abajo)</option>
          {TOPIC_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className="pv3-label">Cuéntanos más, si quieres (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="pv3-input"
          placeholder="Puedes escribir lo que necesites. Nadie lo leerá excepto el equipo de apoyo."
          style={{ minHeight: 90, resize: 'vertical', marginTop: 5 }}
        />
      </div>

      <div>
        <label className="pv3-label">¿Cómo te contactamos?</label>
        <div style={{ display: 'grid', gap: 6, marginTop: 5 }}>
          {CONTACT_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                border: '0.5px solid',
                borderColor: contactMethod === o.value ? '#1a1a2e' : 'var(--pv3-line, rgba(26,26,46,.14))',
                borderRadius: 8,
                padding: '9px 11px',
                background: contactMethod === o.value ? '#f0f4ff' : '#fff',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="contactMethod"
                value={o.value}
                checked={contactMethod === o.value}
                onChange={() => setContactMethod(o.value)}
                style={{ accentColor: '#1a1a2e' }}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      {contactMethod !== 'none' && (
        <div>
          <label className="pv3-label">
            {contactMethod === 'whatsapp' ? 'Número de WhatsApp' : 'Número de teléfono'}
          </label>
          <input
            type="tel"
            value={contactValue}
            onChange={(e) => setContactValue(e.target.value)}
            className="pv3-input"
            placeholder="+58 4XX XXX XXXX"
            style={{ marginTop: 5 }}
          />
        </div>
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 13,
          color: '#5f6373',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <input
          type="checkbox"
          checked={urgent}
          onChange={(e) => setUrgent(e.target.checked)}
          style={{ marginTop: 2, accentColor: '#dc2626' }}
        />
        <span>
          <strong style={{ color: '#1a1a2e' }}>Es urgente</strong> — necesito hablar con alguien
          lo antes posible.
        </span>
      </label>

      <div
        style={{
          background: '#eef1ff',
          border: '0.5px solid #d2d8ff',
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 12,
          color: '#2f3261',
          lineHeight: 1.45,
        }}
      >
        Tu información es confidencial. Solo el equipo de apoyo y el psicólogo/a asignado/a la
        verá. No se publica ni se comparte con terceros.
      </div>

      <label
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, cursor: 'pointer', lineHeight: 1.4 }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 2, accentColor: '#1a1a2e' }}
          required
        />
        <span>Acepto que el equipo de FARO comparta mi solicitud con el psicólogo/a voluntario/a asignado/a para recibir acompañamiento.</span>
      </label>

      {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

      <button
        type="submit"
        className="pv3-btn pv3-btn--primary"
        disabled={mutation.isPending || !consent}
      >
        {mutation.isPending ? 'Enviando…' : 'Pedir acompañamiento'}
      </button>
    </form>
  )
}

/* -------------------------------------------------------- main view */
interface SupportViewProps {
  notify: (msg: string) => void
  onBack: () => void
}

export function SupportView({ notify, onBack }: SupportViewProps) {
  const { data: resources, isLoading } = useSupportResources()
  const [tab, setTab] = useState<'directory' | 'request'>('directory')

  const emergency = (resources ?? []).filter((r) => r.is_emergency)
  const rest = (resources ?? []).filter((r) => !r.is_emergency)

  return (
    <div>
      <div className="pv3-view-header">
        <div>
          <h2 className="pv3-view-title">Apoyo emocional</h2>
          <ViewHint>{getNavHint('support')}</ViewHint>
        </div>
        <button className="pv3-btn" onClick={onBack}>Volver</button>
      </div>

      <SectionGuide id="support">
        <strong>Crisis</strong> — líneas 24/7 para riesgo inmediato (llamar directamente).{' '}
        <strong>Acompañamiento</strong> — psicólogos/as voluntarios/as que te contactan con calma;
        usa la pestaña &quot;Pedir acompañamiento&quot; para solicitarlo de forma confidencial.
      </SectionGuide>

      <div
        style={{
          background: '#fef9f0',
          border: '0.5px solid #fde4a0',
          borderRadius: 10,
          padding: '10px 13px',
          fontSize: 13,
          color: '#7c4b00',
          lineHeight: 1.45,
          marginBottom: 16,
        }}
      >
        <strong>Si hay riesgo inmediato para tu vida o la de alguien, llama a emergencias (911) ahora.</strong>{' '}
        Las opciones de abajo son complementarias, no reemplazan la atención de crisis.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={`pv3-btn ${tab === 'directory' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setTab('directory')}
        >
          Directorio
        </button>
        <button
          className={`pv3-btn ${tab === 'request' ? 'pv3-btn--primary' : ''}`}
          onClick={() => setTab('request')}
        >
          Pedir acompañamiento
        </button>
      </div>

      {tab === 'directory' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {isLoading ? (
            <p style={{ color: '#9aa3b2', fontSize: 13, padding: '16px 0' }}>Cargando recursos…</p>
          ) : (
            <>
              {emergency.length > 0 && (
                <>
                  <p style={{ fontSize: 11, color: '#9aa3b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    Líneas de crisis
                  </p>
                  {emergency.map((r) => <ResourceCard key={r.id} res={r} />)}
                </>
              )}
              {rest.length > 0 && (
                <>
                  <p style={{ fontSize: 11, color: '#9aa3b2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 6 }}>
                    Apoyo y actividades
                  </p>
                  {rest.map((r) => <ResourceCard key={r.id} res={r} />)}
                </>
              )}
              {!emergency.length && !rest.length && (
                <p style={{ color: '#9aa3b2', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                  No hay recursos cargados todavía. El equipo de FARO los irá agregando.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'request' && (
        <div className="pv3-card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 650 }}>
            Solicitar acompañamiento confidencial
          </h3>
          <p style={{ fontSize: 13, color: '#5f6373', marginBottom: 16 }}>
            Un/a psicólogo/a voluntario/a de la red de apoyo se pondrá en contacto contigo. Tu
            información no se publica.
          </p>
          <RequestForm notify={notify} />
        </div>
      )}
    </div>
  )
}
