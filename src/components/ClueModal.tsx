import { useEffect, useState } from 'react'
import { COLORS } from '../lib/cards'
import type { Action, Color, OtherPlayerView } from '../lib/types'
import { SuitGlyph } from './Card'
import { COLOR_HEX } from './cardTheme'

type ClueSelection = { kind: 'color'; value: Color } | { kind: 'number'; value: number }

export interface ClueModalProps {
  players: OtherPlayerView[]
  onClose: () => void
  onSubmit: (action: Extract<Action, { type: 'clue' }>) => void
}

const chipBase = 'rounded border px-2.5 py-1 text-sm font-medium transition'

export function ClueModal({ players, onClose, onSubmit }: ClueModalProps) {
  const [targetId, setTargetId] = useState<number>(players[0]?.id ?? -1)
  const [kind, setKind] = useState<'color' | 'number'>('color')
  const [selection, setSelection] = useState<ClueSelection | null>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (players.length === 0) return null

  const target = players.find((p) => p.id === targetId)
  const matchingColors = new Set(target ? target.hand.map((card) => card.color) : [])
  const matchingNumbers = new Set(target ? target.hand.map((card) => card.number) : [])

  function chooseTarget(id: number): void {
    setTargetId(id)
    setSelection(null)
  }

  function chooseKind(next: 'color' | 'number'): void {
    setKind(next)
    setSelection(null)
  }

  function handleSubmit(): void {
    if (targetId === -1 || !selection) return
    if (selection.kind === 'color') {
      onSubmit({ type: 'clue', target: targetId, kind: 'color', value: selection.value })
    } else {
      onSubmit({ type: 'clue', target: targetId, kind: 'number', value: selection.value })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Give a clue"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Give a clue</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ×
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70">Target</p>
          <div className="flex flex-wrap gap-1.5">
            {players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => chooseTarget(player.id)}
                className={`${chipBase} ${
                  player.id === targetId
                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:border-purple-400/40 dark:bg-purple-400/10 dark:text-purple-300'
                    : 'border-neutral-200 bg-white text-gray-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700'
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70">Type</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => chooseKind('color')}
              className={`${chipBase} ${
                kind === 'color'
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:border-purple-400/40 dark:bg-purple-400/10 dark:text-purple-300'
                  : 'border-neutral-200 bg-white text-gray-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              Color
            </button>
            <button
              type="button"
              onClick={() => chooseKind('number')}
              className={`${chipBase} ${
                kind === 'number'
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:border-purple-400/40 dark:bg-purple-400/10 dark:text-purple-300'
                  : 'border-neutral-200 bg-white text-gray-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              Number
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70">Value</p>
          {kind === 'color' ? (
            <div className="grid grid-cols-5 gap-1.5">
              {COLORS.map((color) => {
                const matched = matchingColors.has(color)
                const selected = selection?.kind === 'color' && selection.value === color
                return (
                  <button
                    key={color}
                    type="button"
                    disabled={!matched}
                    onClick={() => setSelection({ kind: 'color', value: color })}
                    aria-label={`${color} clue`}
                    title={color}
                    className={`flex aspect-square items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-30 ${
                      selected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-800' : ''
                    }`}
                    style={{ backgroundColor: COLOR_HEX[color] }}
                  >
                    <svg viewBox="0 0 40 40" className="h-8 w-8">
                      <g transform="translate(20 20) scale(0.95)">
                        <SuitGlyph color={color} onDark />
                      </g>
                    </svg>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((number) => {
                const matched = matchingNumbers.has(number)
                const selected = selection?.kind === 'number' && selection.value === number
                return (
                  <button
                    key={number}
                    type="button"
                    disabled={!matched}
                    onClick={() => setSelection({ kind: 'number', value: number })}
                    className={`aspect-square rounded border text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                      selected
                        ? 'border-purple-500 bg-purple-500 text-white dark:border-purple-400 dark:bg-purple-400 dark:text-neutral-950'
                        : 'border-neutral-200 bg-white text-gray-800 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    {number}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selection}
            className="rounded bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-purple-400 dark:text-neutral-950 dark:hover:bg-purple-300"
          >
            Give clue
          </button>
        </div>
      </div>
    </div>
  )
}
