export default function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a35] border border-white/10 rounded-xl p-3 shadow-xl text-xs tooltip-fade">
      <div className="text-slate-400 mb-2 font-medium">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
          <span className="text-slate-300">{p.name}</span>
          <span className="text-white font-bold ml-auto pl-4">
            {typeof p.value === 'number' ? `₺${p.value.toFixed(2)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}
