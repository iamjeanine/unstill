import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ─── Load prompt assets at cold-start (cached across invocations) ───

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const systemPrompt = readFileSync(join(root, 'resists-prompt-v5.md'), 'utf-8')
const historicalContext = readFileSync(join(root, 'historical-context.md'), 'utf-8')

// Primary sources are an ES module — read and extract the object manually
// since we can't dynamically import from a Vite-bundled source file.
// Instead, inline a small lookup that mirrors src/data/primarySources.js.
import { primarySources } from '../src/data/primarySources.js'

// ─── Rate limiting (in-memory, resets per-instance + midnight UTC) ───

let callCount = 0
let resetDate = todayUTC()

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

function checkRateLimit() {
  const today = todayUTC()
  if (today !== resetDate) {
    callCount = 0
    resetDate = today
  }
  if (callCount >= 100) return false
  callCount++
  return true
}

// ─── Handler ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limit
  if (!checkRateLimit()) {
    return res.status(429).json({ error: 'Daily limit reached (100 calls/day)' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const {
    personId,
    personName,
    age,
    charge,
    date,
    location,
    essay = '',
    previousNotes = [],
  } = req.body || {}

  if (!personId || !personName) {
    return res.status(400).json({ error: 'Missing personId or personName' })
  }

  // Build user message server-side (prompt + context never leave the server)
  const primarySource = primarySources[personId] || ''
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

  // Call Anthropic API with retry
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      if (response.status === 429 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000))
        continue
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        console.error(`[marginalia] API error ${response.status}:`, errorBody)
        return res.status(502).json({ error: 'Upstream API error' })
      }

      const data = await response.json()
      const text = data?.content?.[0]?.text?.trim()

      if (!text || text.length > 800) {
        return res.status(502).json({ error: 'Invalid API response' })
      }

      // Reject model preamble
      const preamblePatterns = /^(I'll |I need to |I should |Let me |I want to |I will )/i
      if (preamblePatterns.test(text)) {
        return res.status(502).json({ error: 'Model returned preamble instead of inscriptions' })
      }

      return res.status(200).json({ text })
    } catch (err) {
      console.error(`[marginalia] fetch error (attempt ${attempt}):`, err.message)
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000))
        continue
      }
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(500).json({ error: 'All retries exhausted' })
}
