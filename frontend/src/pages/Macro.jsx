import { useState, useEffect } from 'react'
import client from '../api/client'
import { formatNumber, formatDate } from '../utils/formatters'
import { Globe, Activity, TrendingDown, BarChart2, ShieldAlert } from 'lucide-react'

const META = {
  'CDS':       { label: 'Türkiye CDS', unit: 'bps', icon: ShieldAlert, color: 'red' },
  'VIX':       { label: 'VIX (Korku)',  unit: '',    icon: Activity,    color: 'yellow' },
  'ENFLASYON': { label: 'Enflasyon',    unit: '%',   icon: TrendingDown,color: 'cyan' },
  'FAIZ':      { label: 'TCMB Faiz',    unit: '%',   icon: BarChart2,   color: 'green' },
}

const Macro = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try { setLoading(true); const res = await client.get('/macro'); setData(res.data) }
      catch {} finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Globe size={24} className="text-green-400" /> Makro Göstergeler</h1>
        <p className="text-sm text-slate-500 mt-1">Ekonomik göstergeler</p></div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(META).map(([type, meta]) => {
          const item = data.find(d => d.type === type)
          const Icon = meta.icon
          return (
            <div key={type} className="glass-card glass-card-hover p-5 relative overflow-hidden">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{meta.label}</p>
                <Icon size={18} className={`text-${meta.color}-400`} />
              </div>
              {item ? (
                <>
                  <p className="text-3xl font-bold mb-1">{formatNumber(item.value)}<span className="text-base text-slate-500 ml-1">{meta.unit}</span></p>
                  <p className="text-[11px] text-slate-600">Son: {formatDate(item.date)}</p>
                </>
              ) : <p className="text-xl text-slate-600">Veri Yok</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Macro
