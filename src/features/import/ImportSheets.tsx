import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../../components/AppContext'
import { ConfirmButton, Money, Segmented, Sheet } from '../../components/ui'
import { restoreBackup } from '../../db/backup'
import { db } from '../../db/db'
import { CARD_KINDS, useCards, useCategories, useSetting } from '../../db/hooks'
import { commitImport, createCard } from '../../db/statements'
import type { CardKind } from '../../db/types'
import type { BackupFile } from '../../domain/backup'
import { formatDateTR, formatMonthTR } from '../../domain/dates'
import { defaultMonth, monthOptions, planStatement, suggestCard, type ImportFile, type MonthMode } from '../../domain/importer'
import { newId, nowISO } from '../../lib/id'

const NEW = '__new'
const KIND_OPTIONS = Object.entries(CARD_KINDS).map(([k, v]) => [k, v.label]) as [CardKind, string][]

type RowEdit = { include?: boolean; categoryId?: string }

export function ImportSheet({ file, onClose }: { file: ImportFile; onClose: () => void }) {
  const cards = useCards()
  const categories = useCategories()
  const rules = useLiveQuery(async () => Object.fromEntries((await db.rules.toArray()).map((r) => [r.key, r.categoryId])))
  const existing = useLiveQuery(() => db.transactions.toArray())
  const lastCardId = useSetting<string>('lastCardId')
  const { setMonth } = useApp()
  const navigate = useNavigate()

  const bank = file.statement?.bank ?? null
  const looksCard = !!file.summary || file.items.some((i) => i.type === 'payment' || i.installment)
  const [cardChoice, setCardChoice] = useState('')
  const [newName, setNewName] = useState(bank ? `${bank}${looksCard ? ' kart' : ''}` : '')
  const [newKind, setNewKind] = useState<CardKind>(looksCard ? 'credit_card' : 'bank')
  const [month, setMonthMode] = useState<MonthMode>(() => defaultMonth(file))
  const [edits, setEdits] = useState<Record<number, RowEdit>>({})
  const [busy, setBusy] = useState(false)

  const suggested = suggestCard(bank, cards, lastCardId)
  const target = cardChoice === NEW ? '' : cardChoice || suggested || ''
  const card = cards.find((c) => c.id === target)
  const creating = !card

  const plan =
    card && existing && rules
      ? planStatement(file.items, {
          cardId: card.id,
          month,
          categories,
          rules,
          existing: existing.filter((t) => t.cardId === card.id),
          now: nowISO(),
          newId,
        })
      : null
  const rows = (plan?.rows ?? []).map((r) => {
    const e = edits[r.index] ?? {}
    return { ...r, include: e.include ?? !r.duplicate, tx: { ...r.tx, categoryId: e.categoryId ?? r.tx.categoryId } }
  })
  const selected = rows.filter((r) => r.include).map((r) => r.tx)
  const setEdit = (i: number, e: RowEdit) => setEdits((s) => ({ ...s, [i]: { ...s[i], ...e } }))
  const setAll = (include: boolean) => setEdits((s) => Object.fromEntries(rows.map((r) => [r.index, { ...s[r.index], include }])))
  const dupCount = rows.filter((r) => r.duplicate).length
  const sumOf = (type: string) => selected.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0)
  const summaryOnly = !!file.summary && month !== 'date'
  const canCommit = !!card && (selected.length > 0 || summaryOnly)

  const cardKey = card?.id ?? ''
  const statementExists = useLiveQuery(
    () => (cardKey && month !== 'date' ? db.statements.where('[cardId+month]').equals([cardKey, month]).count() : 0),
    [cardKey, month],
  )

  async function commit() {
    if (!card || !plan || !canCommit || busy) return
    setBusy(true)
    const last = await commitImport({ card, month, rows: selected, newCategories: plan.newCategories, summary: file.summary, bank })
    onClose()
    setMonth(month !== 'date' ? month : [...last.months].sort().pop()!)
    navigate('/')
  }

  const sm = file.summary
  const options = monthOptions(file)

  return (
    <Sheet title="Ekstreyi ekle" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          {[bank, file.statement?.period].filter(Boolean).join(' · ') || 'Ekstre Okuyucu dosyası'}
          {` — ${file.items.length} satır`}
          {file.invalid ? `, ${file.invalid} bozuk satır atlandı` : ''}
          {plan?.skippedPayments ? `, ${plan.skippedPayments} kart ödemesi sayılmadı` : ''}
        </p>
        {sm && (
          <p className="rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            {sm.statementDate && <>Kesim: <strong>{formatDateTR(sm.statementDate)}</strong> · </>}
            {sm.dueDate && <>Son ödeme: <strong>{formatDateTR(sm.dueDate)}</strong> · </>}
            {sm.statementBalance !== undefined && <>Ekstre borcu: <Money value={sm.statementBalance} /> · </>}
            {sm.minimumPayment !== undefined && <>Asgari: <Money value={sm.minimumPayment} /></>}
          </p>
        )}

        <label className="block">
          <span className="label">Hangi kartın / hesabın ekstresi?</span>
          <select className="input" value={creating ? NEW : target} onChange={(e) => setCardChoice(e.target.value)}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {CARD_KINDS[c.kind].icon} {c.name}
              </option>
            ))}
            <option value={NEW}>+ Yeni kart / hesap…</option>
          </select>
        </label>
        {creating && (
          <div className="space-y-2 rounded-xl border border-emerald-300 p-3 dark:border-emerald-800">
            <label className="block">
              <span className="label">Adı</span>
              <input className="input" value={newName} placeholder="ör. DenizBank Black" onChange={(e) => setNewName(e.target.value)} />
            </label>
            <Segmented value={newKind} options={KIND_OPTIONS} onChange={setNewKind} />
            <button className="btn-primary w-full" disabled={!newName.trim()} onClick={() => void createCard(newName, newKind).then(setCardChoice)}>
              Oluştur
            </button>
          </div>
        )}

        <label className="block">
          <span className="label">Hangi aya sayılsın?</span>
          <select className="input" value={month} onChange={(e) => setMonthMode(e.target.value)}>
            {options.map((m) => (
              <option key={m} value={m}>
                {formatMonthTR(m)} ekstresi
              </option>
            ))}
            <option value="date">Her satır kendi tarihinin ayına</option>
          </select>
          {month !== 'date' && !!statementExists && (
            <span className="mt-1 block text-xs text-zinc-500">
              Bu kartın {formatMonthTR(month)} ekstresi zaten var; yeni satırlar ona eklenir, aynıları atlanır.
            </span>
          )}
        </label>

        {plan && rows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="label mb-0">
                Satırlar: {selected.length} / {rows.length} seçili{dupCount ? ` · ${dupCount} zaten kayıtlı` : ''}
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
                Harcama <Money value={sumOf('expense')} sign="expense" className="font-semibold" />
              </span>
              {sumOf('income') > 0 && (
                <span>
                  İade / gelen <Money value={sumOf('income')} sign="income" className="font-semibold" />
                </span>
              )}
            </div>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700">
              {rows.map((r) => {
                const cats = categories.filter((c) => c.kind === r.tx.type && (!c.archived || c.id === r.tx.categoryId))
                return (
                  <li key={r.index} className={`space-y-2 p-3 ${r.include ? '' : 'opacity-50'}`}>
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-5 accent-emerald-600"
                        checked={r.include}
                        onChange={(e) => setEdit(r.index, { include: e.target.checked })}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-medium">{r.tx.merchant}</span>
                        <span className="block text-xs break-words text-zinc-500">
                          {formatDateTR(r.tx.date)}
                          {r.tx.installment && ` · ${r.tx.installment.no}/${r.tx.installment.count} taksit`}
                          {r.tx.description !== r.tx.merchant && ` · ${r.tx.description}`}
                        </span>
                        {r.duplicate && <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Zaten kayıtlı</span>}
                      </span>
                      <Money value={r.tx.amount} sign={r.tx.type} className="text-sm font-semibold" />
                    </label>
                    <div className="pl-8">
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
                        {!cats.some((c) => c.id === r.tx.categoryId) && <option value={r.tx.categoryId}>➕ Diğer (yeni)</option>}
                      </select>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <button className="btn-primary sticky bottom-0 w-full shadow-lg" disabled={!canCommit || busy} onClick={() => void commit()}>
          {!card
            ? 'Önce kartı seç ya da oluştur'
            : selected.length
              ? `Ekle (${selected.length} satır)`
              : summaryOnly
                ? 'Sadece özet bilgisini kaydet'
                : 'Eklenecek satır yok'}
        </button>
      </div>
    </Sheet>
  )
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
          Yedek tarihi: <strong>{file.exportedAt ? new Date(file.exportedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'bilinmiyor'}</strong>
          <br />
          {file.data.cards.length} kart, {file.data.statements.length} ekstre, {file.data.transactions.length} satır
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
