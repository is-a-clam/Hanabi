import { Card, SuitGlyph } from './Card'
import type { Color } from '../lib/types'

const FIREWORK_SIZE = 'h-20 w-14 sm:h-24 sm:w-16'

export function Firework({ color, level }: { color: Color; level: number }) {
  if (level === 0) {
    return (
      <svg viewBox="0 0 66 96" className={FIREWORK_SIZE} role="img" aria-label={`${color} firework empty`}>
        <rect x="3" y="3" width="60" height="90" rx="7" fill="none" stroke="#d1d5db" strokeWidth="2" strokeDasharray="5 4" />
        <g transform="translate(33 48) scale(0.5)" opacity="0.35">
          <SuitGlyph color={color} />
        </g>
      </svg>
    )
  }
  return (
    <div className="relative">
      <Card mode="face" color={color} number={level} className={FIREWORK_SIZE} />
      {level === 5 && <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-green-500" />}
    </div>
  )
}
