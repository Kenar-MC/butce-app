# Bütçe App — Teknik Şartname (SPEC)

> **Ne** yapılacağını tanımlar. Uygulama 2026-11-06'dan beri **ekstre sürümü**: sadece ekstre okuma ve aylık harcama grafikleri (K11).
> Eski gelir–gider sürümünün şartnamesi git geçmişinde (`23a3441` ve öncesi).

## 1. Ekranlar

Alt menü (mobil) / yan menü (≥768px): **Özet · Trend · Ekstreler · Ayarlar**. Sağ altta yeşil yükleme düğmesi → İçe aktar.
Kart filtresi (birden fazla kart varsa) ve seçili ay Özet ile Trend arasında ortak (`AppContext`).

### 1.1 Özet (`/`)
- Maskot + ayın durumuna göre laf (geçen aya göre fazla/az).
- Ay seçici: oklar sadece **verisi olan aylar** arasında gezer. Varsayılan: verisi olan son ay; içe aktarmadan sonra aktarılan ay.
- Kahraman kart: "Ekim 2026 harcaması" (kırmızı), işlem sayısı, geçen aya göre değişim (▲ fazla kırmızı / ▼ az yeşil; %0 ise yazılmaz), iade/gelen para ayrı.
- **Aylık harcama**: son 12 ayın sütun grafiği (Recharts). Tek seri, mavi; seçili ay koyu, diğerleri açık ton, seçili sütunun üstünde değer. Bir aya (sütunun hizasına) dokununca o ay seçilir. Y ekseni kısaltılmış (`7,5 B`).
- **Kategoriler**: seçili ayın gider dağılımı, tam yükseklikte dolu çubuk satırları (kategori rengi, işlem sayısı, %). Dokununca o kategorinin işlemleri altında açılır.
- **En çok harcanan yerler**: işyeri bazında (ilk 8, "Tümünü göster"), dokununca işlemleri açılır.
- Hiç veri yoksa karşılama: maskot, iki adımlık açıklama, "İlk ekstreni yükle".

### 1.2 Trend (`/trend`)
- Son 6 / 12 ay seçimi; toplam ve aylık ortalama.
- Her kategori bir satır (pencere toplamına göre büyükten küçüğe): aylık ortalama, **son ay** tutarı, son ayın önceki ayların ortalamasına göre değişimi, küçük sütunlar (son ay koyu). Dokununca o kategorinin aylık sütun grafiği açılır.

### 1.3 Ekstreler (`/ekstreler`, `/ekstreler/:id`)
- Liste: aya göre gruplu (yeniden eskiye), her satır kart · işlem sayısı · son ödeme · harcama.
- Detay: kart + ay, harcama ve iade, özet bilgileri (kesim, son ödeme, ekstre borcu, asgari, kalan borç), kategori çubukları (dokununca işlemler), tüm satırlar, "Ekstreyi sil (N satır)" (iki dokunuş), "Bu ayın özetine git".

### 1.4 Satır ayrıntısı (alttan panel)
- Tutar, tarih, kart, hangi ayın ekstresi, taksit, ekstredeki açıklama.
- Kategori değiştir; işyerinin birden fazla satırı varsa "hepsine uygula ve sonraki ekstrelerde de böyle sınıflandır" (varsayılan açık) → aynı işyerinin aynı türdeki tüm satırları değişir ve **işyeri kuralı** kaydedilir.
- Satırı sil.

