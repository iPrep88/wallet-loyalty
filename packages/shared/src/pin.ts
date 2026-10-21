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
