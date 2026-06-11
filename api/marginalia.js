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

// ─── CORS allowlist ──────────────────────────────────────────────────
//
// NOTE: This lock is tied to the production domain unstill.vercel.app.
// If the site ever moves to a custom domain, add that domain here or
// browser calls to this endpoint will be blocked.

const ALLOWED_ORIGINS = [
  'https://unstill.vercel.app',
  'http://localhost:3000', // local dev
]

// ─── Rate limiting ───────────────────────────────────────────────────
//
// Hard daily ceiling + per-IP limit, backed by Upstash Redis (via the
// Vercel Marketplace integration) so the caps hold across serverless
// instances and cold starts. If the Redis env vars are not configured
// or Redis is unreachable, degrades to the per-instance in-memory
// guard below — never fails open without any limit, never errors out.
//
// When a cap is hit the endpoint returns 429; the client treats that
// as a null result and falls back to the static pre-generated
// inscriptions in storyInscriptions.json, so visitors see no error.

// Limits are anti-bot ceilings, not engagement caps — a real visitor
// reading every portrait uses ~10 calls/day.
const DAILY_GLOBAL_LIMIT = 500
const DAILY_IP_LIMIT = 100
const COUNTER_TTL_SECONDS = 90000 // 25h — outlives the UTC day it counts

// Env vars auto-populated when an Upstash Redis store is connected to
// the Vercel project (Marketplace uses either naming convention).
const REDIS_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
const REDIS_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

// In-memory fallback (per-instance, resets on cold start)
let memGlobalCount = 0
let memIpCounts = new Map()
let memResetDate = todayUTC()

function memCheck(ip) {
  const today = todayUTC()
  if (today !== memResetDate) {
    memGlobalCount = 0
    memIpCounts = new Map()
    memResetDate = today
  }
  if (memGlobalCount >= DAILY_GLOBAL_LIMIT) return false
  const ipCount = memIpCounts.get(ip) || 0
  if (ipCount >= DAILY_IP_LIMIT) return false
  memGlobalCount++
  memIpCounts.set(ip, ipCount + 1)
  return true
}

// Durable counters via Upstash REST pipeline: INCR both counters and
// set a TTL on first increment so keys expire after their day passes.
async function redisCheck(ip) {
  const day = todayUTC()
  const globalKey = `marginalia:global:${day}`
  const ipKey = `marginalia:ip:${ip}:${day}`

  const response = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', globalKey],
      ['EXPIRE', globalKey, String(COUNTER_TTL_SECONDS), 'NX'],
      ['INCR', ipKey],
      ['EXPIRE', ipKey, String(COUNTER_TTL_SECONDS), 'NX'],
    ]),
  })

  if (!response.ok) throw new Error(`Redis ${response.status}`)

  const results = await response.json()
  const globalCount = Number(results?.[0]?.result)
  const ipCount = Number(results?.[2]?.result)
  if (!Number.isFinite(globalCount) || !Number.isFinite(ipCount)) {
    throw new Error('Unexpected Redis pipeline response')
  }

  return globalCount <= DAILY_GLOBAL_LIMIT && ipCount <= DAILY_IP_LIMIT
}

async function checkRateLimit(ip) {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      return await redisCheck(ip)
    } catch (err) {
      console.error(
        '[marginalia] Redis unavailable, using in-memory limit:',
        err.message
      )
    }
  }
  return memCheck(ip)
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown'
}

// ─── Handler ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS — locked to the site's own origin (see ALLOWED_ORIGINS note)
  const origin = req.headers.origin
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Reject browser cross-origin calls outright — CORS headers alone only
  // stop the response from being read; this stops the API spend too.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }

  // Rate limit — per-IP and global daily caps
  const clientIp = getClientIp(req)
  if (!(await checkRateLimit(clientIp))) {
    return res.status(429).json({ error: 'Daily limit reached' })
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
