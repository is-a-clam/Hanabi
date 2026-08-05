import { Card } from './Card'
import type { CardMode } from './cardTheme'
import type { Color } from '../lib/types'

export interface HandCard {
  id: number
  mode: CardMode
  color: Color | null
  number: number | null
}

export interface HandProps {
  title: string
  cards: HandCard[]
  active?: boolean
  own?: boolean
  className?: string
}

export function Hand({ title, cards, active = false, own = false, className }: HandProps) {
  const size = own ? 'h-28 w-[4.4rem] sm:h-32 sm:w-[4.9rem]' : 'h-24 w-16 sm:h-28 sm:w-[4.4rem]'
  return (
    <div className={className}>
      <p
        className={`mb-1.5 text-sm font-semibold ${
          active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
      </p>
      <div className={`flex items-end gap-1.5 ${own ? 'justify-center' : ''}`}>
        {cards.map((card) => (
          <Card key={card.id} mode={card.mode} color={card.color} number={card.number} className={size} />
        ))}
      </div>
    </div>
  )
}
