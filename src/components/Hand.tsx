import type { ReactNode } from 'react'
import { Card } from './Card'
import type { CardMode } from './cardTheme'
import type { Color } from '../lib/types'

export interface HandCard {
  id: number
  mode: CardMode
  color: Color | null
  number: number | null
  selected?: boolean
  known?: { color: Color | null; number: number | null }
}

export interface HandProps {
  title: string
  cards: HandCard[]
  active?: boolean
  own?: boolean
  compact?: boolean
  offline?: boolean
  onCardClick?: (card: HandCard) => void
  actionButton?: ReactNode
  className?: string
}

export function Hand({
  title,
  cards,
  active = false,
  own = false,
  compact = false,
  offline = false,
  onCardClick,
  actionButton,
  className,
}: HandProps) {
  const size = own
    ? 'h-28 w-[4.4rem] sm:h-32 sm:w-[4.9rem]'
    : compact
      ? 'h-24 w-[3rem] sm:h-28 sm:w-[4.4rem]'
      : 'h-24 w-16 sm:h-28 sm:w-[4.4rem]'
  const rowClass = own ? 'justify-center' : actionButton ? 'flex-wrap justify-between sm:justify-start' : ''
  return (
    <div className={className}>
      <p
        className={`mb-1.5 text-sm font-semibold ${
          active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
        {offline && (
          <span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            offline
          </span>
        )}
      </p>
      <div className={`flex items-center gap-1.5 ${rowClass}`}>
        <div className='flex items-end gap-1.5'>
          {cards.map((card) => (
            <Card
              key={card.id}
              mode={card.mode}
              color={card.color}
              number={card.number}
              selected={card.selected}
              known={card.known}
              className={size}
              onClick={onCardClick ? () => onCardClick(card) : undefined}
            />
          ))}
        </div>
        {actionButton && <div className='ml-1.5 shrink-0 sm:ml-2.5'>{actionButton}</div>}
      </div>
    </div>
  )
}
