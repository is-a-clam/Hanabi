import { describe, expect, it } from 'vitest'
import { isAction, isClientMessage, isHostMessage } from './protocol'

describe('isAction', () => {
  it('accepts valid play and discard actions', () => {
    expect(isAction({ type: 'play', cardId: 3 })).toBe(true)
    expect(isAction({ type: 'discard', cardId: 7 })).toBe(true)
  })

  it('accepts valid clues', () => {
    expect(isAction({ type: 'clue', target: 2, kind: 'color', value: 'red' })).toBe(true)
    expect(isAction({ type: 'clue', target: 2, kind: 'number', value: 4 })).toBe(true)
  })

  it('rejects malformed actions', () => {
    expect(isAction(null)).toBe(false)
    expect(isAction({})).toBe(false)
    expect(isAction({ type: 'play' })).toBe(false)
    expect(isAction({ type: 'clue', target: 1, kind: 'color', value: 5 })).toBe(false)
    expect(isAction({ type: 'explode' })).toBe(false)
  })
})

describe('isClientMessage', () => {
  it('accepts join, action and ping messages', () => {
    expect(isClientMessage({ type: 'join', name: 'alice' })).toBe(true)
    expect(isClientMessage({ type: 'action', action: { type: 'play', cardId: 1 } })).toBe(true)
    expect(isClientMessage({ type: 'ping' })).toBe(true)
  })

  it('rejects malformed messages', () => {
    expect(isClientMessage(null)).toBe(false)
    expect(isClientMessage({ type: 'join', name: '  ' })).toBe(false)
    expect(isClientMessage({ type: 'join' })).toBe(false)
    expect(isClientMessage({ type: 'snapshot' })).toBe(false)
  })
})

describe('isHostMessage', () => {
  const view = {
    me: 0,
    hand: [],
    players: [
      {
        id: 1,
        name: 'alice',
        hand: [{ id: 7, color: 'red', number: 3 }],
        marks: [{ id: 7, color: null, number: 3 }],
      },
    ],
    fireworks: { red: 0, yellow: 0, green: 0, blue: 0, white: 0 },
    discard: [],
    clueTokens: 8,
    fuseTokens: 3,
    deckRemaining: 40,
    turnOf: 0,
    finalRound: false,
    over: null,
    log: [],
  }

  it('accepts room-info, snapshot, error and pong messages', () => {
    expect(isHostMessage({ type: 'room-info', room: 'ABC12', seat: 1, names: ['alice', null], connected: [true, false] })).toBe(true)
    expect(isHostMessage({ type: 'snapshot', view })).toBe(true)
    expect(isHostMessage({ type: 'error', message: 'nope' })).toBe(true)
    expect(isHostMessage({ type: 'pong' })).toBe(true)
  })

  it('rejects room-info with missing or mismatched connected', () => {
    expect(isHostMessage({ type: 'room-info', room: 'ABC12', seat: 1, names: ['alice', null] })).toBe(false)
    expect(isHostMessage({ type: 'room-info', room: 'ABC12', seat: 1, names: ['alice'], connected: [true, false] })).toBe(false)
    expect(isHostMessage({ type: 'room-info', room: 'ABC12', seat: 1, names: ['alice'], connected: ['yes'] })).toBe(false)
  })

  it('rejects a snapshot whose players lack marks', () => {
    expect(
      isHostMessage({
        type: 'snapshot',
        view: { ...view, players: [{ ...view.players[0], marks: undefined }] },
      }),
    ).toBe(false)
    expect(
      isHostMessage({
        type: 'snapshot',
        view: { ...view, players: [{ ...view.players[0], marks: [{ id: 7 }] }] },
      }),
    ).toBe(false)
  })

  it('rejects malformed messages', () => {
    expect(isHostMessage(null)).toBe(false)
    expect(isHostMessage({ type: 'room-info' })).toBe(false)
    expect(isHostMessage({ type: 'error' })).toBe(false)
    expect(isHostMessage({ type: 'action', action: { type: 'play', cardId: 1 } })).toBe(false)
  })
})
