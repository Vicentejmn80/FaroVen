const USER_AGENT = 'FARO-Humanitarian-Console/1.0 (contact: nex.gen0211@gmail.com)'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const url = new URL(request.url)
  const qs = url.searchParams.toString()
  const upstreamUrl = `https://nominatim.openstreetmap.org/reverse${qs ? `?${qs}` : ''}`

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