### 1.5 İçe aktar (`/ice-aktar`)
1. Ekstre Okuyucu'yu aç (fotoğraf / ekran görüntüsü / PDF → `kind:"import"` JSON indir).
2. Dosya yükle → **Ekstreyi ekle** paneli:
   - Kart / hesap seç (banka adı kart adında geçiyorsa o, yoksa son kullanılan) ya da yeni oluştur (ad + kredi kartı/banka hesabı).
   - **Hangi aya sayılsın?** Varsayılan: kesim tarihinin ayı; yoksa satırlar tek aydaysa o ay; değilse "her satır kendi tarihinin ayına". Aynı kart+ay ekstresi varsa satırlar ona eklenir (not gösterilir).
   - Satırlar tek tek: işaret kutusu, işyeri, tarih, taksit, açıklama, kategori seçimi. Zaten kayıtlı olanlar işaretsiz gelir. Kart ödemeleri sayılmaz (atlanır, sayısı yazılır).
   - Satır yoksa ama özet varsa "Sadece özet bilgisini kaydet".
3. Son içe aktarmayı geri al (satırlar silinir, o aktarmayla açılıp boş kalan ekstreler de).

### 1.6 Ayarlar
- Kartlar ve hesaplar: ad / tür düzenle, sil (ekstreleri ve satırlarıyla).
- Kategoriler (gider / gelir): ekle, düzenle (ikon, ad, renk), arşivle.
- Yedek al / yedekten geri yükle. Sürüm etiketi.

## 2. Veri modeli (Dexie, veritabanı `butce-ekstre`)

Eski sürümün `butce-app` veritabanına dokunulmaz (K11). Tutarlar kuruş, tarihler `YYYY-MM-DD`, aylar `YYYY-MM`.

