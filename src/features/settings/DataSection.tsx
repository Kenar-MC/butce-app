import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Sheet } from '../../components/ui'
import { createBackup, restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { EKSTRE_OKUYUCU_URL, useAccounts, useCategories, useSetting } from '../../db/hooks'
import { backupFileName, parseBackup, type BackupFile } from '../../domain/backup'
import { monthKey } from '../../domain/dates'
import { detectKind, parseImportFile, planImport, type ImportFile } from '../../domain/importer'
import { isIOS, makeFile, readJsonFile, saveFile } from '../../lib/files'
import { newId, nowISO } from '../../lib/id'

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
  const [importFile, setImportFile] = useState<ImportFile | null>(null)
  const [restoreFile, setRestoreFile] = useState<BackupFile | null>(null)
  const input = useRef<HTMLInputElement>(null)

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

  async function onFile(f: File | undefined) {
    if (!f) return
    setMsg('')
    let json: unknown
    try {
      json = await readJsonFile(f)
    } catch {
      return setMsg('Dosya okunamadı. Ekstre Okuyucu dosyası ya da Bütçe yedeği (.json) seç.')
    }
    const kind = detectKind(json)
    if (kind === 'import') {
      const r = parseImportFile(json)
      if (typeof r === 'string') setMsg(r)
      else setImportFile(r)
    } else if (kind === 'backup') {
      const r = parseBackup(json)
      if (typeof r === 'string') setMsg(r)
      else setRestoreFile(r)
    } else setMsg('Tanınmayan dosya. Ekstre Okuyucu dosyası ya da Bütçe yedeği seç.')
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Veri</h2>
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

      <div className="card space-y-3">
        <div>
          <h3 className="font-medium">Ekstreden içe aktar</h3>
          <p className="text-sm text-zinc-500">
            Ekstre Okuyucu'da fotoğrafı okut, indirdiğin dosyayı buradan yükle. Tekrar eden işlemler atlanır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href={EKSTRE_OKUYUCU_URL} target="_blank" rel="noreferrer">
            Ekstre Okuyucu'yu aç ↗
          </a>
          <button className="btn-primary" onClick={() => input.current?.click()}>
            Dosya yükle
          </button>
        </div>
      </div>

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
          <button className="btn-ghost" onClick={() => input.current?.click()}>
            Yedekten geri yükle
          </button>
        </div>
      </div>

      {msg && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {msg}
        </p>
      )}

      {importFile && <ImportSheet file={importFile} onClose={() => setImportFile(null)} />}
      {restoreFile && (
        <RestoreSheet
          file={restoreFile}
          onClose={(done) => {
            setRestoreFile(null)
            if (done) setMsg('Yedek geri yüklendi.')
          }}
        />
      )}
    </section>
  )
}

function ImportSheet({ file, onClose }: { file: ImportFile; onClose: () => void }) {
  const accounts = useAccounts().filter((a) => !a.archived)
  const categories = useCategories()
  const { setMonth } = useApp()
  const navigate = useNavigate()
  const dates = useMemo(() => file.items.map((i) => i.date).sort(), [file])
  const existing = useLiveQuery(
    () => db.transactions.where('date').between(dates[0], dates[dates.length - 1], true, true).toArray(),
    [dates],
  )

  const card = accounts.find((a) => a.type === 'credit_card')
  const [accountId, setAccountId] = useState('')
  const [payFrom, setPayFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const target = accountId || card?.id || accounts[0]?.id || ''

  // Ucuz bir hesap; her çizimde yeniden yapılır
  const plan =
    existing && target
      ? planImport(file.items, { accountId: target, paymentFromAccountId: payFrom || null, categories, existing, now: nowISO(), newId })
      : null

  const sum = (t: string) => file.items.filter((i) => i.type === t).reduce((s, i) => s + i.amount, 0)
  const count = (t: string) => file.items.filter((i) => i.type === t).length
  const payments = count('payment')

  async function commit() {
    if (!plan || !plan.transactions.length) return
    setBusy(true)
    await db.transaction('rw', db.categories, db.transactions, async () => {
      if (plan.newCategories.length) await db.categories.bulkAdd(plan.newCategories)
      await db.transactions.bulkAdd(plan.transactions)
    })
    setMonth(monthKey(dates[dates.length - 1]))
    onClose()
    navigate('/islemler')
  }

  return (
    <Sheet title="Ekstreyi içe aktar" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          {[file.statement?.bank, file.statement?.period].filter(Boolean).join(' · ') || 'Ekstre Okuyucu dosyası'} — {file.items.length} satır
          {file.invalid ? `, ${file.invalid} bozuk satır atlandı` : ''}
        </p>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-zinc-500">Gider ({count('expense')})</div>
            <Money value={sum('expense')} sign="expense" className="font-semibold" />
          </div>
          <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800">
            <div className="text-zinc-500">Gelir / iade ({count('income')})</div>
            <Money value={sum('income')} sign="income" className="font-semibold" />
          </div>
        </div>

        <label className="block">
          <span className="label">İşlemler hangi hesaba yazılsın?</span>
          <select className="input" value={target} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {!card && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Kredi kartı hesabın yok. Kart ekstresiyse önce Hesaplar'dan kart hesabını ekle.
          </p>
        )}

        {payments > 0 && (
          <label className="block">
            <span className="label">
              Kart ödemesi ({payments}, <Money value={sum('payment')} />) hangi hesaptan yapıldı?
            </span>
            <select className="input" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
              <option value="">Aktarma (atla)</option>
              {accounts
                .filter((a) => a.id !== target)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        )}

        {plan && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <strong>{plan.transactions.length} işlem eklenecek.</strong>
            {plan.skippedDuplicates > 0 && ` ${plan.skippedDuplicates} işlem zaten kayıtlı, atlanacak.`}
            {plan.skippedPayments > 0 && ` ${plan.skippedPayments} kart ödemesi atlanacak.`}
            {plan.newCategories.length > 0 && ` "${plan.newCategories[0].name}" kategorisi oluşturulacak.`}
          </p>
        )}

        <button
          className="btn-primary w-full"
          disabled={!plan || !plan.transactions.length || busy}
          onClick={() => void commit()}
        >
          {plan && !plan.transactions.length ? 'Eklenecek yeni işlem yok' : 'İçe aktar'}
        </button>
      </div>
    </Sheet>
  )
}

function RestoreSheet({ file, onClose }: { file: BackupFile; onClose: (done: boolean) => void }) {
  const [error, setError] = useState('')
  async function restore() {
    try {
      await restoreBackup(file)
      onClose(true)
    } catch {
      setError('Geri yükleme başarısız oldu; mevcut veriye dokunulmadı.')
    }
  }
  return (
    <Sheet title="Yedekten geri yükle" onClose={() => onClose(false)}>
      <div className="space-y-4">
        <p>
          Yedek tarihi: <strong>{file.exportedAt ? dateFmt.format(new Date(file.exportedAt)) : 'bilinmiyor'}</strong>
          <br />
          {file.data.accounts.length} hesap, {file.data.transactions.length} işlem, {file.data.categories.length} kategori
        </p>
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">
          Bu cihazdaki tüm veriler silinip yedektekilerle değiştirilecek.
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => onClose(false)}>
            Vazgeç
          </button>
          <ConfirmButton label="Geri yükle" onConfirm={() => void restore()} />
        </div>
      </div>
    </Sheet>
  )
}
