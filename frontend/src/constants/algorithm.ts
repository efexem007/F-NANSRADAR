export const ALGORITHM_STEPS = [
  { name: 'Trend Tespiti', weight: 0.15, description: 'Son 20 günlük fiyat hareketinin doğrusal regresyonu ile trend yönü belirleme' },
  { name: 'RSI Analizi', weight: 0.15, description: '14 günlük Göreceli Güç Endeksi ile aşırı alım/satım tespiti' },
  { name: 'MACD Analizi', weight: 0.12, description: 'MACD çizgisi ve sinyal çizgisi kesişim analizi' },
  { name: 'Bollinger Bantları', weight: 0.10, description: 'Fiyatın üst/alt bantlara göre konum analizi' },
  { name: 'Hacim Analizi', weight: 0.10, description: 'Anlık hacmin 20 günlük ortalamaya göre kıyaslanması' },
  { name: 'Destek/Direnç', weight: 0.10, description: 'Son 60 günün en düşük ve en yüksek değerlerine göre seviye analizi' },
  { name: 'EMA Kesişim', weight: 0.08, description: '9 EMA / 21 EMA / 50 EMA golden cross / death cross tespiti' },
  { name: 'Sektör Kıyaslaması', weight: 0.08, description: 'Hisse getirisinin sektör ortalamasına göre performansı' },
  { name: 'Volatilite', weight: 0.07, description: '14 günlük ATR ile volatilite skoru hesaplama' },
  { name: 'Final Skor', weight: 0.05, description: '9 adımın ağırlıklı ortalaması ile 0-100 sinyal skoru üretimi' },
];

export const RISK_COMPONENTS = [
  { key: 'likidite', label: 'Likidite Riski', icon: '💧', weight: '25%' },
  { key: 'kaldirac', label: 'Kaldıraç Riski', icon: '⚖️', weight: '25%' },
  { key: 'piyasa', label: 'Piyasa Riski', icon: '📉', weight: '20%' },
  { key: 'teknik', label: 'Teknik Risk', icon: '📊', weight: '15%' },
  { key: 'makro', label: 'Makro Risk', icon: '🌍', weight: '15%' },
];

export const SECTORS = [
  'Bankacılık', 'Enerji', 'Teknoloji', 'Gıda', 'Tekstil',
  'İnşaat', 'Otomotiv', 'Holding', 'Madencilik', 'Sağlık',
  'Ulaştırma', 'Turizm', 'Finansal Hizmetler', 'Perakende', 'İletişim',
  'Kimya', 'Metal', 'Plastik', 'Ambalaj', 'Bilişim',
  'Eğitim', 'Gayrimenkul', 'Hayvancılık', 'Hububat', 'Orman Ürünleri',
  'Sigorta', 'Tarım', 'Taahhüt', 'Tobacco', 'Yatırım',
];

export const INDICES = ['BIST 30', 'BIST 50', 'BIST 100', 'BIST TÜM'];

export const TIME_FRAMES = [
  { key: '1H', label: '1 Saat' },
  { key: '4H', label: '4 Saat' },
  { key: '1D', label: '1 Gün' },
  { key: '1W', label: '1 Hafta' },
  { key: '1M', label: '1 Ay' },
  { key: '3M', label: '3 Ay' },
  { key: '6M', label: '6 Ay' },
  { key: '1Y', label: '1 Yıl' },
];

export const SIGNAL_THRESHOLDS = {
  'GÜÇLÜ AL': 75,
  'AL': 60,
  'BEKLE': 50,
  'SAT': 40,
  'GÜÇLÜ SAT': 0,
};

export const PREDICTION_PERIODS = [
  { key: '1w', label: '1 Hafta', days: 7 },
  { key: '1m', label: '1 Ay', days: 30 },
  { key: '1y', label: '1 Yıl', days: 365 },
  { key: '3y', label: '3 Yıl', days: 1095 },
];
