# UNSTILL — Project Brief
### Single source of truth. Last updated: February 21, 2026.

---

## CURRENT SPRINT — What to Build Next

### 1. Replace Synthesized Audio with Custom Files
We have custom ambient audio files generated in ElevenLabs in the `Audio for layout` folder. Replace the current Web Audio API synthesized audio with these files.

**How it should work:**
1. `Site Ambient Sound Looping.mp3` plays when the user scrolls past the hero into the archive. It loops continuously. This is the base sound of the experience.
2. When a user clicks into a person's story, crossfade from the site ambient to that person's individual audio file. Smooth crossfade, 1-2 seconds. The individual file loops.
3. When the user exits a story and returns to the archive, crossfade back to the site ambient.
4. All files loop seamlessly.
5. Respect the existing mute toggle.

**Files:**
- `Audio for layout/Site Ambient Sound Looping.mp3` — base site ambient
- `Audio for layout/Nellie Cameron2.mp3`
- `Audio for layout/Edna Lindsay2.mp3`
- `Audio for layout/Henry Pierce.mp3`
- `Audio for layout/Patsy Neill.mp3`
- `Audio for layout/Marie Elliot.mp3`
- `Audio for layout/Fay Watson.mp3`
- `Audio for layout/Elsie Paul.mp3`

Map each file to the corresponding person in the people/story data. Remove or replace the current synthesized Web Audio API drone entirely. Keep the AudioManager crossfade infrastructure.

### 2. "The Photograph Resists" — Glass Plate Inscriptions
The signature feature. When the viewer enters a story and the animated mugshot plays, text inscriptions develop directly ON the video surface — in the lower-left corner — like markings scratched into a glass plate negative. The text develops from blurred to sharp over several seconds, like a photograph developing in a chemical tray.

