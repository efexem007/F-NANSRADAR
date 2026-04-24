# 🔧 FinansRadar — Arayüz & Fonksiyon Onarım Planı

> **Amaç:** Tüm sayfalarda arayüzün doğru, işlevsel ve kesintisiz çalışmasını sağlamak.
> **Tarih:** 2026-04-22

---

## 📋 GENEL TESPİTLER (Kod Analizi Sonuçları)

Tüm frontend ve backend dosyalarını inceledim. Aşağıda sayfa bazlı tespit edilen **kritik buglar, eksiklikler ve bozuk bağlantılar** listelenmiştir.

---

## 🔴 SAYFA 1: AI Scanner & Lab (`Scanner.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| S1 | **SSE EventSource URL yanlış** | 🔴 Kritik | Satır 413: `new EventSource('/api/universal/scan-stream?token=...')` — Vite dev proxy `/api` prefix'ini doğru yönlendirmeyebilir. EventSource, axios interceptor'larını kullanmaz, dolayısıyla token query param ile gönderiliyor ama backend `authenticate` middleware SSE route'unda header yerine query'den token okumuyor olabilir. |
| S2 | **Tarama yarıda kesiliyor** | 🔴 Kritik | Backend `universal.js` satır 59: Tek hisse için 20sn timeout var ama 500+ hisse taramada toplam süre çok uzun. EventSource bağlantısı proxy/tarayıcı timeout'larına takılıyor. Keep-alive 12sn ama Vite proxy varsayılan timeout'u daha kısa olabilir. |
| S3 | **İlerleme çubuğu eksik** | 🟡 Orta | `scanning` durumunda sadece toast mesajı var, görsel bir progress bar yok. Kullanıcı hangi aşamada olduğunu göremez. |
| S4 | **Tarama sonuçları üzerine yazılmıyor düzgün** | 🟡 Orta | Satır 410: `setScanResults(prev => prev \|\| ...)` — Önceki sonuçlar silinmiyor, eski + yeni karışıyor. `totalScanned` her `assetAnalyzed` event'inde +1 artıyor ama `progress` event'i ayrı geliyor, sayılar tutarsız olabiliyor. |
| S5 | **"Seçiliyi Tara" butonu bağlantısız** | 🟡 Orta | `handleScan(selectedTickers)` çağrılıyor ama `selectedTickers` array'i `symbol` formatında (örn: `THYAO.IS`). Backend `symbols` parametresini alıyor ama `.IS` suffix'i olmadan gönderilirse bulunamaz. |
| S6 | **AI Lab (Backtest) tab'ı hata veriyor** | 🔴 Kritik | `Backtest.jsx` — `Card` ve `Button` componentleri `../components/ui/` altından import ediliyor. Chart componentleri (`HorizonForecastChart`, `BacktestEquityCurve`, `SignalAccuracyChart`) var mı kontrol edilmeli. Backend `/backtest/:symbol/full` endpoint'i çalışıyor mu doğrulanmalı. |
| S7 | **Watchlist view bağlantı kopuk** | 🟡 Orta | Watchlist panel yükleme sırasında `getWatchlist` backend'de her item için `analyzeAsset` çağırıyor — 10+ item varsa timeout olur. |
| S8 | **Zaman dilimi filtreleri taramayı etkilemiyor** | 🟡 Orta | `timeFrame` state'i `handleScan`'e parametre olarak gidiyor ama backend SSE handler'da `filters.timeFrame` sadece `analyzeAsset`'e geçiyor — period/interval mapping doğru çalışıyor mu test edilmeli. |

### Çözüm Planı

