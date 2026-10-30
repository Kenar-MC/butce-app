# Bütçe App — Teknik Şartname (SPEC)

> Ne yapılacağını tanımlar: ekranlar, veri modeli, iş kuralları. Kararların nedenleri için `CONTEXT.md`.

---

## 1. Ekranlar

Mobil öncelikli. Telefonda **alt sekme çubuğu**, geniş ekranda (≥ 768px) **sol menü**.

Sekmeler: **Özet · İşlemler · Hesaplar · Bütçe · Ayarlar**
Her ekranda sağ altta **"+" (yeni işlem)** butonu.

### 1.1 Özet (ana sayfa)
- Üstte **ay seçici** (‹ Ekim 2026 ›)
- 3 kart: **Gelir**, **Gider**, **Net** (gelir − gider)
- **Hesap bakiyeleri** listesi + toplam (kredi kartı borcu eksi görünür)
- **Bütçe durumu**: limiti olan kategoriler için ilerleme çubukları (yeşil < %80, sarı %80–100, kırmızı > %100)
- **Kategori dağılımı**: seçili ayın giderleri, halka (donut) grafik + liste
- **Son 6 ay**: gelir vs gider çubuk grafik
- **Yaklaşanlar**: önümüzdeki 30 günün tekrarlayan işlemleri ve taksitleri

### 1.2 İşlemler
- Seçili aya ait işlemler, **güne göre gruplu** (her gün başlığında günlük toplam)
- Filtre: tür (gelir/gider/transfer), hesap, kategori; not alanında arama
- Satır: kategori ikonu/rengi, açıklama/not, hesap adı, tutar (gelir yeşil +, gider kırmızı −). Taksitliyse "3/12" rozeti, tekrarlayansa ↻ ikonu
- Satıra dokununca düzenleme formu; formda **Sil** butonu (onaylı)

### 1.3 İşlem ekle / düzenle (alttan açılan panel / modal)
- Tür seçici: **Gider · Gelir · Transfer**
- **Tutar** — büyük alan, `inputmode="decimal"`; `1250,50` ve `1250.50` ikisi de kabul edilir
- **Kategori** (türe göre filtreli, ikonlu ızgara)
- **Hesap** (transferde: *Kimden* → *Kime*)
- **Tarih** (varsayılan bugün)
- **Not** (isteğe bağlı)
- **Taksitli** anahtarı — sadece *gider + kredi kartı hesabı* seçiliyken görünür → taksit sayısı (2–36), toplam tutar girilir, aylık tutar önizlenir
- **Tekrarlasın** anahtarı → sıklık (aylık / haftalık / yıllık), isteğe bağlı bitiş tarihi
- Taksitli ve Tekrarlasın aynı anda açık olamaz

### 1.4 Hesaplar
- Hesap listesi: ad, tür ikonu, güncel bakiye
- Kredi kartında ek bilgi: **gelecek taksit toplamı**
- Ekle / düzenle / arşivle (işlemi olan hesap silinmez, arşivlenir)
- Alanlar: ad, tür (Nakit / Banka / Kredi Kartı), açılış bakiyesi, renk

### 1.4b Hesap detayı (`/hesaplar/:id`)
- Bakiye, **Ay ay / Tüm zamanlar** seçimi + ay seçici; **Harcamalar / Gelirler kategoriye göre** (tutar, işlem sayısı, %, çubuk); kategoriye dokununca liste süzülür
- O hesabın o aydaki işlemleri tek tek (transferler dahil); "Düzenle" hesap formunu açar
- Hesaplar listesinde her satırda bu ayın gideri ve en çok harcanan 2 kategori

### 1.4c İçe aktar (`/ice-aktar`)
- + düğmesinin üstündeki fotoğraf simgeli düğmeyle açılır: 1) Ekstre Okuyucu'yu aç, 2) dosyayı yükle
- İçe aktarma panelinde **her işlem tek tek listelenir**: seç/çıkar, tarih ve kategori değiştir; zaten kayıtlı olanlar işaretli ve seçili değil. Son içe aktarma geri alınabilir (`importId`).
- İçe aktarma panelinde işlemlerin yazılacağı hesap için "+ Yeni hesap oluştur…" (ad ve tür ekstreden önerilir); uygulanınca o hesabın detayına gidilir

