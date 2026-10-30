# Bütçe App — Uygulama Planı (PLAN)

> Hangi sırayla yapılacağını tanımlar. Her faz kendi başına çalışan bir sürüm bırakır.
> Görev bitince `[ ]` → `[x]` yapılır. Detaylar için `SPEC.md`.

## Durum
- **Şu an:** Faz 0–2 tamam (v0.1.0-alpha, 2026-10-30). **Sıradaki: Faz 3** (taksit + tekrarlayan).
- Faz 2'den öne alınanlar: Özet'te basit gelir/gider/net kartları ve hesap bakiyeleri (grafikler yine Faz 4).
- Bilinen eksik: yeni işlem formunda hesap hep ilk hesapla açılıyor (son kullanılanı hatırlamıyor) → Fikir havuzu.

## Genel bakış

| Faz | İçerik | Sonunda ne görürsün |
|-----|--------|---------------------|
| 0 | Proje kurulumu | Boş ama çalışan uygulama, alt menü |
| 1 | Veri katmanı, hesaplar, kategoriler | Hesap ekleyip bakiyesini görmek |
| 2 | İşlemler | **İlk kullanılabilir sürüm**: gelir/gider gir, listede gör |
| 3 | Taksit + tekrarlayan işlem | Kart taksitleri ve kira/maaş otomatik |
| 4 | Özet, grafikler, bütçe limitleri | Ay sonu tablosu |
| 5 | Yedekleme, PWA, mobil cilalama | **MVP v0.1** — telefona kurulur, offline çalışır |
| 6+ | Yol haritası (döviz, varlık, piyasa, senkron) | — |

---

## Faz 0 — Kurulum
- [x] Vite + React + TypeScript projesi (`npm create vite@latest`)
- [x] Tailwind CSS (güncel sürümün Vite kurulumu)
- [x] React Router: 5 sekme rotası (`/`, `/islemler`, `/hesaplar`, `/butce`, `/ayarlar`)
- [x] Yerleşim: mobilde alt sekme çubuğu, ≥768px'te sol menü; sağ altta "+" butonu (şimdilik boş)
- [x] Vitest kurulumu + örnek test
- [x] Lint: oxlint (Vite şablonu ile gelen; ESLint/Prettier yerine)
- [x] `npm run dev / build / test / lint` komutları çalışıyor
- [x] Git repo + ilk commit

**Kabul:** `npm run dev` ile açılıyor; telefon boyutunda (DevTools 360px) alt menüyle sekmeler arası geçiliyor.

## Faz 1 — Veri katmanı, hesaplar, kategoriler
- [x] Dexie şeması v1 (`src/db/db.ts`) — SPEC §2
- [x] Tip tanımları (`src/db/types.ts`)
- [x] `domain/money.ts`: `parseAmount`, `formatTRY`, kuruş yardımcıları + testler
- [x] `domain/dates.ts`: ay anahtarı, ay ekleme (son güne sabitleme), ay aralığı + testler
- [x] Seed: varsayılan kategoriler + "Nakit" hesabı (DB boşsa)
- [x] Hesaplar ekranı: liste, ekle/düzenle/arşivle formu
- [x] `domain/balances.ts`: bakiye hesabı (SPEC §3.2) + testler
- [x] Ayarlar > Kategoriler: liste, ekle/düzenle/arşivle
- [x] `navigator.storage.persist()` isteği (uygulama açılışında)

**Kabul:** Hesap ekleyip sayfayı yenileyince hesap duruyor; açılış bakiyesi doğru formatta (₺1.250,50) görünüyor.

## Faz 2 — İşlemler  ⭐ ilk kullanılabilir sürüm
- [x] `AmountInput` bileşeni (Türkçe virgül desteği, sayısal klavye)
- [x] İşlem formu (alttan panel): tür, tutar, kategori ızgarası, hesap, tarih, not
- [x] Transfer desteği (kimden → kime)
- [x] İşlem ekle / düzenle / sil (onaylı)
- [x] İşlemler ekranı: ay seçici, güne göre gruplu liste, günlük toplam
- [x] Filtreler: tür, hesap, kategori, not araması
- [x] Hesap bakiyeleri işlemlerle güncelleniyor (`useLiveQuery`)

**Kabul:** Bir gider ve bir gelir girince listede doğru günde görünüyor, hesap bakiyesi anında değişiyor; transfer iki hesabı da doğru etkiliyor ve gelir/gider toplamına girmiyor.

