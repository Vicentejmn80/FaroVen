import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ScreenScaffold } from '@/components/faro/screen-scaffold'
import { GlassCard } from '@/components/ui/glass-card'
import { EmergencyButton } from '@/components/ui/emergency-button'
import { useAuth } from '@/store/auth-context'
import { formatAuthError } from '@/lib/auth-errors'
import { countSignupDebug } from '@/lib/signup-debug'
import { cn } from '@/lib/utils'
import { InvisibleTurnstile, type InvisibleTurnstileHandle } from '@/components/security/invisible-turnstile'
import { legalService } from '@/services/legal-service'

export type AuthMode =
  | 'login'
  | 'signup'
  | 'recover'
  | 'check-email'
  | 'reset-password'
  | 'password-updated'

interface AuthScreenProps {
  onClose?: () => void
  initialMode?: AuthMode
}

export function AuthScreen({ onClose, initialMode = 'login' }: AuthScreenProps) {
  const {
    session,
    signInWithPassword,
    signUp,
    resendSignupConfirmation,
    resetPassword,
    updatePassword,
    clearPendingAuthIntent,
    pendingAuthIntent,
  } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const turnstileRef = useRef<InvisibleTurnstileHandle>(null)
  /** Mutex síncrono: useState(isSubmitting) no bloquea un segundo clic antes del re-render. */
  const submitLockRef = useRef(false)

  async function requestCaptchaToken() {
    if (!import.meta.env.VITE_TURNSTILE_SITE_KEY) return undefined
    const token = await turnstileRef.current?.requestToken()
    if (!token) throw new Error('No pudimos verificar la seguridad del formulario. Intenta nuevamente.')
    return token
  }

  // Cerrar la pantalla de espera automáticamente cuando Supabase confirma la sesión.
  // Cubre el caso de confirmación desde otro navegador/pestaña (cross-tab via localStorage).
  useEffect(() => {
    if (mode === 'check-email' && session) {
      onClose?.()
    }
  }, [mode, session, onClose])

  useEffect(() => {
    if (pendingAuthIntent === 'password_recovery') {
      setMode('reset-password')
    }
  }, [pendingAuthIntent])

  const title = useMemo(() => {
    if (mode === 'check-email') return 'Revisa tu correo'
    if (mode === 'reset-password') return 'Crear nueva contraseña'
    if (mode === 'password-updated') return 'Contraseña actualizada'
    if (mode === 'recover') return 'Recuperar acceso'
    if (mode === 'signup') return 'Crear cuenta operativa'
    return 'Acceso operativo'
  }, [mode])

  const openLegal = (doc: 'terms' | 'privacy') => {
    window.dispatchEvent(new CustomEvent('faro:open-legal', { detail: { doc } }))
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    countSignupDebug('auth-screen.handleSubmit invoked', { mode })

    if (submitLockRef.current) {
      countSignupDebug('auth-screen.handleSubmit BLOCKED (submitLockRef)')
      return
    }
    if (isSubmitting) {
      countSignupDebug('auth-screen.handleSubmit BLOCKED (isSubmitting state lag)')
      return
    }

    submitLockRef.current = true
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'login') {
        const captchaToken = await requestCaptchaToken()
        await signInWithPassword(email.trim(), password, captchaToken)
        onClose?.()
      } else if (mode === 'signup') {
        if (!termsAccepted || !privacyAccepted) {
          throw new Error('Debes aceptar los Términos de Servicio y la Política de Privacidad.')
        }
        countSignupDebug('auth-screen.handleSubmit calling signUp()')
        const captchaToken = await requestCaptchaToken()
        const result = await signUp(email.trim(), password, fullName.trim(), phone.trim(), captchaToken)
        legalService.setConsentPending()
        await legalService.syncPendingConsent(result.session?.user?.id)
        if (result.needsEmailConfirmation) {
          setMode('check-email')
        } else {
          onClose?.()
        }
      } else if (mode === 'recover') {
        const captchaToken = await requestCaptchaToken()
        await resetPassword(email.trim(), captchaToken)
        setMessage('Te enviamos un enlace para restablecer tu contraseña.')
      } else if (mode === 'reset-password') {
        if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
        if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.')
        await updatePassword(password)
        clearPendingAuthIntent()
        setMode('password-updated')
      }
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'Error de autenticación'))
    } finally {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    if (submitLockRef.current || isSubmitting) return

    submitLockRef.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      const captchaToken = await requestCaptchaToken()
      await resendSignupConfirmation(email.trim(), captchaToken)
      setMessage('Nuevo enlace enviado. Revisa tu correo.')
    } catch (err) {
      setError(formatAuthError(err instanceof Error ? err.message : 'No se pudo reenviar'))
    } finally {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const submitLabel = useMemo(() => {
    if (isSubmitting) return 'Procesando...'
    if (mode === 'login') return 'Entrar'
    if (mode === 'signup') return 'Registrarse'
    if (mode === 'recover') return 'Enviar enlace de recuperación'
    if (mode === 'reset-password') return 'Guardar contraseña'
    return 'Continuar'
  }, [isSubmitting, mode])

  const isSubmitDisabled =
    isSubmitting ||
    !email.trim() ||
    (mode !== 'recover' && mode !== 'check-email' && mode !== 'password-updated' && !password.trim()) ||
    (mode === 'signup' && (!fullName.trim() || !phone.trim())) ||
    (mode === 'reset-password' && (!password.trim() || !confirmPassword.trim())) ||
    (mode === 'signup' && (!termsAccepted || !privacyAccepted))

  return (
    <ScreenScaffold title={title} subtitle="Gestión segura de centros FARO" onBack={onClose}>
      <div className="mx-auto w-full max-w-md space-y-5 pt-2">
        <GlassCard className="relative overflow-hidden border-info/20 bg-gradient-to-br from-info/10 via-transparent to-transparent p-5">
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/20 ring-1 ring-info/30">
              <ShieldCheck className="h-5 w-5 text-info" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">Acceso para operadores</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                El ciudadano no necesita cuenta. Solo coordinadores y administradores inician sesión aquí.
              </p>
            </div>
          </div>
        </GlassCard>

        {mode !== 'check-email' &&
          mode !== 'recover' &&
          mode !== 'reset-password' &&
          mode !== 'password-updated' && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              {(['login', 'signup'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    if (isSubmitting) return
                    setMode(tab)
                    setError(null)
                    setMessage(null)
                  }}
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    mode === tab ? 'bg-info text-white shadow-focal' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                </button>
              ))}
            </div>
          )}

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {mode === 'check-email' ? (
              <EmailLinkPanel
                email={email}
                error={error}
                message={message}
                isSubmitting={isSubmitting}
                onResend={() => void handleResend()}
                onBack={() => setMode('login')}
              />
            ) : mode === 'password-updated' ? (
              <PasswordUpdatedPanel onLogin={() => setMode('login')} />
            ) : mode === 'reset-password' ? (
              <GlassCard className="space-y-4">
                <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)} noValidate>
                <p className="text-sm text-ink-muted">
                  Elige una contraseña segura. Después de guardar deberás iniciar sesión nuevamente.
                </p>
                <AuthField
                  label="Nueva contraseña"
                  icon={Lock}
                  value={password}
                  onChange={setPassword}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  disabled={isSubmitting}
                />
                <AuthField
                  label="Confirmar contraseña"
                  icon={Lock}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  type="password"
                  placeholder="Repite la contraseña"
                  disabled={isSubmitting}
                />
                {error && <ErrorBanner message={error} />}
                <EmergencyButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitDisabled}
                >
                  {submitLabel}
                </EmergencyButton>
                </form>
              </GlassCard>
            ) : (
              <GlassCard className="space-y-4">
                <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)} noValidate>
                {mode === 'signup' && (
                  <>
                    <AuthField
                      label="Nombre completo"
                      icon={UserRound}
                      value={fullName}
                      onChange={setFullName}
                      placeholder="Tu nombre"
                      disabled={isSubmitting}
                    />
                    <AuthField
                      label="Teléfono"
                      icon={Phone}
                      value={phone}
                      onChange={setPhone}
                      type="tel"
                      placeholder="0412-0000000"
                      disabled={isSubmitting}
                    />
                  </>
                )}
                <AuthField
                  label="Correo electrónico"
                  icon={Mail}
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="tu@correo.com"
                  disabled={isSubmitting}
                />
                {mode !== 'recover' && (
                  <AuthField
                    label="Contraseña"
                    icon={Lock}
                    value={password}
                    onChange={setPassword}
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    disabled={isSubmitting}
                  />
                )}

                {mode === 'signup' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-ink-muted">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        He leído y acepto los{' '}
                        <button type="button" className="text-info hover:underline" onClick={() => openLegal('terms')}>
                          Términos de Servicio
                        </button>
                        .
                      </span>
                    </label>
                    <label className="mt-2 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        He leído y acepto la{' '}
                        <button
                          type="button"
                          className="text-info hover:underline"
                          onClick={() => openLegal('privacy')}
                        >
                          Política de Privacidad
                        </button>
                        .
                      </span>
                    </label>
                  </div>
                )}

                {error && <ErrorBanner message={error} />}
                {message && <SuccessBanner message={message} />}

                <EmergencyButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSubmitDisabled}
                >
                  {submitLabel}
                </EmergencyButton>
                </form>
              </GlassCard>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="space-y-2 text-center text-sm">
          {mode === 'login' && (
            <>
              <button type="button" className="text-info" onClick={() => setMode('recover')}>
                ¿Olvidaste tu contraseña?
              </button>
              <p className="text-ink-subtle">
                ¿Primera vez?{' '}
                <button type="button" className="text-info" onClick={() => setMode('signup')}>
                  Crear cuenta operativa
                </button>
              </p>
            </>
          )}
          {(mode === 'signup' || mode === 'recover') && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-info"
              onClick={() => setMode('login')}
            >
              <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
            </button>
          )}
        </div>
      </div>
      <InvisibleTurnstile ref={turnstileRef} action={`auth-${mode}`} />
    </ScreenScaffold>
  )
}

