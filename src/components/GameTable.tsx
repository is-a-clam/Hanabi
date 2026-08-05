import { Card } from './Card'
import { Firework } from './Firework'
import { Hand } from './Hand'
import type { HandCard } from './Hand'
import { COLORS } from '../lib/cards'
import type { View } from '../lib/types'
import { useGame } from '../store/GameContext'

function playerName(view: View, id: number): string {
  if (id === view.me) return 'you'
  const player = view.players.find((p) => p.id === id)
  return player ? player.name : `Seat ${id + 1}`
}

export function GameTable() {
  const { view, roomCode, name } = useGame()
  if (!view) return null

  const myTurn = view.turnOf === view.me
  const turnText = myTurn ? "It's your turn" : `${playerName(view, view.turnOf)}'s turn`
  const clueChips = Array.from({ length: 8 }, (_, i) => i < view.clueTokens)
  const fuseChips = Array.from({ length: 3 }, (_, i) => i < view.fuseTokens)
  const discardTop = view.discard.length > 0 ? view.discard[view.discard.length - 1] : null
  const ownCards: HandCard[] = view.hand.map((card) => ({
    id: card.id,
    mode: 'marks',
    color: card.color,
    number: card.number,
  }))

  return (
    <main className="min-h-svh bg-white text-gray-500 dark:bg-neutral-900 dark:text-gray-400">
      <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-5 px-4 py-5">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70">
            Room {roomCode}
          </span>
          <span className="flex items-center gap-1">
            {clueChips.map((filled, i) => (
              <span
                key={`clue-${i}`}
                className={`h-3.5 w-3.5 rounded-sm ${filled ? 'bg-purple-500 dark:bg-purple-400' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
            <span className="ml-1 text-xs">clues</span>
          </span>
          <span className="flex items-center gap-1">
            {fuseChips.map((filled, i) => (
              <span
                key={`fuse-${i}`}
                className={`h-3.5 w-3.5 rounded-sm ${filled ? 'bg-red-600 dark:bg-red-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
            <span className="ml-1 text-xs">fuses</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Card mode="back" color={null} number={null} className="h-10 w-7" />
            <span className="text-sm font-semibold">{view.deckRemaining}</span>
          </span>
        </header>

        <p
          className={`text-center text-sm font-semibold ${
            myTurn ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {turnText}
        </p>

        {view.finalRound && (
          <p className="rounded bg-amber-100 px-3 py-1.5 text-center text-sm font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-400">
            Final round — {view.finalTurnsRemaining} {view.finalTurnsRemaining === 1 ? 'turn' : 'turns'} left
          </p>
        )}

        <section className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
          {COLORS.map((color) => (
            <Firework key={color} color={color} level={view.fireworks[color]} />
          ))}
          <div className="ml-2 flex items-center gap-1.5">
            {discardTop ? (
              <Card mode="face" color={discardTop.color} number={discardTop.number} className="h-16 w-11 sm:h-20 sm:w-14" />
            ) : (
              <div className="h-16 w-11 rounded-md border border-dashed border-neutral-300 dark:border-neutral-600 sm:h-20 sm:w-14" />
            )}
            <span className="text-xs text-gray-500/70 dark:text-gray-400/70">×{view.discard.length}</span>
          </div>
        </section>

        <section className="space-y-4">
          {view.players.map((player) => (
            <Hand
              key={player.id}
              title={player.name}
              active={view.turnOf === player.id}
              cards={player.hand.map((card) => ({ id: card.id, mode: 'face', color: card.color, number: card.number }))}
            />
          ))}
        </section>

        <Hand
          title={name ? `${name} (you)` : 'You'}
          active={myTurn}
          own
          cards={ownCards}
          className="mt-auto"
        />
      </div>
    </main>
  )
}
