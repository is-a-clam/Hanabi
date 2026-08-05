import { COLORS, buildDeck, shuffle } from './cards'
import type {
  Action,
  Card,
  CardId,
  GameState,
  PlayerId,
  PlayerState,
  View,
} from './types'

export const MAX_CLUE_TOKENS = 8
export const MAX_FUSE_TOKENS = 3
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5

export function handSizeFor(numPlayers: number): number {
  return numPlayers <= 3 ? 5 : 4
}

export interface CreateGameOptions {
  rng?: () => number
  deck?: Card[]
}

export function createGame(names: string[], opts: CreateGameOptions = {}): GameState {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    throw new Error(`Hanabi requires ${MIN_PLAYERS}-${MAX_PLAYERS} players`)
  }
  const deck = opts.deck ?? shuffle(buildDeck(), opts.rng ?? Math.random)
  const cards: GameState['cards'] = {}
  for (const card of deck) {
    cards[card.id] = card
  }

  const handSize = handSizeFor(names.length)
  const players: PlayerState[] = names.map((name, id) => ({
    id,
    name,
    hand: [],
    known: {},
  }))

  const drawPile = [...deck]
  for (let round = 0; round < handSize; round++) {
    for (const player of players) {
      const card = drawPile.pop()
      if (!card) throw new Error('deck ran out while dealing')
      player.hand.push(card.id)
    }
  }

  return {
    cards,
    players,
    deck: drawPile,
    discard: [],
    fireworks: { red: 0, yellow: 0, green: 0, blue: 0, white: 0 },
    clueTokens: MAX_CLUE_TOKENS,
    fuseTokens: MAX_FUSE_TOKENS,
    turnOf: 0,
    finalRound: false,
    finalTurnsRemaining: 0,
    over: null,
    log: [],
  }
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.over) throw new Error('game is over')
  const s = structuredClone(state)
  const actor = s.players[s.turnOf]

  switch (action.type) {
    case 'play':
      return resolvePlay(s, actor, action.cardId)
    case 'discard':
      return resolveDiscard(s, actor, action.cardId)
    case 'clue':
      return resolveClue(s, actor, action)
  }
}

function resolvePlay(s: GameState, actor: PlayerState, cardId: CardId): GameState {
  const idx = indexOfCard(actor, cardId)
  const card = s.cards[cardId]
  const firework = s.fireworks[card.color]
  const success = card.number === firework + 1

  actor.hand.splice(idx, 1)
  delete actor.known[cardId]

  let fused = false
  if (success) {
    s.fireworks[card.color] = firework + 1
    if (card.number === 5 && s.clueTokens < MAX_CLUE_TOKENS) {
      s.clueTokens += 1
    }
  } else {
    s.discard.push(card)
    s.fuseTokens -= 1
    fused = true
  }
  s.log.push({ type: 'play', player: actor.id, card, success, fused })

  if (s.fuseTokens === 0) {
    s.over = { reason: 'fuse', score: getScore(s) }
    return s
  }
  drawCard(s)
  finishTurn(s)
  return s
}

function resolveDiscard(s: GameState, actor: PlayerState, cardId: CardId): GameState {
  if (s.clueTokens >= MAX_CLUE_TOKENS) {
    throw new Error('cannot discard while at maximum clue tokens')
  }
  const idx = indexOfCard(actor, cardId)
  const card = s.cards[cardId]
  actor.hand.splice(idx, 1)
  delete actor.known[cardId]
  s.discard.push(card)
  s.clueTokens = Math.min(MAX_CLUE_TOKENS, s.clueTokens + 1)
  s.log.push({ type: 'discard', player: actor.id, card })
  drawCard(s)
  finishTurn(s)
  return s
}

function resolveClue(s: GameState, actor: PlayerState, action: Extract<Action, { type: 'clue' }>): GameState {
  if (s.clueTokens <= 0) throw new Error('no clue tokens available')
  if (action.target === actor.id) throw new Error('you cannot give a clue to yourself')
  const target = s.players[action.target]
  if (!target) throw new Error('invalid clue target')
  if (action.kind === 'color' && !COLORS.includes(action.value)) {
    throw new Error('invalid color clue')
  }
  if (action.kind === 'number' && (action.value < 1 || action.value > 5)) {
    throw new Error('invalid number clue')
  }

  let matchedCount = 0
  for (const cardId of target.hand) {
    const card = s.cards[cardId]
    const matches = action.kind === 'color' ? card.color === action.value : card.number === action.value
    if (!matches) continue
    matchedCount++
    const current = target.known[cardId] ?? { color: null, number: null }
    target.known[cardId] =
      action.kind === 'color'
        ? { color: action.value, number: current.number }
        : { color: current.color, number: action.value }
  }
  if (matchedCount === 0) throw new Error('clue matches no cards in the target hand')

  s.clueTokens -= 1
  s.log.push({
    type: 'clue',
    from: actor.id,
    to: target.id,
    kind: action.kind,
    value: action.value,
    matchedCount,
  })
  finishTurn(s)
  return s
}

function drawCard(s: GameState): void {
  if (s.deck.length > 0) {
    const card = s.deck.pop()
    if (card) s.players[s.turnOf].hand.push(card.id)
    if (s.deck.length === 0 && !s.finalRound) {
      s.finalRound = true
      // +1 because the turn that drew the last card is counted too; everyone (including that player) gets one more turn before the game ends.
      s.finalTurnsRemaining = s.players.length + 1
    }
  }
}

function finishTurn(s: GameState): void {
  s.turnOf = (s.turnOf + 1) % s.players.length

  if (allFireworksComplete(s)) {
    s.over = { reason: 'perfect', score: 25 }
    return
  }
  if (s.finalRound) {
    s.finalTurnsRemaining -= 1
    if (s.finalTurnsRemaining <= 0) {
      s.over = { reason: 'deck', score: getScore(s) }
    }
  }
}

function indexOfCard(player: PlayerState, cardId: CardId): number {
  const idx = player.hand.indexOf(cardId)
  if (idx === -1) throw new Error('card is not in the player hand')
  return idx
}

function allFireworksComplete(s: GameState): boolean {
  return COLORS.every((color) => s.fireworks[color] === 5)
}

export function getScore(state: GameState): number {
  return COLORS.reduce((sum, color) => sum + state.fireworks[color], 0)
}

export function viewForPlayer(state: GameState, me: PlayerId): View {
  const mePlayer = state.players[me]
  if (!mePlayer) throw new Error('invalid player id')

  return {
    me,
    hand: mePlayer.hand.map((cardId) => {
      const known = mePlayer.known[cardId]
      return {
        id: cardId,
        color: known?.color ?? null,
        number: known?.number ?? null,
      }
    }),
    players: state.players
      .filter((p) => p.id !== me)
      .map((p) => ({
        id: p.id,
        name: p.name,
        hand: p.hand.map((cardId) => ({ ...state.cards[cardId] })),
      })),
    fireworks: { ...state.fireworks },
    discard: state.discard.map((card) => ({ ...card })),
    clueTokens: state.clueTokens,
    fuseTokens: state.fuseTokens,
    deckRemaining: state.deck.length,
    turnOf: state.turnOf,
    finalRound: state.finalRound,
    finalTurnsRemaining: state.finalTurnsRemaining,
    over: state.over ? { ...state.over } : null,
    log: [...state.log],
  }
}
