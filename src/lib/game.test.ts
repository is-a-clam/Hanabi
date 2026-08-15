import { describe, expect, it } from 'vitest'
import { COLORS, NUMBER_COUNTS, buildDeck, shuffle } from './cards'
import {
  MAX_CLUE_TOKENS,
  MAX_FUSE_TOKENS,
  applyAction,
  createGame,
  describeCard,
  getScore,
  handSizeFor,
  playerName,
  turnNumberFor,
  viewForPlayer,
} from './game'
import type { Card, Color, Fireworks, GameState } from './types'

let seq = 0
function c(color: Color, number: number): Card {
  return { id: seq++, color, number }
}

function makeGame(
  hands: Card[][],
  opts: {
    deck?: Card[]
    fireworks?: Fireworks
    clueTokens?: number
    fuseTokens?: number
    turnOf?: number
    turnOrder?: number[]
  } = {},
): GameState {
  const allCards = [...hands.flat(), ...(opts.deck ?? [])]
  const cards: Record<number, Card> = {}
  for (const card of allCards) {
    cards[card.id] = card
  }
  const players = hands.map((hand, id) => ({
    id,
    name: `p${id}`,
    hand: hand.map((card) => card.id),
    known: {},
  }))
  return {
    cards,
    players,
    deck: (opts.deck ?? []).map((card) => ({ ...card })),
    discard: [],
    fireworks: opts.fireworks ?? { red: 0, yellow: 0, green: 0, blue: 0, white: 0 },
    clueTokens: opts.clueTokens ?? MAX_CLUE_TOKENS,
    fuseTokens: opts.fuseTokens ?? MAX_FUSE_TOKENS,
    turnOf: opts.turnOf ?? 0,
    turnOrder: opts.turnOrder ?? Array.from({ length: hands.length }, (_, i) => i),
    finalRound: false,
    finalTurnsRemaining: 0,
    over: null,
    log: [],
  }
}

describe('cards', () => {
  it('builds a standard 50-card deck', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(50)
    const ids = new Set(deck.map((card) => card.id))
    expect(ids.size).toBe(50)
    for (const color of COLORS) {
      for (const [number, count] of Object.entries(NUMBER_COUNTS)) {
        expect(deck.filter((card) => card.color === color && card.number === Number(number))).toHaveLength(
          count,
        )
      }
    }
  })

  it('shuffles deterministically with a fixed rng', () => {
    const deck = buildDeck()
    const a = shuffle(deck, () => 0.5)
    const b = shuffle(deck, () => 0.5)
    expect(a).toEqual(b)
    expect(a).not.toEqual(deck)
    expect([...a].sort((x, y) => x.id - y.id).map((card) => card.id)).toEqual(
      [...deck].sort((x, y) => x.id - y.id).map((card) => card.id),
    )
  })
})

describe('createGame', () => {
  it('rejects invalid player counts', () => {
    expect(() => createGame(['a'])).toThrow()
    expect(() => createGame(['a', 'b', 'c', 'd', 'e', 'f'])).toThrow()
  })

  it('deals 5 cards each for 2-3 players', () => {
    for (const n of [2, 3]) {
      const state = createGame(Array.from({ length: n }, (_, i) => `p${i}`))
      expect(state.players.every((p) => p.hand.length === 5)).toBe(true)
      expect(state.deck).toHaveLength(50 - n * 5)
    }
  })

  it('deals 4 cards each for 4-5 players', () => {
    for (const n of [4, 5]) {
      const state = createGame(Array.from({ length: n }, (_, i) => `p${i}`))
      expect(state.players.every((p) => p.hand.length === 4)).toBe(true)
      expect(state.deck).toHaveLength(50 - n * 4)
    }
  })

  it('is deterministic with a fixed rng', () => {
    const a = createGame(['p0', 'p1', 'p2'], { rng: () => 0.5 })
    const b = createGame(['p0', 'p1', 'p2'], { rng: () => 0.5 })
    expect(a).toEqual(b)
  })

  it('starts with full clue tokens, fuse tokens and a valid random turn order', () => {
    const state = createGame(['a', 'b'])
    expect(state.clueTokens).toBe(MAX_CLUE_TOKENS)
    expect(state.fuseTokens).toBe(MAX_FUSE_TOKENS)
    expect([...state.turnOrder].sort()).toEqual([0, 1])
    expect(state.turnOf).toBe(state.turnOrder[0])
    expect(state.over).toBeNull()
    expect(handSizeFor(2)).toBe(5)
  })

  it('honours an explicit turn order', () => {
    const state = createGame(['a', 'b', 'c'], { turnOrder: [2, 0, 1] })
    expect(state.turnOrder).toEqual([2, 0, 1])
    expect(state.turnOf).toBe(2)
  })

  it('randomises a permutation of all seat ids', () => {
    for (const n of [2, 3, 4, 5]) {
      const state = createGame(Array.from({ length: n }, (_, i) => `p${i}`), { rng: () => 0.7 })
      expect(state.turnOrder).toHaveLength(n)
      expect([...state.turnOrder].sort()).toEqual(Array.from({ length: n }, (_, i) => i))
    }
  })
})

