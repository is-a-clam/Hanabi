import Peer, { PeerErrorType, type DataConnection, type PeerError } from 'peerjs'
import { peerOptions } from '../lib/config'
import { MAX_PLAYERS } from '../lib/game'
import type { Action, View } from '../lib/types'
import type { ClientToHost, HostToClient } from './protocol'
import { isClientMessage, isHostMessage } from './protocol'
import { generateRoomCode } from './room'

export const MAX_ROOM_CODE_ATTEMPTS = 5
export const PING_INTERVAL_MS = 2000
export const SEAT_TIMEOUT_MS = 15000
export const HOST_RECOVERY_BUDGET_MS = 60000
export const HOST_RECOVERY_MAX_DELAY_MS = 15000
export const RECONNECT_BUDGET_MS = 60000
export const RECONNECT_MAX_DELAY_MS = 15000

export function isStale(now: number, lastSeen: number | undefined, timeoutMs: number): boolean {
  return lastSeen === undefined || now - lastSeen >= timeoutMs
}

export function reconnectDelays(budgetMs: number, maxDelayMs: number): number[] {
  const delays: number[] = []
  let total = 0
  let delay = 2000
  while (total + delay <= budgetMs) {
    delays.push(delay)
    total += delay
    delay = Math.min(delay * 2, maxDelayMs)
  }
  return delays
}

export interface HostSeatInfo {
  seat: number
  name: string | null
  connected: boolean
}

export interface HostCallbacks {
  onOpen(roomCode: string): void
  onSeatsChanged(seats: HostSeatInfo[]): void
  onAction(seat: number, action: Action): void
  onReconnect(seat: number): void
  onError(message: string): void
}

export interface ClientCallbacks {
  onOpen(id: string): void
  onRoomInfo(room: string, seat: number, names: (string | null)[], connected: boolean[]): void
  onSnapshot(view: View): void
  onDisconnect(): void
  onError(message: string): void
}

export interface HostPeerOptions {
  roomCode?: string
  seats?: (string | null)[]
}

export class HostPeer {
  private _roomCode!: string
  private peer!: Peer
  private opened = false
  private attempts = 0
  private locked = false
  private recoveryDelayIndex = 0

  private readonly callbacks: HostCallbacks
  private readonly seatList: HostSeatInfo[]
  private readonly seatByPeer = new Map<string, number>()
  private readonly connBySeat = new Map<number, DataConnection>()
  private readonly lastSeen = new Map<number, number>()
  private readonly watchdog: ReturnType<typeof setInterval>
  private readonly fixedRoomCode: string | null
  private readonly recoveryDelays: number[]

  constructor(hostName: string, callbacks: HostCallbacks, opts?: HostPeerOptions) {
    this.callbacks = callbacks
    this.fixedRoomCode = opts?.roomCode ?? null
    this.recoveryDelays = this.fixedRoomCode ? reconnectDelays(HOST_RECOVERY_BUDGET_MS, HOST_RECOVERY_MAX_DELAY_MS) : []
    this.seatList = Array.from({ length: MAX_PLAYERS }, (_, seat) => ({
      seat,
      name: seat === 0 ? hostName : (opts?.seats?.[seat] ?? null),
      connected: seat === 0,
    }))
    this.watchdog = setInterval(() => this.checkStale(), PING_INTERVAL_MS)
    this.setupPeer(this.fixedRoomCode ?? generateRoomCode())
  }

  get roomCode(): string {
    return this._roomCode
  }

  get seats(): HostSeatInfo[] {
    return this.seatList.map((seat) => ({ ...seat }))
  }

  get joinsLocked(): boolean {
    return this.locked
  }

  sendTo(seat: number, message: HostToClient): void {
    const conn = this.connBySeat.get(seat)
    if (conn) this.sendConn(conn, message)
  }

  broadcast(messageFor: (seat: number) => HostToClient): void {
    for (const [seat, conn] of this.connBySeat) {
      if (conn.open) conn.send(messageFor(seat))
    }
  }

