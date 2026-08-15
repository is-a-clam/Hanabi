import { useEffect, useRef } from 'react'
import { describeCard, playerName } from '../lib/game'
import type { GameEvent, PlayerId, View } from '../lib/types'

export interface LogProps {
  view: View
  myName: string | null
  className?: string
}

function describeEvent(event: GameEvent, getName: (id: PlayerId) => string): string {
  switch (event.type) {
    case 'play':
      return `${getName(event.player)} played ${describeCard(event.card)}${event.success ? '' : ' — missed'}`
    case 'discard':
      return `${getName(event.player)} discarded ${describeCard(event.card)}`
    case 'clue':
      return `${getName(event.from)} clued ${getName(event.to)} ${event.value} (${event.matchedCount} ${
        event.matchedCount === 1 ? 'card' : 'cards'
      })`
  }
}

export function Log({ view, myName, className }: LogProps) {
  const listRef = useRef<HTMLOListElement | null>(null)
  const getName = (id: PlayerId) => playerName(view, myName, id)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [view.log.length])

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50 ${className ?? ''}`}
    >
      <div className='flex items-center justify-between px-3 py-2'>
        <p className='text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>Log</p>
        <span className='text-xs text-gray-500/60 dark:text-gray-400/60'>{view.log.length}</span>
      </div>
      <ol ref={listRef} className='max-h-40 space-y-1 overflow-y-auto px-3 pb-2 text-sm'>
        {view.log.map((event, i) => (
          <li key={i} className='text-gray-700 dark:text-gray-300'>
            {describeEvent(event, getName)}
          </li>
        ))}
      </ol>
    </div>
  )
}
