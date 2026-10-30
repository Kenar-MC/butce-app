import { EKSTRE_OKUYUCU_URL } from '../../db/hooks'
import { useFileImporter } from './useFileImporter'

export default function ImportPage() {
  const importer = useFileImporter()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">İçe aktar</h1>
        <p className="text-sm text-zinc-500">
          Kart ekstresi, hesap hareketleri ya da bankacılık uygulamasındaki bakiye / borç ekran görüntüsü olabilir.
        </p>
      </div>

      <ol className="space-y-3">
        <li className="card space-y-3">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 font-bold text-white">1</span>
            <div>
              <h2 className="font-semibold">Görseli Ekstre Okuyucu'da okut</h2>
              <p className="text-sm text-zinc-500">
                Claude işlemleri kategorilere ayırır ve bakiyeleri çıkarır. Kontrol edip "Bütçe dosyasını indir"e dokun, iPhone'da
                "Dosyalar'a Kaydet"i seç.
              </p>
            </div>
          </div>
          <a className="btn-primary w-full" href={EKSTRE_OKUYUCU_URL} target="_blank" rel="noreferrer">
            Ekstre Okuyucu'yu aç ↗
          </a>
        </li>

        <li className="card space-y-3">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 font-bold text-white">2</span>
            <div>
              <h2 className="font-semibold">İndirdiğin dosyayı yükle</h2>
              <p className="text-sm text-zinc-500">
                İşlemleri hangi hesaba yazacağını seçersin (yeni hesap da açabilirsin); bakiyeler eşleşen hesaplara yazılır. Daha önce
                eklenen işlemler atlanır.
              </p>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={importer.open}>
            Dosya yükle
          </button>
        </li>
      </ol>

      {importer.message && (
        <p className="text-sm font-medium text-rose-600" role="status">
          {importer.message}
        </p>
      )}
      {importer.element}
    </div>
  )
}
