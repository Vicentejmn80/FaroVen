import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import { hasPendingAuthCallback } from '@/lib/auth-callback'
import { formatAuthError } from '@/lib/auth-errors'
import { buildV3RedirectUrl } from '../lib/auth-redirect'
import { normalizeVePhone } from '../lib/phone'

type AuthMethod = 'email' | 'sms' | 'google'
type Step = 'pick' | 'email-sent' | 'sms-code'

interface AuthViewProps {
  targetView: 'coordinator' | 'admin'
  onSuccess: () => void
  onBack: () => void
}

export function AuthView({ targetView, onSuccess, onBack }: AuthViewProps) {
  const { session, loading, authError } = useAuth()
  const [method, setMethod] = useState<AuthMethod>('email')
  const [step, setStep] = useState<Step>('pick')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [normalizedPhone, setNormalizedPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const completing = loading || hasPendingAuthCallback()
  const redirectTo = buildV3RedirectUrl(targetView)

  useEffect(() => {
    if (!completing && session) onSuccess()
  }, [completing, session, onSuccess])

  useEffect(() => {
    if (authError) setError(formatAuthError(authError))
  }, [authError])

  const sendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Escribe tu correo.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    })
    setBusy(false)
    if (err) {
      setError(formatAuthError(err.message))
      return
    }
    setStep('email-sent')
  }

  const sendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const e164 = normalizeVePhone(phone)
    if (!e164 || e164.length < 12) {
      setError('Ingresa un número válido (ej. 0414 1234567).')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 })
    setBusy(false)
    if (err) {
      setError(formatAuthError(err.message))
      return
    }
    setNormalizedPhone(e164)
    setStep('sms-code')
  }

  const verifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (smsCode.trim().length < 4) {
      setError('Escribe el código de 6 dígitos.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: smsCode.trim(),
      type: 'sms',
    })
    setBusy(false)
    if (err) {
      setError(formatAuthError(err.message))
      return
    }
    onSuccess()
  }

  const signInWithGoogle = async () => {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    setBusy(false)
    if (err) {
      setError(formatAuthError(err.message))
    }
  }

  if (completing) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <p style={{ fontSize: 13, color: '#9aa3b2' }}>Completando acceso…</p>
      </div>
    )
  }

  if (step === 'email-sent') {
    return (
      <div>
        <div className="pv3-view-header">
          <h2 className="pv3-view-title">Revisa tu correo</h2>
          <button type="button" className="pv3-btn" onClick={onBack}>Volver</button>
        </div>
        <div className="pv3-card">
          <p style={{ fontSize: 14, margin: '0 0 12px', lineHeight: 1.5 }}>
            Enviamos un enlace a <strong>{email}</strong>. Ábrelo en este navegador para continuar.
          </p>
          <button type="button" className="pv3-btn" onClick={() => setStep('pick')}>
            Probar otro método
          </button>
        </div>
      </div>
    )
  }

  if (step === 'sms-code') {
    return (
      <div>
        <div className="pv3-view-header">
          <h2 className="pv3-view-title">Código SMS</h2>
          <button type="button" className="pv3-btn" onClick={() => setStep('pick')}>Volver</button>
        </div>
        <div className="pv3-card">
          <p style={{ fontSize: 13, color: '#5f6373', margin: '0 0 12px' }}>
            Enviamos un código a <strong>{normalizedPhone}</strong>
          </p>
          <form onSubmit={verifySmsCode} style={{ display: 'grid', gap: 12 }}>
            <input
              className="pv3-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              maxLength={6}
            />
            {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}
            <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="pv3-auth-gate">
      <div className="pv3-view-header">
        <h2 className="pv3-view-title">
          {targetView === 'admin' ? 'Admin' : 'Entrar'}
        </h2>
      </div>

      <div className="pv3-card">
        <div className="pv3-auth-tabs">
          {(
            [
              { id: 'email' as const, label: 'Correo' },
              { id: 'sms' as const, label: 'SMS' },
              { id: 'google' as const, label: 'Google' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pv3-btn ${method === t.id ? 'pv3-btn--primary' : ''}`}
              onClick={() => { setMethod(t.id); setError(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {method === 'email' && (
          <form onSubmit={sendEmailLink} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <div>
              <label className="pv3-label">Correo electrónico</label>
              <input
                type="email"
                className="pv3-input"
                style={{ marginTop: 5 }}
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}
            <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar enlace al correo'}
            </button>
          </form>
        )}

        {method === 'sms' && (
          <form onSubmit={sendSmsCode} style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <div>
              <label className="pv3-label">Número de teléfono</label>
              <input
                type="tel"
                className="pv3-input"
                style={{ marginTop: 5 }}
                placeholder="0414 1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                required
              />
              <p style={{ fontSize: 11, color: '#9aa3b2', margin: '6px 0 0' }}>
                Recibirás un código de 6 dígitos por SMS.
              </p>
            </div>
            {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}
            <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar código SMS'}
            </button>
          </form>
        )}

        {method === 'google' && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="pv3-btn pv3-btn--google"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              Continuar con Google
            </button>
            {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '12px 0 0' }}>{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
