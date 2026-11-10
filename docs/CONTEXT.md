# Bütçe App — Bağlam (CONTEXT)

> Bu dosya projenin "neden"ini ve alınmış kararları tutar. Yeni bir oturuma başlarken önce bunu oku.
> Son güncelleme: 2026-11-06 (ekstre sürümüne geçiş, K11)

## 1. Proje nedir?

Kişisel kullanım için bir **ekstre okuma ve harcama analizi uygulaması** (2026-11-06'dan beri, K11). Kart ekstresi / hesap hareketleri Ekstre Okuyucu'da (claude.ai artifact) okunur, uygulamaya yüklenir; uygulama aylık harcamayı, kategorilere dağılımı, kategori trendini ve en çok harcanan yerleri gösterir. Elle işlem girilmez.

İlk sürüm (Faz 0–5) gelir–gider takibiydi; kodu git geçmişinde.

Uzun vadede (istenirse):
1. Malvarlığı takibi (döviz, altın, hisse, fon, kripto, gayrimenkul vb.)
2. Piyasa verisiyle güncel değer hesaplama (kur, altın, BIST)
3. Belki başka kişilerle paylaşım / dışarı açma

## 2. Geliştirici

- Mehmet Can — altyapı/network tarafında çalışıyor; React/Vite + Node/Express + PostgreSQL ile daha önce proje kurdu (WSL2, nvm, GitHub CLI ortamı hazır).
- Geliştirme Claude Code ile yapılacak; kodun büyük kısmını Claude yazar, Mehmet yön verir ve test eder.
- İletişim ve arayüz dili: **Türkçe**. Kod, değişken ve dosya adları: **İngilizce**.

## 3. Alınmış kararlar (Karar Kaydı)

| # | Konu | Karar | Neden |
|---|------|-------|-------|
| K1 | Platform | **Web uygulaması (PWA)**, mobil öncelikli (mobile-first) responsive tasarım | Tek kod tabanı; telefonda tarayıcıdan veya "Ana ekrana ekle" ile uygulama gibi açılır |
| K2 | Veri saklama | **Tarayıcı içi IndexedDB** (Dexie.js ile) — sunucu yok | Tamamen offline çalışır; her kullanıcının verisi kendi tarayıcısında kalır (bkz. §4) |
| K3 | Para birimi | **Arayüzde sadece TL**, ama her kayıtta `currency` alanı var | İleride USD/EUR/altın eklemek veri modelini bozmaz |
| K4 | MVP kapsamı | İşlemler + kategoriler + **hesaplar**, **taksit**, **tekrarlayan işlem**, **aylık özet/grafik**, **kategori bütçe limitleri** | Mehmet'in seçimi |
| K5 | Teknoloji | React + Vite + TypeScript, Tailwind CSS v4, Dexie.js, React Router, Vitest, oxlint; sonra Recharts, vite-plugin-pwa. Tarih için kütüphane yok (`Intl`) | Mehmet React/Vite biliyor; TS para hesaplarında hatayı azaltır |
| K6 | Para tutarı | Tutarlar **tam sayı kuruş** olarak saklanır (`12550` = 125,50 ₺), asla float | Yuvarlama hatalarını önler |
| K7 | Yayınlama | İlk aşama lokal (`npm run dev`). Dışarı açılırsa **statik hosting** (Cloudflare Pages / Netlify / GitHub Pages) | Backend olmadığı için sunucu maliyeti yok, sunucuda kullanıcı verisi yok |
| K9 | Yayın | **GitHub Pages**, `Kenar-MC/butce-app` (public; kod açık, veri cihazda) → https://kenar-mc.github.io/butce-app/ | main'e her push otomatik yayın; adres değişirse cihazdaki veri taşınmaz (yedekle taşınır) |
| K10 | Ekstre okuma | Ayrı bir claude.ai artifact'ı (**Ekstre Okuyucu**) Claude'a fotoğrafı okutur, `kind:"import"` JSON verir; uygulama bu dosyayı içe aktarır | API anahtarı ve ek ücret yok, kullanım claude.ai aboneliğinden; uygulama offline kalır |
| K11 | Yön değişikliği | Uygulama **sadece ekstre okuma + aylık grafikler**: elle işlem, hesap bakiyesi, bütçe, transfer kaldırıldı. Ana ekran uygulaması (PWA) kaldı; veri yine cihazda. **Sıfırdan başlandı**: yeni veritabanı `butce-ekstre`, eski `butce-app` veritabanına dokunulmadı | Mehmet'in seçimi (2026-11-06); eski veriyi silmeden yeni yapıya geçmek |
| K12 | Ay = ekstre ayı | Kart ekstresindeki satır, işlem tarihine değil **ekstrenin (kesim) ayına** sayılır; banka hareketlerinde istenirse satır tarihinin ayı. Kart + ay başına tek ekstre kaydı, yeni okumalar ona eklenir | "Aylık ekstrelere göre" harcama; ekstre parça parça okunabilsin |
| K13 | İşyeri ve kural | Okuyucu kısa işyeri adı verir; kullanıcı bir satırın kategorisini "hepsine uygula" ile değiştirirse işyeri → kategori kuralı kaydedilir ve sonraki içe aktarmalarda okuyucunun kategorisini ezer | Sınıflandırma zamanla kullanıcıya göre düzelsin |
| K14 | Grafik | Recharts 3; tek seri sütunlar mavi (gelir yeşili / gider kırmızısıyla karışmasın), seçili ay koyu ton. Kategori grafikleri kategorinin kendi rengini kullanır | Sade, okunur; renk anlamı korunur |
| K15 | Ekstre kimliği | Okuyucu her ekstreyi **hesap (banka, kart adı, son 4 hane, tür) + ay** ile etiketler; farklı hesap/ay ayrı ekstre (dosya v2). Uygulama kartı son 4 haneye göre eşler; emin olamazsa **yeni kart açar** (son kullanılan karta düşmez) | Ekstreler birbirine karışmasın, kart elle seçilmek zorunda kalınmasın (Mehmet, 2026-11-06) |
| K16 | Safari ve IndexedDB | Veritabanında **imleç açan sorgu kullanılmaz** (`uniqueKeys`, `each`, `filter`, `orderBy().keys` vb.); sadece `toArray`, `where().equals()`, `get`, `count`, `bulk*`. Filtreleme JS'te yapılır | iPhone Safari'de boş tabloda imleçli sorgu "UnknownError: Unable to open cursor" verip uygulamayı açılmaz hale getirdi (2026-11-09). Kişisel veri küçük, `toArray` yeterince hızlı |
| K17 | Görünüm ve Özet | **Karanlık mod varsayılan**; her ekranın sağ üstünde kaydırmalı ay/güneş anahtarı (renkler ~0,5 sn'de yumuşak geçer: destekleyen tarayıcıda View Transition ile tüm ekran tek parça çapraz geçer — iç içe CSS `color` geçişleri iPhone'da yazıyı geciktiriyordu; yoksa CSS geçişi. Grafik renkleri CSS'te: `.bar-on/.bar-off`, `.month-chart`), seçim cihazda (`localStorage` `butce-theme`) saklanır, Tailwind `dark:` sınıfla çalışır. Özet genel bakış (dönem 3/6/12 ay), Aylık görünüm Trend'e katıldı. Dağılım için pasta yerine yüzdeli parçalı şerit | Mehmet "direkt karanlık mod, ya da üste ay/güneş tuşu" dedi; ana ekranda daha geniş özet istedi (2026-11-10). Şerit küçük dilimleri pastadan daha okunur gösteriyor; istenirse halka grafiğe çevrilebilir |
| K8 | Yönlendirme | `HashRouter` (`/#/islemler`) + `base: './'` | Her statik hostta ayarsız çalışır |

## 4. IndexedDB nasıl çalışır? (K2'nin sonuçları)

- Veri **tarayıcı + cihaz + site adresi** bazında tutulur. Siteyi açan herkesin verisi kendi tarayıcısındadır; kimse kimsenin verisini görmez. Giriş/şifre gerekmez.
- **Artısı:** Paylaşmak için siteyi yayınlamak yeterli; herkes kendi bağımsız bütçesini tutar.
- **Sınırları (bilinçli kabul edilen):**
  - Telefon ile bilgisayar arasında **otomatik senkron yok**. Aynı kişi iki cihazda ayrı veri görür. Çözüm (MVP): JSON yedek al → diğer cihazda yükle. Gerçek senkron ileride backend + giriş ile gelir (Faz 8).
  - Tarayıcı verisi temizlenirse veya gizli sekmede kullanılırsa veri silinir.
  - iPhone Safari, uzun süre ziyaret edilmeyen sitelerin verisini silebilir. Önlem: uygulamayı **ana ekrana ekleyerek** kullanmak, `navigator.storage.persist()` ile kalıcı depolama istemek ve **düzenli JSON yedek** almak.
- Bu yüzden **yedekleme (dışa/içe aktarma) MVP'nin zorunlu parçasıdır.**

## 5. Kapsam dışı (şimdilik)

- Elle gelir/gider girişi, hesap bakiyeleri, bütçe limitleri (K11 ile kaldırıldı)
- Kullanıcı hesabı, giriş, sunucu, senkronizasyon
- Banka entegrasyonu / otomatik ekstre çekme
- Aktif çoklu döviz (altyapı hazır ama arayüzde yok)
- iPhone notu: Ana ekrana eklenen uygulamanın verisi Safari sekmesinden ayrıdır; hep ana ekran ikonundan kullan
- Varlık takibi ve piyasa verisi
- Paylaşımlı/aile bütçesi

## 6. Diğer dosyalar

- `docs/SPEC.md` — ekranlar, veri modeli, iş kuralları (ne yapılacak)
- `docs/PLAN.md` — fazlar, görev listesi, kabul kriterleri (hangi sırayla)
- `CLAUDE.md` — Claude Code için kodlama talimatları (nasıl yapılacak)

## 7. Açık sorular (ileride netleşecek)

- Kategori başına aylık hedef istenir mi?
- Dışarı açılırsa alan adı ve hosting seçimi
