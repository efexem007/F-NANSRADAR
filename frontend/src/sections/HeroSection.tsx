import { ArrowRight, Play, BarChart3, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';

interface HeroSectionProps {}

export const HeroSection = (_props: HeroSectionProps) => {
  return (
    <section className="relative pt-24 lg:pt-32 pb-16 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px]" />
      </div>

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium text-slate-300">513 BIST Hissesi | AI Destekli Analiz</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                Teknoloji ile{' '}
                <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Daha İyi
                </span>{' '}
                Yatırım
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                10 basamaklı AI algoritması ile Borsa İstanbul'un tüm hisselerini tarayın, 
                fiyat tahminlerini görün ve en doğru kararı verin.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <Link
                to="/scanner"
                className="group inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Play className="w-4 h-4" />
                Taramayı Başlat
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/stocks"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                Hisseleri İncele
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">513</p>
                  <p className="text-xs text-slate-400">Hisse</p>
                </div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-lg font-bold text-white">10 Adım</p>
                <p className="text-xs text-slate-400">AI Algoritma</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-lg font-bold text-white">Anlık</p>
                <p className="text-xs text-slate-400">Tarama</p>
              </div>
            </div>
          </div>

          {/* Right - Chart Preview */}
          <div className="relative hidden lg:block">
            <div className="relative bg-[#111827] rounded-2xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
              {/* Fake chart header */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="text-xs text-slate-500 font-mono">THYAO.IS - 1D</div>
              </div>
              {/* Fake chart body */}
              <div className="p-4 h-[320px] relative">
                <svg viewBox="0 0 500 250" className="w-full h-full">
                  {/* Grid lines */}
                  {[0, 50, 100, 150, 200].map((y) => (
                    <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                  ))}
                  {/* Chart line */}
                  <path
                    d="M0,180 C50,170 80,120 120,140 C160,160 180,80 220,100 C260,120 280,60 320,80 C360,100 380,40 420,70 C460,100 480,50 500,60"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* Fill area */}
                  <path
                    d="M0,180 C50,170 80,120 120,140 C160,160 180,80 220,100 C260,120 280,60 320,80 C360,100 380,40 420,70 C460,100 480,50 500,60 L500,250 L0,250 Z"
                    fill="url(#chartGradient)"
                    opacity="0.3"
                  />
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Data points */}
                  {[120, 220, 320, 420].map((x, i) => (
                    <circle key={i} cx={x} cy={[140, 100, 80, 70][i]} r="4" fill="#06b6d4" />
                  ))}
                </svg>
                {/* Floating badges */}
                <div className="absolute top-4 left-4 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <span className="text-xs font-semibold text-emerald-400">GÜÇLÜ AL</span>
                </div>
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
                  <span className="text-xs font-mono text-slate-300">Skor: 87/100</span>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};
