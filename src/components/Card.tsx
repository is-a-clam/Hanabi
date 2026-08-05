import type { ReactNode } from 'react'
import type { Color } from '../lib/types'
import { CARD_H, CARD_W, COLOR_HEX } from './cardTheme'
import type { CardMode } from './cardTheme'

export interface CardProps {
  mode: CardMode
  color: Color | null
  number: number | null
  selected?: boolean
  className?: string
}

interface GlyphStyle {
  fill: string
  stroke: string
  strokeWidth: number
}

function glyphStyle(color: Color, onDark: boolean): GlyphStyle {
  if (onDark) {
    return color === 'white'
      ? { fill: '#4b5563', stroke: '#4b5563', strokeWidth: 1 }
      : { fill: '#ffffff', stroke: 'none', strokeWidth: 0 }
  }
  return color === 'white'
    ? { fill: '#f9fafb', stroke: '#9ca3af', strokeWidth: 1.5 }
    : { fill: COLOR_HEX[color], stroke: 'none', strokeWidth: 0 }
}

export function SuitGlyph({ color, onDark = false }: { color: Color; onDark?: boolean }) {
  const style = glyphStyle(color, onDark)
  const common = {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeLinejoin: 'round' as const,
  }
  switch (color) {
    case 'red':
      return (
        <g {...common}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" transform="translate(-12 -12)" />
        </g>
      )
    case 'yellow':
      return (
        <g {...common}>
          <rect x="-10" y="-10" width="20" height="20" transform="rotate(45)" />
        </g>
      )
    case 'green':
      return (
        <g {...common}>
          <circle cx="-6.5" cy="-6.5" r="6.5" />
          <circle cx="6.5" cy="-6.5" r="6.5" />
          <circle cx="-6.5" cy="6.5" r="6.5" />
          <circle cx="6.5" cy="6.5" r="6.5" />
        </g>
      )
    case 'blue':
      return (
        <g {...common}>
          <circle cx="0" cy="-10" r="5.5" />
          <circle cx="8.7" cy="-5" r="5.5" />
          <circle cx="8.7" cy="5" r="5.5" />
          <circle cx="0" cy="10" r="5.5" />
          <circle cx="-8.7" cy="5" r="5.5" />
          <circle cx="-8.7" cy="-5" r="5.5" />
        </g>
      )
    case 'white':
      return (
        <g {...common}>
          <path d="M0 -14 L3.6 -3.6 L14 0 L3.6 3.6 L0 14 L-3.6 3.6 L-14 0 L-3.6 -3.6 Z" />
        </g>
      )
  }
}

function cardLabel(mode: CardMode, color: Color | null, number: number | null): string {
  if (mode === 'back') return 'card back'
  if (mode === 'face') return color ? `${number ?? ''} ${color}` : 'card'
  if (color || number != null) return `${color ?? ''} ${number ?? ''} marked`.trim()
  return 'unknown card'
}

export function Card({ mode, color, number, selected = false, className }: CardProps) {
  let inner: ReactNode
  if (mode === 'back') {
    inner = (
      <>
        <rect x="3" y="3" width="60" height="90" rx="7" fill="#312e81" stroke="#4f46e5" strokeWidth="2" />
        <rect x="8.5" y="8.5" width="49" height="79" rx="5" fill="none" stroke="#6366f1" strokeWidth="1.5" />
        <g transform="translate(33 48) scale(0.55)" opacity="0.5">
          <g fill="#a5b4fc" stroke="none" strokeWidth={0}>
            <rect x="-10" y="-10" width="20" height="20" transform="rotate(45)" />
          </g>
        </g>
      </>
    )
  } else if (mode === 'face') {
    const hex = color ? COLOR_HEX[color] : '#9ca3af'
    inner = (
      <>
        <rect x="3" y="3" width="60" height="90" rx="7" fill="#ffffff" stroke={hex} strokeWidth="3" />
        {number != null && (
          <>
            <text x="12" y="24" fontSize="17" fontWeight="700" fill="#1f2937">
              {number}
            </text>
            <text x="12" y="24" fontSize="17" fontWeight="700" fill="#1f2937" transform="rotate(180 33 48)">
              {number}
            </text>
          </>
        )}
        {color && (
          <g transform="translate(33 50) scale(0.85)">
            <SuitGlyph color={color} />
          </g>
        )}
      </>
    )
  } else {
    inner = (
      <>
        <rect x="3" y="3" width="60" height="90" rx="7" fill="#ffffff" stroke="#d1d5db" strokeWidth="2" strokeDasharray="5 4" />
        {number != null && (
          <g transform="translate(12 20)">
            <rect x="-9" y="-13" width="18" height="20" rx="4" fill="#1f2937" />
            <text x="0" y="-2" fontSize="15" fontWeight="700" fill="#ffffff" textAnchor="middle" dominantBaseline="middle">
              {number}
            </text>
          </g>
        )}
        {color && (
          <g transform="translate(48 78)">
            <circle r="14" fill={COLOR_HEX[color]} />
            <g transform="scale(0.62)">
              <SuitGlyph color={color} onDark />
            </g>
          </g>
        )}
      </>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      className={className}
      role="img"
      aria-label={cardLabel(mode, color, number)}
    >
      {selected && <rect x="1" y="1" width="64" height="94" rx="9" fill="none" stroke="#a855f7" strokeWidth="3" />}
      {inner}
    </svg>
  )
}
