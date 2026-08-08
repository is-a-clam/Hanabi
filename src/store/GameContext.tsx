import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { applyAction, createGame, viewForPlayer } from '../lib/game'
import type { Action, GameState, View } from '../lib/types'
import { ClientPeer, HostPeer, reconnectDelays, RECONNECT_BUDGET_MS, RECONNECT_MAX_DELAY_MS } from '../net/peer'
import type { HostPeerOptions, HostSeatInfo } from '../net/peer'
import type { HostSession } from './session'
import {
  clearClientSession,
  clearHostSession,
  loadClientSession,
  loadHostSession,
  saveClientSession,
  saveHostSession,
} from './session'

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
  reconnecting: boolean
  createRoom: (name: string) => void
  joinRoom: (code: string, name: string) => void
  startGame: () => void
  sendAction: (action: Action) => void
  reconnectNow: () => void
  clearError: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  // Common State
  const [isHost, setIsHost] = useState(false)
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [peerId, setPeerId] = useState<string | null>(null)
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [seat, setSeat] = useState<number | null>(null)
  const [seats, setSeats] = useState<HostSeatInfo[] | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)

  const roomCodeRef = useRef<string | null>(null)
  const nameRef = useRef<string | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const recoveredRef = useRef(false)

  useEffect(() => {
    roomCodeRef.current = roomCode
  }, [roomCode])
  useEffect(() => {
    nameRef.current = name
  }, [name])
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Host State
  const hostRef = useRef<HostPeer | null>(null)
  const gameRef = useRef<GameState | null>(null)

  // Client State
  const [reconnecting, setReconnectingState] = useState(false)

  const clientRef = useRef<ClientPeer | null>(null)
  const reconnectingRef = useRef(false)
  const retryModeRef = useRef<'lobby' | 'game'>('game')

  useEffect(() => {
    reconnectingRef.current = reconnecting
  }, [reconnecting])

  const cleanup = useCallback(() => {
    hostRef.current?.close()
    clientRef.current?.close()
    hostRef.current = null
    clientRef.current = null
    gameRef.current = null
    recoveredRef.current = false
    setReconnectingState(false)
  }, [])

  useEffect(() => cleanup, [cleanup])

  const persistHost = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    saveHostSession({
      roomCode: host.roomCode,
      name: host.seats[0]?.name ?? '',
      seats: host.seats.map((s) => s.name),
      game: gameRef.current,
    })
  }, [])

  const broadcast = useCallback((state: GameState) => {
    const host = hostRef.current
    if (!host) return
    setView(viewForPlayer(state, 0))
    host.broadcast((seatNo) => ({ type: 'snapshot', view: viewForPlayer(state, seatNo) }))
    if (state.over) setPhaseState('over')
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
        persistHost()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        host.sendTo(fromSeat, { type: 'error', message })
      }
    },
    [broadcast, persistHost],
  )

  const makeHost = useCallback(
    (hostName: string, opts?: HostPeerOptions) => {
      const host = new HostPeer(
        hostName,
        {
          onOpen: (code) => {
            setRoomCode(code)
            setPeerId(code)
            setSeat(0)
            if (gameRef.current) {
              host.lockJoins()
              setPhaseState(gameRef.current.over ? 'over' : 'playing')
            } else {
              setPhaseState('lobby')
            }
            persistHost()
          },
          onSeatsChanged: (updated) => {
            setSeats(updated)
            persistHost()
          },
          onAction: (seatNo, action) => applyAndBroadcast(action, seatNo),
          onReconnect: (seatNo) => {
            const state = gameRef.current
            if (state) host.sendTo(seatNo, { type: 'snapshot', view: viewForPlayer(state, seatNo) })
          },
          onError: (message) => {
            setError(message)
            if (phaseRef.current === 'connecting') setPhaseState('idle')
          },
        },
        opts,
      )
      return host
    },
    [applyAndBroadcast, persistHost],
  )

  const makeClient = useCallback((clientName: string, roomCode: string) => {
    return new ClientPeer(clientName, roomCode, {
      onOpen: (id) => setPeerId(id),
      onRoomInfo: (room, mySeat, names, connected) => {
        setRoomCode(room)
        setSeat(mySeat)
        setSeats(names.map((playerName, i) => ({ seat: i, name: playerName, connected: connected[i] ?? false })))
        saveClientSession({ roomCode: room, name: clientName })
        if (phaseRef.current === 'connecting') setPhaseState('lobby')
        if (reconnectingRef.current && retryModeRef.current === 'lobby') setReconnectingState(false)
      },
      onSnapshot: (snap) => {
        setView(snap)
        setPhaseState(snap.over ? 'over' : 'playing')
        if (reconnectingRef.current) setReconnectingState(false)
      },
      onError: (message) => {
        if (reconnectingRef.current) return
        setError(message)
        if (phaseRef.current === 'connecting') setPhaseState('idle')
      },
      onDisconnect: () => {
        const current = phaseRef.current
        if (current === 'playing' || current === 'over') {
          retryModeRef.current = 'game'
          setReconnectingState(true)
        } else if (current === 'lobby') {
          retryModeRef.current = 'lobby'
          setReconnectingState(true)
        } else {
          setError('Disconnected.')
          setPhaseState('idle')
          clearClientSession()
        }
      },
    })
  }, [])

  const createRoom = useCallback(
    (playerName: string) => {
      cleanup()
      clearHostSession()
      clearClientSession()
      setName(playerName)
      setIsHost(true)
      setSeat(0)
      setPhaseState('connecting')
      setView(null)
      setError(null)
      const host = makeHost(playerName)
      hostRef.current = host
      setSeats(host.seats)
    },
    [cleanup, makeHost],
  )

  const recoverHost = useCallback(
    (saved: HostSession) => {
      cleanup()
      clearClientSession()
      setName(saved.name)
      setIsHost(true)
      setSeat(0)
      setPhaseState('connecting')
      setView(null)
      setError(null)
      if (saved.game) {
        gameRef.current = saved.game
        setView(viewForPlayer(saved.game, 0))
      }
      const host = makeHost(saved.name, { roomCode: saved.roomCode, seats: saved.seats })
      hostRef.current = host
      setSeats(host.seats)
    },
    [cleanup, makeHost],
  )

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      const trimmed = code.trim()
      cleanup()
      clearHostSession()
      setName(playerName)
      setIsHost(false)
      setPhaseState('connecting')
      setView(null)
      setError(null)
      const client = makeClient(playerName, trimmed)
      clientRef.current = client
    },
    [cleanup, makeClient],
  )

  const reconnectRoom = useCallback(
    (code: string, playerName: string) => {
      const trimmed = code.trim()
      cleanup()
      clearHostSession()
      setName(playerName)
      setIsHost(false)
      setError(null)
      const client = makeClient(playerName, trimmed)
      clientRef.current = client
    },
    [cleanup, makeClient],
  )

  const startGame = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const names = host.seats.flatMap((s) => (s.name ? [s.name] : []))
    const state = createGame(names)
    gameRef.current = state
    host.lockJoins()
    broadcast(state)
    setPhaseState(state.over ? 'over' : 'playing')
    persistHost()
  }, [broadcast, persistHost])

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

  const reconnectNow = useCallback(() => {
    const code = roomCodeRef.current
    const playerName = nameRef.current
    if (isHost || !code || !playerName) return
    reconnectRoom(code, playerName)
  }, [isHost, reconnectRoom])

  useEffect(() => {
    if (recoveredRef.current) return
    recoveredRef.current = true
    const hostSession = loadHostSession()
    if (hostSession) {
      recoverHost(hostSession)
      return
    }
    const clientSession = loadClientSession()
    if (clientSession) {
      joinRoom(clientSession.roomCode, clientSession.name)
    }
  }, [recoverHost, joinRoom])

  useEffect(() => {
    if (!reconnecting) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let index = 0
    const delays = reconnectDelays(RECONNECT_BUDGET_MS, RECONNECT_MAX_DELAY_MS)
    const code = roomCodeRef.current
    const playerName = nameRef.current

    if (!code || !playerName) return

    const run = (): void => {
      if (cancelled) return
      reconnectRoom(code, playerName)
      const delay = delays[Math.min(index, delays.length - 1)]
      index += 1
      timer = setTimeout(run, delay)
    }
    run()

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [reconnecting, makeClient, reconnectRoom])

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
        reconnecting,
        createRoom,
        joinRoom,
        startGame,
        sendAction,
        reconnectNow,
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
