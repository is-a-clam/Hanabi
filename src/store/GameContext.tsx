import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { applyAction, createGame, viewForPlayer } from '../lib/game'
import type { Action, GameState, View } from '../lib/types'
import { ClientPeer, HostPeer } from '../net/peer'
import type { HostSeatInfo } from '../net/peer'

export type Phase = 'idle' | 'connecting' | 'lobby' | 'playing' | 'over'

export interface GameContextValue {
  phase: Phase
  isHost: boolean
  name: string | null
  peerId: string | null
  seat: number | null
  roomCode: string | null
  seats: HostSeatInfo[] | null
  view: View | null
  error: string | null
  createRoom: (name: string) => void
  joinRoom: (code: string, name: string) => void
  startGame: () => void
  sendAction: (action: Action) => void
  clearError: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  function setPhase(next: Phase): void {
    phaseRef.current = next
    setPhaseState(next)
  }
  const [isHost, setIsHost] = useState(false)
  const [name, setName] = useState<string | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [seat, setSeat] = useState<number | null>(null)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [seats, setSeats] = useState<HostSeatInfo[] | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hostRef = useRef<HostPeer | null>(null)
  const clientRef = useRef<ClientPeer | null>(null)
  const gameRef = useRef<GameState | null>(null)

  const cleanup = useCallback(() => {
    hostRef.current?.close()
    clientRef.current?.close()
    hostRef.current = null
    clientRef.current = null
    gameRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  const broadcast = useCallback((state: GameState) => {
    const host = hostRef.current
    if (!host) return
    setView(viewForPlayer(state, 0))
    host.broadcast((seatNo) => ({ type: 'snapshot', view: viewForPlayer(state, seatNo) }))
    if (state.over) setPhase('over')
  }, [])

  const applyAndBroadcast = useCallback(
    (action: Action, fromSeat: number) => {
      const state = gameRef.current
      const host = hostRef.current
      if (!state || !host) return
      try {
        const next = applyAction(state, action)
        gameRef.current = next
        broadcast(next)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        host.sendTo(fromSeat, { type: 'error', message })
      }
    },
    [broadcast],
  )

  const createRoom = useCallback(
    (playerName: string) => {
      cleanup()
      setName(playerName)
      setIsHost(true)
      setPhase('connecting')
      setView(null)
      setError(null)
      const host = new HostPeer(playerName, {
        onOpen: (code) => {
          setRoomCode(code)
          setPeerId(code)
          setSeat(0)
          setPhase('lobby')
        },
        onSeatsChanged: (updated) => setSeats(updated),
        onAction: (seatNo, action) => applyAndBroadcast(action, seatNo),
        onError: (message) => {
          setError(message)
          if (phaseRef.current === 'connecting') setPhase('idle')
        },
      })
      hostRef.current = host
      setSeats(host.seats)
    },
    [cleanup, applyAndBroadcast],
  )

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      const trimmed = code.trim()
      setName(playerName)
      setIsHost(false)
      setPhase('connecting')
      setView(null)
      setError(null)
      const existing = clientRef.current
      if (existing && existing.usable) {
        existing.join(trimmed, playerName)
        return
      }
      cleanup()
      const client = new ClientPeer(playerName, {
        onOpen: (id) => setPeerId(id),
        onRoomInfo: (room, mySeat, names, connected) => {
          setRoomCode(room)
          setSeat(mySeat)
          setSeats(names.map((playerName, i) => ({ seat: i, name: playerName, connected: connected[i] ?? false })))
          if (phaseRef.current === 'connecting') setPhase('lobby')
        },
        onSnapshot: (snap) => {
          setView(snap)
          setPhase(snap.over ? 'over' : 'playing')
        },
        onError: (message) => {
          setError(message)
          if (phaseRef.current === 'connecting') setPhase('idle')
        },
        onClosed: () => setPhase('idle'),
      })
      clientRef.current = client
      client.join(trimmed, playerName)
    },
    [cleanup],
  )

  const startGame = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const names = host.seats.flatMap((s) => (s.name ? [s.name] : []))
    const state = createGame(names)
    gameRef.current = state
    host.lockJoins()
    broadcast(state)
    setPhase(state.over ? 'over' : 'playing')
  }, [broadcast])

  const sendAction = useCallback(
    (action: Action) => {
      if (isHost) {
        applyAndBroadcast(action, 0)
      } else {
        clientRef.current?.send({ type: 'action', action })
      }
    },
    [isHost, applyAndBroadcast],
  )

  const clearError = useCallback(() => setError(null), [])

  return (
    <GameContext.Provider
      value={{
        phase,
        isHost,
        name,
        peerId,
        seat,
        roomCode,
        seats,
        view,
        error,
        createRoom,
        joinRoom,
        startGame,
        sendAction,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within a GameProvider')
  return ctx
}
