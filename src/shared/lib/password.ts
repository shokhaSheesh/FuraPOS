/*
 * Passwords handed to people: suppliers on their portal, employees on this
 * platform. One generator and one minimum, so the two never drift apart.
 *
 * Ambiguous glyphs are left out on purpose. These passwords get read aloud or
 * copied into a message, and `I`/`l`/`1` and `O`/`0` are where that goes wrong.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const PASSWORD_LENGTH = 12

/** Short enough to type over the phone, long enough not to be guessed. */
export const MIN_PASSWORD_LENGTH = 8

export function generatePassword(length = PASSWORD_LENGTH): string {
  const size = PASSWORD_ALPHABET.length
  // crypto where it exists, because a predictable password is not a password.
  const random =
    typeof globalThis.crypto?.getRandomValues === 'function'
      ? Array.from(globalThis.crypto.getRandomValues(new Uint32Array(length)))
      : Array.from({ length }, () => Math.floor(Math.random() * size))
  return random.map((value) => PASSWORD_ALPHABET[value % size]).join('')
}

/** A login somebody has to spell down a phone line: lowercase, no spaces. */
export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,}$/
