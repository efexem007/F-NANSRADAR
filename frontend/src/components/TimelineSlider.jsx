import { useState } from 'react'

const months = []
const start = new Date('2023-01-01')
for (let i = 0; i < 30; i++) {
  const d = new Date(start)
  d.setMonth(start.getMonth() + i)
  months.push(d.toISOString().slice(0, 7))
}

export { months }

export default function TimelineSlider({ value, onChange }) {
  return (
    <div className="flex flex-col items-center w-full px-8 py-3">
      <div className="text-purple-400 font-bold text-sm mb-2">{value}</div>
      <div className="flex items-center w-full gap-3">
        <span className="text-xs text-slate-500">{months[0]}</span>
        <input
          type="range"
          min={0}
          max={months.length - 1}
          value={months.indexOf(value)}
          onChange={e => onChange(months[parseInt(e.target.value)])}
          className="flex-1 accent-purple-500"
        />
        <span className="text-xs text-slate-500">{months[months.length - 1]}</span>
      </div>
    </div>
  )
}
