/**
 * Pre-generate Horizon inscriptions for all 17 faces.
 * Run once: node scripts/generate-inscriptions.mjs
 * Outputs: src/data/horizonInscriptions.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const API_KEY = readFileSync(join(root, '.env.local'), 'utf-8')
  .split('\n')
  .find(l => l.startsWith('VITE_ANTHROPIC_API_KEY='))
  ?.split('=')
  .slice(1)
  .join('=')
  .trim()

if (!API_KEY) { console.error('No API key found'); process.exit(1) }

const systemPrompt = readFileSync(join(root, 'resists-prompt-v5.md'), 'utf-8')
const historicalContext = readFileSync(join(root, 'historical-context.md'), 'utf-8')

const faces = [
  { name: 'Sidney Kelly',     date: '26.6.24',  location: 'Sydney' },
  { name: 'D. Ligores',       date: 'c. 1925',  location: 'Sydney' },
  { name: 'Edna Edgar',       date: '28.12.26', location: 'Sydney' },
  { name: 'V. Lowe',          date: '15.2.22',  location: 'Sydney' },
  { name: 'D. Poole',         date: '31.7.24',  location: 'Sydney' },
  { name: 'F. Schmidt',       date: '18.6.23',  location: 'Sydney' },
  { name: 'Ah Chong',         date: '11.7.28',  location: 'Sydney' },
  { name: 'S. J. Hay',        date: 'c. 1922',  location: 'Sydney' },
  { name: 'May Russel',       date: '31.1.22',  location: 'Sydney' },
  { name: 'E. Falleni',       date: 'c. 1920',  location: 'Sydney' },
  { name: 'G. Lowe',          date: '28.9.28',  location: 'Sydney' },
  { name: 'N. McQuade & L. Stanley', date: 'c. 1930', location: 'Sydney' },
  { name: 'Patrick Riley',    date: '17.8.26',  location: 'Sydney' },
  { name: 'V. Stander',       date: 'c. 1925',  location: 'Sydney' },
  { name: 'P. Hume',          date: '1.6.21',   location: 'Sydney' },
  { name: 'E. Park',          date: '20.29',    location: 'Sydney' },
  { name: 'William Stanley Moore', date: '1.8.25', location: 'Sydney' },
]

const DELAY_MS = 3000

async function generate(face) {
  const personId = face.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')

  const userMessage = `Person: ${face.name}
Age:
Charge:
Date: ${face.date}
Location: ${face.location}

PRIMARY SOURCE RECORD:


NARRATIVE ESSAY (do not repeat or rephrase anything from this):


HISTORICAL CONTEXT:
${historicalContext}

PREVIOUS LINES THIS SESSION:
None yet — first visit.

REMINDER: Output ONLY the three inscription sentences, nothing else. No reasoning, no preamble, no "I'll search for" — just three lines.`

  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })

      if (response.status === 429) {
        const delay = (attempt + 1) * 4000
        console.log(`  429 for ${face.name}, retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }

      if (!response.ok) {
        console.error(`  API error ${response.status} for ${face.name}`)
        return { personId, lines: null }
      }

      const data = await response.json()
      const text = data?.content?.[0]?.text?.trim()
      if (!text) return { personId, lines: null }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).slice(0, 2)
      return { personId, lines }
    } catch (err) {
      console.error(`  Error for ${face.name}:`, err.message)
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000))
        continue
      }
      return { personId, lines: null }
    }
  }
  return { personId, lines: null }
}

async function main() {
  const results = {}

  for (let i = 0; i < faces.length; i++) {
    const face = faces[i]
    console.log(`[${i + 1}/${faces.length}] ${face.name}...`)
    const { personId, lines } = await generate(face)
    if (lines && lines.length > 0) {
      results[personId] = lines
      console.log(`  OK: ${lines.join(' | ')}`)
    } else {
      console.log(`  FAILED`)
    }

    if (i < faces.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  const outPath = join(root, 'src', 'data', 'horizonInscriptions.json')
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\nDone! Wrote ${Object.keys(results).length} inscriptions to ${outPath}`)
}

main()
