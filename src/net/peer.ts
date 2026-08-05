import Peer, { PeerErrorType, type DataConnection, type PeerError } from 'peerjs'
import { peerOptions } from '../lib/config'
import { MAX_PLAYERS } from '../lib/game'
import type { Action, View } from '../lib/types'
import type { ClientToHost, HostToClient } from './protocol'
import { isClientMessage, isHostMessage } from './protocol'
import { generateRoomCode } from './room'

export const MAX_ROOM_CODE_ATTEMPTS = 5
export const PING_INTERVAL_MS = 2000
export const SEAT_TIMEOUT_MS = 8000

export function isStale(now: number, lastSeen: number | undefined, timeoutMs: number): boolean {
  return lastSeen === undefined || now - lastSeen >= timeoutMs
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
  onError(message: string): void
}

export interface ClientCallbacks {
  onOpen(id: string): void
  onRoomInfo(room: string, seat: number, names: (string | null)[], connected: boolean[]): void
  onSnapshot(view: View): void
  onError(message: string): void
  onClosed(): void
}

export class HostPeer {
  private _roomCode!: string
  private readonly callbacks: HostCallbacks
  private readonly seatList: HostSeatInfo[]
  private readonly seatByPeer = new Map<string, number>()
  private readonly connBySeat = new Map<number, DataConnection>()
  private readonly lastSeen = new Map<number, number>()
  private readonly watchdog: ReturnType<typeof setInterval>
  private peer!: Peer
  private opened = false
  private attempts = 0
  private joinsLocked = false

  constructor(hostName: string, callbacks: HostCallbacks) {
    this.callbacks = callbacks
    this.seatList = Array.from({ length: MAX_PLAYERS }, (_, seat) => ({
      seat,
      name: seat === 0 ? hostName : null,
      connected: seat === 0,
    }))
    this.watchdog = setInterval(() => this.checkStale(), PING_INTERVAL_MS)
    this.setupPeer(generateRoomCode())
  }

  get roomCode(): string {
    return this._roomCode
  }

  get seats(): HostSeatInfo[] {
    return this.seatList.map((seat) => ({ ...seat }))
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
    this.joinsLocked = true
  }

  unlockJoins(): void {
    this.joinsLocked = false
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

  private handleError(err: PeerError<`${PeerErrorType}`>): void {
    if (err.type === PeerErrorType.UnavailableID) {
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

  private handleConnection(conn: DataConnection): void {
    conn.on('data', (data) => this.handleData(conn, data))
    conn.on('close', () => this.handleClose(conn))
    conn.on('error', () => this.handleClose(conn))
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

  private handleJoin(conn: DataConnection, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) {
      this.sendConn(conn, { type: 'error', message: 'invalid player name' })
      return
    }
    if (this.joinsLocked) {
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
    this.broadcastRoomInfo()
    this.callbacks.onSeatsChanged(this.seats)
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

  private handleClose(conn: DataConnection): void {
    const seat = this.seatByPeer.get(conn.peer)
    if (seat === undefined) return
    if (this.connBySeat.get(seat) !== conn) return
    this.markOffline(seat)
  }

  private checkStale(): void {
    const now = Date.now()
    for (const seat of this.connBySeat.keys()) {
      if (isStale(now, this.lastSeen.get(seat), SEAT_TIMEOUT_MS)) this.markOffline(seat)
    }
  }

  private markOffline(seat: number): void {
    const conn = this.connBySeat.get(seat)
    if (conn) {
      this.connBySeat.delete(seat)
      this.seatByPeer.delete(conn.peer)
      conn.close()
    }
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
  private readonly callbacks: ClientCallbacks
  private readonly peer: Peer
  private name: string
  private conn: DataConnection | null = null
  private connWasOpen = false
  private closed = false
  private onClosedFired = false
  private pendingRoomCode: string | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private hostWatchdog: ReturnType<typeof setInterval> | null = null
  private lastHostMessage: number | null = null

  constructor(name: string, callbacks: ClientCallbacks) {
    this.name = name
    this.callbacks = callbacks
    this.peer = new Peer(peerOptions())
    this.peer.on('open', (id) => {
      callbacks.onOpen(id)
      this.connectPending()
    })
    this.peer.on('error', (err) => {
      const room = this.pendingRoomCode
      callbacks.onError(
        err.type === PeerErrorType.PeerUnavailable ? `room "${room ?? 'unknown'}" not found` : err.message,
      )
    })
  }

  get id(): string {
    return this.peer.id
  }

  get usable(): boolean {
    return !this.closed && !this.peer.destroyed && this.peer.open
  }

  join(roomCode: string, name?: string): void {
    if (name) this.name = name
    this.pendingRoomCode = roomCode
    this.onClosedFired = false
    this.resetConn()
    this.connectPending()
  }

  send(message: ClientToHost): void {
    if (this.conn?.open) this.conn.send(message)
  }

  close(): void {
    this.closed = true
    this.stopPing()
    this.stopHostWatchdog()
    this.peer.destroy()
  }

  private connectPending(): void {
    const roomCode = this.pendingRoomCode
    if (!roomCode || this.closed || !this.peer.open) return
    this.resetConn()
    const conn = this.peer.connect(roomCode, { serialization: 'json', reliable: true })
    this.conn = conn
    conn.on('open', () => {
      if (this.conn !== conn) return
      this.connWasOpen = true
      conn.send({ type: 'join', name: this.name })
      this.stopPing()
      this.pingTimer = setInterval(() => {
        if (this.conn === conn && conn.open) conn.send({ type: 'ping' })
      }, PING_INTERVAL_MS)
      this.lastHostMessage = Date.now()
      this.stopHostWatchdog()
      this.hostWatchdog = setInterval(() => this.checkHostAlive(), PING_INTERVAL_MS)
    })
    conn.on('data', (data) => {
      if (this.conn === conn) this.handleData(data)
    })
    conn.on('close', () => this.handleConnClosed(conn))
    conn.on('error', () => this.handleConnClosed(conn))
  }

  private resetConn(): void {
    const old = this.conn
    this.conn = null
    this.connWasOpen = false
    this.stopPing()
    this.stopHostWatchdog()
    this.lastHostMessage = null
    old?.close()
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
    if (isStale(Date.now(), last, SEAT_TIMEOUT_MS)) this.fireClosed()
  }

  private fireClosed(): void {
    if (this.closed || this.onClosedFired) return
    const wasOpen = this.connWasOpen
    this.connWasOpen = false
    this.stopPing()
    this.stopHostWatchdog()
    const conn = this.conn
    this.conn = null
    conn?.close()
    if (wasOpen) {
      this.onClosedFired = true
      this.callbacks.onClosed()
    }
  }

  private handleConnClosed(conn: DataConnection): void {
    if (this.conn !== conn) return
    this.fireClosed()
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
}