  close(): void {
    clearInterval(this.watchdog)
    this.peer.destroy()
  }

  lockJoins(): void {
    this.locked = true
  }

  unlockJoins(): void {
    this.locked = false
  }

  private setupPeer(code: string): void {
    this._roomCode = code
    this.peer = new Peer(code, peerOptions())
    this.peer.on('open', () => {
      this.opened = true
      this.callbacks.onOpen(this._roomCode)
    })
    this.peer.on('connection', (conn) => this.handleConnection(conn))
    this.peer.on('error', (err) => this.handleError(err))
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('data', (data) => this.handleData(conn, data))
    conn.on('close', () => this.handleClose(conn))
    conn.on('error', () => this.handleClose(conn))
  }

  private handleError(err: PeerError<`${PeerErrorType}`>): void {
    if (err.type === PeerErrorType.UnavailableID) {
      // Unable to rejoin as host - retry with backoff
      if (this.fixedRoomCode !== null) {
        if (!this.opened && this.recoveryDelayIndex < this.recoveryDelays.length) {
          const delay = this.recoveryDelays[this.recoveryDelayIndex]
          this.recoveryDelayIndex += 1
          const code = this.fixedRoomCode
          setTimeout(() => {
            this.peer.destroy()
            this.setupPeer(code)
          }, delay)
          return
        }
        this.callbacks.onError(`room code "${this._roomCode}" is still in use, could not resume the room`)
        return
      }
      // Room code taken - Retry creating room with different room code
      if (!this.opened && this.attempts < MAX_ROOM_CODE_ATTEMPTS) {
        this.attempts += 1
        this.peer.destroy()
        this.setupPeer(generateRoomCode())
        return
      }
      this.callbacks.onError(`room code "${this._roomCode}" is already taken, create a new room`)
      return
    }
    this.callbacks.onError(err.message)
  }

  private handleData(conn: DataConnection, data: unknown): void {
    if (!isClientMessage(data)) return
    if (data.type === 'join') {
      this.handleJoin(conn, data.name)
      return
    }
    const seat = this.seatByPeer.get(conn.peer)
    if (seat === undefined) return
    this.lastSeen.set(seat, Date.now())
    if (data.type === 'ping') {
      this.sendTo(seat, { type: 'pong' })
      return
    }
    this.callbacks.onAction(seat, data.action)
  }

  private handleClose(conn: DataConnection): void {
    const seat = this.seatByPeer.get(conn.peer)
    if (seat === undefined) return
    if (this.connBySeat.get(seat) !== conn) return
    this.connBySeat.delete(seat)
    this.seatByPeer.delete(conn.peer)
    conn.close()
    this.markOffline(seat)
  }

  private handleJoin(conn: DataConnection, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      this.sendConn(conn, { type: 'error', message: 'invalid player name' })
      return
    }
    if (this.locked) {
      const isReconnect = this.seatByPeer.has(conn.peer) || this.findReconnectSeat(trimmed) !== null
      if (!isReconnect) {
        this.sendConn(conn, { type: 'error', message: 'game already started' })
        conn.close()
        return
      }
    }
    const seat = this.seatByPeer.get(conn.peer) ?? this.findReconnectSeat(trimmed) ?? this.findEmptySeat()
    if (seat === null) {
      this.sendConn(conn, { type: 'error', message: 'room is full' })
      conn.close()
      return
    }
    this.seatList[seat] = { seat, name: trimmed, connected: true }
    this.seatByPeer.set(conn.peer, seat)
    this.connBySeat.set(seat, conn)
    this.lastSeen.set(seat, Date.now())
    this.callbacks.onSeatsChanged(this.seats)
    this.broadcastRoomInfo()
    if (this.locked) this.callbacks.onReconnect(seat)
  }

  private findReconnectSeat(name: string): number | null {
    for (const info of this.seatList) {
      if (info.seat !== 0 && info.name === name && !info.connected) return info.seat
    }
    return null
  }

  private findEmptySeat(): number | null {
    for (const info of this.seatList) {
      if (info.seat !== 0 && info.name === null) return info.seat
    }
    return null
  }

  private checkStale(): void {
    const now = Date.now()
    for (const seat of this.connBySeat.keys()) {
      if (isStale(now, this.lastSeen.get(seat), SEAT_TIMEOUT_MS)) this.markOffline(seat)
    }
  }

  private markOffline(seat: number): void {
    const info = this.seatList[seat]
    if (info) info.connected = false
    this.callbacks.onSeatsChanged(this.seats)
    this.broadcastRoomInfo()
  }

  private sendConn(conn: DataConnection, message: HostToClient): void {
    if (conn.open) conn.send(message)
  }

  private broadcastRoomInfo(): void {
    const names = this.seatList.map((seat) => seat.name)
    const connected = this.seatList.map((seat) => seat.connected)
    this.broadcast((seat) => ({ type: 'room-info', room: this.roomCode, seat, names, connected }))
  }
}

