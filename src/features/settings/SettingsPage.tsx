import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ConfirmButton, Segmented, Sheet } from '../../components/ui'
import { db } from '../../db/db'
import { CARD_KINDS, useCards, useCategories, kindIcon } from '../../db/hooks'
import { deleteCard } from '../../db/statements'
import type { Card, CardKind, Category, CategoryKind } from '../../db/types'
import { newId, nowISO } from '../../lib/id'
import mascot from '../../assets/mascot.webp'
import DataSection from './DataSection'
import { cardLabel } from '../../domain/cards'
import { clearCacheAndReload } from '../../lib/recover'
import { checkForUpdate } from '../../pwa'

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b']
const KINDS: [CategoryKind, string][] = [
  ['expense', 'Gider'],
  ['income', 'Gelir'],
]

export default function SettingsPage() {
  const categories = useCategories()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [editing, setEditing] = useState<{ cat?: Category } | null>(null)
  const list = categories.filter((c) => c.kind === kind)
  const cards = useCards()
  const counts = useLiveQuery(async () => {
    const m: Record<string, number> = {}
    for (const s of await db.statements.toArray()) m[s.cardId] = (m[s.cardId] ?? 0) + 1
    return m
  })
  const [editCard, setEditCard] = useState<Card | null>(null)

  return (
    <div className="space-y-4">
      <h1 className="flex min-h-11 items-center pr-[4.5rem] text-xl font-bold">Ayarlar</h1>

      <section className="space-y-3">
        <h2 className="font-semibold">Kartlar ve hesaplar</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-zinc-500">İlk ekstreyi yüklerken kart oluşturulur.</p>
        ) : (
          <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
            {cards.map((c) => (
              <li key={c.id}>
                <button onClick={() => setEditCard(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="text-2xl">{kindIcon(c.kind)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{cardLabel(c)}</span>
                  <span className="shrink-0 text-sm text-zinc-500">{counts?.[c.id] ?? 0} ekstre</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Kategoriler</h2>
          <button className="btn-ghost" onClick={() => setEditing({})}>
            + Kategori ekle
          </button>
        </div>
        <Segmented value={kind} options={KINDS} onChange={setKind} />
        <ul className="card divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
          {list.map((c) => (
            <li key={c.id}>
              <button onClick={() => setEditing({ cat: c })} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${c.archived ? 'opacity-50' : ''}`}>
                <span className="grid size-10 place-items-center rounded-full text-lg" style={{ background: `${c.color}22` }}>
                  {c.icon}
                </span>
                <span className="flex-1 font-medium">{c.name}</span>
                {c.archived && <span className="text-xs text-zinc-500">arşivde</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <DataSection />

      <img src={mascot} alt="" className="mx-auto size-12 rounded-xl opacity-90" />
      <UpdateCheck />

      {editCard && <CardSheet card={editCard} statements={counts?.[editCard.id] ?? 0} onClose={() => setEditCard(null)} />}
      {editing && <CategorySheet cat={editing.cat} kind={kind} sortOrder={list.length} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CategorySheet({ cat, kind, sortOrder, onClose }: { cat?: Category; kind: CategoryKind; sortOrder: number; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState(cat?.icon ?? '🏷️')
  const [color, setColor] = useState(cat?.color ?? COLORS[7])
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) return setError('Kategori adı gir')
    const now = nowISO()
    await db.categories.put({
      ...(cat ?? { id: newId(), kind, archived: false, sortOrder, createdAt: now }),
      name: name.trim(),
      icon: icon.trim() || '🏷️',
      color,
      updatedAt: now,
    })
    onClose()
  }

  async function toggleArchive() {
    if (cat) await db.categories.update(cat.id, { archived: !cat.archived, updatedAt: nowISO() })
    onClose()
  }

  return (
    <Sheet title={cat ? 'Kategoriyi düzenle' : 'Yeni kategori'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <label className="block">
            <span className="label">İkon</span>
            <input className="input text-center text-2xl" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Ad</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!cat} />
          </label>
        </div>
        <div>
          <span className="label">Renk</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={c === color}
                onClick={() => setColor(c)}
                className={`size-11 rounded-full ${c === color ? 'ring-4 ring-zinc-900/30 dark:ring-white/50' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          {cat && (
            <button type="button" className="btn-ghost" onClick={() => void toggleArchive()}>
              {cat.archived ? 'Arşivden çıkar' : 'Arşivle'}
            </button>
          )}
          <button type="submit" className="btn-primary flex-1">
            Kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}

const KIND_OPTIONS = Object.entries(CARD_KINDS).map(([k, v]) => [k, v.label]) as [CardKind, string][]

function CardSheet({ card, statements, onClose }: { card: Card; statements: number; onClose: () => void }) {
  const [name, setName] = useState(card.name)
  const [kind, setKind] = useState<CardKind>(card.kind)
  const [bank, setBank] = useState(card.bank ?? '')
  const [last4, setLast4] = useState(card.last4 ?? '')
  const last4Ok = last4 === '' || /^\d{4}$/.test(last4)

  async function save() {
    if (!name.trim() || !last4Ok) return
    await db.cards.update(card.id, { name: name.trim(), kind, bank: bank.trim() || undefined, last4: last4 || undefined, updatedAt: nowISO() })
    onClose()
  }

  return (
    <Sheet title="Kartı düzenle" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="block">
          <span className="label">Ad</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="block">
            <span className="label">Banka</span>
            <input className="input" value={bank} placeholder="ör. Garanti BBVA" onChange={(e) => setBank(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Son 4 hane</span>
            <input
              className="input tabular-nums"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              placeholder="1234"
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">Yeni ekstreler bu karta son 4 haneye göre eşlenir; aynı bankanın başka kartıyla karışmaz.</p>
        <Segmented value={kind} options={KIND_OPTIONS} onChange={setKind} />
        <div className="flex flex-wrap gap-2 pt-2">
          <ConfirmButton label={`Sil (${statements} ekstre)`} onConfirm={() => void deleteCard(card.id).then(onClose)} />
          <button type="submit" className="btn-primary flex-1" disabled={!name.trim() || !last4Ok}>
            Kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}

const UPDATE_TEXT = {
  updating: 'Yeni sürüm yükleniyor, uygulama birazdan yenilenecek…',
  latest: 'En güncel sürümü kullanıyorsun.',
  offline: 'İnternet yok; bağlanınca tekrar dene.',
  unsupported: 'Bu tarayıcı güncellemeyi denetleyemiyor.',
} as const

/** Sürüm etiketi + elle güncelleme denetimi */
function UpdateCheck() {
  const [state, setState] = useState<keyof typeof UPDATE_TEXT | 'checking' | null>(null)
  return (
    <div className="space-y-1 pb-2 text-center text-xs text-zinc-400">
      <p>
        Sürüm {__APP_VERSION__} · {new Date(__BUILD_DATE__).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
      </p>
      <button
        className="min-h-11 px-3 text-sm font-medium text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
        disabled={state === 'checking' || state === 'updating'}
        onClick={() => {
          setState('checking')
          void checkForUpdate().then(setState)
        }}
      >
        {state === 'checking' ? 'Denetleniyor…' : 'Güncellemeleri denetle'}
      </button>
      {state && state !== 'checking' && <p role="status">{UPDATE_TEXT[state]}</p>}
      <button className="min-h-11 px-3 text-xs text-zinc-500 underline" onClick={() => void clearCacheAndReload()}>
        Sorun mu var? Önbelleği temizle ve yenile (veriler silinmez)
      </button>
    </div>
  )
}
