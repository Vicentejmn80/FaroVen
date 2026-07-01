/** Redirect de magic link de vuelta a esta entrada aislada (no /auth de la app principal). */
export function buildV3RedirectUrl(view: 'coordinator' | 'admin' = 'coordinator'): string {
  const url = new URL(`${window.location.origin}/prototype-v3.html`)
  url.searchParams.set('view', view)
  return url.toString()
}

export function readV3ViewFromUrl(): 'coordinator' | 'admin' | null {
  const v = new URL(window.location.href).searchParams.get('view')
  if (v === 'coordinator' || v === 'admin') return v
  return null
}

export function clearV3ViewParam() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('view')) return
  url.searchParams.delete('view')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
