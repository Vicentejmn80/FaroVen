/** Limpia caches de Workbox para manifest e iconos PWA (Android/iOS). */
export async function clearPwaAssetCaches(): Promise<void> {
  if (typeof caches === 'undefined') return

  await Promise.all([caches.delete('pwa-icons'), caches.delete('pwa-manifest')])
}
