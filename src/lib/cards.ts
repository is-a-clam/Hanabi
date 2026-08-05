import type { Card, Color } from './types'

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue', 'white']

export const NUMBER_COUNTS: Record<number, number> = {
  1: 3,
  2: 2,
  3: 2,
  4: 2,
  5: 1,
}

export function buildDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (const color of COLORS) {
    for (let number = 1; number <= 5; number++) {
      for (let i = 0; i < NUMBER_COUNTS[number]; i++) {
        deck.push({ id, color, number })
        id++
      }
    }
  }
  return deck
}

export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
