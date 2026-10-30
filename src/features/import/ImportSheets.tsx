import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Segmented, Sheet } from '../../components/ui'
import { restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { ACCOUNT_TYPES, useAccounts, useCategories } from '../../db/hooks'
import type { AccountType, Transaction } from '../../db/types'
import type { BackupFile } from '../../domain/backup'
import { adjustedOpeningBalance } from '../../domain/balances'
import { monthKey, todayISO } from '../../domain/dates'
import { balanceTarget, isISODate, matchAccount, planImport, type ImportFile } from '../../domain/importer'
import { newId, nowISO } from '../../lib/id'

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const NEW = '__new'
const TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).map(([k, v]) => [k, v.label]) as [AccountType, string][]

/** Son içe aktarma kaydı (geri almak için) */
export interface LastImport {
  id: string
  at: string
  count: number
  accountName: string
  /** Bakiyesi değişen hesapların önceki açılış bakiyeleri */
  prevOpening: Record<string, number>
}

type RowEdit = { include?: boolean; categoryId?: string; date?: string }

export function ImportSheet({ file, onClose }: { file: ImportFile; onClose: () => void }) {
  const allAccounts = useAccounts()
  const accounts = allAccounts.filter((a) => !a.archived)
  const categories = useCategories()
  const allTx = useLiveQuery(() => db.transactions.toArray())
  const { setMonth } = useApp()
  const navigate = useNavigate()
  const hasItems = file.items.length > 0

  const cardBalance = file.balances.find((b) => b.accountType === 'credit_card')
  const defaultTarget =
    (cardBalance && matchAccount(cardBalance, accounts)) || accounts.find((a) => a.type === 'credit_card') || accounts[0]
  const [accountId, setAccountId] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [picked, setPicked] = useState<Record<number, string>>({})
  const [edits, setEdits] = useState<Record<number, RowEdit>>({})
  const [busy, setBusy] = useState(false)

  const target = accountId === NEW ? '' : accountId || defaultTarget?.id || ''
  const targetAcc = accounts.find((a) => a.id === target)
  const targetIsCard = targetAcc?.type === 'credit_card'
  const looksCard = !!cardBalance || !!file.summary || file.items.some((i) => i.type === 'payment')
  const [newName, setNewName] = useState(cardBalance?.label ?? (file.statement?.bank ? `${file.statement.bank}${looksCard ? ' kart' : ''}` : ''))
  const [newType, setNewType] = useState<AccountType>(looksCard ? 'credit_card' : 'bank')

  // Satırlar dosyadaki sıraya (index) göre anahtarlanır; kimliklerin her çizimde yenilenmesi sorun değil
  const plan =
    hasItems && allTx && target
      ? planImport(file.items, {
          accountId: target,
          paymentCounterpartyId: counterparty || null,
          targetIsCard,
          statementDate: file.summary?.statementDate,
          categories,
          existing: allTx,
          now: nowISO(),
          newId,
        })
      : null

  const rows = (plan?.rows ?? []).map((r) => {
    const e = edits[r.index] ?? {}
    const include = !!r.tx && (e.include ?? !r.duplicate)
    const tx: Transaction | null = r.tx
      ? { ...r.tx, categoryId: e.categoryId ?? r.tx.categoryId, date: e.date && isISODate(e.date) ? e.date : r.tx.date }
      : null
    return { ...r, include, tx }
  })
  const selected = rows.filter((r) => r.include && r.tx).map((r) => r.tx!)
  const setEdit = (i: number, e: RowEdit) => setEdits((s) => ({ ...s, [i]: { ...s[i], ...e } }))
  const setAll = (include: boolean) =>
    setEdits((s) => Object.fromEntries(rows.map((r) => [r.index, { ...s[r.index], include: include && !!r.tx }])))

  // Her bakiye ayrı bir hesaba gider: açıkça seçilenler ayrılır, kalanlar sırayla eşlenir.
  // Aynı türden birden fazla bakiye varsa "o türde tek hesap" kestirmesi kapalı.
  const typeCount = file.balances.reduce<Record<string, number>>((m, b) => ({ ...m, [b.accountType]: (m[b.accountType] ?? 0) + 1 }), {})
  const used = new Set(Object.values(picked).filter((v) => v && v !== '-' && v !== NEW))
  const balanceRows = file.balances.map((b, i) => {
    const choice = picked[i]
    const skip = choice === '-'
    const creating = choice === NEW
    let acc = choice && !skip && !creating ? allAccounts.find((a) => a.id === choice) : undefined
    if (!choice) {
      acc = matchAccount(
        b,
        accounts.filter((a) => !used.has(a.id)),
        { singleFallback: typeCount[b.accountType] === 1 },
      )
      if (acc) used.add(acc.id)
    }
    const asOf = b.asOf ?? todayISO()
    const adj = acc && allTx ? adjustedOpeningBalance(acc, [...allTx, ...selected], asOf, balanceTarget(b)) : null
    return { b, i, acc, asOf, adj, skip, creating: creating || (!acc && !skip) }
  })
  const [balNames, setBalNames] = useState<Record<number, string>>({})
  const [balTypes, setBalTypes] = useState<Record<number, AccountType>>({})
  const updates = balanceRows.filter((r) => r.acc && r.adj && r.adj.openingBalance !== r.acc.openingBalance)
  const canCommit = selected.length > 0 || updates.length > 0

  async function createAccount(name: string, type: AccountType): Promise<string> {
    const t = nowISO()
    const id = newId()
    await db.accounts.add({ id, name: name.trim(), type, currency: 'TRY', openingBalance: 0, archived: false, createdAt: t, updatedAt: t })
    return id
  }

  async function commit() {
    if (!canCommit || busy) return
    setBusy(true)
    const importId = newId()
    const usedCats = new Set(selected.map((t) => t.categoryId))
    const newCats = (plan?.newCategories ?? []).filter((c) => usedCats.has(c.id))
    const record: LastImport = {
      id: importId,
      at: nowISO(),
      count: selected.length,
      accountName: targetAcc?.name ?? '',
      prevOpening: Object.fromEntries(updates.map((r) => [r.acc!.id, r.acc!.openingBalance])),
    }
    await db.transaction('rw', [db.accounts, db.categories, db.transactions, db.settings], async () => {
      if (newCats.length) await db.categories.bulkAdd(newCats)
      if (selected.length) await db.transactions.bulkAdd(selected.map((t) => ({ ...t, importId })))
      for (const r of updates) await db.accounts.update(r.acc!.id, { openingBalance: r.adj!.openingBalance, updatedAt: nowISO() })
      await db.settings.put({ key: 'lastImport', value: record })
    })
    onClose()
    if (selected.length) {
      setMonth(monthKey(selected.map((t) => t.date).sort().pop()!))
      // Tüm zamanlar: farklı aylara düşen işlemler de görünsün
      navigate(`/hesaplar/${target}`, { state: { all: true } })
    } else navigate('/hesaplar')
  }

  const sumOf = (type: string) => selected.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
  const sm = file.summary
  const payments = file.items.filter((i) => i.type === 'payment')

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
                <button
                  className="btn-primary w-full"
                  disabled={!newName.trim()}
                  onClick={() => void createAccount(newName, newType).then(setAccountId)}
                >
                  Hesabı oluştur
                </button>
              </div>
            )}
            {payments.length > 0 && target && (
              <label className="block">
                <span className="label">
                  Kart ödemesi ({payments.length}) {targetIsCard ? 'hangi hesaptan yapıldı?' : 'hangi karta yapıldı?'}
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="label mb-0">
                    İşlemler: {selected.length} / {rows.length} seçili
                  </span>
                  <span className="flex gap-3 text-sm">
                    <button className="text-emerald-700 dark:text-emerald-400" onClick={() => setAll(true)}>
                      Tümü
                    </button>
                    <button className="text-zinc-500" onClick={() => setAll(false)}>
                      Hiçbiri
                    </button>
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span>
                    Gider <Money value={sumOf('expense')} sign="expense" className="font-semibold" />
                  </span>
                  <span>
                    Gelir <Money value={sumOf('income')} sign="income" className="font-semibold" />
                  </span>
                </div>
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
                  {rows.map((r) => {
                    const kind = r.item.type === 'income' ? 'income' : 'expense'
                    const cats = categories.filter((c) => c.kind === kind && (!c.archived || c.id === r.tx?.categoryId))
                    return (
                      <li key={r.index} className={`space-y-2 p-3 ${r.include ? '' : 'opacity-50'}`}>
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 size-5 accent-emerald-600"
                            checked={r.include}
                            disabled={!r.tx}
                            onChange={(e) => setEdit(r.index, { include: e.target.checked })}
                          />
                          <span className="min-w-0 flex-1 text-sm">
                            <span className="block font-medium break-words">{r.tx?.note ?? r.item.note ?? 'Kart ödemesi'}</span>
                            {r.duplicate && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Zaten kayıtlı · </span>}
                            {r.movedFrom && <span className="text-xs text-zinc-500">Taksit ekstre tarihine yazıldı · </span>}
                            {!r.tx && <span className="text-xs text-zinc-500">Karşı hesabı seçince eklenir</span>}
                          </span>
                          {r.item.type === 'payment' ? (
                            <Money value={r.item.amount} className="text-sm text-zinc-500" />
                          ) : (
                            <Money value={r.item.amount} sign={kind} className="text-sm font-semibold" />
                          )}
                        </label>
                        {r.tx && (
                          <div className="flex flex-wrap gap-2 pl-8">
                            <input
                              type="date"
                              className="input min-h-9 w-auto py-1"
                              aria-label="Tarih"
                              value={r.tx.date}
                              onChange={(e) => setEdit(r.index, { date: e.target.value })}
                            />
                            {r.tx.type !== 'transfer' && (
                              <select
                                className="input min-h-9 w-auto py-1"
                                aria-label="Kategori"
                                value={r.tx.categoryId}
                                onChange={(e) => setEdit(r.index, { categoryId: e.target.value })}
                              >
                                {cats.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.icon} {c.name}
                                  </option>
                                ))}
                                {!cats.some((c) => c.id === r.tx!.categoryId) && <option value={r.tx.categoryId}>➕ Diğer (yeni)</option>}
                              </select>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
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
                  value={r.skip ? '-' : r.acc ? r.acc.id : NEW}
                  onChange={(e) => setPicked((p) => ({ ...p, [r.i]: e.target.value }))}
                >
                  <option value={NEW}>+ Yeni hesap oluştur…</option>
                  <option value="-">Bu bakiyeyi kullanma</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {r.creating && (
                  <div className="space-y-2 rounded-xl border border-emerald-300 p-3 dark:border-emerald-800">
                    <label className="block">
                      <span className="label">Yeni hesabın adı</span>
                      <input
                        className="input"
                        value={balNames[r.i] ?? r.b.label}
                        onChange={(e) => setBalNames((n) => ({ ...n, [r.i]: e.target.value }))}
                      />
                    </label>
                    <Segmented
                      value={balTypes[r.i] ?? r.b.accountType}
                      options={TYPE_OPTIONS}
                      onChange={(t) => setBalTypes((m) => ({ ...m, [r.i]: t }))}
                    />
                    <button
                      className="btn-primary w-full"
                      disabled={!(balNames[r.i] ?? r.b.label).trim()}
                      onClick={() =>
                        void createAccount(balNames[r.i] ?? r.b.label, balTypes[r.i] ?? r.b.accountType).then((id) =>
                          setPicked((p) => ({ ...p, [r.i]: id })),
                        )
                      }
                    >
                      Hesabı oluştur
                    </button>
                  </div>
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

        <button className="btn-primary sticky bottom-0 w-full shadow-lg" disabled={!canCommit || busy} onClick={() => void commit()}>
          {canCommit
            ? `Uygula${selected.length ? ` (${selected.length} işlem${updates.length ? ` + ${updates.length} bakiye` : ''})` : ` (${updates.length} bakiye)`}`
            : 'Değişecek bir şey yok'}
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
