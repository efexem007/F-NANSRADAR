import { memo } from 'react'

export default memo(function RiskGauge({ score = 65 }) {
  const angle = (score / 100) * 180 - 90
  const rad = (angle * Math.PI) / 180
  const cx = 100, cy = 100, r = 80
  const x = cx + r * Math.cos(rad)
  const y = cy + r * Math.sin(rad)
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
        <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
        <path d="M 100 20 A 80 80 0 0 1 140 30" fill="none" stroke="#f59e0b" strokeWidth="14" strokeLinecap="round" />
        <path d="M 140 30 A 80 80 0 0 1 180 100" fill="none" stroke="#00ff88" strokeWidth="14" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={x} y2={y} stroke="white" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="white" />
        <text x={cx} y={cy + 22} textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">{score}</text>
        <text x={cx} y={cy + 38} textAnchor="middle" fill="#64748b" fontSize="9">Risk / Ödül Skoru</text>
      </svg>
    </div>
  )
})
