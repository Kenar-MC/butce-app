import { useState } from 'react'
import { Link } from 'react-router'
import { createBackup } from '../../db/backup'
import { useSetting } from '../../db/hooks'
import { backupFileName } from '../../domain/backup'
import { isIOS, makeFile, saveFile } from '../../lib/files'
import { useFileImporter } from '../import/useFileImporter'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

function backupAge(iso?: string): string {
  if (!iso) return 'Henüz yedek alınmadı'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return `Son yedek: ${dateFmt.format(new Date(iso))} (${days <= 0 ? 'bugün' : `${days} gün önce`})`
}

export default function DataSection() {
  const lastBackupAt = useSetting<string>('lastBackupAt')
  const [prepared, setPrepared] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const importer = useFileImporter()

  async function backup() {
    const b = await createBackup()
    const file = makeFile(backupFileName(b.exportedAt), JSON.stringify(b))
    // iPhone'da paylaş menüsü ayrı bir dokunuşla açılmalı
    if (isIOS()) {
      setPrepared(file)
      setMsg('Yedek hazır. "Dosyalar\'a kaydet"e dokun ve iCloud Drive\'a kaydet.')
      return
    }
    await saveFile(file)
    setMsg('Yedek indirildi.')
  }

  async function savePrepared() {
    if (!prepared) return
    const r = await saveFile(prepared)
    if (r !== 'cancelled') {
      setPrepared(null)
      setMsg('Yedek kaydedildi.')
    }
  }

  const status = importer.message || msg

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Veri</h2>

      <Link to="/ice-aktar" className="card flex items-center gap-3">
        <span className="text-2xl">🧾</span>
        <span className="flex-1">
          <span className="block font-medium">Ekstre ve bakiyeleri içe aktar</span>
          <span className="block text-sm text-zinc-500">Ekstre Okuyucu dosyasını yükle</span>
        </span>
        <span className="text-zinc-400" aria-hidden>
          ›
        </span>
      </Link>

      <div className="card space-y-3">
        <div>
          <h3 className="font-medium">Yedek</h3>
          <p className="text-sm text-zinc-500">
            {backupAge(lastBackupAt)}. Veriler sadece bu cihazda duruyor; telefon değişirse ya da tarayıcı verisi silinirse yedekten geri dönersin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void backup()}>
            Yedek al
          </button>
          {prepared && (
            <button className="btn-primary" onClick={() => void savePrepared()}>
              Dosyalar'a kaydet
            </button>
          )}
          <button className="btn-ghost" onClick={importer.open}>
            Yedekten geri yükle
          </button>
        </div>
      </div>

      {status && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {status}
        </p>
      )}
      {importer.element}
    </section>
  )
}