export class ClientPeer {
  private name: string
  private roomCode: string
  private conn: DataConnection | null = null
  private lastHostMessage: number | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private hostWatchdog: ReturnType<typeof setInterval> | null = null

  private readonly callbacks: ClientCallbacks
  private readonly peer: Peer

  constructor(name: string, roomcode: string, callbacks: ClientCallbacks) {
    this.name = name
    this.roomCode = roomcode
    this.callbacks = callbacks
    this.peer = new Peer(peerOptions())
    this.peer.on('open', (id) => {
      callbacks.onOpen(id)
      const conn = this.peer.connect(this.roomCode, { serialization: 'json', reliable: true })
      this.conn = conn
      this.handleConnection(conn)
    })
    this.peer.on('error', (err) => {
      const room = this.roomCode
      callbacks.onError(
        err.type === PeerErrorType.PeerUnavailable ? `room "${room ?? 'unknown'}" not found` : err.message,
      )
    })
  }

  get id(): string {
    return this.peer.id
  }

  send(message: ClientToHost): void {
    if (this.conn?.open) this.conn.send(message)
  }

  close(): void {
    this.stopPing()
    this.stopHostWatchdog()
    this.peer.destroy()
  }

  private handleConnection(conn: DataConnection): void {
    conn.on('open', () => {
      conn.send({ type: 'join', name: this.name })
      this.pingTimer = setInterval(() => {
        if (conn.open) conn.send({ type: 'ping' })
      }, PING_INTERVAL_MS)
      this.lastHostMessage = Date.now()
      this.stopHostWatchdog()
      this.hostWatchdog = setInterval(() => this.checkHostAlive(), PING_INTERVAL_MS)
    })
    conn.on('data', (data) => this.handleData(data))
    conn.on('close', () => this.handleConnClosed())
    conn.on('error', () => this.handleConnClosed())
  }

  private handleData(data: unknown): void {
    if (!isHostMessage(data)) return
    this.lastHostMessage = Date.now()
    switch (data.type) {
      case 'room-info':
        this.callbacks.onRoomInfo(data.room, data.seat, data.names, data.connected)
        break
      case 'snapshot':
        this.callbacks.onSnapshot(data.view)
        break
      case 'error':
        this.callbacks.onError(data.message)
        break
      case 'pong':
        break
    }
  }

  private handleConnClosed(): void {
    this.stopPing()
    this.stopHostWatchdog()
    const conn = this.conn
    conn?.close()
    this.conn = null
    this.callbacks.onDisconnect()
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private stopHostWatchdog(): void {
    if (this.hostWatchdog !== null) {
      clearInterval(this.hostWatchdog)
      this.hostWatchdog = null
    }
  }

  private checkHostAlive(): void {
    const last = this.lastHostMessage
    if (last === null) return
    if (isStale(Date.now(), last, SEAT_TIMEOUT_MS)) this.callbacks.onDisconnect()
  }
}
