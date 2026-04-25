import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { BarChart3, PieChart, Activity, TrendingUp } from 'lucide-react';

interface ChartsGridProps {
  stocks?: unknown[];
}

// Generate monthly change data
const generateMonthlyData = () => {
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return months.map((month, i) => ({
    month,
    bist100: [2.1, -1.3, 3.8, 0.5, -2.1, 4.2, 1.8, -0.9, 5.1, 2.3, -1.5, 3.2][i],
    bist30: [1.8, -0.8, 4.2, 1.2, -1.5, 3.8, 2.5, -0.5, 4.8, 1.9, -0.8, 2.8][i],
    hacim: [45, 38, 52, 41, 35, 58, 48, 42, 62, 55, 40, 50][i],
  }));
};

const generateRadarData = () => [
  { subject: 'Risk', A: 65, B: 85, fullMark: 100 },
  { subject: 'Getiri', A: 80, B: 70, fullMark: 100 },
  { subject: 'Hacim', A: 90, B: 60, fullMark: 100 },
  { subject: 'Volatilite', A: 45, B: 75, fullMark: 100 },
  { subject: 'Momentum', A: 70, B: 80, fullMark: 100 },
  { subject: 'Trend', A: 85, B: 65, fullMark: 100 },
];

const monthlyData = generateMonthlyData();
const radarData = generateRadarData();

// Generate cumulative data
const generateCumulativeData = () => {
  let cumulative = 100;
  return Array.from({ length: 30 }, (_, i) => {
    cumulative += (Math.random() - 0.4) * 3;
    return {
      day: `${i + 1}`,
      value: Math.round(cumulative * 100) / 100,
    };
  });
};

const cumulativeData = generateCumulativeData();

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1f35] border border-white/10 rounded-xl px-4 py-3 shadow-xl">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value > 0 ? '+' : ''}{entry.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const ChartsGrid = (_props: ChartsGridProps) => {
  return (
    <section className="py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Cumulative Return Chart */}
          <div className="rounded-2xl bg-[#111827] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-violet-500/15">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Kümülatif Getiri</h3>
                  <p className="text-[10px] text-slate-500">Son 30 gün bazlı</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">+12.4%</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} fill="url(#cumulativeGrad)" name="Getiri" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Change Bar Chart */}
          <div className="rounded-2xl bg-[#111827] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/15">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Aylık Değişim</h3>
                  <p className="text-[10px] text-slate-500">BIST 100 vs BIST 30</p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="bist100" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="BIST 100" />
                <Bar dataKey="bist30" fill="#06b6d4" radius={[4, 4, 0, 0]} name="BIST 30" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="rounded-2xl bg-[#111827] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15">
                  <PieChart className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Volatilite Analizi</h3>
                  <p className="text-[10px] text-slate-500">5 boyutlu risk profili</p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={11} />
                <PolarRadiusAxis stroke="#475569" fontSize={9} />
                <Radar name="Piyasa" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="Hisse" dataKey="B" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Chart */}
          <div className="rounded-2xl bg-[#111827] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15">
                  <Activity className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Hacim Analizi</h3>
                  <p className="text-[10px] text-slate-500">Aylık işlem hacmi (Milyar ₺)</p>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="hacim" stroke="#f59e0b" strokeWidth={2} fill="url(#volumeGrad)" name="Hacim" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
