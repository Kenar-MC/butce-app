/**
 * Kurtarma: service worker kaydını ve önbellekleri siler, sayfayı internetten yeniden yükler.
 * IndexedDB'deki verilere (kartlar, ekstreler) dokunmaz.
 */
export async function clearCacheAndReload(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  } finally {
    window.location.reload()
  }
}
