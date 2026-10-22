/**
 * Posting JSON from the browser, with an honest failure.
 *
 * Every form here used to wrap its fetch in one try/catch and report "No
 * connection" for anything that threw — including a server error whose HTML
 * response made .json() blow up. That sent a real person hunting their wifi
 * while the actual fault was a database constraint. A message that is wrong
 * is worse than one that is vague.
 */
export type PostResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; offline?: boolean }

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<PostResult<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    // fetch only rejects when the request never completed — this is the one
    // case where "no connection" is actually true.
    return { ok: false, offline: true, message: 'No connection. Please try again.' }
  }

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    // The server answered with something that is not JSON, which in practice
    // means it crashed and returned an error page.
    return {
      ok: false,
      message: `Something broke on our end (error ${res.status}). `
             + 'It has been logged — please try again in a moment.',
    }
  }

  const data = parsed as T & { ok?: boolean; message?: string }
  if (!res.ok || data.ok === false) {
    return { ok: false, message: data.message ?? `Request failed (${res.status}).` }
  }
  return { ok: true, data }
}

/** The same, for multipart uploads. */
export async function postForm<T>(url: string, form: FormData): Promise<PostResult<T>> {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', body: form })
  } catch {
    return { ok: false, offline: true, message: 'No connection. Please try again.' }
  }
  const text = await res.text()
  try {
    const data = JSON.parse(text) as T & { ok?: boolean; message?: string }
    if (!res.ok || data.ok === false) {
      return { ok: false, message: data.message ?? `Upload failed (${res.status}).` }
    }
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      message: `Something broke on our end (error ${res.status}). Please try again.`,
    }
  }
}
