import type { Color } from '../lib/types'

export const CARD_W = 66
export const CARD_H = 96

export const COLOR_HEX: Record<Color, string> = {
  red: '#dc2626',
  yellow: '#eab308',
  green: '#16a34a',
  blue: '#2563eb',
  white: '#f3f4f6',
}

export type CardMode = 'face' | 'back' | 'marks'
