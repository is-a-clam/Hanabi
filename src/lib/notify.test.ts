import { describe, expect, it } from 'vitest'
import { shouldNotifyTurn } from './notify'

describe('shouldNotifyTurn', () => {
  it('does not fire at game start when there is no previous turn', () => {
    expect(shouldNotifyTurn(null, 0, 0, false)).toBe(false)
  })

  it('fires when the turn is handed to me', () => {
    expect(shouldNotifyTurn(1, 2, 2, false)).toBe(true)
  })

  it('does not fire when it is not my turn', () => {
    expect(shouldNotifyTurn(0, 1, 2, false)).toBe(false)
  })

  it('does not fire when the turn is unchanged', () => {
    expect(shouldNotifyTurn(2, 2, 2, false)).toBe(false)
  })

  it('does not fire when the game is over', () => {
    expect(shouldNotifyTurn(1, 2, 2, true)).toBe(false)
  })
})
