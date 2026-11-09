import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearCacheAndReload } from '../lib/recover'

/** Ekranda bir hata olursa beyaz sayfa yerine açıklama ve kurtarma düğmeleri gösterir */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    // iPhone'da veritabanı bağlantısı kopabiliyor (WebKit hatası); yenileme yetmezse uygulamayı tamamen kapatmak gerekir
    const dbError = /UnknownError|Indexed Database|cursor|DatabaseClosed/i.test(`${error.name} ${error.message}`)
    return (
      <div className="mx-auto max-w-md space-y-4 px-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <h1 className="text-xl font-bold">Bir şeyler ters gitti</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Verilerin silinmedi. Önce yeniden yüklemeyi dene; düzelmezse önbelleği temizle. Sorun sürerse bu ekranın görüntüsünü gönder.
        </p>
        {dbError && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Telefonun veritabanı bağlantısında sorun var. Yeniden yükle işe yaramazsa uygulamayı uygulama değiştiriciden yukarı kaydırarak
            tamamen kapat ve yeniden aç.
          </p>
        )}
        <p className="rounded-xl bg-zinc-100 p-3 font-mono text-xs break-words text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {error.message || String(error)}
        </p>
        <div className="flex flex-col gap-2">
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Yeniden yükle
          </button>
          <button className="btn-ghost" onClick={() => void clearCacheAndReload()}>
            Önbelleği temizle ve yenile
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              window.location.hash = '#/'
              this.setState({ error: null })
            }}
          >
            Ana sayfaya dön
          </button>
        </div>
      </div>
    )
  }
}
