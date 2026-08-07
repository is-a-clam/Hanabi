import { Card, SuitGlyph } from './Card'
import type { Color } from '../lib/types'

const FIREWORK_SIZE = 'h-20 w-14 sm:h-24 sm:w-16'
const STACK_STEP = 26

export function Firework({ color, level, highlight = false }: { color: Color; level: number; highlight?: boolean }) {
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
  const pad = (level - 1) * STACK_STEP
  return (
    <div className="relative" style={{ paddingTop: pad }}>
      <Card mode="face" color={color} number={level} className={`relative ${FIREWORK_SIZE}${highlight ? ' animate-card-pop' : ''}`} style={{ zIndex: level }} />
      {Array.from({ length: level - 1 }, (_, i) => {
        const value = level - 1 - i
        return (
          <Card
            key={value}
            mode="face"
            color={color}
            number={value}
            className={`absolute ${FIREWORK_SIZE}`}
            style={{ left: 0, top: (value - 1) * STACK_STEP, zIndex: value }}
          />
        )
      })}
      {level === 5 && <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-green-500" />}
    </div>
  )
}
