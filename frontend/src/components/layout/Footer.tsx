import { TrendingUp, Twitter, Linkedin, Mail, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-[#0a0e1a] border-t border-white/5 mt-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-white">FinansRadar Pro</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              513 Borsa İstanbul hissesini AI destekli algoritma ile tarayan gelişmiş analiz platformu.
            </p>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Özellikler</h4>
            <ul className="space-y-2">
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">AI Scanner</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">Fiyat Tahmini</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">Teknik Analiz</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">Portföy Takibi</span></li>
            </ul>
          </div>

          {/* Markets */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Piyasalar</h4>
            <ul className="space-y-2">
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">BIST 30</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">BIST 100</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">BIST TÜM</span></li>
              <li><span className="text-sm text-slate-400 hover:text-white transition-colors cursor-default">Kripto</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">İletişim</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-400">info@finansradar.pro</span>
              </li>
              <li className="flex items-center gap-2">
                <Twitter className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-400">@finansradar</span>
              </li>
              <li className="flex items-center gap-2">
                <Linkedin className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-sm text-slate-400">FinansRadar</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            2025 FinansRadar Pro. Tüm hakları saklıdır.
          </p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> in Istanbul
          </p>
        </div>
      </div>
    </footer>
  );
};
