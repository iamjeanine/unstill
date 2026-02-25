/**
 * marginaliaSessionStore — In-memory store for "The Photograph Resists"
 *
 * Tracks all inscription lines generated per person during the session.
 * When the API is called again for the same person (return visit),
 * previous notes are sent so the AI generates different facts.
 *
 * Also holds a prefetch cache — API calls fire on hover so lines
 * are ready before the StoryPanel mounts.
 *
 * Resets on page refresh — no persistence.
 */

// { personId: string[] }
const store = {}

// Prefetch cache — { personId: Promise<string[]|null> }
const prefetchCache = {}

/**
 * Get all previously generated inscription lines for a person.
 * @param {string} personId
 * @returns {string[]}
 */
export function getPreviousNotes(personId) {
  return store[personId] || []
}

/**
 * Store new inscription lines after an API response.
 * @param {string} personId
 * @param {string[]} lines — The lines from the latest API response
 */
export function addNotes(personId, lines) {
  if (!store[personId]) store[personId] = []
  store[personId].push(...lines)
}

/**
 * Store a prefetch promise for a person (fired on hover).
 * @param {string} personId
 * @param {Promise<string[]|null>} promise
 */
export function setPrefetch(personId, promise) {
  prefetchCache[personId] = promise
}

/**
 * Consume the prefetch result. Returns the promise if available, null otherwise.
 * Non-destructive — keeps the cache entry so React 18 Strict Mode
 * double-mounts can both read the same prefetched result.
 * @param {string} personId
 * @returns {Promise<string[]|null>|null}
 */
export function consumePrefetch(personId) {
  return prefetchCache[personId] || null
}

/**
 * Explicitly clear a prefetch entry (call after successful consumption).
 * @param {string} personId
 */
export function clearPrefetch(personId) {
  delete prefetchCache[personId]
}

/**
 * Check if a prefetch is already in flight for this person.
 * @param {string} personId
 * @returns {boolean}
 */
export function hasPrefetch(personId) {
  return !!prefetchCache[personId]
}