## Faz 3 — Taksit + tekrarlayan işlem
- [ ] `domain/installments.ts`: taksit bölme (kalan kuruş ilk taksite) + tarih üretimi + testler
- [ ] Formda "Taksitli" anahtarı (sadece gider + kredi kartı), aylık tutar önizleme
- [ ] Plan + n işlemin tek Dexie transaction'ında yazılması
- [ ] Listede "3/12" rozeti; kart hesabında "gelecek taksit toplamı"
- [ ] Ayarlar > Taksit planları: liste, sil ("gelecekler" / "tümü")
- [ ] `domain/recurring.ts`: tekrar tarihlerini üretme, `generateDueRecurring(today)` (idempotent) + testler
- [ ] Formda "Tekrarlasın" anahtarı (aylık/haftalık/yıllık, bitiş tarihi)
- [ ] Uygulama açılışında vadesi gelen tekrarları oluşturma
- [ ] Ayarlar > Tekrarlayan işlemler: liste, duraklat/devam, düzenle, sil

**Kabul:** 12 taksitli 10.000 ₺'lik alışveriş girince önümüzdeki 12 ayda birer taksit görünüyor, toplamları kuruşu kuruşuna 10.000 ₺. Ayın 31'inde başlayan aylık kira Şubat'ta 28/29'unda oluşuyor. Uygulamayı kapatıp açmak çift kayıt oluşturmuyor.

## Faz 4 — Özet, grafikler, bütçe limitleri
- [ ] `domain/reports.ts`: aylık gelir/gider/net, kategori dağılımı, son 6 ay serisi + testler
- [ ] `domain/budgets.ts`: harcanan/limit/kalan ve durum (normal/uyarı/aşım) + testler
- [ ] Özet ekranı: ay seçici, 3 kart, hesap bakiyeleri, donut grafik, 6 aylık çubuk grafik (Recharts)
- [ ] "Yaklaşanlar" (30 gün: tekrarlar + taksitler)
- [ ] Bütçe ekranı: kategori başına limit girme, ilerleme çubukları
- [ ] İşlem kaydında limit aşılırsa uyarı (toast)

**Kabul:** Özet'teki gider toplamı İşlemler ekranındaki o ayın gider toplamıyla aynı; limit %80'i geçince çubuk sarıya, %100'ü geçince kırmızıya dönüyor.

## Faz 5 — Yedekleme, PWA, cilalama  ✅ MVP v0.1
- [ ] `db/backup.ts`: JSON dışa aktarma / doğrulama / geri yükleme (tam değiştirme)
- [ ] CSV dışa aktarma (BOM + `;`)
- [ ] Ayarlar > Yedekleme ekranı, son yedek tarihi, 30 gün hatırlatması
- [ ] "Tüm veriyi sil" (iki adımlı onay)
- [ ] vite-plugin-pwa: manifest (ad, ikon, tema rengi), service worker, offline önbellek
- [ ] Uygulama ikonu
- [ ] Mobil cilalama: dokunma alanları ≥ 44px, boş durum ekranları, karanlık mod (sistem ayarına göre)
- [ ] `npm run build` + `npm run preview` ile üretim testi

**Kabul:** Telefonda "Ana ekrana ekle" ile kuruluyor; uçak modunda açılıp işlem girilebiliyor; yedek alınıp veri silindikten sonra yedekten aynen geri dönüyor.

---

## Yol haritası (MVP sonrası, sıra değişebilir)

### Faz 6 — Çoklu döviz + varlık takibi (v0.2)
- Hesaplarda USD / EUR / altın (gram) para birimi
- "Varlıklar" sekmesi: döviz, altın, hisse, fon, kripto, gayrimenkul — miktar + elle girilen değer
- Net varlık = hesaplar + varlıklar − borçlar; aylık net varlık geçmişi

### Faz 7 — Piyasa verisi (v0.3)
- Kur (TCMB), altın, BIST, kripto fiyatlarıyla otomatik değerleme
- Tarayıcıdan doğrudan erişilemeyen kaynaklar için küçük bir sunucusuz fonksiyon/proxy gerekir (CORS) — bu fazda karar verilecek
- Offline iken son bilinen fiyatla çalışma

### Faz 8 — Hesap + senkronizasyon (dışarı açma)
- Giriş sistemi ve sunucu (Node/Express + PostgreSQL ya da hazır bir servis)
- Cihazlar arası senkron (UUID'ler ve `updatedAt` bunun için baştan var)
- Paylaşımlı/aile bütçesi

### Fikir havuzu
- Banka ekstresi CSV içe aktarma
- Etiketler (#tatil, #iş)
- Maaş gününe göre ay başlangıcı
- Kredi kartı hesap kesim/son ödeme günü hatırlatması
- Yedeği birleştirerek yükleme
- İşlem formunda son kullanılan hesabı/kategoriyi hatırlama

---

## Yeni oturuma başlarken

İlk mesaj:

> `CLAUDE.md`'yi oku, PLAN.md > Durum'daki sıradaki fazı uygula, kabul kriterine göre kontrol et ve PLAN.md'yi güncelle.
