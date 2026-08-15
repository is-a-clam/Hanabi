import { useEffect, useState } from 'react'
import { requestNotifyPermission } from '../lib/notify'
import { useGame } from '../store/GameContext'

function Lobby() {
  const { phase, isHost, roomCode, seat, seats, error, createRoom, joinRoom, startGame, clearError, simulateRoom } =
    useGame()
  const [playerName, setPlayerName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const lockScroll = (): void => document.documentElement.classList.add('keyboard-open')
  const unlockScroll = (): void => document.documentElement.classList.remove('keyboard-open')

  useEffect(() => () => unlockScroll(), [])

  const namedCount = seats?.filter((s) => s.name !== null).length ?? 0
  const canStart = namedCount >= 2

  function handleCreate(): void {
    const trimmed = playerName.trim()
    if (trimmed) {
      requestNotifyPermission()
      createRoom(trimmed)
    }
  }

  function handleJoin(): void {
    const trimmed = playerName.trim()
    const code = joinCode.trim()
    if (trimmed && code) {
      requestNotifyPermission()
      joinRoom(code, trimmed)
    }
  }

  return (
    <main className='flex min-h-svh items-center justify-center bg-white p-6 text-gray-500 dark:bg-neutral-900 dark:text-gray-400'>
      <div className='w-full max-w-md space-y-4 rounded-xl border border-neutral-200 bg-neutral-100 p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-800'>
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

        {phase === 'connecting' && <p className='text-center text-gray-500/70 dark:text-gray-400/70'>Connecting…</p>}

        {phase === 'lobby' && (
          <div className='space-y-4'>
            <div>
              <p className='text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>Room code</p>
              <p className='text-3xl font-bold tracking-[0.3em] text-purple-500 dark:text-purple-400'>{roomCode}</p>
            </div>

            <div>
              <p className='mb-2 text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>Players</p>
              <ul className='space-y-1'>
                {seats?.map((s) => (
                  <li
                    key={s.seat}
                    className={`flex items-center justify-between rounded border px-3 py-2 ${
                      s.seat === seat
                        ? 'border-purple-500/40 bg-purple-500/10 dark:border-purple-400/40 dark:bg-purple-400/10'
                        : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                    }`}
                  >
                    <span className='flex items-center gap-2'>
                      <span
                        className={
                          s.connected ? 'text-purple-500 dark:text-purple-400' : 'text-red-700 dark:text-red-400'
                        }
                      >
                        ●
                      </span>
                      <span className={s.name ? '' : 'italic text-gray-500/50 dark:text-gray-400/50'}>
                        {s.name ?? 'Empty'}
                        {s.seat === seat ? ' (you)' : ''}
                      </span>
                    </span>
                    <span className='text-xs text-gray-500/60 dark:text-gray-400/60'>Seat {s.seat + 1}</span>
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <div className='space-y-2'>
                <button
                  type='button'
                  onClick={startGame}
                  disabled={!canStart}
                  className='w-full rounded bg-purple-500 py-2 font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-purple-400 dark:text-neutral-950 dark:hover:bg-purple-300'
                >
                  Start game
                </button>
                {!canStart && (
                  <p className='text-center text-xs text-gray-500/70 dark:text-gray-400/70'>
                    Need at least 2 players to start
                  </p>
                )}
              </div>
            ) : (
              <p className='text-center text-sm text-gray-500/70 dark:text-gray-400/70'>
                Waiting for the host to start the game…
              </p>
            )}
          </div>
        )}

        {phase === 'idle' && (
          <form onSubmit={(e) => e.preventDefault()} className='space-y-4'>
            <div>
              <label
                htmlFor='player-name'
                className='mb-1 block text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'
              >
                Your name
              </label>
              <input
                id='player-name'
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onFocus={lockScroll}
                onBlur={unlockScroll}
                placeholder='Player'
                autoFocus
                className='w-full rounded border border-neutral-200 bg-white px-3 py-2 text-gray-900 outline-none placeholder:text-gray-500/50 focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:placeholder:text-gray-400/50 dark:focus:ring-purple-400'
              />
            </div>

            <div>
              <label
                htmlFor='room-code'
                className='mb-1 block text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'
              >
                Room code (to join)
              </label>
              <input
                id='room-code'
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onFocus={lockScroll}
                onBlur={unlockScroll}
                placeholder='ABC23'
                maxLength={5}
                className='w-full rounded border border-neutral-200 bg-white px-3 py-2 uppercase text-gray-900 outline-none placeholder:normal-case placeholder:text-gray-500/50 focus:ring-2 focus:ring-purple-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:placeholder:text-gray-400/50 dark:focus:ring-purple-400'
              />
            </div>

            <div className='flex gap-3'>
              <button
                type='submit'
                onClick={handleCreate}
                disabled={!playerName.trim()}
                className='flex-1 rounded bg-purple-500 py-2 font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-purple-400 dark:text-neutral-950 dark:hover:bg-purple-300'
              >
                Create room
              </button>
              <button
                type='submit'
                onClick={handleJoin}
                disabled={!playerName.trim() || joinCode.trim().length !== 5}
                className='flex-1 rounded border border-neutral-200 bg-white py-2 font-semibold text-gray-700 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700'
              >
                Join room
              </button>
            </div>

            {import.meta.env.DEV && (
              <div className='border-t border-neutral-200 pt-3 dark:border-neutral-700'>
                <p className='mb-1.5 text-xs uppercase tracking-wide text-gray-500/70 dark:text-gray-400/70'>
                  Dev — simulate room
                </p>
                <div className='flex flex-wrap gap-2'>
                  {[2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type='button'
                      onClick={() => simulateRoom(count)}
                      className='rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-700'
                    >
                      {count} players
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  )
}

export default Lobby
