import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Segmented, Sheet } from '../../components/ui'
import { restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, useAccounts, useCategories } from '../../db/hooks'
import type { AccountType } from '../../db/types'
import type { BackupFile } from '../../domain/backup'
import { adjustedOpeningBalance } from '../../domain/balances'
import { monthKey, todayISO } from '../../domain/dates'
import { balanceTarget, matchAccount, planImport, type ImportFile } from '../../domain/importer'
import { newId, nowISO } from '../../lib/id'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const NEW = '__new'
const TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([k, v]) => [k, v.label]) as [AccountType, string][]

export function ImportSheet({ file, onClose }: { file: ImportFile; onClose: () => void }) {
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

  const target = accountId === NEW ? '' : accountId || defaultTarget?.id || ''
  // Yeni hesap: adı ekstreden önerilir; kart ekstresi/ödeme varsa tür kredi kartı
  const looksCard = !!cardBalance || !!file.summary || file.items.some((i) => i.type === 'payment')
  const [newName, setNewName] = useState(cardBalance?.label ?? (file.statement?.bank ? `${file.statement.bank}${looksCard ? ' kart' : ''}` : ''))
  const [newType, setNewType] = useState<AccountType>(looksCard ? 'credit_card' : 'bank')
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

  async function createTargetAccount() {
    if (!newName.trim()) return
    const now = nowISO()
    const id = newId()
    await db.accounts.add({ id, name: newName.trim(), type: newType, currency: 'TRY', openingBalance: 0, archived: false, createdAt: now, updatedAt: now })
    setAccountId(id)
  }

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
      navigate(`/hesaplar/${target}`)
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
        {sm && (sm.dueDate || sm.minimumPayment !== undefined || sm.totalDebt !== undefined || sm.statementBalance !== undefined) && (
          <p className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            {sm.dueDate && <>Son ödeme: <strong>{dayLabel(sm.dueDate)}</strong> · </>}
            {sm.minimumPayment !== undefined && <>Asgari: <Money value={sm.minimumPayment} /> · </>}
            {sm.statementBalance !== undefined && <>Ekstre borcu: <Money value={sm.statementBalance} /> · </>}
            {sm.totalDebt !== undefined && <>Kalan toplam borç: <Money value={sm.totalDebt} /></>}
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
              <select className="input" value={accountId === NEW ? NEW : target} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value={NEW}>+ Yeni hesap oluştur…</option>
              </select>
            </label>
            {accountId === NEW && (
              <div className="space-y-2 rounded-xl border border-emerald-300 p-3 dark:border-emerald-800">
                <label className="block">
                  <span className="label">Yeni hesabın adı</span>
                  <input className="input" value={newName} placeholder="ör. DenizBank Black" onChange={(e) => setNewName(e.target.value)} />
                </label>
                <Segmented value={newType} options={TYPE_OPTIONS} onChange={setNewType} />
                <button className="btn-primary w-full" disabled={!newName.trim()} onClick={() => void createTargetAccount()}>
                  Hesabı oluştur
                </button>
              </div>
            )}
            {payments > 0 && target && (
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

export function RestoreSheet({ file, onClose }: { file: BackupFile; onClose: (done: boolean) => void }) {
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
