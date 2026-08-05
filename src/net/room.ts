export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

export function generateRoomCode(length = ROOM_CODE_LENGTH, rng: () => number = Math.random): string {
  if (length < 1) throw new Error('room code length must be positive')
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}
