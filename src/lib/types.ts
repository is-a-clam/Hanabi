export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'white'

export type CardId = number
export type PlayerId = number

export interface Card {
  id: CardId
  color: Color
  number: number
}

export interface PlayerState {
  id: PlayerId
  name: string
  hand: CardId[]
  known: Record<CardId, { color: Color | null; number: number | null }>
}

export type Fireworks = Record<Color, number>

export type Action =
  | { type: 'play'; cardId: CardId }
  | { type: 'discard'; cardId: CardId }
  | { type: 'clue'; target: PlayerId; kind: 'color'; value: Color }
  | { type: 'clue'; target: PlayerId; kind: 'number'; value: number }

export type GameEvent =
  | { type: 'play'; player: PlayerId; card: Card; success: boolean; fused: boolean }
  | { type: 'discard'; player: PlayerId; card: Card }
  | {
      type: 'clue'
      from: PlayerId
      to: PlayerId
      kind: 'color' | 'number'
      value: Color | number
      matchedCount: number
    }

export type GameOverReason = 'fuse' | 'deck' | 'perfect'

export interface GameOver {
  reason: GameOverReason
  score: number
}

export interface GameState {
  cards: Record<CardId, Card>
  players: PlayerState[]
  deck: Card[]
  discard: Card[]
  fireworks: Fireworks
  clueTokens: number
  fuseTokens: number
  turnOf: PlayerId
  finalRound: boolean
  finalTurnsRemaining: number
  over: GameOver | null
  log: GameEvent[]
}

export interface OwnCardView {
  id: CardId
  color: Color | null
  number: number | null
}

export interface OtherPlayerView {
  id: PlayerId
  name: string
  hand: Card[]
}

export interface View {
  me: PlayerId
  hand: OwnCardView[]
  players: OtherPlayerView[]
  fireworks: Fireworks
  discard: Card[]
  clueTokens: number
  fuseTokens: number
  deckRemaining: number
  turnOf: PlayerId
  finalRound: boolean
  finalTurnsRemaining: number
  over: GameOver | null
  log: GameEvent[]
}
