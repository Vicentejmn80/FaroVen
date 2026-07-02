import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export interface InvisibleTurnstileHandle {
  requestToken: () => Promise<string | null>
  reset: () => void
}

interface InvisibleTurnstileProps {
  action: string
}

const TURNSTILE_TIMEOUT_MS = 12_000

export const InvisibleTurnstile = forwardRef<InvisibleTurnstileHandle, InvisibleTurnstileProps>(
  function InvisibleTurnstile({ action }, ref) {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
    const turnstileRef = useRef<TurnstileInstance>()

    useImperativeHandle(ref, () => ({
      requestToken: async () => {
        if (!siteKey) return null
        turnstileRef.current?.reset()
        turnstileRef.current?.execute()
        try {
          const token = await turnstileRef.current?.getResponsePromise(TURNSTILE_TIMEOUT_MS, 250)
          return token ?? null
        } catch {
          return null
        }
      },
      reset: () => {
        turnstileRef.current?.reset()
      },
    }))

    if (!siteKey) return null

    return (
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          options={{
            size: 'invisible',
            execution: 'execute',
            appearance: 'interaction-only',
            action,
          }}
        />
      </div>
    )
  },
)
