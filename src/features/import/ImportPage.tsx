import { ConfirmButton } from '../../components/ui'
import { EKSTRE_OKUYUCU_URL, useSetting } from '../../db/hooks'
import { undoImport, type LastImport } from '../../db/statements'
import { formatMonthTR } from '../../domain/dates'
import { useFileImporter } from './useFileImporter'

export default function ImportPage() {
  const importer = useFileImporter()
  const last = useSetting<LastImport>('lastImport')

  async function undo() {
    if (!last) return
    await undoImport(last)
    importer.setMessage(`Son içe aktarma geri alındı (${last.count} satır silindi).`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Ekstre yükle</h1>
        <p className="text-sm text-zinc-500">Kredi kartı ekstresi ya da banka hesap hareketleri: fotoğraf, ekran görüntüsü veya PDF.</p>
      </div>

      <ol className="space-y-3">
        <li className="card space-y-3">
          <div className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-600 font-bold text-white">1</span>
            <div>
              <h2 className="font-semibold">Ekstre Okuyucu'da okut</h2>
              <p className="text-sm text-zinc-500">
                Claude satırları okur ve kategorilere ayırır. Kontrol edip "Bütçe dosyasını indir"e dokun, iPhone'da "Dosyalar'a Kaydet"i seç.
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
                Kartı ve ayı seçersin, satırları tek tek gözden geçirirsin. Daha önce eklenen satırlar atlanır; kart ödemeleri harcama sayılmaz.
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
            Son içe aktarma: <strong>{last.count} satır</strong> → {last.cardName}
            {last.months.length > 0 && ` (${last.months.map(formatMonthTR).join(', ')})`},{' '}
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