### 1.5 Bütçe
- Gider kategorileri listesi; her birine **aylık limit** girilebilir (boş = limit yok)
- Seçili ay için harcanan / limit / kalan ve ilerleme çubuğu
- Toplam limit ve toplam harcama özeti

### 1.6 Ayarlar
- **Kategoriler**: ekle, düzenle (ad, ikon, renk), arşivle
- **Tekrarlayan işlemler**: liste, duraklat/devam, düzenle, sil
- **Taksit planları**: liste, kalan taksit, planı sil
- **Yedekleme**: JSON yedek indir, JSON yedekten geri yükle, işlemleri CSV olarak indir
- **Depolama**: kalıcı depolama durumu (persist), son yedek tarihi
- **Tehlikeli bölge**: tüm veriyi sil (iki adımlı onay)

### 1.7 İlk açılış
- Veritabanı boşsa: varsayılan kategoriler ve bir "Nakit" hesabı otomatik oluşturulur
- Kısa karşılama: "İlk hesabını ekle" yönlendirmesi

---

## 2. Veri modeli (Dexie / IndexedDB)

Ortak kurallar:
- `id`: `string` — `crypto.randomUUID()` (ileride senkron için çakışmasız)
- Tutarlar: `number`, **tam sayı kuruş**, her zaman **pozitif**; yönü `type` belirler
- `currency`: `'TRY'` (şimdilik sabit)
- Tarihler: `'YYYY-MM-DD'` string (saat dilimi kayması olmasın); zaman damgaları ISO string
- Her tabloda `createdAt`, `updatedAt`

```ts
type AccountType = 'cash' | 'bank' | 'credit_card';
type TxType = 'income' | 'expense' | 'transfer';
type CategoryKind = 'income' | 'expense';
type Frequency = 'weekly' | 'monthly' | 'yearly';

interface Account {
  id: string;
  name: string;              // "Nakit", "Garanti Vadesiz", "Bonus Kart"
  type: AccountType;
  currency: 'TRY';
  openingBalance: number;    // kuruş; kredi kartında mevcut borç negatif girilir
  color?: string;
  archived: boolean;
  createdAt: string; updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;              // emoji veya ikon adı
  color: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string; updatedAt: string;
}

interface Transaction {
  id: string;
  type: TxType;
  amount: number;            // kuruş, > 0
  currency: 'TRY';
  date: string;              // 'YYYY-MM-DD'
  accountId: string;         // transferde kaynak hesap
  toAccountId?: string;      // sadece transfer
  categoryId?: string;       // transferde yok
  note?: string;
  installmentPlanId?: string;
  installmentNo?: number;    // 1..count
  recurringRuleId?: string;
  createdAt: string; updatedAt: string;
}

interface InstallmentPlan {
  id: string;
  accountId: string;         // kredi kartı
  categoryId: string;
  totalAmount: number;       // kuruş
  currency: 'TRY';
  count: number;             // 2..36
  firstDate: string;         // ilk taksit tarihi
  note?: string;
  createdAt: string; updatedAt: string;
}

interface RecurringRule {
  id: string;
  type: TxType;
  amount: number;
  currency: 'TRY';
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  note?: string;
  frequency: Frequency;
  startDate: string;         // ilk tekrar tarihi; gün bilgisi buradan alınır
  endDate?: string;
  lastGeneratedDate?: string;
  active: boolean;
  createdAt: string; updatedAt: string;
}

interface Budget {
  id: string;
  categoryId: string;        // gider kategorisi, benzersiz
  monthlyLimit: number;      // kuruş
  currency: 'TRY';
  createdAt: string; updatedAt: string;
}

interface Setting { key: string; value: unknown; }  // lastBackupAt, theme vb.
```

Dexie şema (v1) — indeksler:
```ts
db.version(1).stores({
  accounts:         'id, type, archived',
  categories:       'id, kind, archived, sortOrder',
  transactions:     'id, date, type, accountId, toAccountId, categoryId, installmentPlanId, recurringRuleId, [recurringRuleId+date]',
  installmentPlans: 'id, accountId',
  recurringRules:   'id, active',
  budgets:          'id, &categoryId',
  settings:         'key',
});
```

