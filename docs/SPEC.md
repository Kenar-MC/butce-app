# Bütçe App — Teknik Şartname (SPEC)

> **Ne** yapılacağını tanımlar. Uygulama 2026-11-06'dan beri **ekstre sürümü**: sadece ekstre okuma ve aylık harcama grafikleri (K11).
> Eski gelir–gider sürümünün şartnamesi git geçmişinde (`23a3441` ve öncesi).

## 1. Ekranlar

Alt menü (mobil) / yan menü (≥768px): **Özet · Trend · Ekstreler · Ayarlar**. Sağ altta yeşil yükleme düğmesi → İçe aktar.
Kart filtresi (birden fazla kart varsa) ve seçili ay Özet ile Trend arasında ortak (`AppContext`).

### 1.1 Özet (`/`) — genel bakış (E3)
- Maskot + döneme göre laf. Sağ üstte ay/güneş düğmesi (her ekranda; K17).
- Dönem: **Bu ay / 3 ay (varsayılan) / 6 ay / 12 ay** + kart seçimi. Dönem, verisi olan son aya kadar sayılır.
- Kahraman kart: dönemin toplam harcaması (kırmızı) + önceki eşit uzunlukta döneme göre değişim (▲ kırmızı / ▼ yeşil).
- 4 kutu: Bu ay → 12 ay ortalaması, işlem, geçen ay, en büyük harcama; diğer dönemler → aylık ortalama, işlem, en yüksek ay, en büyük harcama (işyeri + tarih).
- **Harcama dağılımı**: pasta yerine yüzdeli **parçalı şerit** (ilk 5 kategori + "Diğer" gri) ve altında aynı sırada liste (simge, ad, %, tutar). Dokununca Trend'de o kategori açılır.
- **Aylık harcama**: son 12 ay sütun grafiği + kesikli ortalama çizgisi (başlıkta "ort. ₺…"). Bir aya dokununca Trend o aya geçer.
- **En çok harcanan yerler** (ilk 5) ve **Kartlara göre** (birden fazla kart varsa; dokununca o karta süzer): ince mavi çubuklu sıralı liste.
- **Yaklaşan son ödemeler**: son ödeme tarihi bugün/sonra olan ekstreler, kaç gün kaldı (≤3 gün sarı), dokununca ekstre.
- Hiç veri yoksa karşılama: maskot, iki adımlık açıklama, "İlk ekstreni yükle".

### 1.2 Trend (`/trend`) — ay ay ayrıntı (eski "Aylık" görünüm buraya katıldı, E3)
- Üstte yapışkan **ay seçici** (verisi olan aylar) + kart seçimi.
- Ay kartı: o ayın harcaması, işlem sayısı, geçen aya göre değişim, ortalamaya göre üstünde/altında, iade/gelen; 12 ay grafiği (seçili ay koyu, ortalama çizgisi), sütuna dokununca ay değişir.
- **Kategoriler**: 12 aylık pencerede harcaması olan **bütün** kategoriler, seçili aydaki tutara göre sıralı. Satırda aylık ortalama, diğer ayların ortalamasına göre değişim ya da "bu ay yok", 12 küçük sütun (seçili ay koyu), sağda o ayın tutarı. Dokununca kategorinin aylık grafiği ve o ayki işlemleri açılır.
- **En çok harcanan yerler · {ay}**: işyeri bazında, "Tümünü göster", dokununca işlemleri açılır.

### 1.3 Ekstreler (`/ekstreler`, `/ekstreler/:id`)
- Liste: aya göre gruplu (yeniden eskiye), her satır kart · işlem sayısı · son ödeme · harcama.
- Detay: kart + ay, harcama ve iade, özet bilgileri (kesim, son ödeme, ekstre borcu, asgari, kalan borç), kategori çubukları (dokununca işlemler), tüm satırlar, "Ekstreyi sil (N satır)" (iki dokunuş), "Bu ayın özetine git".

### 1.4 Satır ayrıntısı (alttan panel)
- Tutar, tarih, kart, hangi ayın ekstresi, taksit, ekstredeki açıklama.
- Kategori değiştir; işyerinin birden fazla satırı varsa "hepsine uygula ve sonraki ekstrelerde de böyle sınıflandır" (varsayılan açık) → aynı işyerinin aynı türdeki tüm satırları değişir ve **işyeri kuralı** kaydedilir.
- Satırı sil.

### 1.5 İçe aktar (`/ice-aktar`)
1. Ekstre Okuyucu'yu aç (fotoğraf / ekran görüntüsü / PDF → `kind:"import"` JSON indir).
2. Dosya yükle → panel: dosyadaki **her ekstre ayrı bölüm** (okuyucu farklı kart/hesap ve farklı ayları ayrı ekstre olarak verir; K15):
   - **Kart / hesap** otomatik eşlenir (§3.9): son 4 hane aynı olan kart; yoksa kart **otomatik oluşturulur** (ad: banka + kart adı, son 4 hane, tür). İstenirse başka kart seçilir ya da yeni kartın adı/türü düzeltilir. Aynı yeni kart dosyada iki kez geçerse (ör. iki ay) tek kart açılır.
   - **Hangi aya sayılsın?** Varsayılan: okuyucunun belirlediği ay → kesim tarihinin ayı → dönem metni ("Ekim 2026", "15.09–14.10.2026") → en geç satırın ayı. Ekstre tek bir aya yazılır; istenirse "her satır kendi tarihinin ayına". Aynı kart+ay ekstresi varsa satırlar ona eklenir (not gösterilir).
   - Satırlar tek tek: işaret kutusu, işyeri, tarih, taksit, açıklama, kategori seçimi. Zaten kayıtlı olanlar işaretsiz gelir. Kart ödemeleri sayılmaz (atlanır, sayısı yazılır).
   - Satır yoksa ama özet varsa "Sadece özet bilgisini kaydet".