function EmailLinkPanel({
  email,
  error,
  message,
  isSubmitting,
  onResend,
  onBack,
}: {
  email: string
  error: string | null
  message: string | null
  isSubmitting: boolean
  onResend: () => void
  onBack: () => void
}) {
  return (
    <GlassCard className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-info/15 ring-1 ring-info/25">
        <Mail className="h-6 w-6 text-info" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-ink">Revisa tu correo</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Enviamos un enlace de confirmación a{' '}
          <span className="font-medium text-ink">{email}</span>. Haz clic en el enlace para activar
          tu cuenta.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      {message && <SuccessBanner message={message} />}
      <div className="flex flex-col gap-2 text-sm">
        <button type="button" className="text-info" disabled={isSubmitting} onClick={onResend}>
          {isSubmitting ? 'Procesando...' : 'Reenviar enlace'}
        </button>
        <button type="button" className="text-ink-muted" onClick={onBack}>
          Volver al inicio de sesión
        </button>
      </div>
    </GlassCard>
  )
}

function PasswordUpdatedPanel({ onLogin }: { onLogin: () => void }) {
  return (
    <GlassCard className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-operational/15 ring-1 ring-operational/25">
        <CheckCircle2 className="h-7 w-7 text-operational" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold text-ink">Contraseña actualizada</p>
        <p className="text-sm text-ink-muted">Ya puedes iniciar sesión con tu nueva contraseña.</p>
      </div>
      <EmergencyButton variant="primary" size="lg" className="w-full" onClick={onLogin}>
        Iniciar sesión
      </EmergencyButton>
    </GlassCard>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
      {message}
    </p>
  )
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-operational/30 bg-operational/10 px-3 py-2 text-sm text-operational">
      {message}
    </p>
  )
}

function AuthField({
  label,
  icon: Icon,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
}: {
  label: string
  icon: typeof Mail
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </span>
      <span className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition-colors focus-within:border-info/40 focus-within:bg-white/[0.06]">
        <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-60"
        />
      </span>
    </label>
  )
}
