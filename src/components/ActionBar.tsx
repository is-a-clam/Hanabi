export interface ActionBarProps {
  canClue: boolean
  canDiscard: boolean
  hasSelection: boolean
  onPlay: () => void
  onDiscard: () => void
  onClue: () => void
}

const buttonBase =
  'rounded px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'

export function ActionBar({ canClue, canDiscard, hasSelection, onPlay, onDiscard, onClue }: ActionBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={onPlay}
          disabled={!hasSelection}
          className={`${buttonBase} bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-400 dark:text-neutral-950 dark:hover:bg-purple-300`}
        >
          Play
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!hasSelection || !canDiscard}
          className={`${buttonBase} border border-neutral-200 bg-white text-gray-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700`}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onClue}
          disabled={!canClue}
          className={`${buttonBase} bg-teal-600 text-white hover:bg-teal-500 dark:bg-teal-500 dark:text-neutral-950 dark:hover:bg-teal-400`}
        >
          Clue
        </button>
      </div>
      <p className="text-center text-xs text-gray-500/70 dark:text-gray-400/70">
        {hasSelection ? 'Press Play or Discard on the selected card' : 'Select a card to play or discard'}
      </p>
    </div>
  )
}
