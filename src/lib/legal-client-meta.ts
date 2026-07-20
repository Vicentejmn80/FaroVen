/** Best-effort client metadata for legal consent records. */
export async function resolveConsentClientMetadata(): Promise<{
  ipAddress: string | null
  userAgent: string | null
}> {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null
  let ipAddress: string | null = null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok) {
      const data = (await response.json()) as { ip?: string }
      ipAddress = data.ip?.trim() || null
    }
  } catch {
    ipAddress = null
  }

  return { ipAddress, userAgent }
}