```
Adım 1: SSE Bağlantı Düzeltmesi (S1, S2)
├── Frontend: EventSource URL'ini tam path ile oluştur (http://localhost:3001/api/...)
├── Backend: SSE route'unda token'ı query param'dan da kabul et
├── Vite proxy config'e SSE için özel timeout ekle (300sn)
└── Keep-alive interval'ı 8sn'ye düşür

Adım 2: İlerleme Göstergesi Ekleme (S3)
├── Scanner.jsx'e dedicated ProgressBar component'i ekle
├── scanning=true olduğunda: animasyonlu progress bar + yüzde + metin
├── Her assetAnalyzed event'inde canlı güncelleme
└── Hata/skip sayısını da göster

Adım 3: Sonuç Yönetimi Düzeltme (S4, S5)
├── Yeni tarama başlatıldığında eski sonuçları temizle (reset)
├── totalScanned'ı progress event'inden al, assetAnalyzed'dan değil
├── selectedTickers formatını normalize et (.IS suffix kontrolü)
└── Duplicate symbol kontrolünü güçlendir

Adım 4: AI Lab Çalıştırma (S6)
├── ui/Card.jsx ve ui/Button.jsx var mı kontrol et, yoksa oluştur
├── Chart componentlerini kontrol et, eksikleri stub ile doldur
├── Backend /backtest/* endpoint'lerini test et
└── Hata durumunda anlamlı fallback göster

Adım 5: Watchlist Performans (S7)
├── getWatchlist'te paralel analiz yerine cached veri kullan
├── veya analyzeAsset çağrısını opsiyonel yap (live: null tolere et)
└── Frontend'de lazy loading ekle

Adım 6: Filtre Entegrasyonu (S8)
├── timeFrame değiştiğinde mevcut sonuçları invalidate et
├── Backend'de period/interval mapping'i doğrula
└── Filtre değişikliğinde uyarı mesajı göster ("Yeni tarama gerekli")
```

---

## 🔴 SAYFA 2: Tüm BIST Hisseleri (`AllStocks.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| A1 | **Sayfalama `hasPrev`/`hasNext` undefined** | 🔴 Kritik | Satır 430-458: `pagination.hasPrev` ve `pagination.hasNext` kullanılıyor ama backend `/stock/list` response'unda bu alanlar `stockDiscovery.listStocks()` return değerine bağlı — muhtemelen döndürülmüyor. Butonlar her zaman disabled kalıyor. |
| A2 | **Sektör filtresi çalışmıyor** | 🟡 Orta | `selectedSector` değiştiğinde `fetchStocks` tekrar çağrılması gerekiyor ama `useEffect` dependency'si sadece `[fetchStocks]`. Filtre değişiminde sayfa 1'e dönüyor ama `fetchStocks(pagination.page)` ile çağrılıyor — eski page ile fetch yapılabilir. |
| A3 | **Endeks filtresi (BIST 30/100) backend'de yok** | 🟡 Orta | Frontend `indexFilter` parametresi gönderiyor ama `stockDiscovery.listStocks()` bu parametreyi işliyor mu belirsiz. |
| A4 | **Grid görünümde fiyat/değişim eksik** | 🟢 Düşük | `StockCard` sadece `lastPrice` gösteriyor, günlük değişim yüzdesi yok. |
| A5 | **Arama sonuçlarında sayfalama kayboluyor** | 🟢 Düşük | `searchResults` doluyken pagination gizleniyor (doğru davranış) ama arama temizlenince önceki sayfa state'i kaybolabiliyor. |
| A6 | **Boş sektör/isim gösterimi** | 🟢 Düşük | Bazı hisselerde sector='Unknown' veya name boş geliyor — daha iyi fallback gerekli. |

### Çözüm Planı