describe('clues', () => {
  it('marks every matching card and costs a clue', () => {
    const p1r1 = c('red', 1)
    const p1r2 = c('red', 2)
    const p1g1 = c('green', 1)
    const state = makeGame([[c('red', 1), c('red', 2), c('green', 1)], [p1r1, p1r2, p1g1]])
    const next = applyAction(state, { type: 'clue', target: 1, kind: 'color', value: 'red' })
    expect(next.clueTokens).toBe(7)
    expect(next.players[1].known[p1r1.id].color).toBe('red')
    expect(next.players[1].known[p1r2.id].color).toBe('red')
    expect(next.players[1].known[p1g1.id]).toBeUndefined()
    expect(next.log).toHaveLength(1)
    expect(next.log[0]).toMatchObject({ type: 'clue', from: 0, to: 1, kind: 'color', matchedCount: 2 })
  })

  it('marks cards by number', () => {
    const p1a = c('red', 2)
    const p1b = c('green', 2)
    const state = makeGame([[c('red', 2), c('green', 2), c('blue', 1)], [p1a, p1b]])
    const next = applyAction(state, { type: 'clue', target: 1, kind: 'number', value: 2 })
    expect(next.players[1].known[p1a.id].number).toBe(2)
    expect(next.players[1].known[p1b.id].number).toBe(2)
  })

  it('rejects self-clue, empty matches and zero tokens', () => {
    const state = makeGame([[c('red', 1), c('green', 2)], [c('red', 1), c('green', 3)]])
    expect(() => applyAction(state, { type: 'clue', target: 0, kind: 'color', value: 'red' })).toThrow()
    expect(() =>
      applyAction(state, { type: 'clue', target: 1, kind: 'number', value: 5 }),
    ).toThrow()
    const broke = makeGame([[c('red', 1), c('green', 2)], [c('red', 1), c('green', 3)]], { clueTokens: 0 })
    expect(() =>
      applyAction(broke, { type: 'clue', target: 1, kind: 'color', value: 'red' }),
    ).toThrow()
  })

  it('does not draw a card when a clue is given', () => {
    const state = makeGame([[c('red', 1), c('red', 2), c('green', 1)], [c('red', 1), c('green', 2)]], {
      deck: [c('blue', 1)],
    })
    const before = state.players[0].hand.length
    const next = applyAction(state, { type: 'clue', target: 1, kind: 'color', value: 'red' })
    expect(next.players[0].hand).toHaveLength(before)
    expect(next.deck).toHaveLength(1)
    expect(next.turnOf).toBe(1)
  })

  it('decrements the final round on a clue without drawing', () => {
    const g1 = c('green', 1)
    const r2 = c('red', 2)
    const b1 = c('blue', 1)
    const state = makeGame(
      [
        [r2, b1],
        [g1],
      ],
      { deck: [c('blue', 2)], clueTokens: 7 },
    )
    const afterDiscard = applyAction(state, { type: 'discard', cardId: r2.id })
    expect(afterDiscard.finalRound).toBe(true)
    expect(afterDiscard.finalTurnsRemaining).toBe(2)

    const afterClue = applyAction(afterDiscard, { type: 'clue', target: 0, kind: 'number', value: 2 })
    expect(afterClue.turnOf).toBe(0)
    expect(afterClue.finalTurnsRemaining).toBe(1)
    expect(afterClue.over).toBeNull()

    const afterPlay = applyAction(afterClue, { type: 'play', cardId: b1.id })
    expect(afterPlay.over).toEqual({ reason: 'deck', score: 1 })
  })
})

