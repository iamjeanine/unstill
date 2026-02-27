/**
 * MarginaliaAPI — Proxy client for contextual inscriptions
 *
 * Calls the Vercel serverless function at /api/marginalia instead of
 * the Anthropic API directly. The API key and prompt stay server-side.
 */

// ─── Request queue — serializes all API calls to avoid 429s ─────────

const QUEUE_DELAY_MS = 1500
let _queue = Promise.resolve()

function enqueue(fn) {
  let resolve
  const callerPromise = new Promise((r) => { resolve = r })

  _queue = _queue
    .then(() => fn())
    .then((result) => {
      resolve(result)
      return new Promise((r) => setTimeout(r, QUEUE_DELAY_MS))
    })
    .catch(() => {
      resolve(null)
      return new Promise((r) => setTimeout(r, QUEUE_DELAY_MS))
    })

  return callerPromise
}

// ─── API call (via serverless proxy) ────────────────────────────────

// Queued — for batch prefetch. Calls wait their turn.
export function generateMarginalia(params) {
  return enqueue(() => _callAPI(params))
}

// Immediate — for user-initiated clicks. Bypasses the queue.
export function generateMarginaliaImmediate(params) {
  return _callAPI(params)
}

async function _callAPI({
  personId,
  personName,
  age,
  charge,
  date,
  location,
  essay = '',
  previousNotes = [],
}) {
  try {
    const response = await fetch('/api/marginalia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personId,
        personName,
        age,
        charge,
        date,
        location,
        essay,
        previousNotes,
      }),
    })

    if (response.status === 429) {
      console.warn('[Marginalia] Rate limit reached')
      return null
    }

    if (!response.ok) {
      console.warn(`[Marginalia] ${personName}: proxy error ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.text || null
  } catch (err) {
    console.warn(`[Marginalia] ${personName}: fetch error`, err.message)
    return null
  }
}
