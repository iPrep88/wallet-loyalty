import { one, query, type Staff } from '@wl/db'
import { isValidPinFormat, verifyPin, PIN_MAX_ATTEMPTS, PIN_LOCKOUT_SECONDS } from '@wl/shared'

/**
 * Matching a 4-digit PIN to a staff member at one store.
 *
 * The lockout is keyed to the scanner DEVICE, not to a staff row: whoever is
 * guessing does not know which staff member a given PIN belongs to, so
 * counting failures per staff row would let them walk the whole 10,000-code
 * space one row at a time.
 */
export type PinResult =
  | { ok: true; staff: Staff }
  | { ok: false; code: 'bad_pin' | 'locked' | 'bad_request'
      message: string; retryAfterSeconds?: number }

export async function authenticatePin(args: {
  storeId: string
  deviceId: string
  pin: string
}): Promise<PinResult> {
  const { storeId, deviceId, pin } = args

  if (!isValidPinFormat(pin)) {
    return { ok: false, code: 'bad_request', message: 'Enter your 4-digit PIN.' }
  }
  if (!deviceId) {
    return { ok: false, code: 'bad_request', message: 'Missing device id.' }
  }

  const lock = await one<{ locked_until: Date | null; attempts: number }>(
    `select locked_until, attempts from pin_attempts
      where store_id = $1 and device_id = $2`,
    [storeId, deviceId],
  )

  if (lock?.locked_until && new Date(lock.locked_until) > new Date()) {
    const seconds = Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / 1000)
    return {
      ok: false, code: 'locked', retryAfterSeconds: seconds,
      message: `Too many wrong PINs. Try again in ${Math.ceil(seconds / 60)} min.`,
    }
  }

  // Every active PIN at this store has to be compared, because the PIN itself
  // does not say whose it is. bcrypt makes that deliberately slow, which is
  // also the point.
  const staffRows = await query<Staff>(
    `select * from staff where store_id = $1 and active order by created_at`, [storeId],
  )

  for (const staff of staffRows) {
    if (await verifyPin(pin, staff.pin_hash)) {
      await query(`delete from pin_attempts where store_id = $1 and device_id = $2`,
        [storeId, deviceId])
      return { ok: true, staff }
    }
  }

  const attempts = await recordFailure(storeId, deviceId)
  const left = PIN_MAX_ATTEMPTS - attempts
  return {
    ok: false, code: 'bad_pin',
    message: left > 0
      ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`
      : 'Wrong PIN. This device is locked for 5 minutes.',
  }
}

async function recordFailure(storeId: string, deviceId: string): Promise<number> {
  const row = await one<{ attempts: number }>(
    `insert into pin_attempts (store_id, device_id, attempts, updated_at)
     values ($1, $2, 1, now())
     on conflict (store_id, device_id) do update
       set attempts = pin_attempts.attempts + 1,
           updated_at = now(),
           locked_until = case
             when pin_attempts.attempts + 1 >= $3
               then now() + ($4 || ' seconds')::interval
             else pin_attempts.locked_until
           end
     returning attempts`,
    [storeId, deviceId, PIN_MAX_ATTEMPTS, String(PIN_LOCKOUT_SECONDS)],
  )
  return row?.attempts ?? 1
}
