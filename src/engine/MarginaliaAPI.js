/**
 * MarginaliaAPI — Claude API integration for contextual inscriptions
 *
 * Generates 3 short inscription lines providing wider historical context
 * about the world around the person in the photograph — laws, economics,
 * policing, social conditions. The essay is the close-up; inscriptions
 * are the wide shot.
 *
 * Direct browser-side call with `anthropic-dangerous-direct-browser-access`
 * header — acceptable for pitch prototype, not for production.
 */

import { primarySources } from '../data/primarySources'
import historicalContext from '../../historical-context.md?raw'
import resistsPrompt from '../../resists-prompt-v5.md?raw'

// ─── System prompt — Contextual wide-shot inscriptions ──────────────

const SYSTEM_PROMPT = resistsPrompt

// ─── Request queue — serializes all API calls to avoid 429s ─────────
// Every call goes through this queue regardless of origin (batch
// prefetch, hover prefetch, click fetch). 1.5s gap between calls
// keeps us well under the 30k input tokens/min rolling window.

const QUEUE_DELAY_MS = 1500
let _queue = Promise.resolve()

function enqueue(fn) {
  _queue = _queue
    .then(() => fn())
    .then((result) => {
      return new Promise((resolve) =>
        setTimeout(() => resolve(result), QUEUE_DELAY_MS)
      )
    })
    .catch((err) => {
      return new Promise((resolve) =>
        setTimeout(() => resolve(null), QUEUE_DELAY_MS)
      )
    })
  return _queue
}

// ─── API call ───────────────────────────────────────────────────────

/**
 * Generate contextual inscription lines for the video surface.
 *
 * @param {Object} params
 * @param {string} params.personId       — ID of the person being viewed
 * @param {string} params.personName     — Display name
 * @param {string} params.age            — Age(s) as string
 * @param {string} params.charge         — The charge
 * @param {string} params.date           — Date of arrest
 * @param {string} params.location       — Location
 * @param {string} params.essay          — The narrative essay (so inscriptions avoid overlap)
 * @param {string[]} params.previousNotes — Lines from previous API calls this session
 * @returns {Promise<string|null>} The inscription lines (newline-separated), or null on failure
 */
export function generateMarginalia(params) {
  return enqueue(() => _callAPI(params))
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
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('REPLACE')) return null

  const primarySource = primarySources[personId] || ''

  // Build the user message — person details, primary source, historical context, previous lines
  const previousLinesBlock =
    previousNotes.length > 0
      ? previousNotes.join('\n')
      : 'None yet — first visit.'

  const userMessage = `Person: ${personName}
Age: ${age}
Charge: ${charge}
Date: ${date}
Location: ${location}

PRIMARY SOURCE RECORD:
${primarySource}

NARRATIVE ESSAY (do not repeat or rephrase anything from this):
${essay}

HISTORICAL CONTEXT:
${historicalContext}

PREVIOUS LINES THIS SESSION:
${previousLinesBlock}

REMINDER: Output ONLY the three inscription sentences, nothing else. No reasoning, no preamble, no "I'll search for" — just three lines.`

  // Retry with exponential backoff for rate limits (429)
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        }),
      })

      if (response.status === 429 && attempt < MAX_RETRIES) {
        // Rate limited — wait and retry with exponential backoff
        const delay = (attempt + 1) * 2000 // 2s, 4s, 6s
        await new Promise((r) => setTimeout(r, delay))
        continue
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        console.warn(`[Marginalia] ${personName}: API error ${response.status}`, errorBody)
        return null
      }

      const data = await response.json()
      const text = data?.content?.[0]?.text?.trim()

      // Sanity check — should be 3 context sentences
      if (!text || text.length > 800) return null

      // Reject model preamble — the model sometimes outputs chain-of-thought
      // reasoning ("I'll search for...", "I need to...") instead of inscriptions.
      const preamblePatterns = /^(I'll |I need to |I should |Let me |I want to |I will )/i
      if (preamblePatterns.test(text)) {
        console.warn(`[Marginalia] ${personName}: rejected preamble response`)
        return null
      }

      return text
    } catch (err) {
      console.warn(`[Marginalia] ${personName}: fetch error`, err.message)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000))
        continue
      }
      return null
    }
  }
  return null
}
