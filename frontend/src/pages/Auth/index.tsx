import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-provider'
import { hasPendingAuthCallback, buildAuthRedirectUrl } from '@/lib/auth-callback'
import { formatAuthError, isEmailRateLimitError } from '@/lib/auth-errors'
import {
  clearPendingAuthEmail,
  getOtpCooldownRemaining,
  getPendingAuthEmail,
  markOtpSent,
  setPendingAuthEmail,
} from '@/lib/auth-otp-cooldown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/shared/loading-spinner'

type Step = 'email' | 'check-email' | 'code'

const DEV_AUTH_EMAIL = import.meta.env.VITE_DEV_AUTH_EMAIL as string | undefined
const DEV_AUTH_PASSWORD = import.meta.env.VITE_DEV_AUTH_PASSWORD as string | undefined
const DEV_AUTH_ENABLED = import.meta.env.DEV && DEV_AUTH_EMAIL && DEV_AUTH_PASSWORD

export function AuthPage() {
  const pendingEmail = getPendingAuthEmail()
  const [step, setStep] = useState<Step>(pendingEmail ? 'check-email' : 'email')
  const [email, setEmail] = useState(pendingEmail ?? '')
  const [otpCode, setOtpCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(() =>
    pendingEmail ? getOtpCooldownRemaining(pendingEmail) : 0
  )
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session, loading: authLoading, authError } = useAuth()

  const redirect = searchParams.get('redirect') || '/volunteer'
  const completingLogin = authLoading || hasPendingAuthCallback()

  useEffect(() => {
    if (!completingLogin && session) {
      clearPendingAuthEmail()
      navigate(redirect, { replace: true })
    }
  }, [completingLogin, session, redirect, navigate])

  useEffect(() => {
    if (authError) setError(formatAuthError(authError))
  }, [authError])

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = window.setInterval(() => {
      setCooldown(getOtpCooldownRemaining(email))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldown, email])

  const sendMagicLink = async (trimmedEmail: string) => {
    return supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildAuthRedirectUrl(redirect),
      },
    })
  }

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    const remaining = getOtpCooldownRemaining(trimmedEmail)
    if (remaining > 0) {
      setCooldown(remaining)
      setError(`Espera ${remaining}s antes de pedir otro enlace.`)
      return
    }

    setLoading(true)
    const { error: authError } = await sendMagicLink(trimmedEmail)
    setLoading(false)

    if (authError) {
      setError(formatAuthError(authError.message))
      if (isEmailRateLimitError(authError.message)) {
        setInfo('Si ya tienes un correo con el botón "Sign in", úsalo sin pedir otro.')
        setStep('check-email')
      }
      return
    }

    markOtpSent(trimmedEmail)
    setPendingAuthEmail(trimmedEmail)
    setCooldown(getOtpCooldownRemaining(trimmedEmail))
    setStep('check-email')
  }

  const handleResendLink = async () => {
    setError(null)
    setInfo(null)

    const trimmedEmail = email.trim()
    const remaining = getOtpCooldownRemaining(trimmedEmail)
    if (remaining > 0) {
      setCooldown(remaining)
      setError(`Espera ${remaining}s antes de reenviar.`)
      return
    }

    setLoading(true)
    const { error: authError } = await sendMagicLink(trimmedEmail)
    setLoading(false)

    if (authError) {
      setError(formatAuthError(authError.message))
      return
    }

    markOtpSent(trimmedEmail)
    setCooldown(getOtpCooldownRemaining(trimmedEmail))
    setInfo('Nuevo enlace enviado. Revisa tu correo.')
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'email',
    })

    setLoading(false)
    if (verifyError) {
      setError(formatAuthError(verifyError.message))
    }
  }

  const handleDevLogin = async () => {
    if (!DEV_AUTH_ENABLED) return

    setError(null)
    setInfo(null)
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEV_AUTH_EMAIL!,
      password: DEV_AUTH_PASSWORD!,
    })

    setLoading(false)
    if (signInError) {
      setError(formatAuthError(signInError.message))
    }
  }

  if (completingLogin) {
    return (
      <div className="py-16">
        <LoadingSpinner />
        <p className="text-center text-sm text-muted-foreground mt-4">Completando acceso...</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-6">
      <div className="text-center mb-6">
        <Link to="/" className="text-xs text-muted-foreground hover:text-primary">
          ← Volver al inicio
        </Link>
        <Badge variant="info" className="mt-4 mb-3">Coordinador en sitio</Badge>
        <h1 className="text-xl font-bold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace seguro al correo. No hay contraseña.
        </p>
      </div>

      {step === 'email' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paso 1 · Tu correo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="label block mb-1.5">
                  Correo del coordinador
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {info && <p className="text-sm text-primary">{info}</p>}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading || cooldown > 0}
              >
                {loading
                  ? 'Enviando...'
                  : cooldown > 0
                    ? `Espera ${cooldown}s`
                    : 'Enviar enlace al correo'}
              </Button>
              {pendingEmail && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEmail(pendingEmail)
                    setStep('check-email')
                    setError(null)
                    setInfo('Usa el enlace "Sign in" del último correo que recibiste.')
                  }}
                >
                  Ya me llegó un enlace
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {step === 'check-email' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paso 2 · Abre tu correo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
              <p>
                Revisa <strong>{email}</strong> y busca el correo{' '}
                <strong>&quot;Your sign-in link&quot;</strong> de Supabase.
              </p>
              <p>
                Haz clic en el botón azul <strong>Sign in</strong>. Te llevará al panel
                automáticamente.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Importante:</strong> no cierres esta pestaña.
                Abre el enlace en el <strong>mismo navegador</strong> donde pediste el acceso
                (Opera, Chrome, etc.).
              </p>
              <p>Supabase no envía números por defecto — solo el enlace.</p>
            </div>

            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <div
                className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary"
                role="status"
                aria-label="Esperando"
              />
              Esperando que abras el enlace...
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-primary">{info}</p>}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading || cooldown > 0}
              onClick={handleResendLink}
            >
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar enlace'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setStep('code')}
            >
              Mi correo muestra un código numérico
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('email')
                setError(null)
                setInfo(null)
              }}
            >
              Usar otro correo
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'code' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Código numérico (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Solo si personalizaste la plantilla de correo en Supabase. Si tu correo dice{' '}
              <strong>Sign in</strong>, vuelve al paso anterior y usa el enlace.
            </p>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label htmlFor="otp" className="label block mb-1.5">
                  Código
                </label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ''))}
                  className="text-center text-lg tracking-widest"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading || otpCode.length < 6}>
                {loading ? 'Verificando...' : 'Entrar al panel'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep('check-email')}>
                ← Volver al enlace del correo
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {DEV_AUTH_ENABLED && (
        <Card className="mt-4 border-dashed">
          <CardContent className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Desarrollo: acceso con contraseña (sin correo). Crea el usuario en Supabase Dashboard
              → Authentication → Users.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={loading}
              onClick={handleDevLogin}
            >
              Entrar como {DEV_AUTH_EMAIL}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
