import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker kaydı. Yeni sürüm yayınlanınca indirilir, beklemeden devreye girer ve sayfa kendiliğinden yenilenir.
 * iPhone'da ana ekran uygulaması arka plandan dönünce yeniden yüklenmez; bu yüzden uygulama öne geldiğinde
 * ve saatte bir güncelleme kontrolü yapılır.
 */
let registration: ServiceWorkerRegistration | undefined

/** Eski (bekleyen) service worker'ı devreye al: SKIP_WAITING mesajını eski sürümler de anlar */
function activateWaiting(reg: ServiceWorkerRegistration): boolean {
  if (!reg.waiting) return false
  reg.waiting.postMessage({ type: 'SKIP_WAITING' })
  return true
}

export function setupPWA() {
  if (!('serviceWorker' in navigator)) return

  // Sayfa açıkken kontrol yeni sürüme geçerse bir kez yenile
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })

  registerSW({
    immediate: true,
    onNeedReload() {
      if (reloading) return
      reloading = true
      window.location.reload()
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return
      registration = reg
      // Önceki sürümlerden "bekliyor"da kalmış bir sürüm varsa hemen devreye al
      activateWaiting(reg)
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed') activateWaiting(reg)
        })
      })
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      setInterval(check, 60 * 60 * 1000)
    },
  })
}

/** Ayarlar'daki "Güncellemeleri denetle": yeni sürüm varsa yükleyip sayfayı yeniler */
export async function checkForUpdate(): Promise<'updating' | 'latest' | 'offline' | 'unsupported'> {
  if (!('serviceWorker' in navigator)) return 'unsupported'
  if (!navigator.onLine) return 'offline'
  const reg = registration ?? (await navigator.serviceWorker.getRegistration())
  if (!reg) return 'unsupported'
  try {
    await reg.update()
  } catch {
    return 'offline'
  }
  if (activateWaiting(reg) || reg.installing) return 'updating'
  return 'latest'
}
