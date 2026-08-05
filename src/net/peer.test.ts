import { describe, expect, it } from 'vitest'
import { isStale } from './peer'

describe('isStale', () => {
  it('treats a seat with no activity as stale', () => {
    expect(isStale(1000, undefined, 8000)).toBe(true)
  })

  it('treats recent activity as fresh', () => {
    expect(isStale(1000, 500, 8000)).toBe(false)
  })

  it('treats activity past the timeout as stale', () => {
    expect(isStale(9000, 1000, 8000)).toBe(true)
  })

  it('treats activity exactly at the timeout as stale', () => {
    expect(isStale(9000, 1000, 8000)).toBe(true)
  })
})
