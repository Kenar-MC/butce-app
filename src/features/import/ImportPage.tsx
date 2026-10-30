import { ConfirmButton } from '../../components/ui'
import { db } from '../../db/db'
import { EKSTRE_OKUYUCU_URL, useSetting } from '../../db/hooks'
import type { LastImport } from './ImportSheets'
import { useFileImporter } from './useFileImporter'

export default function ImportPage() {
  const importer = useFileImporter()
  const last = useSetting<LastImport>('lastImport')

  async function undo() {
    if (!last) return
    await db.transaction('rw', [db.transactions, db.accounts, db.settings], async () => {
      const ids = await db.transactions.filter((t) => t.importId === last.id).primaryKeys()
      await db.transactions.bulkDelete(ids)
      for (const [id, openingBalance] of Object.entries(last.prevOpening)) await db.accounts.update(id, { openingBalance })
      await db.settings.delete('lastImport')
    })
    importer.setMessage(`Son içe aktarma geri alındı (${last.count} işlem silindi).`)
  }
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

      {last && (
        <div className="card space-y-2">
          <p className="text-sm">
            Son içe aktarma: <strong>{last.count} işlem</strong>
            {last.accountName && ` → ${last.accountName}`},{' '}
            {new Date(last.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
          <ConfirmButton label="Son içe aktarmayı geri al" onConfirm={() => void undo()} />
        </div>
      )}

      {importer.message && (
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300" role="status">
          {importer.message}
        </p>
      )}
      {importer.element}
    </div>
  )
}