3. Son içe aktarmayı geri al (satırlar silinir; o aktarmayla açılıp boş kalan ekstreler ve kartlar da).

### 1.6 Ayarlar
- Kartlar ve hesaplar: ad, banka, son 4 hane, tür düzenle; sil (ekstreleri ve satırlarıyla). Kartlar her yerde "Ad •• 1234" olarak görünür.
- Kategoriler (gider / gelir): ekle, düzenle (ikon, ad, renk), arşivle.
- Yedek al / yedekten geri yükle. Sürüm etiketi.

## 2. Veri modeli (Dexie, veritabanı `butce-ekstre`)

Eski sürümün `butce-app` veritabanına dokunulmaz (K11). Tutarlar kuruş, tarihler `YYYY-MM-DD`, aylar `YYYY-MM`.

```ts
cards:        'id'                                   // Card { id, name, kind: 'credit_card'|'bank', currency, bank?, last4? }
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

### 3.9 Kart eşleme (`src/domain/cards.ts`, K15)
- Son 4 hane varsa: aynı son 4 haneli (ve aynı türdeki) kart. Yoksa aynı bankada son 4 hanesi kayıtlı olmayan **tek** uygun kart (eski kartlar) seçilir ve son 4 hanesi kaydedilir; birden fazlaysa eşlenmez.
- Son 4 hane yoksa: adı birebir aynı tek kart, yoksa aynı bankadaki tek uygun kart.
- Emin olunamazsa eşlenmez → yeni kart açılır (karışmaktansa ayrı kart; sonra elle birleştirilebilir/seçilebilir). Son kullanılan karta düşme yok.
- Dosyadaki ekstreler sırayla eşlenir: öncekinin açtığı/eşlediği kart sonrakinde görülür (iki farklı kart aynı eski karta karışmaz).

### 3.7 Yedekleme
- `{ app: 'butce-app', kind: 'backup', schemaVersion: 2, exportedAt, data: { cards, statements, transactions, categories, rules, settings } }` → `butce-yedek-YYYY-MM-DD.json`.
- Geri yükleme mevcut veriyi tamamen değiştirir (tek işlem). Eski sürüm yedekleri (`schemaVersion: 1`) reddedilir.

### 3.8 İçe aktarma dosyası (Ekstre Okuyucu → uygulama)
```json
{ "app": "butce-app", "kind": "import", "version": 2, "source": "ekstre-okuyucu",
  "statements": [
    { "bank": "Garanti BBVA",
      "account": { "name": "Bonus Platinum", "last4": "1234", "kind": "credit_card|bank" },
      "period": "Ekim 2026", "month": "2026-10",
      "summary": { "statementDate": "2026-10-14", "dueDate": "2026-10-24", "statementBalance": 1234550,
                   "minimumPayment": 246910, "totalDebt": 2049850 },
      "items": [ { "date": "2026-10-08", "type": "expense|income|payment", "amount": 249983,
                   "categoryName": "Ev", "note": "TEKNOSA ZORLU AVM", "merchant": "Teknosa",
                   "installment": { "no": 3, "count": 6 } } ] } ] }
```
- Her ekstre: hangi kart/hesap (`account`, son 4 hane sadece 4 rakam) ve hangi ay (`month`). Okuyucu aynı hesap + aynı ayın sayfalarını tek ekstrede birleştirir, başlıksız devam sayfasını önceki ekstreye ekler; farklı hesap/ay ayrı ekstre olur. Dönemi seçilmemiş ekstre dışa aktarılmaz.
- Eski `version: 1` dosyaları (üst düzeyde `statement`, `summary`, `items`) tek ekstre olarak okunur; hesap bilgisi sadece banka.
- `merchant` isteğe bağlı (yoksa açıklamadan tahmin).
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
├─ domain/      money.ts, dates.ts, importer.ts, cards.ts, merchant.ts, stats.ts, backup.ts  (+ *.test.ts)
├─ features/
│  ├─ dashboard/ (Özet)  ├─ trend/  ├─ statements/ (liste, detay, TxSheet)  ├─ import/  └─ settings/
├─ components/  ui.tsx (Sheet, MonthStepper, Money, ConfirmButton, Segmented, SelectChip, BarRow, Empty),
│               MonthChart.tsx (Recharts), ShareBar.tsx (dağılım şeridi + RankList), ThemeToggle.tsx,
│               TxList.tsx, Layout.tsx, AppContext.ts
└─ lib/         id.ts, files.ts, theme.ts (karanlık/açık, K17), useDark.ts
tools/ekstre-okuyucu/index.html   — artifact kaynağı
```
