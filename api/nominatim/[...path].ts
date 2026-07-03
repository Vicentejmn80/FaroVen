const USER_AGENT = 'FARO-Humanitarian-Console/1.0 (contact: nex.gen0211@gmail.com)'
const ALLOWED = new Set(['search', 'reverse'])

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/api\/nominatim\/(search|reverse)$/)
  const path = match?.[1]

  if (!path || !ALLOWED.has(path)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const qs = url.searchParams.toString()
  const upstreamUrl = `https://nominatim.openstreetmap.org/${path}${qs ? `?${qs}` : ''}`

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es',
        'User-Agent': USER_AGENT,
      },
    })
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch {
    return Response.json({ error: 'Geocoding service unavailable' }, { status: 502 })
  }
}

export const config = { runtime: 'edge' }
