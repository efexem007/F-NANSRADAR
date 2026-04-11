export default function ChartCard({ icon, title, badge, badgeColor = 'purple', children }) {
  const colors = {
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    ai: 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-purple-300 border-purple-500/30 animate-pulse',
  }
  return (
    <div className="glass-card glass-card-hover p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-slate-200">{title}</span>
        </div>
        {badge && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[badgeColor] || colors.purple}`}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
