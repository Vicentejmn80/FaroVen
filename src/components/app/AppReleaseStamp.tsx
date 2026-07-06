import { getAppReleaseCode } from '@/lib/app-meta'

/** Marca de release discreta — esquina inferior, no compite con la navegación. */
export function AppReleaseStamp() {
  const code = getAppReleaseCode()

  return (
    <p
      className="pointer-events-none absolute bottom-1 left-0 right-0 z-30 text-center text-[9px] font-medium tracking-[0.18em] text-ink-faint/60 lg:bottom-2"
      aria-label={`Release ${code}`}
    >
      {code}
    </p>
  )
}
