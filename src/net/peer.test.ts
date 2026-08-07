import { describe, expect, it } from 'vitest'
import {
  HOST_RECOVERY_BUDGET_MS,
  HOST_RECOVERY_MAX_DELAY_MS,
  MAX_ROOM_CODE_ATTEMPTS,
  PING_INTERVAL_MS,
  RECONNECT_BUDGET_MS,
  RECONNECT_MAX_DELAY_MS,
  SEAT_TIMEOUT_MS,
  isStale,
  reconnectDelays,
} from './peer'

describe('liveness constants', () => {
  it('keeps the expected heartbeat and timeout values', () => {
    expect(PING_INTERVAL_MS).toBe(2000)
    expect(SEAT_TIMEOUT_MS).toBe(15000)
    expect(MAX_ROOM_CODE_ATTEMPTS).toBe(5)
  })

  it('keeps the expected recovery budgets', () => {
    expect(HOST_RECOVERY_BUDGET_MS).toBe(60000)
    expect(HOST_RECOVERY_MAX_DELAY_MS).toBe(15000)
    expect(RECONNECT_BUDGET_MS).toBe(60000)
    expect(RECONNECT_MAX_DELAY_MS).toBe(15000)
  })
})

describe('isStale', () => {
  it('treats a never-seen peer as stale', () => {
    expect(isStale(1000, undefined, 15000)).toBe(true)
  })

  it('returns false when the last contact is within the timeout', () => {
    expect(isStale(2000, 1000, 15000)).toBe(false)
  })

  it('returns true exactly at the timeout boundary', () => {
    expect(isStale(16000, 1000, 15000)).toBe(true)
  })

  it('returns true when the last contact is older than the timeout', () => {
    expect(isStale(17000, 1000, 15000)).toBe(true)
  })
})

describe('reconnectDelays', () => {
  it('returns no delays when the budget cannot fit the first delay', () => {
    expect(reconnectDelays(1000, 15000)).toEqual([])
  })

  it('starts at 2000ms and doubles up to the max delay', () => {
    expect(reconnectDelays(30000, 15000)).toEqual([2000, 4000, 8000, 15000])
  })

  it('never exceeds the max delay', () => {
    const delays = reconnectDelays(100000, 15000)
    expect(delays.every((delay) => delay <= 15000)).toBe(true)
  })

  it('never lets the cumulative total exceed the budget', () => {
    const budget = 25000
    const delays = reconnectDelays(budget, 15000)
    const total = delays.reduce((sum, delay) => sum + delay, 0)
    expect(total).toBeLessThanOrEqual(budget)
  })

  it('produces the schedule used by the real client budget', () => {
    expect(reconnectDelays(RECONNECT_BUDGET_MS, RECONNECT_MAX_DELAY_MS)).toEqual([
      2000,
      4000,
      8000,
      15000,
      15000,
      15000,
    ])
  })
})