**The concept:** The glass plate negative asserts its own conditions. It tells the viewer what they are actually looking at — a police photograph, taken in a yard behind holding cells, of someone who hasn't been to court yet. It does NOT repeat the person's name, charge, or date (that's already on the page below the video). It says things the page doesn't.

**The voice:** The AI writes as the glass plate itself — a material object that knows where it was made, how it was made, and what it was for. Not a narrator, not a commentator. An object asserting what is true about itself.

**Examples of what the glass plate says:**
- "Yard behind the holding cells. Central Police Station."
- "She positioned herself for this photograph."
- "Glass plate negative. Never intended for public display."
- "The bentwood chair is for scale."
- "Not yet convicted of anything."
- "The photographer wrote her name backwards on the glass."
- "130,000 negatives survive. 52,000 are searchable."
- "Cocaine was legal twelve months before this photograph."
- "She is wearing what she was wearing when they arrested her."

**Design:**
- **Position:** Lower-left of the video element. Absolutely positioned inside the video container. ON the video, not beside it, not below it.
- **Typography:** DM Sans, weight 300 (first line weight 400). Clean, no handwriting font, no displacement filter. 18px first line, 14-15px subsequent lines. Letter-spacing 0.12-0.16em.
- **Color:** Off-white, each line progressively dimmer — from rgba(232, 228, 214, 0.92) down to rgba(178, 175, 164, 0.50).
- **Background:** Subtle gradient on the lower 42% of the video — linear-gradient from rgba(8,7,5,0.50) to transparent. Permanent, not tied to inscriptions.
- **Reveal — "Chemical Development":** Each line animates from blur(6px) + opacity 0 to blur(0) + opacity 1 over 3 seconds. Lines stagger 1.5 seconds apart. Feels like a photograph developing in a chemical tray. Total reveal: ~6-8 seconds.
- **Timing:** API call fires immediately on story load. No behavioral tracking, no dwell time, no scroll trigger. The inscriptions begin developing ~2-3 seconds after entering the story.

**Each visit generates different lines.** Session memory stores all previous inscriptions per person. The AI receives previous lines and generates new ones, drawing from different aspects of the archive each time — sometimes the physical object, sometimes the station, sometimes the legal context, sometimes the historical world.

**The glass plate resists.** The animation makes the face breathe. The narrative makes the person a character. The inscription quietly says: this is a police photograph taken in a yard behind a cell and she hadn't been to court yet.

**Two gestures, same argument:** The loupe is active (the viewer chooses to look beneath the animation). The inscriptions are passive (the photograph asserts itself). Both reveal what's underneath the construction.

**Files for this feature:**
- `resists-prompt-v4.md` — system prompt. The glass plate speaks as itself.
- `historical-context.md` — comprehensive document about 1920s Sydney, the glass plates, the station, the archive. Sent to the API with each call.
- `primary-sources/` — per-person context files:
  - `nellie-cameron.md`, `edna-lindsay.md`, `henry-pierce.md`
  - `patsy-neill.md`, `marie-elliott.md`, `fay-watson.md`, `elsie-paul.md`
- When a viewer enters a story, fire the API call immediately with the system prompt, the person's primary source file, the historical context document, and any previous inscription lines from this session.

### 3. Story Panel Layout Refinements
- **Make the animated mugshot larger.** It should command the viewport — 50-60% of viewport width on desktop. The breath and blink need to feel visceral, not like a thumbnail.
- **Move connections up.** The "CONNECTED" section should appear after the narrative and contextual reframe, not buried at the bottom. Give the viewer a natural next click while still engaged.
- **Smooth exit.** Return to archive should feel like pulling back, not closing a page. The archive should feel like it's still there, dimmed and distant, while you're in a story.

---

## WHAT THIS IS

UNSTILL is an interactive web experience that transforms 1920s Sydney police archive photographs into living stories using AI. It's a prototype/pitch being sent to Rebecca Bushby, Director of Museums of History NSW. One URL. She clicks it. She experiences her museum's archive like never before.

**This is NOT a website. It's an interactive experience** — modeled after the David Whyte Experience by Immersive Garden (https://davidwhyte.com/experience/), Awwwards Site of the Month.

## THE CONCEPT

**"Photographs never intended for public consumption."**

The viewer enters and sees police mugshots in B&W — the archive as the police left it. Through interaction (hover, scroll, click), the photographs transform. Color bleeds in. Movement begins. Stories emerge. The more you look, the more you see.

Each layer demonstrates a different AI capability: colorization → subtle animation → full narrative reconstruction → AI that responds to how you engage.

## ABOUT THE ARCHIVE — "THE SPECIALS"

These photographs come from the NSW Police Forensic Photography Archive — a collection of approximately 130,000 negatives, including around 2,500 glass plate negatives known as "The Specials." They were taken at Central Police Station, Sydney, between 1910 and 1930.

**What makes them unique:**
- Unlike any police photography found elsewhere in the world
- Subjects were "allowed — perhaps invited — to position and compose themselves for the camera as they liked" (Curator Peter Doyle)
- The photographer, likely George Howard (whose "artistic proclivities" were noted in newspapers), captured personality, not just identification
- Shot on glass plate negatives with details inscribed backwards on the emulsion side
- A bentwood chair appears in most photos to indicate height
- Never intended for public consumption — they were internal police tools

**Scale:** 2,500 Specials. 130,000 total negatives. 52,000 searchable records online. UNSTILL tells seven stories. Imagine the rest.

## DESIGN SYSTEM

- **Background:** Light, clean off-white (#fafaf8), generous whitespace
- **Accent color:** Coral (#E8705A) — buttons, highlights, interactive indicators
- **Typography:** Instrument Serif (display/headlines) + DM Sans (body)
- **Dark photographs punch through** the clean modern frame like portals into another world
- **Museum-quality presentation** — photos given space and respect
- **One consistent visual world** that deepens, never breaks into a different design language

## THE EXPERIENCE — CURRENT STATE

### Already Built:
- **Hero:** UNSTILL title over Ah Num & Ah Tom photograph (colorized, police inscriptions visible). Subtitle: "Photographs never intended for public consumption." Subtle distortion squares on hover. Scroll indicator at bottom.
- **Archive pages:** Grouped by connection. Fay & Elsie together ("Darlinghurst, 24 March 1928"). Henry, Marie & Patsy together ("William Street Flat, 12 August 1929"). Nellie and Edna on individual pages. B&W photographs with drag-to-explore.
- **Magnifying glass/loupe on archive:** Working. Hover reveals color from B&W. Conceptual layer: the police took these in black and white — we added color. The loupe peels back to show the intervention.
- **Click into story:** Animated mugshot (Veo video) plays large and centered. Loops between close-up and full body. Name, age, charge, date appear below.
- **Inverted loupe on video:** Working. Hover over animation reveals original B&W still underneath. Animation cycles through frames while original stays frozen. Conceptual layer: AI gave this face life — underneath it's still a police photograph. The video is the site of construction, so it's the site where the loupe reveals the truth.
- **Narrative text:** Develops below the video on scroll. Photograph-developing opacity effect — lines fade in sequentially tied to scroll position.
- **Contextual reframe:** Coral italic text after narrative (e.g. "Cocaine was sold at pharmacies a year earlier...").
- **Connected section:** Below reframe. Small circular mugshot of connected person with arrow to navigate.
- **← ARCHIVE:** Top left navigation to return.
- **Audio mute toggle:** Bottom right.

### Still To Build:
1. Wire up custom ElevenLabs audio files (replacing current synthesized drone)
2. "The Photograph Resists" — glass plate inscriptions developing on video surface (see details above)
3. Horizon section (faces without stories + scale numbers)
4. Invitation/partnership section for Rebecca

## SOUND DESIGN

**Approach:** Ambient and atmospheric. NOT period-literal (no jazz, no ragtime). Voice as texture, not narration. Each person has their own ambient world — different temperature, different room.

**Voice fragments by person (embedded in ElevenLabs ambient generation):**
- **Edna May Lindsay:** "There's only one way out." (warm ambient)
- **Nellie Cameron:** "They already knew my name." (cold, sparse ambient)
- **Patsy Neill:** "The bar closed and my real shift started." (dark, warm, gritty ambient)
- **Marie Elliott:** "The flat was mine." (warm, confident ambient)
- **Henry Pierce:** "I watched the door." (tense, confined ambient)
- **Fay Watson:** No whisper — warm, open, wistful ambient only
- **Elsie Paul:** No whisper — warm ambient with subtle undercurrent of tension

## UPDATED NARRATIVES

### Edna May Lindsay
*Edna May Lindsay, 19. Bank forgery, 27 March 1929.*

She had a boyfriend and a plan. He was eighteen. They would forge a check — a year's salary — walk into a bank dressed like the money was already theirs, and disappear. Become dancers. Become somebody else.

Polka dots. A cloche hat. She was nineteen and she dressed for the life she wanted, not the one she had.

They almost made it to the door.

Both arrested. Both released with a warning. The judge told her dancing isn't everything.

She was nineteen. She disagreed.

### Nellie Cameron
*Nellie Cameron, 21. Unknown charge, 29 July, Sydney.*

She was 21 and the city was already making a place for her in its dark heart.

The arrests would come — 101 of them. Not for violence. Not for theft. For being somewhere. For knowing someone. For refusing to disappear.

But this is before all that. A young woman moving through the crowds like something the streets themselves had dreamed up.

### Henry Pierce
*Henry Pierce, 35. Cocaine, 12 August 1929.*

Masseur. Safe breaker. Bodyguard. He worked with theatrical companies. He knew how to wait in the wings.

Marie Elliott ran the flat. Patsy Neill ran for her. Henry watched the door. Same raid. Same night.

What happened before the photograph — they broke his nose. The photograph is what's left.

### Marie Elliott
*Marie Elliott, 29. Cocaine, 12 August 1929.*

The flat on William Street was hers. Patsy Neill was her runner. Henry Pierce watched the door.

Saturday nights the theatre crowd came through. They even sold outside the courthouse. Sniffs for defendants before they faced the bench.

The record doesn't say who she was before this. Or after.

### Patsy Neill
*Patsy Neill, 26. Cocaine, 12 August 1929.*

Barmaid. Runner. Two jobs, one night.

The bar closed and her real shift started. The streets knew her. The women she delivered to knew her. The flat where they caught her knew her too.

Two hundred fifty pounds. She paid it. Two years later Kate Leigh put a gun in her face over two pounds. Patsy took her to court.

That was just a Tuesday.

### Fay Watson & Elsie Paul
*Fay Watson, 23. Cocaine possession, 24 March 1928, Darlinghurst.*
*Elsie Paul, 21. Cocaine possession, 24 March 1928, Darlinghurst.*

Separate stories in the experience (separate mugshots, separate ambient audio, separate click-in) but connected.

The state called it disorder. They called it Saturday.

What the police file tells us: Fay, 23. Elsie, 21. Arrested during a raid. House party. Darlinghurst.

What it doesn't tell us: How they found each other — whatever together meant. Friends. Strangers. Conspirators. Something without a name.

*Cocaine was sold at pharmacies a year earlier. By 1928, the same act could make you criminal.*

**Note:** Fay and Elsie need individual narratives — the shared narrative above needs to be split. Fay may have been simply at a party. Elsie may have been a runner. We don't know for certain.

## CONNECTIONS MAP

```
SAME RAID — William Street Flat, 12 August 1929:
├── Marie Elliott (ran the flat)
├── Patsy Neill (runner)
└── Henry Pierce (watched the door)

SAME PARTY — Darlinghurst, 24 March 1928:
├── Fay Watson (23)
└── Elsie Paul (21)

SEPARATE:
├── Edna May Lindsay (bank forgery, 27 March 1929)
└── Nellie Cameron (legendary figure, pre-myth)
```

## ASSET INVENTORY

### People with Full Stories

**1. Fay Watson & Elsie Paul (paired)**
- Mugshots: Fay_Watson_Mugshot.jpeg, Elsie_Mugshot.jpg (colorized dual-panel)
- Short animated portrait: Fay_and_Elsie.mp4 (10 sec)
- Full narrative film: Strange_Nights__vo__2_2.mp4 (60 sec, has voiceover)

**2. Edna May Lindsay**
- Mugshot: Mugshot_double.png (colorized, polka dot dress, cloche hat)
- Narrative film: Edna_May_LIndsay.mp4 (57 sec, bank reconstruction)

**3. Henry Pierce**
- Mugshot: Henry_Color_Mug__Doublepng.png (colorized, brown coat, fedora)
- Animated portrait: Henry_Pierce.mp4 (18 sec)

**4. Marie Elliott**
- Mugshot: Marie_Color_Mug_Double.png (colorized, leather trench)
- Narrative film: Marie_Elliot.mp4 (15 sec, Tivoli theatre, rain)

**5. Patsy Neill**
- Mugshot: Enhanced_Mug_2.jpeg (colorized, fur collar, polka dot tie)
- Animated portrait: Patsy_Neill3.mp4 (11 sec)

**6. Nellie Cameron**
- Mugshot: MUGSHOTcleaned.jpeg / Nellie_Cameron.jpeg (colorized, three-panel)
- Animated portrait: Nellie_Cameron.mp4 (23 sec)

### Horizon Section (colorized mugshots, no stories yet)
- **V. Lowe** — blue gingham dress, very young
- **Sidney Kelly** — three-piece suit, looks like a movie star
- **Ah Num & Ah Tom** — arm around shoulder, overcoats
- **Patrick Riley** — grinning, tan hat

## TECH STACK

- React + Three.js (WebGL shaders for B&W-to-color magnifying glass effect)
- GSAP (animations, transitions)
- Lenis (smooth scroll)
- HTML5 video for Veo animations and narrative films
- Web Audio API / HTML5 audio for ambient sound
- Claude API for "Photograph Resists" marginalia
- Vite for bundling

## PRIMARY DESIGN REFERENCE

**David Whyte Experience** (https://davidwhyte.com/experience/)
- Key principle: when you go deeper into content, you never leave the visual world. Same design language throughout — just deeper. No sudden shifts.
- Case study: https://www.awwwards.com/case-study-david-whyte-experience-by-immersive-garden.html

## KEY PRINCIPLES

1. **"Not overly interactive, yet everything responds."** Simple actions, rich responses. One world that gets deeper.
2. **One continuous visual world.** No page changes. No modals. The archive is always there — you're just at different depths within it.
3. **The AI isn't a feature. It's a collaborator with an opinion about what archives are and what looking does.**
4. **Your attention is the mechanism.** Hover brings color. Click brings breath. Scroll reveals story. The glass plate asserts what the animation tries to hide.
5. **Two gestures, same argument.** The loupe is active — the viewer peels back layers by choosing to look. The inscriptions are passive — the glass plate pushes back whether you asked it to or not. Both reveal what's underneath the construction.

## WHAT SUCCESS LOOKS LIKE

Rebecca opens this link and:
1. Immediately knows this is not a normal website
2. Recognizes her museum's collection but sees it doing something it's never done before
3. Feels something — not just impressed technically, but moved
4. Thinks about the 2,500 Specials, the 130,000 negatives, and what they could become
5. Replies to schedule a conversation