```
Adım 1: Sayfalama Düzeltmesi (A1)
├── Backend stockDiscovery.listStocks() return değerine hasPrev/hasNext ekle
│   hasPrev: page > 1
│   hasNext: page < totalPages
├── Veya frontend'de pagination.page > 1 / < totalPages ile hesapla
└── İlk/son sayfa butonları ekle

Adım 2: Filtre Senkronizasyonu (A2, A3)
├── useEffect dependency'lerine selectedSector, selectedIndex ekle
├── Filtre değişiminde her zaman page=1 ile fetch et
├── Backend listStocks'a indexFilter desteği ekle (bist30/bist100 JSON listesi)
└── Filtre aktifken badge göster

Adım 3: Grid Görünüm Zenginleştirme (A4)
├── StockCard'a günlük değişim yüzdesi ekle
├── Sinyal badge'i ekle (eğer backend'den geliyorsa)
└── Sektör rengini dinamik yap

Adım 4: Veri Kalitesi (A6)
├── name temizleme regex'ini genişlet
├── sector='Unknown' için "Tanımsız" göster
└── lastPrice null ise "Fiyat bekleniyor" göster
```

---

## 🟡 SAYFA 3: Piyasa Sinyalleri (`Signals.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| SG1 | **SSE URL hardcoded localhost** | 🔴 Kritik | Satır 102: `http://localhost:3001/api/signal/scan-all` — Production'da çalışmaz. Vite proxy kullanılmalı. |
| SG2 | **Scanner sonuçlarıyla senkronizasyon kırık** | 🟡 Orta | `lastScanResults` localStorage'dan okuyor ama Scanner'dan gelen veri formatı (`symbol`, `opportunityScore`) ile Signals'ın beklediği format (`ticker`, `score`) farklı — mapping hatalı olabilir. |
| SG3 | **Tarama ve Scanner çakışması** | 🟡 Orta | Signals ve Scanner aynı anda tarama başlatabilir, iki farklı SSE endpoint'i kullanıyor (`/signal/scan-all` vs `/universal/scan-stream`). Kullanıcı hangisini kullanacağını bilmiyor. |
| SG4 | **Backend `/signal/scan-all` endpoint'i var mı?** | 🔴 Kritik | `signal.js` route dosyasında `scan-all` SSE endpoint'i tanımlı olmalı — kontrol edilmeli. |

### Çözüm Planı

```
Adım 1: URL Düzeltme (SG1)
├── Hardcoded URL'i relative path'e çevir: '/api/signal/scan-all'
└── veya EventSource için proxy config ekle

Adım 2: Veri Format Birleştirme (SG2, SG3)
├── Signals sayfasını Scanner sonuçlarından beslenen pasif bir görünüm yap
├── Veya: Scanner'ın SSE endpoint'ini kullanacak şekilde refactor et
├── Tek bir veri kaynağı belirle (localStorage key standardize et)
└── Field mapping: symbol→ticker, opportunityScore→score, currentPrice→price

Adım 3: Backend Doğrulama (SG4)
├── /signal/scan-all endpoint'ini kontrol et
├── Yoksa: universal/scan-stream'i kullan
└── veya signal route'una SSE endpoint ekle
```

---

## 🟡 SAYFA 4: Dashboard (`Dashboard.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| D1 | **Karşılaştırma hisse listesi yüklenmiyor** | 🟡 Orta | Satır 91-94: `/stock/list?pageSize=500` çağrısı yapılıyor ama response format `res.data.data` olabilir (listStocks wrapper). `res.data.stocks \|\| res.data.items` kontrolü var ama `res.data.data` yok. |
| D2 | **Makro veriler statik** | 🟡 Orta | Satır 442-446: CDS, Faiz, Enflasyon değerleri hardcoded. Backend `/macro` endpoint'inden gelen veri formatı ile eşleşmiyor olabilir. |
| D3 | **Portföy boşsa grafikler kırılıyor** | 🟢 Düşük | Portföy boşken fallback ticker listesi `['THYAO', 'AKBNK', 'TUPRS', 'ASELS']` kullanılıyor ama `.IS` suffix'i eklenmemiyor — backend'de ticker `THYAO.IS` olarak kayıtlı olabilir. |

### Çözüm Planı

