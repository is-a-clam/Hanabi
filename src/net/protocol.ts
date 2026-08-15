import type { Action, View } from '../lib/types'

export type ClientToHost =
  | { type: 'join'; name: string }
  | { type: 'action'; action: Action }
  | { type: 'ping' }

export type HostToClient =
  | {
      type: 'room-info'
      room: string
      seat: number
      names: (string | null)[]
      connected: boolean[]
      turnOrder: number[] | null
    }
  | { type: 'snapshot'; view: View }
  | { type: 'error'; message: string }
  | { type: 'pong' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isAction(value: unknown): value is Action {
  if (!isRecord(value)) return false
  switch (value.type) {
    case 'play':
    case 'discard':
      return typeof value.cardId === 'number'
    case 'clue':
      return (
        typeof value.target === 'number' &&
        ((value.kind === 'color' && typeof value.value === 'string') ||
          (value.kind === 'number' && typeof value.value === 'number'))
      )
    default:
      return false
  }
}

export function isClientMessage(value: unknown): value is ClientToHost {
  if (!isRecord(value)) return false
  switch (value.type) {
    case 'join':
      return typeof value.name === 'string' && value.name.trim().length > 0
    case 'action':
      return isAction(value.action)
    case 'ping':
      return true
    default:
      return false
  }
}

export function isHostMessage(value: unknown): value is HostToClient {
  if (!isRecord(value)) return false
  switch (value.type) {
    case 'room-info':
      return (
        typeof value.room === 'string' &&
        typeof value.seat === 'number' &&
        Array.isArray(value.names) &&
        value.names.every((name) => name === null || typeof name === 'string') &&
        Array.isArray(value.connected) &&
        value.connected.every((connected) => typeof connected === 'boolean') &&
        value.connected.length === value.names.length &&
        (value.turnOrder === null ||
          (Array.isArray(value.turnOrder) && value.turnOrder.every((id) => typeof id === 'number')))
      )
    case 'snapshot':
      return isView(value.view)
    case 'error':
      return typeof value.message === 'string'
    case 'pong':
      return true
    default:
      return false
  }
}

function isOwnCard(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    (value.color === null || typeof value.color === 'string') &&
    (value.number === null || typeof value.number === 'number')
  )
}

function isView(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.me === 'number' &&
    Array.isArray(value.hand) &&
    Array.isArray(value.players) &&
    value.players.every(
      (player) =>
        isRecord(player) &&
        typeof player.id === 'number' &&
        typeof player.name === 'string' &&
        Array.isArray(player.hand) &&
        Array.isArray(player.marks) &&
        player.marks.every(isOwnCard),
    ) &&
    typeof value.clueTokens === 'number' &&
    typeof value.fuseTokens === 'number' &&
    typeof value.deckRemaining === 'number' &&
    typeof value.turnOf === 'number' &&
    typeof value.finalRound === 'boolean' &&
    (value.over === null || (isRecord(value.over) && typeof value.over.reason === 'string'))
  )
}