describe('play', () => {
  it('advances the firework on success', () => {
    const r1 = c('red', 1)
    const r2 = c('red', 2)
    const state = makeGame([[r1, r2], [c('green', 1)]])
    const next = applyAction(state, { type: 'play', cardId: r1.id })
    expect(next.fireworks.red).toBe(1)
    expect(next.players[0].hand).toHaveLength(1)
    expect(next.log[0]).toMatchObject({ type: 'play', success: true, fused: false })
  })

  it('refunds a clue when a 5 completes a firework', () => {
    const r5 = c('red', 5)
    const state = makeGame([[r5, c('blue', 1)], [c('green', 1)]], {
      clueTokens: 7,
      fireworks: { red: 4, yellow: 0, green: 0, blue: 0, white: 0 },
    })
    const next = applyAction(state, { type: 'play', cardId: r5.id })
    expect(next.fireworks.red).toBe(5)
    expect(next.clueTokens).toBe(8)
  })

  it('does not exceed the max clue tokens', () => {
    const r5 = c('red', 5)
    const state = makeGame([[r5, c('blue', 1)], [c('green', 1)]], {
      fireworks: { red: 4, yellow: 0, green: 0, blue: 0, white: 0 },
    })
    const next = applyAction(state, { type: 'play', cardId: r5.id })
    expect(next.clueTokens).toBe(8)
  })

  it('discards and loses a fuse on a wrong card', () => {
    const r2 = c('red', 2)
    const state = makeGame([[r2, c('blue', 1)], [c('green', 1)]])
    const next = applyAction(state, { type: 'play', cardId: r2.id })
    expect(next.fireworks.red).toBe(0)
    expect(next.fuseTokens).toBe(2)
    expect(next.discard).toContainEqual(expect.objectContaining({ id: r2.id }))
    expect(next.log[0]).toMatchObject({ type: 'play', success: false, fused: true })
  })

  it('ends the game on the third fuse', () => {
    const a = c('red', 3)
    const b = c('red', 2)
    const state = makeGame([[a, b], [c('green', 1), c('green', 2)]], { fuseTokens: 1 })
    const next = applyAction(state, { type: 'play', cardId: a.id })
    expect(next.over).toEqual({ reason: 'fuse', score: 0 })
    expect(next.players[0].hand).toHaveLength(1)
  })

  it('does not draw after a game-ending fuse', () => {
    const a = c('red', 3)
    const state = makeGame([[a, c('blue', 1)], [c('green', 1)]], { fuseTokens: 1 })
    const next = applyAction(state, { type: 'play', cardId: a.id })
    expect(next.players[0].hand).toHaveLength(1)
  })

  it('rejects playing a card not in hand', () => {
    const state = makeGame([[c('red', 1)], [c('green', 1)]])
    expect(() => applyAction(state, { type: 'play', cardId: 999 })).toThrow()
  })
})

describe('discard', () => {
  it('is illegal at maximum clue tokens', () => {
    const a = c('red', 1)
    const state = makeGame([[a, c('blue', 2)], [c('green', 1)]])
    expect(() => applyAction(state, { type: 'discard', cardId: a.id })).toThrow()
  })

  it('reveals the card and adds a clue token', () => {
    const a = c('red', 1)
    const state = makeGame([[a, c('blue', 2)], [c('green', 1)]], { clueTokens: 7 })
    const next = applyAction(state, { type: 'discard', cardId: a.id })
    expect(next.clueTokens).toBe(8)
    expect(next.discard).toContainEqual(expect.objectContaining({ id: a.id, color: 'red', number: 1 }))
    expect(next.log[0]).toMatchObject({ type: 'discard', player: 0 })
  })
})

describe('turn rotation and endgame', () => {
  it('rotates turns after each action', () => {
    const r1 = c('red', 1)
    const state = makeGame([[r1], [c('green', 1)]])
    const next = applyAction(state, { type: 'play', cardId: r1.id })
    expect(next.turnOf).toBe(1)
  })

  it('rotates turns following the turn order', () => {
    const r1 = c('red', 1)
    const state = makeGame([[c('blue', 1)], [r1], [c('green', 1)]], { turnOrder: [1, 0, 2], turnOf: 1 })
    const first = applyAction(state, { type: 'play', cardId: r1.id })
    expect(first.turnOf).toBe(0)
    const second = applyAction(first, { type: 'clue', target: 2, kind: 'number', value: 1 })
    expect(second.turnOf).toBe(2)
    const third = applyAction(second, { type: 'clue', target: 0, kind: 'number', value: 1 })
    expect(third.turnOf).toBe(1)
  })

  it('plays a final round after the deck runs out', () => {
    const r1 = c('red', 1)
    const r2 = c('red', 2)
    const g1 = c('green', 1)
    const g2 = c('green', 2)
    const b1 = c('blue', 1)
    const state = makeGame(
      [
        [r1, r2],
        [g1, g2],
      ],
      { deck: [b1], clueTokens: 7 },
    )

    let next = applyAction(state, { type: 'discard', cardId: r1.id })
    expect(next.deck).toHaveLength(0)
    expect(next.finalRound).toBe(true)
    expect(next.finalTurnsRemaining).toBe(2)
    expect(next.over).toBeNull()
    expect(next.turnOf).toBe(1)

    next = applyAction(next, { type: 'play', cardId: g1.id })
    expect(next.finalTurnsRemaining).toBe(1)
    expect(next.over).toBeNull()
    expect(next.turnOf).toBe(0)

    next = applyAction(next, { type: 'play', cardId: r2.id })
    expect(next.over).toEqual({ reason: 'deck', score: 1 })
  })

  it('ends immediately on a perfect game', () => {
    const r5 = c('red', 5)
    const state = makeGame([[r5, c('blue', 1)], [c('green', 1), c('green', 2)]], {
      clueTokens: 7,
      fireworks: { red: 4, yellow: 5, green: 5, blue: 5, white: 5 },
    })
    const next = applyAction(state, { type: 'play', cardId: r5.id })
    expect(next.fireworks.red).toBe(5)
    expect(next.over).toEqual({ reason: 'perfect', score: 25 })
  })

  it('computes the score from the fireworks', () => {
    const state = makeGame([[c('red', 1)], [c('green', 1)]], {
      fireworks: { red: 3, yellow: 0, green: 2, blue: 1, white: 5 },
    })
    expect(getScore(state)).toBe(11)
  })
})