```
Adım 1: Karşılaştırma Listesi (D1)
├── Response format: res.data?.data || res.data?.stocks || res.data?.items || []
└── Backend listStocks response'unu standartlaştır

Adım 2: Makro Veri Bağlantısı (D2)
├── Backend /macro endpoint'ini kontrol et, canlı veri çekiyor mu
├── macroData.js service'ini incele
└── Hardcoded değerleri backend response ile değiştir

Adım 3: Boş Portföy Koruması (D3)
├── Fallback ticker'lara .IS suffix ekle veya
├── Backend'de suffix olmadan da kabul et
└── Hata durumunda graceful fallback göster
```

---

## 🟡 SAYFA 5: Hisse Detay (`StockDetail.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| SD1 | **Analiz yükleme çok yavaş** | 🟡 Orta | Tek hisse detayı açılırken birden fazla API çağrısı yapılıyor (price + fundamental + analyze + prediction). Bunlar paralel mi yoksa sıralı mı? |
| SD2 | **Risk modal veri eksikliği** | 🟢 Düşük | `riskLevel` verisi backend'den gelmezse modal açılamıyor — fallback yok. |
| SD3 | **Bilanço tablosu tahmini değerler gösteriyor** | 🟡 Orta | `BalanceSheetTable` satır 716-718: `currentAssets * 0.4`, `currentAssets * 0.3` gibi sabit oranlarla alt kalem tahmini yapılıyor — gerçek veri değil. |

### Çözüm Planı

```
Adım 1: API Çağrı Optimizasyonu (SD1)
├── Promise.all ile tüm API'leri paralel çağır
├── Her bölüm için bağımsız loading state
└── Skeleton loader ekle

Adım 2: Fallback ve Hata Koruması (SD2)
├── riskLevel null ise default değerler göster
└── Her panel için try-catch koruması

Adım 3: Bilanço Doğruluğu (SD3)
├── Backend'den detaylı bilanço kalemleri çek (Yahoo Finance)
├── Tahmini değerleri "Tahmini" etiketi ile işaretle
└── Gerçek veri yoksa "Detay mevcut değil" göster
```

---

## 🟡 SAYFA 6: Portföy (`Portfolio.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| P1 | **PDF export Türkçe karakter sorunu** | 🟢 Düşük | jsPDF varsayılan fontu Türkçe karakter desteklemez (ö, ü, ş, ç, ğ, ı). Export'ta bozuk karakterler çıkabilir. |
| P2 | **Optimize endpoint çalışıyor mu?** | 🟡 Orta | `/portfolio/optimize` endpoint'i backend'de HRP optimizer service'ini çağırıyor — çalıştığı doğrulanmalı. |

---

## 🟡 SAYFA 7: Backtest (`Backtest.jsx`)

### Tespit Edilen Sorunlar

| # | Sorun | Şiddet | Detay |
|---|-------|--------|-------|
| B1 | **UI component'leri eksik olabilir** | 🔴 Kritik | `Card`, `Button` → `../components/ui/` altında var mı? Chart componentleri (`HorizonForecastChart`, `BacktestEquityCurve`, `SignalAccuracyChart`) → `../components/charts/` altında var mı? |
| B2 | **Backend endpoint'leri çalışıyor mu?** | 🔴 Kritik | `/backtest/:symbol/full`, `/backtest/:symbol/backtest`, `/backtest/:symbol/risk`, `/backtest/:symbol/accuracy` — tümü kontrol edilmeli. |
| B3 | **handleSearch paramSymbol olmadan çağrılmıyor** | 🟡 Orta | Sayfa açılışında `paramSymbol` yoksa hiçbir veri yüklenmiyor, boş sayfa kalıyor. |

### Çözüm Planı

