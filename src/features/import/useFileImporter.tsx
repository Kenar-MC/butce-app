import { useRef, useState } from 'react'
import { parseBackup, type BackupFile } from '../../domain/backup'
import { detectKind, parseImportFile, type ImportFile } from '../../domain/importer'
import { readJsonFile } from '../../lib/files'
import { ImportSheet, RestoreSheet } from './ImportSheets'

/**
 * Dosya seçici + içe aktarma/geri yükleme panelleri. Dosya türünü kendisi anlar:
 * Ekstre Okuyucu dosyası → içe aktarma, Bütçe yedeği → geri yükleme.
 */
export function useFileImporter() {
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [importFile, setImportFile] = useState<ImportFile | null>(null)
  const [restoreFile, setRestoreFile] = useState<BackupFile | null>(null)

  async function onFile(f: File | undefined) {
    if (!f) return
    setMessage('')
    let json: unknown
    try {
      json = await readJsonFile(f)
    } catch {
      return setMessage('Dosya okunamadı. Ekstre Okuyucu dosyası ya da Bütçe yedeği (.json) seç.')
    }
    const kind = detectKind(json)
    if (kind === 'import') {
      const r = parseImportFile(json)
      if (typeof r === 'string') setMessage(r)
      else setImportFile(r)
    } else if (kind === 'backup') {
      const r = parseBackup(json)
      if (typeof r === 'string') setMessage(r)
      else setRestoreFile(r)
    } else setMessage('Tanınmayan dosya. Ekstre Okuyucu dosyası ya da Bütçe yedeği seç.')
  }

  const element = (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {importFile && <ImportSheet file={importFile} onClose={() => setImportFile(null)} />}
      {restoreFile && (
        <RestoreSheet
          file={restoreFile}
          onClose={(done) => {
            setRestoreFile(null)
            if (done) setMessage('Yedek geri yüklendi.')
          }}
        />
      )}
    </>
  )

  return { open: () => input.current?.click(), element, message, setMessage }
}
