# Claude Code — Build "The Photograph Resists"

## IMPORTANT: Read this first

The UNSTILL_BRIEF describes "The Photograph Resists" as an adversarial AI narrator in the right margin with behavioral tracking, monospaced type, and sentences like "You've been looking at her face for forty seconds." **That version is scrapped.** Ignore all of that. This prompt replaces it entirely.

Also ignore the old `resists-prompt.md` if it exists in the project. Replace it with `resists-prompt-v4.md`.

Review the current codebase first. Understand how the story panel works — the video element, the narrative text below it, the loupe, the audio. Then build this feature into the existing structure.

---

## What you're building

When the viewer clicks into a person's story and the animated mugshot plays, text inscriptions develop directly ON the video surface — lower-left corner. They look like markings on a glass plate negative slowly becoming visible, like a photograph developing in a chemical tray.

The text is NOT repeating the person's name, charge, or date — that information is already on the page below the video. Instead, the AI writes as the glass plate itself, asserting the conditions of the photograph. Things like:

- "Yard behind the holding cells. Central Police Station."
- "She positioned herself for this photograph."
- "Glass plate negative. Never intended for public display."
- "The bentwood chair is for scale."
- "Not yet convicted of anything."

Each visit generates different lines. The AI draws from the person's primary source record and a historical context document about 1920s Sydney and the photographs.

---

## Step 1: Review the codebase

Before writing any code, review these files to understand the current story panel structure:

