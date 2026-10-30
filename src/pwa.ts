import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker kaydı. Yeni sürüm yayınlanınca indirilir ve sayfa kendiliğinden yenilenir.
 * iPhone'da ana ekran uygulaması arka plandan dönünce yeniden yüklenmez; bu yüzden
 * uygulama öne geldiğinde ve saatte bir güncelleme kontrolü yapılır.
 */
export function setupPWA() {
  if (!('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
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
