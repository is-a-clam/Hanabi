import { describe, expect, it } from 'vitest'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, generateRoomCode } from './room'

describe('generateRoomCode', () => {
  it('generates a code of the default length', () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH)
  })

  it('only uses unambiguous alphanumeric characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode()
      expect([...code].every((ch) => ROOM_CODE_ALPHABET.includes(ch))).toBe(true)
    }
  })

  it('is deterministic with a fixed rng', () => {
    expect(generateRoomCode(5, () => 0.5)).toBe(generateRoomCode(5, () => 0.5))
  })

  it('rejects non-positive lengths', () => {
    expect(() => generateRoomCode(0)).toThrow()
  })
})