```ts
cards:        'id'                                   // Card { id, name, kind: 'credit_card'|'bank', currency }
statements:   'id, cardId, month, [cardId+month]'    // Statement { id, cardId, month, currency, bank?, statementDate?, dueDate?,
                                                     //   statementBalance?, minimumPayment?, totalDebt? }  — kart+ay başına tek kayıt
transactions: 'id, month, date, cardId, statementId, categoryId, importId'
              // Transaction { id, statementId, cardId, month, date, type: 'expense'|'income', amount, currency,
              //   categoryId, description, merchant, installment?: {no,count}, importId }
categories:   'id, kind, sortOrder'                  // Category { id, name, kind, icon, color, archived, sortOrder }
rules:        'key'                                  // MerchantRule { key: merchantKey(merchant), categoryId, updatedAt }
settings:     'key'                                  // lastCardId, lastImport, lastBackupAt
```
Her kayıtta `createdAt` / `updatedAt` (rules'ta `updatedAt`).

## 3. İş kuralları

### 3.1 Para
- Kuruş tam sayı; ayrıştırma/gösterim sadece `src/domain/money.ts`.

### 3.2 Ay (dönem)
- Kart ekstresinde satır, işlem tarihinden bağımsız olarak **ekstrenin ayına** sayılır (Eylül'de yapılan alışveriş Ekim ekstresindeyse Ekim harcamasıdır).
- "Her satır kendi tarihinin ayına" seçilirse `month = monthKey(date)` (banka hesap hareketleri için).

### 3.3 Harcama ve iade
- Harcama = `expense` satırları. `income` (iade, gelen para) ayrı gösterilir, harcamadan **düşülmez** (maaş gibi gelirler harcamayı sıfırlamasın).
- Kart ödemeleri (`payment`) içe aktarılmaz.

### 3.4 İşyeri
- Okuyucunun verdiği kısa ad (`merchant`), yoksa açıklamadan tahmin (`guessMerchant`: ödeme aracıları ve kod parçaları atılır, ilk anlamlı kelime).
- Gruplama anahtarı `merchantKey`: küçük harf, Türkçe karakterler sadeleşir (ŞOK = SOK), harf/rakam dışı boşluk.
- Kural varsa (`rules`) içe aktarmada okuyucunun kategorisini ezer (tür uyuyorsa).

### 3.5 Tekrar
- Aynı kartta aynı tarih + tür + tutar olan mevcut kayıt bir satırı "zaten kayıtlı" işaretler (çoklu küme: iki aynı satır varsa ikisi de sayılır).

### 3.6 İstatistik (`src/domain/stats.ts`)
- `monthlyTotals`, `categoryTotals` (pay ile), `merchantTotals`, `categoryTrend`, `chartMonths` (en fazla n ay, son veri ayıyla biter, seçili ayı pencerede tutar), `change` (önceki 0 ise yok).

### 3.7 Yedekleme
- `{ app: 'butce-app', kind: 'backup', schemaVersion: 2, exportedAt, data: { cards, statements, transactions, categories, rules, settings } }` → `butce-yedek-YYYY-MM-DD.json`.
- Geri yükleme mevcut veriyi tamamen değiştirir (tek işlem). Eski sürüm yedekleri (`schemaVersion: 1`) reddedilir.

### 3.8 İçe aktarma dosyası (Ekstre Okuyucu → uygulama)
```json
{ "app": "butce-app", "kind": "import", "version": 1, "source": "ekstre-okuyucu",
  "statement": { "bank": "Garanti BBVA", "period": "Ekim 2026" },
  "summary": { "statementDate": "2026-10-14", "dueDate": "2026-10-24", "statementBalance": 1234550,
               "minimumPayment": 246910, "totalDebt": 2049850 },
  "balances": [],
  "items": [ { "date": "2026-10-08", "type": "expense|income|payment", "amount": 249983,
               "categoryName": "Ev", "note": "TEKNOSA ZORLU AVM", "merchant": "Teknosa",
               "installment": { "no": 3, "count": 6 } } ] }
```
- `merchant` isteğe bağlı (eski dosyalarda yok → tahmin). `balances` artık kullanılmaz (okuyucu boş gönderir).
- Kategori adı eşleşmezse "Diğer" / "Diğer Gelir" (yoksa oluşturulur).
- Ekstre Okuyucu: https://claude.ai/artifact/PWM5VX9xkNTK4G1v6mxFmr — kaynak `tools/ekstre-okuyucu/index.html` (değişince artifact'ı da yeniden yayınla).
- Okuyucu girdileri: görseller (40'a kadar; çağrı başına sınırla gruplar halinde) ve PDF (pdf.js 3.11.174, cdnjs; metin katmanı varsa metin, yoksa sayfa görüntüsü; şifreli PDF'te şifre sorulur, saklanmaz).

## 4. Varsayılan kategoriler

**Gider:** 🛒 Market · 🍽️ Yeme-İçme · 🚌 Ulaşım · ⛽ Akaryakıt · 🏠 Kira · 💡 Faturalar · 📱 Telefon/İnternet · 🔁 Abonelikler · 🏥 Sağlık · 🎓 Eğitim · 👕 Giyim · 🎉 Eğlence · 🏋️ Spor · 🛋️ Ev · 💈 Kişisel Bakım · 🎁 Hediye · ➕ Diğer

**Gelir / iade:** 💼 Maaş · 🧾 Serbest/Ek Gelir · 🏘️ Kira Geliri · 📈 Faiz/Getiri · ➕ Diğer Gelir

Okuyucunun kategori listesi bununla aynıdır (değişirse ikisini birlikte değiştir).

## 5. Klasör yapısı

```
src/
├─ main.tsx, App.tsx, pwa.ts
├─ db/          db.ts (şema), types.ts, seed.ts, hooks.ts, statements.ts (içe aktar / geri al / sil / kategori kuralı), backup.ts
├─ domain/      money.ts, dates.ts, importer.ts, merchant.ts, stats.ts, backup.ts  (+ *.test.ts)
├─ features/
│  ├─ dashboard/ (Özet)  ├─ trend/  ├─ statements/ (liste, detay, TxSheet)  ├─ import/  └─ settings/
├─ components/  ui.tsx (Sheet, MonthStepper, Money, ConfirmButton, Segmented, SelectChip, BarRow, Empty),
│               MonthChart.tsx (Recharts), TxList.tsx, Layout.tsx, AppContext.ts
└─ lib/         id.ts, files.ts
tools/ekstre-okuyucu/index.html   — artifact kaynağı
```
