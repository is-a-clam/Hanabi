import { COLORS } from '../lib/cards'
import type { GameOverReason, View } from '../lib/types'
import { Firework } from './Firework'

export interface GameOverModalProps {
  view: View
  isHost: boolean
  onPlayAgain: () => void
}

function overCopy(reason: GameOverReason): { title: string; description: string } {
  switch (reason) {
    case 'fuse':
      return { title: 'Game over', description: 'Three fuses burned, the fireworks go unfinished.' }
    case 'deck':
      return { title: 'Deck exhausted', description: 'The deck ran out, the final score stands.' }
    case 'perfect':
      return { title: 'Perfect game!', description: 'All five fireworks complete.' }
  }
}

export function GameOverModal({ view, isHost, onPlayAgain }: GameOverModalProps) {
  if (!view.over) return null
  const copy = overCopy(view.over.reason)
  const perfect = view.over.reason === 'perfect'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
      <div
        className='w-full max-w-md space-y-5 rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-xl dark:border-neutral-700 dark:bg-neutral-800'
        role='dialog'
        aria-modal='true'
        aria-label='Game over'
      >
        <div>
          <h2
            className={`text-2xl font-bold ${
              perfect ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {copy.title}
          </h2>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>{copy.description}</p>
        </div>

        <p className='text-5xl font-extrabold text-purple-600 dark:text-purple-400'>
          {view.over.score}
          <span className='text-xl font-semibold text-gray-500/70 dark:text-gray-400/70'> / 25</span>
        </p>

        <div className='flex items-end justify-center gap-2'>
          {COLORS.map((color) => (
            <Firework key={color} color={color} level={view.fireworks[color]} />
          ))}
        </div>

        {isHost ? (
          <button
            type='button'
            onClick={onPlayAgain}
            className='w-full rounded bg-purple-500 py-2 font-semibold text-white transition hover:bg-purple-600 dark:bg-purple-400 dark:text-neutral-950 dark:hover:bg-purple-300'
          >
            Play again
          </button>
        ) : (
          <p className='text-sm text-gray-500/70 dark:text-gray-400/70'>Waiting for the host to start another game…</p>
        )}
      </div>
    </div>
  )
}
