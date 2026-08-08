import { useEffect, useState, type CSSProperties } from 'react'
import { IoReload } from 'react-icons/io5'
import { ActionBar } from './ActionBar'
import { Card } from './Card'
import { ClueModal } from './ClueModal'
import { Firework } from './Firework'
import { GameOverModal } from './GameOverModal'
import { Hand } from './Hand'
import type { HandCard } from './Hand'
import { Log } from './Log'
import { COLOR_HEX } from './cardTheme'
import { COLORS } from '../lib/cards'
import { MAX_CLUE_TOKENS, playerName } from '../lib/game'
import type { Action, CardId } from '../lib/types'
import { useGame } from '../store/GameContext'

export function GameTable() {
  const { view, roomCode, name, seats, error, reconnecting, clearError, sendAction, reconnectNow, isHost, startGame } =
    useGame()
  const [selectedId, setSelectedId] = useState<CardId | null>(null)
  const [clueOpen, setClueOpen] = useState(false)

  useEffect(() => {
    setSelectedId(null)
  }, [view?.turnOf])

  if (!view) return null

  const myTurn = view.turnOf === view.me
  const turnOffline = seats?.[view.turnOf]?.connected === false
  const turnText = myTurn ? "It's your turn" : `${playerName(view, name, view.turnOf)}'s turn`
  const clueChips = Array.from({ length: 8 }, (_, i) => i < view.clueTokens)
  const fuseChips = Array.from({ length: 3 }, (_, i) => i < view.fuseTokens)
  const lastEvent = view.log[view.log.length - 1]
  const lastDiscardedId =
    lastEvent && (lastEvent.type === 'discard' || (lastEvent.type === 'play' && !lastEvent.success))
      ? lastEvent.card.id
      : undefined
  const justFused = lastEvent?.type === 'play' && lastEvent.fused
  const sortedDiscard = [...view.discard].sort((a, b) => {
    const colorDiff = COLORS.indexOf(a.color) - COLORS.indexOf(b.color)
    return colorDiff !== 0 ? colorDiff : a.number - b.number
  })
  const ownCards: HandCard[] = view.hand.map((card) => ({
    id: card.id,
    mode: 'marks',
    color: card.color,
    number: card.number,
    selected: selectedId === card.id,
  }))

  function toggleCard(card: HandCard): void {
    if (!myTurn || clueOpen || reconnecting) return
    setSelectedId((current) => (current === card.id ? null : card.id))
  }

  function handlePlay(): void {
    if (selectedId === null) return
    sendAction({ type: 'play', cardId: selectedId })
    setSelectedId(null)
  }

  function handleDiscard(): void {
    if (selectedId === null) return
    sendAction({ type: 'discard', cardId: selectedId })
    setSelectedId(null)
  }

  function handleClue(action: Extract<Action, { type: 'clue' }>): void {
    sendAction(action)
    setClueOpen(false)
  }

  function handlePlayAgain(): void {
    clearError()
    startGame()
  }

  return (
    <main className='flex h-dvh flex-col bg-white text-gray-500 dark:bg-neutral-900 dark:text-gray-400'>
      <header className='sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'>
        <div className='mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 pt-3 pb-2'>
          <span className='text-xs font-semibold uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>
            Room {roomCode}
          </span>
          {!isHost && (
            <button
              type='button'
              onClick={reconnectNow}
              title='Reconnect'
              aria-label='Reconnect'
              className='rounded p-1 text-gray-500/70 transition hover:bg-neutral-100 hover:text-gray-900 dark:text-gray-400/70 dark:hover:bg-neutral-700 dark:hover:text-gray-100'
            >
              <IoReload className={`text-lg${reconnecting ? ' animate-spin' : ''}`} />
            </button>
          )}
          <span className='flex items-center gap-1'>
            {clueChips.map((filled, i) => (
              <span
                key={`clue-${i}`}
                className={`h-3.5 w-3.5 rounded-sm ${filled ? 'bg-purple-500 dark:bg-purple-400' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
            <span className='ml-1 text-xs'>clues</span>
          </span>
          <span className={`flex items-center gap-1${justFused ? ' animate-fuse-flash' : ''}`}>
            {fuseChips.map((filled, i) => (
              <span
                key={`fuse-${i}`}
                className={`h-3.5 w-3.5 rounded-sm ${filled ? 'bg-red-600 dark:bg-red-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
              />
            ))}
            <span className='ml-1 text-xs'>fuses</span>
          </span>
          <span className='flex items-center gap-1.5'>
            <Card mode='back' color={null} number={null} className='h-10 w-7' />
            <span className='text-sm font-semibold'>{view.deckRemaining}</span>
          </span>
        </div>
      </header>

      <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
        <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-4'>
          {reconnecting && (
            <p className='rounded bg-amber-100 px-3 py-1.5 text-center text-sm font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-400'>
              Disconnected — reconnecting…
            </p>
          )}

          {error && (
            <div className='flex items-start justify-between gap-3 rounded border border-red-700/30 bg-red-700/10 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-400'>
              <span>{error}</span>
              <button
                type='button'
                onClick={clearError}
                aria-label='dismiss error'
                className='font-bold hover:text-red-900 dark:hover:text-red-200'
              >
                ×
              </button>
            </div>
          )}

          <p
            className={`text-center text-sm font-semibold ${
              myTurn ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {turnText}
            {turnOffline && ' (offline)'}
          </p>

          {view.finalRound && (
            <p className='rounded bg-amber-100 px-3 py-1.5 text-center text-sm font-semibold text-amber-800 dark:bg-amber-400/10 dark:text-amber-400'>
              Final round — {view.finalTurnsRemaining} {view.finalTurnsRemaining === 1 ? 'turn' : 'turns'} left
            </p>
          )}

          <section className='space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50'>
            <div className='flex flex-wrap items-end justify-center gap-2'>
              {COLORS.map((color) => (
                <Firework
                  key={color}
                  color={color}
                  level={view.fireworks[color]}
                  highlight={lastEvent?.type === 'play' && lastEvent.success && lastEvent.card.color === color}
                />
              ))}
            </div>
            <div>
              <p className='mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>
                Discard · {view.discard.length}
              </p>
              {sortedDiscard.length > 0 ? (
                <div className='flex flex-wrap gap-1'>
                  {sortedDiscard.map((card) => (
                    <Card
                      key={card.id}
                      mode='face'
                      color={card.color}
                      number={card.number}
                      className={`h-11 w-8 sm:h-14 sm:w-10${card.id === lastDiscardedId ? ' animate-card-pop' : ''}`}
                      style={
                        card.id === lastDiscardedId
                          ? ({ '--card-pop-color': `${COLOR_HEX[card.color]}e6` } as CSSProperties)
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className='h-11 w-8 rounded-md border border-dashed border-neutral-300 dark:border-neutral-600 sm:h-14 sm:w-10' />
              )}
            </div>
          </section>

          <section className='space-y-4'>
            {view.players.map((player) => (
              <Hand
                key={player.id}
                title={player.name}
                active={view.turnOf === player.id}
                offline={seats?.[player.id]?.connected === false}
                cards={player.hand.map((card, i) => ({
                  id: card.id,
                  mode: 'face',
                  color: card.color,
                  number: card.number,
                  known: player.marks[i],
                }))}
              />
            ))}
          </section>

          {myTurn && !view.over && !reconnecting && (
            <ActionBar
              canClue={view.clueTokens > 0}
              canDiscard={view.clueTokens < MAX_CLUE_TOKENS}
              hasSelection={selectedId !== null}
              onPlay={handlePlay}
              onDiscard={handleDiscard}
              onClue={() => setClueOpen(true)}
            />
          )}

          <Hand
            title={name ? `${name} (you)` : 'You'}
            active={myTurn}
            own
            offline={seats?.[view.me]?.connected === false}
            cards={ownCards}
            onCardClick={toggleCard}
            className='mt-auto'
          />

          <Log view={view} myName={name} />
        </div>
      </div>

      <div className='h-10 shrink-0' />

      {clueOpen && <ClueModal players={view.players} onClose={() => setClueOpen(false)} onSubmit={handleClue} />}
      {view.over && <GameOverModal view={view} isHost={isHost} onPlayAgain={handlePlayAgain} />}
    </main>
  )
}
