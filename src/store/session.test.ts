import { describe, expect, it } from 'vitest'
import type { StorageBackend } from './session'
import {
  clearClientSession,
  clearHostSession,
  loadClientSession,
  loadHostSession,
  saveClientSession,
  saveHostSession,
  setStorageBackend,
} from './session'

function mockBackend(): StorageBackend {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

describe('session persistence', () => {
  it('round-trips a host session', () => {
    setStorageBackend(mockBackend())
    saveHostSession({
      roomCode: 'ABC23',
      name: 'Host',
      seats: ['Host', 'Alice', null, null, null],
      game: null,
    })
    const loaded = loadHostSession()
    expect(loaded).not.toBeNull()
    expect(loaded?.roomCode).toBe('ABC23')
    expect(loaded?.name).toBe('Host')
    expect(loaded?.seats).toEqual(['Host', 'Alice', null, null, null])
    expect(loaded?.game).toBeNull()
  })

  it('round-trips a client session', () => {
    setStorageBackend(mockBackend())
    saveClientSession({ roomCode: 'XYZ12', name: 'Bob' })
    expect(loadClientSession()).toEqual({ roomCode: 'XYZ12', name: 'Bob' })
  })

  it('returns null when nothing is stored', () => {
    setStorageBackend(mockBackend())
    expect(loadHostSession()).toBeNull()
    expect(loadClientSession()).toBeNull()
  })

  it('clears each session independently', () => {
    setStorageBackend(mockBackend())
    saveHostSession({ roomCode: 'ABC23', name: 'Host', seats: [], game: null })
    saveClientSession({ roomCode: 'XYZ12', name: 'Bob' })
    clearHostSession()
    expect(loadHostSession()).toBeNull()
    expect(loadClientSession()).toEqual({ roomCode: 'XYZ12', name: 'Bob' })
    clearClientSession()
    expect(loadClientSession()).toBeNull()
  })

  it('rejects a corrupted or malformed session', () => {
    const backend = mockBackend()
    setStorageBackend(backend)
    backend.setItem('hanabi.host.session', 'not-json{')
    backend.setItem('hanabi.client.session', JSON.stringify({ roomCode: 42 }))
    expect(loadHostSession()).toBeNull()
    expect(loadClientSession()).toBeNull()
  })
})
