export default function ChartSkeleton({ height = 200 }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full bg-white/5 rounded-xl flex items-end gap-2 p-4">
        {[40, 70, 55, 90, 65, 80, 45, 75, 60, 85].map((h, i) => (
          <div key={i} className="flex-1 bg-white/10 rounded" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}