- The main app/page component — find where the story panel renders
- The video element — how it's wrapped, positioned, sized
- The narrative text — how it renders below the video
- The loupe interaction — how it overlays on the video (don't break this)
- The audio system — how crossfades work on story entry/exit
- The existing API call infrastructure — check if there's already a Claude API setup from a previous attempt at this feature

Understand the DOM structure of the story panel before adding to it.

---

## Step 2: Add the inscription container

Inside the video wrapper/container element, add:

```jsx
{/* Glass plate inscriptions — develops on the video surface */}
<div className="inscriptions-container">
  <div className="inscription-lines">
    {inscriptionLines.map((line, i) => (
      <span 
        key={i}
        className={`inscription-line ${i === 0 ? 'first-line' : ''}`}
        style={{ 
          animationDelay: `${0.5 + (i * 1.5)}s`,
          // Each line gets progressively dimmer
          color: `rgba(${232 - (i * 14)}, ${228 - (i * 14)}, ${214 - (i * 12)}, ${0.92 - (i * 0.12)})`
        }}
      >
        {line}
      </span>
    ))}
  </div>
</div>
```

---

## Step 3: CSS

```css
/* Container — gradient for readability over video */
.inscriptions-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 42%;
  pointer-events: none;
  z-index: 5; /* above video, below loupe */
  background: linear-gradient(
    0deg,
    rgba(8, 7, 5, 0.50) 0%,
    rgba(8, 7, 5, 0.25) 40%,
    transparent 100%
  );
}

/* Text positioning */
.inscription-lines {
  position: absolute;
  bottom: 28px;
  left: 32px;
  right: 32px;
}

/* Each line */
.inscription-line {
  display: block;
  font-family: 'DM Sans', sans-serif;
  font-weight: 300;
  font-size: 14.5px;
  letter-spacing: 0.12em;
  line-height: 1;
  margin-bottom: 16px;
  opacity: 0;
  animation: chemical-develop 3s cubic-bezier(0.22, 0.1, 0.28, 1) forwards;
}

/* First line is bigger and bolder */
.inscription-line.first-line {
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 0.16em;
  margin-bottom: 24px;
  animation-duration: 3.5s;
}

/* Chemical development — blur to sharp */
@keyframes chemical-develop {
  0%   { opacity: 0;    filter: blur(6px) brightness(0.3); }
  12%  { opacity: 0.1;  filter: blur(4px) brightness(0.5); }
  28%  { opacity: 0.3;  filter: blur(2.5px) brightness(0.65); }
  45%  { opacity: 0.55; filter: blur(1.2px) brightness(0.8); }
  65%  { opacity: 0.75; filter: blur(0.4px) brightness(0.92); }
  82%  { opacity: 0.88; filter: blur(0.1px) brightness(0.98); }
  100% { opacity: 1;    filter: blur(0px) brightness(1); }
}

/* Responsive */
@media (max-width: 680px) {
  .inscription-lines { bottom: 16px; left: 16px; right: 16px; }
  .inscription-line { font-size: 13px; margin-bottom: 12px; }
  .inscription-line.first-line { font-size: 16px; margin-bottom: 18px; }
}

@media (max-width: 480px) {
  .inscriptions-container { display: none; }
}
```

**Z-index note:** The inscriptions must sit above the video but below the loupe interaction layer. Check the existing z-index stack and slot it in correctly. The loupe must still work on top of the inscriptions.

---

## Step 4: API call

Fire the API call immediately when the story panel loads/opens. Do not wait for scroll, dwell time, or any user action beyond clicking into the story.

```javascript
// Session memory — persists across story visits, resets on page refresh
const sessionInscriptions = {};

async function fetchInscriptions(person) {
  const previousLines = sessionInscriptions[person.name] || [];
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: RESISTS_SYSTEM_PROMPT, // contents of resists-prompt-v4.md
        messages: [{
          role: 'user',
          content: `Person: ${person.name}
Age: ${person.age}
Charge: ${person.charge}
Date: ${person.date}

PRIMARY SOURCE RECORD:
${person.primarySource}

HISTORICAL CONTEXT:
${HISTORICAL_CONTEXT}

PREVIOUS LINES THIS SESSION:
${previousLines.length > 0 ? previousLines.join('\n') : 'None yet — first visit.'}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    // Store for session memory
    if (!sessionInscriptions[person.name]) {
      sessionInscriptions[person.name] = [];
    }
    sessionInscriptions[person.name].push(...lines);
    
    return lines;
  } catch (error) {
    console.error('Inscription fetch failed:', error);
    return []; // Fail silently — inscriptions are additive, not essential
  }
}
```

**Where to load the prompt and context:** 
- `resists-prompt-v4.md` — load its contents as a string constant (RESISTS_SYSTEM_PROMPT). This is the system prompt.
- `historical-context.md` — load its contents as a string constant (HISTORICAL_CONTEXT). This gets sent in the user message.
- Each person's primary source file (e.g. `nellie-cameron.md`) — load the relevant one based on which person's story is open.

These can be imported as raw strings at build time or loaded at runtime — whatever fits the existing project pattern.

---

## Step 5: Wire it up

In the story panel component:

1. When the story opens (person selected), call `fetchInscriptions(person)`.
2. Store the returned lines in component state.
3. Render the inscription container with the lines.
4. The CSS animation handles the reveal automatically via animation-delay.
5. When the story closes (back to archive), clear the inscription lines from state.

---

## Step 6: Verify

After building, check:

- [ ] Inscriptions appear on the video surface, lower-left, after ~2-3 seconds
- [ ] Each line develops from blur to sharp (chemical development animation)
- [ ] Lines get progressively dimmer/smaller
- [ ] Text is readable over the video (gradient provides contrast)
- [ ] Loupe still works on top of the inscriptions
- [ ] Video still plays and loops normally
- [ ] Narrative text below the video still develops on scroll
- [ ] Audio crossfade still works on story entry/exit
- [ ] Archive navigation still works
- [ ] Clicking into the same person a second time shows different inscriptions
- [ ] Inscriptions don't appear on viewports under 480px wide
- [ ] No console errors from the API call
- [ ] If the API call fails, the story still works — just no inscriptions

---

## Files to add/replace

1. **Replace** `resists-prompt.md` → with `resists-prompt-v4.md`
2. **Add** `historical-context.md` if not already present
3. **Do not modify** primary source files, narratives, audio files, or the brief

---

## What NOT to touch

- The hero section
- The archive pages / grouped layout
- The loupe shader / WebGL code
- The narrative text developing effect
- The audio crossfade system
- The connected section below narratives
- The mute toggle

Build the inscriptions as an additive layer. If the API fails, everything else works exactly as before.