```
Adım 1: Component Kontrolü (B1)
├── ls frontend/src/components/ui/ — Card.jsx, Button.jsx var mı?
├── ls frontend/src/components/charts/ — 3 chart component var mı?
├── Eksik olanları oluştur (minimal çalışır halde)
└── Import hatalarını düzelt

Adım 2: Backend Kontrolü (B2)
├── backtest route'unu incele
├── backtestEngine.js service'ini test et
├── Eksik endpoint'ler için stub response döndür
└── Hata mesajlarını kullanıcıya göster

Adım 3: Varsayılan Yükleme (B3)
├── paramSymbol yoksa default sembol ile yükle
├── veya "Sembol girin" prompt göster
└── Loading state düzelt
```

---

## 🔴 ORTAK SORUNLAR (Tüm Sayfalar)

### Backend Bağlantı Sorunları

| # | Sorun | Etkilenen Sayfalar |
|---|-------|--------------------|
| C1 | **Vite proxy config eksik/yanlış olabilir** | Scanner, Signals, Dashboard |
| C2 | **SSE (EventSource) proxy desteği** | Scanner, Signals |
| C3 | **Rate limiting SSE'yi kesiyor** | Scanner, Signals |
| C4 | **Token yönetimi tutarsız** | EventSource (query param) vs Axios (header) |

### Çözüm Planı

```
Adım 1: Vite Proxy Doğrulama
├── vite.config.js kontrol et — /api proxy'si doğru mu?
├── SSE için ws: true ve timeout ayarları ekle
└── proxy target: http://localhost:3001

Adım 2: SSE Token Standardizasyonu
├── Backend SSE route'larında query param token kabul et
├── authenticate middleware'e fallback: req.query.token
└── Frontend'de token'ı her zaman query param olarak gönder

Adım 3: Rate Limit SSE İstisnası
├── SSE endpoint'lerini rate limit'ten muaf tut
├── veya SSE bağlantıları için ayrı limit belirle
└── universalLimiter'ı scan-stream için bypass et
```

---

## 📊 UYGULAMA ÖNCELİK SIRASI

### Faz 1: Kritik Onarımlar (İlk Yapılacak) ⚡

1. **Vite proxy + SSE config düzeltmesi** → Tüm tarama işlevleri
2. **Scanner SSE bağlantısını düzelt** → Tarama yarıda kesilmez
3. **AllStocks sayfalama düzeltmesi** → Hisseler arasında gezinti
4. **Signals SSE URL düzeltmesi** → Sinyal taraması çalışır
5. **Eksik UI component'leri oluştur** → Backtest/Lab çalışır

### Faz 2: İşlevsellik (Sonra Yapılacak) 🔧

6. Scanner'a görsel progress bar ekle
7. Filtre senkronizasyonlarını düzelt (AllStocks + Scanner)
8. Dashboard karşılaştırma listesi düzeltmesi
9. Signals ↔ Scanner veri format birleştirmesi
10. Watchlist performans optimizasyonu

### Faz 3: Polish (En Son) ✨

11. Bilanço tablosu veri doğruluğu
12. PDF Türkçe karakter desteği
13. Makro veri canlı bağlantısı
14. Boş state tasarımları iyileştirme
15. Hata mesajları Türkçeleştirme

---

## 🏗️ TAHMİNİ İŞ GÜCÜ

| Faz | Tahmini Süre | Dosya Sayısı |
|-----|-------------|--------------|
| Faz 1: Kritik | ~3-4 saat | ~8 dosya |
| Faz 2: İşlevsellik | ~3-4 saat | ~10 dosya |
| Faz 3: Polish | ~2-3 saat | ~6 dosya |
| **Toplam** | **~8-11 saat** | **~15-20 dosya** |

---

> [!IMPORTANT]
> **Önerilen başlangıç:** Faz 1'i tek seferde yapalım. SSE + proxy düzeltmesi yapıldığında Scanner ve Signals taramaları düzelecek, AllStocks sayfalama çalışacak, Backtest/Lab açılabilir olacak. Bu 5 düzeltme uygulamanın %70'ini çalışır hale getirecek.
