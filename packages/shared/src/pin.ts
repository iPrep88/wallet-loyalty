import bcrypt from 'bcryptjs'

const PIN_PATTERN = /^\d{4}$/

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}

export async function hashPin(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) throw new Error('PIN must be exactly 4 digits')
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false
  return bcrypt.compare(pin, hash)
}

/**
 * A fresh 4-digit code for a staff member.
 *
 * Rejects the handful of codes that are not really 10,000-to-one — 1234, 0000,
 * 1111 and the rest of the keypad patterns people actually guess first. A PIN
 * sits on a shop's counter where anyone can watch it being typed, so the few
 * everyone tries should never be issued in the first place.
 *
 * Uses the crypto RNG, not Math.random: this guards money.
 */
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210', '1212', '2121', '1010', '2580', '1379', '6969',
])

export function generatePin(randomInt: () => number = cryptoInt): string {
  for (;;) {
    const pin = String(randomInt() % 10000).padStart(4, '0')
    if (!WEAK_PINS.has(pin)) return pin
  }
}

function cryptoInt(): number {
  const buf = new Uint32Array(1)
  // Node 18+ and every browser expose this on globalThis, so the file stays
  // free of a node: import and keeps working on either side.
  ;(globalThis as unknown as {
    crypto: { getRandomValues(a: Uint32Array): void }
  }).crypto.getRandomValues(buf)
  return buf[0]!
}
