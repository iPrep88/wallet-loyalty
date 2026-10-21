import { NextResponse } from 'next/server'

const STATUS: Record<string, number> = {
  bad_request: 400,
  bad_token: 400,
  not_found: 404,
  wrong_shop: 403,
  undo_forbidden: 403,
  subscription_inactive: 402,
  not_ready: 409,
  card_full: 409,
  already_undone: 409,
  undo_expired: 410,
  cooldown: 429,
  locked: 429,
  bad_pin: 401,
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...(data as object) }, init)
}

export function err(
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  const status = STATUS[code] ?? 400
  const headers: Record<string, string> = {}
  const retry = extra?.retryAfterSeconds
  if (typeof retry === 'number') headers['Retry-After'] = String(retry)
  return NextResponse.json({ ok: false, code, message, ...extra }, { status, headers })
}

/** Parses a JSON body, tolerating an empty or malformed one. */
export async function body<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
