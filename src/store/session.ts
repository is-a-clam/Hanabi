import type { GameState } from '../lib/types'

export interface HostSession {
  roomCode: string
  name: string
  seats: (string | null)[]
  game: GameState | null
}

export interface ClientSession {
  roomCode: string
  name: string
}

export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const HOST_KEY = 'hanabi.host.session'
const CLIENT_KEY = 'hanabi.client.session'

const sessionBackend: StorageBackend = {
  getItem(key) {
    if (typeof sessionStorage === 'undefined') return null
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    if (typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.setItem(key, value)
    } catch {
      // storage full or blocked — ignore
    }
  },
  removeItem(key) {
    if (typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.removeItem(key)
    } catch {
      // storage unavailable — ignore
    }
  },
}

export let storageBackend: StorageBackend = sessionBackend

export function setStorageBackend(backend: StorageBackend): void {
  storageBackend = backend
}

function readJSON<T>(key: string): T | null {
  const raw = storageBackend.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJSON(key: string, value: unknown): void {
  storageBackend.setItem(key, JSON.stringify(value))
}

export function saveHostSession(session: HostSession): void {
  writeJSON(HOST_KEY, session)
}

export function loadHostSession(): HostSession | null {
  const session = readJSON<HostSession>(HOST_KEY)
  if (!session || typeof session.roomCode !== 'string' || typeof session.name !== 'string' || !Array.isArray(session.seats)) {
    return null
  }
  return { ...session, game: session.game ?? null }
}

export function clearHostSession(): void {
  storageBackend.removeItem(HOST_KEY)
}

export function saveClientSession(session: ClientSession): void {
  writeJSON(CLIENT_KEY, session)
}

export function loadClientSession(): ClientSession | null {
  const session = readJSON<ClientSession>(CLIENT_KEY)
  if (!session || typeof session.roomCode !== 'string' || typeof session.name !== 'string') return null
  return session
}

export function clearClientSession(): void {
  storageBackend.removeItem(CLIENT_KEY)
}