---

## 3. İş kuralları

### 3.1 Para
- Giriş: `"1.250,50"`, `"1250,50"`, `"1250.50"`, `"1250"` → `125050`. Geçersiz/0/negatif tutar reddedilir.
- Gösterim: `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })` → `₺1.250,50`
- Tüm hesaplar `domain/money.ts` içindeki fonksiyonlarla yapılır.

### 3.2 Hesap bakiyesi
```
bakiye = openingBalance
       + Σ gelir (accountId = hesap)
       − Σ gider (accountId = hesap)
       − Σ transfer çıkış (accountId = hesap)
       + Σ transfer giriş (toAccountId = hesap)
```
- Sadece **tarihi bugün veya öncesi** olan işlemler sayılır (gelecek taksitler bakiyeyi etkilemez).
- Kredi kartı bakiyesi genelde negatiftir (= borç). **Kart borcu ödemesi = bankadan karta transfer.**
- Kredi kartı için ayrıca: `gelecek taksit toplamı = Σ (taksit işlemleri, date > bugün)`

### 3.3 Taksit
- Kullanıcı **toplam tutarı** ve **taksit sayısını** girer.
- `aylık = floor(toplam / n)`; kalan kuruş **ilk taksite** eklenir. Örnek: 1000,00 ₺ / 3 → 333,34 + 333,33 + 333,33.
- Kayıt anında `InstallmentPlan` + **n adet `Transaction`** birlikte oluşturulur (tek Dexie transaction'ı içinde).
- Tarihler: `firstDate`'ten başlayarak her ay aynı gün; ayda o gün yoksa ayın son günü (31 Ocak → 28/29 Şubat).
- Not: `"<not> (3/12)"` şeklinde gösterilir (`installmentNo/count`).
- Taksitli işlem tek başına düzenlenirse sadece o taksit değişir. **Plan silinirse**: kullanıcıya "sadece gelecek taksitler" / "tümü" sorulur.

### 3.4 Tekrarlayan işlem
- Kural kaydedildiğinde ve **uygulama her açıldığında** `generateDueRecurring(today)` çalışır:
  - Her aktif kural için, `lastGeneratedDate`'ten sonraki (yoksa `startDate` dahil) **bugüne kadarki** tüm tekrarlar işlem olarak oluşturulur (uygulama günlerce açılmazsa eksikler tamamlanır).
  - Aynı `[recurringRuleId+date]` için ikinci kayıt oluşmaz (idempotent).
  - `endDate` geçmişse kural pasif olur.
- Gün kuralı taksitle aynı (ayın son gününe sabitleme).
- **Gelecek tekrarlar kaydedilmez**, "Yaklaşanlar" için anlık hesaplanır.
- Kural düzenlenirse sadece **gelecekteki** tekrarlar etkilenir; oluşmuş işlemler olduğu gibi kalır. Kural silinirse geçmiş işlemler kalır, bağlantıları (`recurringRuleId`) korunur.

### 3.5 Bütçe limiti
- Sadece gider kategorilerine.
- `harcanan(ay) = Σ gider (categoryId, date ∈ ay)` — taksitler ödendikleri ayın bütçesine yazılır.
- Durum: `< %80` normal, `%80–100` uyarı, `> %100` aşım. İşlem kaydederken limit aşılırsa kısa bir uyarı (toast) gösterilir; kayıt engellenmez.

### 3.6 Raporlar
- Gelir/gider toplamlarına **transferler dahil edilmez**.
- Ay = takvim ayı (1–son gün). (İleride: "maaş günü başlangıçlı ay" seçeneği.)

### 3.7 Yedekleme
- **JSON yedek**: `{ app: 'butce-app', schemaVersion, exportedAt, data: { accounts, categories, ... } }` → `butce-yedek-2026-10-30.json`
- **Geri yükleme (MVP)**: dosya doğrulanır → onay → mevcut veri **tamamen değiştirilir**. (Birleştirme ileride.)
- **CSV**: işlemler; UTF-8 BOM + `;` ayırıcı (Türkçe Excel'de düzgün açılsın). Sütunlar: Tarih; Tür; Hesap; Kategori; Tutar; Not.
- Son yedekten 30 gün geçtiyse Özet'te hatırlatma.

---

### 3.8 İçe aktarma dosyası (Ekstre Okuyucu → uygulama)
```json
{ "app": "butce-app", "kind": "import", "version": 1, "source": "ekstre-okuyucu",
  "statement": { "bank": "Garanti BBVA", "period": "Ekim 2026" },
  "summary": { "statementDate": "2026-10-25", "dueDate": "2026-11-05", "statementBalance": 1234550,
               "minimumPayment": 246910, "totalDebt": 2049850 },
  "balances": [ { "label": "Garanti Vadesiz TL", "accountType": "bank|credit_card|cash", "amount": 4500000, "asOf": "2026-10-30" } ],
  "items": [ { "date": "2026-10-08", "type": "expense|income|payment", "amount": 249983,
               "categoryName": "Ev", "note": "TEKNOSA", "installment": { "no": 3, "count": 6 } } ] }
```
- Hepsi seçilen tek hesaba yazılır (genelde kredi kartı). `payment` → seçilen kaynak hesaptan karta transfer; kaynak seçilmezse atlanır.
- Kategori adı eşleşmezse "Diğer"/"Diğer Gelir". Taksit bilgisi nota eklenir: `TEKNOSA (3/6)`.
- Tekrar: aynı tarih + tür + tutar + hesap olan mevcut kayıt bir satırı eler.
- Banka hareketinde (hedef kart değilse) kart ödemesi: bu hesaptan seçilen karta transfer.
- `balances`: her satır ad benzerliği + türle bir hesaba eşlenir (yoksa tek dokunuşla oluşturulur). Hesabın `asOf` tarihindeki bakiyesi tutara eşitlenir; fark **açılış bakiyesine** yazılır (gelir/gider raporunu etkilemez). Kartta tutar borçtur (bakiye −tutar).
- `summary` bilgi amaçlıdır; kart bakiyesi yoksa **kalan toplam borçtan** (yoksa ekstre borcundan) kart bakiyesi üretilir. Kalan borç, ekstre sonrası ödeme ve harcamaları yansıtır.
- Ekstre Okuyucu kaynağı: `tools/ekstre-okuyucu/index.html` (değişince artifact'ı da yeniden yayınla).
- Ekstre Okuyucu: https://claude.ai/artifact/PWM5VX9xkNTK4G1v6mxFmr (kaynak: Mehmet'in artifact'ları)

## 4. Varsayılan kategoriler

**Gider:** 🛒 Market · 🍽️ Yeme-İçme · 🚌 Ulaşım · ⛽ Akaryakıt · 🏠 Kira · 💡 Faturalar · 📱 Telefon/İnternet · 🔁 Abonelikler · 🏥 Sağlık · 🎓 Eğitim · 👕 Giyim · 🎉 Eğlence · 🏋️ Spor · 🛋️ Ev · 💈 Kişisel Bakım · 🎁 Hediye · ➕ Diğer

**Gelir:** 💼 Maaş · 🧾 Serbest/Ek Gelir · 🏘️ Kira Geliri · 📈 Faiz/Getiri · ➕ Diğer Gelir

---

## 5. Klasör yapısı

```
butce-app/
├─ CLAUDE.md
├─ docs/ (CONTEXT.md, SPEC.md, PLAN.md)
├─ public/ (ikonlar, manifest görselleri)
└─ src/
   ├─ main.tsx, App.tsx, routes.tsx
   ├─ db/          db.ts (Dexie şema), types.ts, seed.ts, hooks.ts, backup.ts (Faz 5)
   ├─ domain/      money.ts, dates.ts, balances.ts, installments.ts, recurring.ts, budgets.ts, reports.ts  (+ *.test.ts)
   ├─ features/
   │  ├─ dashboard/  ├─ transactions/  ├─ accounts/  ├─ budgets/  └─ settings/
   ├─ components/  ui.tsx (Sheet, AmountInput, MonthPicker, Money, Segmented, ConfirmButton), Layout.tsx, AppContext.ts
   └─ lib/         id.ts (UUID + yedek yol), csv.ts (Faz 5)
```

`domain/` = saf TypeScript fonksiyonları (React ve Dexie'ye bağımlı değil) → Vitest ile test edilir.
