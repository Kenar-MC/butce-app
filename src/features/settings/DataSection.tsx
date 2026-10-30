import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Sheet } from '../../components/ui'
import { createBackup, restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, EKSTRE_OKUYUCU_URL, useAccounts, useCategories, useSetting } from '../../db/hooks'
import { backupFileName, parseBackup, type BackupFile } from '../../domain/backup'
import { adjustedOpeningBalance } from '../../domain/balances'
import { monthKey, todayISO } from '../../domain/dates'
import { balanceTarget, detectKind, matchAccount, parseImportFile, planImport, type ImportFile } from '../../domain/importer'
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
          <h3 className="font-medium">Ekstre ve bakiyeleri içe aktar</h3>
          <p className="text-sm text-zinc-500">
            Ekstre Okuyucu'da kart ekstresi, hesap hareketi ya da bakiye/borç ekran görüntüsünü okut, indirdiğin dosyayı buradan yükle. İşlemler eklenir, hesap bakiyeleri güncellenir; tekrar eden işlemler atlanır.
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
  const allAccounts = useAccounts()
  const accounts = allAccounts.filter((a) => !a.archived)
  const categories = useCategories()
  const allTx = useLiveQuery(() => db.transactions.toArray())
  const { setMonth } = useApp()
  const navigate = useNavigate()
  const dates = useMemo(() => file.items.map((i) => i.date).sort(), [file])
  const hasItems = file.items.length > 0

  const cardBalance = file.balances.find((b) => b.accountType === 'credit_card')
  const defaultTarget =
    (cardBalance && matchAccount(cardBalance, accounts)) || accounts.find((a) => a.type === 'credit_card') || accounts[0]
  const [accountId, setAccountId] = useState('')
  const [counterparty, setCounterparty] = useState('')
  /** bakiye satırı → hesap id; '-' = güncelleme, yoksa otomatik eşleşme */
  const [picked, setPicked] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const target = accountId || defaultTarget?.id || ''
  const targetIsCard = accounts.find((a) => a.id === target)?.type === 'credit_card'

  const plan =
    hasItems && allTx && target
      ? planImport(file.items, {
          accountId: target,
          paymentCounterpartyId: counterparty || null,
          targetIsCard,
          categories,
          existing: allTx,
          now: nowISO(),
          newId,
        })
      : null

  const balanceRows = file.balances.map((b, i) => {
    const choice = picked[i]
    const skip = choice === '-'
    const acc = skip ? undefined : choice ? allAccounts.find((a) => a.id === choice) : matchAccount(b, accounts)
    const asOf = b.asOf ?? todayISO()
    const adj = acc && allTx ? adjustedOpeningBalance(acc, [...allTx, ...(plan?.transactions ?? [])], asOf, balanceTarget(b)) : null
    return { b, i, acc, asOf, adj, skip }
  })
  const updates = balanceRows.filter((r) => r.acc && r.adj && r.adj.openingBalance !== r.acc.openingBalance)
  const txCount = plan?.transactions.length ?? 0
  const canCommit = txCount > 0 || updates.length > 0

  async function createAccount(i: number) {
    const b = file.balances[i]
    const now = nowISO()
    const id = newId()
    await db.accounts.add({ id, name: b.label, type: b.accountType, currency: 'TRY', openingBalance: 0, archived: false, createdAt: now, updatedAt: now })
    setPicked((p) => ({ ...p, [i]: id }))
  }

  async function commit() {
    if (!canCommit) return
    setBusy(true)
    await db.transaction('rw', db.accounts, db.categories, db.transactions, async () => {
      if (plan?.newCategories.length) await db.categories.bulkAdd(plan.newCategories)
      if (txCount) await db.transactions.bulkAdd(plan!.transactions)
      for (const r of updates) await db.accounts.update(r.acc!.id, { openingBalance: r.adj!.openingBalance, updatedAt: nowISO() })
    })
    onClose()
    if (txCount) {
      setMonth(monthKey(dates[dates.length - 1]))
      navigate('/islemler')
    } else navigate('/hesaplar')
  }

  const sum = (t: string) => file.items.filter((i) => i.type === t).reduce((s, i) => s + i.amount, 0)
  const count = (t: string) => file.items.filter((i) => i.type === t).length
  const payments = count('payment')
  const sm = file.summary

  return (
    <Sheet title="İçe aktar" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          {[file.statement?.bank, file.statement?.period].filter(Boolean).join(' · ') || 'Ekstre Okuyucu dosyası'}
          {hasItems ? ` — ${file.items.length} işlem` : ''}
          {file.invalid ? `, ${file.invalid} bozuk satır atlandı` : ''}
        </p>
        {sm && (sm.dueDate || sm.minimumPayment !== undefined || sm.totalDebt !== undefined) && (
          <p className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            {sm.dueDate && <>Son ödeme: <strong>{dayLabel(sm.dueDate)}</strong> · </>}
            {sm.minimumPayment !== undefined && <>Asgari: <Money value={sm.minimumPayment} /> · </>}
            {sm.totalDebt !== undefined && <>Toplam borç: <Money value={sm.totalDebt} /></>}
          </p>
        )}

        {hasItems && (
          <div className="space-y-3">
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
            {payments > 0 && (
              <label className="block">
                <span className="label">
                  Kart ödemesi ({payments}, <Money value={sum('payment')} />){' '}
                  {targetIsCard ? 'hangi hesaptan yapıldı?' : 'hangi karta yapıldı?'}
                </span>
                <select className="input" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}>
                  <option value="">Aktarma (atla)</option>
                  {accounts
                    .filter((a) => a.id !== target && (targetIsCard ? a.type !== 'credit_card' : a.type === 'credit_card'))
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
                <strong>{txCount} işlem eklenecek.</strong>
                {plan.skippedDuplicates > 0 && ` ${plan.skippedDuplicates} işlem zaten kayıtlı, atlanacak.`}
                {plan.skippedPayments > 0 && ` ${plan.skippedPayments} kart ödemesi atlanacak.`}
                {plan.newCategories.length > 0 && ` "${plan.newCategories[0].name}" kategorisi oluşturulacak.`}
              </p>
            )}
          </div>
        )}

        {balanceRows.length > 0 && (
          <div className="space-y-2">
            <span className="label">Hesap bakiyeleri</span>
            {balanceRows.map((r) => (
              <div key={r.i} className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {ACCOUNT_TYPES[r.b.accountType].icon} {r.b.label}
                  </span>
                  <Money value={balanceTarget(r.b)} className="font-semibold" />
                </div>
                <div className="text-xs text-zinc-500">{dayLabel(r.asOf)} itibarıyla</div>
                <select
                  className="input"
                  aria-label={`${r.b.label} için hesap`}
                  value={r.skip ? '-' : (r.acc?.id ?? '')}
                  onChange={(e) => setPicked((p) => ({ ...p, [r.i]: e.target.value }))}
                >
                  {!r.acc && !r.skip && <option value="">Eşleşen hesap yok</option>}
                  <option value="-">Bu bakiyeyi kullanma</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {!r.acc && !r.skip && (
                  <button className="btn-ghost w-full" onClick={() => void createAccount(r.i)}>
                    + “{r.b.label}” hesabını oluştur
                  </button>
                )}
                {r.acc && r.adj && (
                  <p className="text-sm">
                    {r.acc.name}: <Money value={r.adj.current} /> → <Money value={balanceTarget(r.b)} />
                    {r.adj.current === balanceTarget(r.b) && ' (zaten aynı)'}
                  </p>
                )}
              </div>
            ))}
            <p className="text-xs text-zinc-500">Fark hesabın açılış bakiyesine yazılır; gelir/gider olarak sayılmaz.</p>
          </div>
        )}

        <button className="btn-primary w-full" disabled={!canCommit || busy} onClick={() => void commit()}>
          {canCommit ? 'Uygula' : 'Değişecek bir şey yok'}
        </button>
      </div>
    </Sheet>
  )
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return dateFmt.format(new Date(y, m - 1, d))
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