describe('viewForPlayer', () => {
  it('hides your own cards but shows opponents hands', () => {
    const myR = c('red', 1)
    const myB = c('blue', 2)
    const theirG = c('green', 3)
    const state = makeGame([[myR, myB], [theirG]])
    const view = viewForPlayer(state, 0)

    expect(view.hand).toHaveLength(2)
    expect(view.hand.every((card) => card.color === null && card.number === null)).toBe(true)
    expect(view.players).toHaveLength(1)
    expect(view.players[0].hand).toContainEqual(expect.objectContaining({ id: theirG.id, color: 'green', number: 3 }))
  })

  it('exposes clue knowledge for your own hand', () => {
    const myR = c('red', 1)
    const myB = c('blue', 2)
    const state = makeGame([[myR, myB], [c('green', 1)]], { turnOf: 1 })
    const clued = applyAction(state, { type: 'clue', target: 0, kind: 'color', value: 'red' })
    const view = viewForPlayer(clued, 0)
    const ownRed = view.hand.find((card) => card.id === myR.id)
    const ownBlue = view.hand.find((card) => card.id === myB.id)
    expect(ownRed?.color).toBe('red')
    expect(ownRed?.number).toBeNull()
    expect(ownBlue?.color).toBeNull()
  })

  it('exposes what other players know as marks', () => {
    const theirR = c('red', 1)
    const theirB = c('blue', 2)
    const state = makeGame([[c('green', 1)], [theirR, theirB]], { turnOf: 0 })
    const clued = applyAction(state, { type: 'clue', target: 1, kind: 'number', value: 2 })
    const view = viewForPlayer(clued, 0)
    const marks = view.players[0].marks
    const redMark = marks.find((mark) => mark.id === theirR.id)
    const blueMark = marks.find((mark) => mark.id === theirB.id)
    expect(redMark?.number).toBeNull()
    expect(redMark?.color).toBeNull()
    expect(blueMark?.number).toBe(2)
    expect(blueMark?.color).toBeNull()
  })

  it('rejects an invalid viewer id', () => {
    const state = makeGame([[c('red', 1)], [c('green', 1)]])
    expect(() => viewForPlayer(state, 99)).toThrow()
  })
})

describe('playerName', () => {
  const state = makeGame([
    [c('red', 1), c('blue', 2)],
    [c('green', 3)],
    [c('yellow', 4)],
  ])
  const view = viewForPlayer(state, 0)

  it('uses the viewer name for me', () => {
    expect(playerName(view, 'Alice', 0)).toBe('Alice')
    expect(playerName(view, null, 0)).toBe('You')
  })

  it('looks up other players by name', () => {
    expect(playerName(view, 'Alice', 1)).toBe('p1')
    expect(playerName(view, 'Alice', 2)).toBe('p2')
  })

  it('falls back to a seat label for unknown ids', () => {
    expect(playerName(view, 'Alice', 99)).toBe('Seat 100')
  })
})

describe('describeCard', () => {
  it('formats a card as color and number', () => {
    expect(describeCard({ id: 1, color: 'white', number: 5 })).toBe('white 5')
  })
})

describe('turnNumberFor', () => {
  it('returns the 1-based position in the turn order', () => {
    expect(turnNumberFor([2, 0, 1, 3], 2)).toBe(1)
    expect(turnNumberFor([2, 0, 1, 3], 0)).toBe(2)
    expect(turnNumberFor([2, 0, 1, 3], 3)).toBe(4)
  })

  it('returns null without a turn order or for unknown ids', () => {
    expect(turnNumberFor(null, 0)).toBeNull()
    expect(turnNumberFor([0, 1], 99)).toBeNull()
  })
})
