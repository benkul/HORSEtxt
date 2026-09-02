# HorseText Debugger — working notes

Date: 2026-09-01. Sessions 1-2.
Date: 2026-09-02. Session 3 — the drawn horse.

## Mission
Build the visual debugger for HorseText: a flame-graph / waterfall trace of
the horse's state, where ears and head position change what you see because
they change what the horse attends to. Unhinged in HorseText's own way, not
decoration — every ear/head effect traceable to BIBLIOGRAPHY.md and GRAMMAR.md
§4.

## Ground truth already confirmed in the code
- `src/runtime.js` `Horse#signal(name, value, provenance)` — calls
  `this.host.onSignal(name, answer)` for EVERY emission (line ~533).
  `answer = { answered, by, value, refused, carried }`, and
  `carried = { line, file, individual, side }` + any chord provenance.
  Two silences: `reason: "not attending"` and `reason: "nobody there"`.
- `src/runtime.js` — ears are attention (`this.attending`); gait scheduling
  from limb-phase vectors; affect/Forage/Weather are runtime state.
- `src/emit.js` — provenance compiled into emitted JS (`line: N`, sourceURL).
- `playground.html` — already has a live `<script type="text/horse">` block,
  an editor, compiled-JS view, and a flat lists of utterances/signals. The
  debugger is the NEXT panel on top of the SAME onSignal stream.

## What was built (session 2)
1. `src/debugger.js` — ES module, DOM-lite. Consumes `onSignal(name, answer)`
   events; renders a waterfall: each emission = a frame labelled with locus
   (line, band/cue) and the answer it got. Frame tree is pure:
   `render(trace, opts)` -> vnode; the page turns it into real DOM.
2. Ears/head semantics drive the render:
   - forward/relaxed = full detail (sharp frames, in order)
   - flat (`_ ears back _`) = dim/blur/retreat (not attending) — the trace
     retreats because the horse is not attending (EAD103, EquiFACS)
   - head high = frames float, head low = frames sink (signed bend, CSS
     var `--bend`); head is a literal channel value
   - divided (`^ ears divided _`) = split fork: left eye / right eye, the
     answer goes to the attending side, the guarded silence to the other;
     the provenance `side` says which eye asked
3. `playground.html` wired: new `#trace` panel + ears/head selects + posture
   legend; `postureOf()` reads the literal channel truth from the runtime's
   `{ ears, states }` (the runtime's `p.ears` reduces
   `_ ears back _` to `agonistic`, so ears come from the states — a real bug
   the debugger found). Anchor-vs-utterance tracking hands `accept()` the
   exact posture in force when a signal fired.
4. `test/debugger.test.js` — 18 tests in `npm test`.
5. `examples/trace.horse` (+ "the trace" sample in samples.js) — one paddock
   walking all four states; compiles and runs clean.
6. GRAMMAR.md §12n, README "Not built yet" entry.

## Bugs found and fixed along the way
- **emit.js: context + lead mare threw "undefined is not a cue"** — the
  context's `try` swallowed the lead declarations into a nested scope; the
  lead call then ran against an unassigned hoisted `let`. Fixed by emitting
  the remainder with `statementList()` (no inner hoist) and the lead call
  inside the same try, and suppressing the group's duplicate lead call.
  Regression test in `test/emit.test.js`.
- **`p.ears` is a reduction, not the truth** — `_ ears back _` reports
  `p.ears === "agonistic"` while the channel state is `{state:"back"}`; the
  debugger must read ears from the states. The trace's whole point is the
  literal channel state the horse struck.
- **Anchor chords** — after most utterances the runtime emits a default
  ears-forward chord, so `onChord` fires twice per utterance; `accept()`
  must receive the *struck* posture, not the anchor that follows.
- **npm test omitted debugger.test.js** — the script listed 11 suites,
  missing debugger (18 tests). Fixed by adding both debugger and the new
  horse suite to `npm test` in package.json (session 3).

## What was built (session 3) — the drawn horse
1. `src/horse.js` — DOM-lite, ES module. Pure posture descriptor
   (`postureState`) + SVG vnode renderer (`renderHorse`) + live stream
   (`HorseView`).
2. Every posture mapping traced to the bibliography:
   - ears: EAD101 forward / EAD103 flattening (EquiFACS, Wathan et al.
     2015); aimed independently, 180deg on ten muscles (Wathan & McComb
     2014). Drawn: ear groups rotate at poll; agonistic rotates back
     +74/+68deg, dims the whole body (opacity 0.42, scale 0.88, retreat +18).
   - divided: EAD103L/EAD103R independent; one ear forward (-32deg), one
     back (+62deg); two eyes split — the left eye feeds the right hemisphere
     (novelty/threat), the right feeds the left (categorisation), GRAMMAR.md
     §12g.
   - head: signed fraction (§4); rise = translateY, rearing > 0.55 rotates
     whole body around hind foot + lifts forehand; sunk > 0.3 drops head +
     rotates nose down.
   - nostrils: flare is arousal/agonistic (ethogram, Lewis et al. 2025);
     nostril ellipses dilate.
   - lids: droop = relaxed/dozing (EquiFACS eyelid AUs); lid line drops
     over eye.
   - tail: carriage raised = arousal, lashing = agitation (ethogram;
     weather/flies, BIBLIOGRAPHY.md); height rotates tail, lash waves it.
   - tension: reinforcement spine (Applied Animal Behaviour Science 2025,
     cited in runtime.js); tightens neck, darkens body.
   - signal pulse: on landing, transient nostril flare + ear flick.
3. `test/horse.test.js` — 23 tests: posture descriptor assertions (pure),
   vnode tree assertions (DOM-lite), HorseView stream assertions.
4. `playground.html` wired: `#horse-panel` beside the trace; `svgel()` SVG
   builder; `drawHorse()` + `poseline()` + horse note with full citations.
   Same stream as trace: `onChord` feeds `horseView.chord(p)` (non-anchor),
   `onSignal` feeds `horseView.signal(name, answer)` (visible attend pulse).
   Seeds a resting horse on page load ("a horse is a horse before it says
   anything").
5. `examples/moods.horse` + "the moods" sample in samples.js — seven states
   walked, each citing its bibliography entry.
6. GRAMMAR.md §12n.1 — the drawn horse gallery with citation table and
   5 mood renders (docs/horse/).
7. README updated: drawn horse as built (was in "not built yet").
8. `docs/horse/` — 5 mood webp captures: contented, agonistic, divided,
   rearing, sunken. `docs/trace/` — 4 webp captures re-shot with fork
   class fix.

## Bugs found and fixed (session 3)
- **playground `el()` fork class missing** — `render()` returns fork nodes
  as `{ cls: "fork", children }` but `el()` only read `attrs.cls`. The fork
  rendered structurally (children visible) but without the `.fork` class,
  so `querySelectorAll('.fork')` returned 0 and CSS couldn't target it.
  Fixed: `el()` now also reads top-level `node.cls` when `attrs.cls` is
  absent.
- **npm test script omitted debugger.test.js** (session 2 gap): the script
  listed 11 suites; debugger (18 tests) was not included, so `npm test`
  never ran them. Added debugger + horse suites to the script.
- **trace.horse non-ASCII `—` in comments** (moods.horse, session 3):
  browser.test.js compiles every .horse file; the lexer rejects non-ASCII
  `—` in comments. Fixed: rewrote to ASCII hyphens.
- **tail SVG path invalid** — `tailPath()` replaced the whole base path
  string with a `C`-only fragment when `tailLash` was set, producing an SVG
  error (`Expected moveto` — no leading `M`). Fixed: both branches start
  with `M 352 208`.

## Status (session 3)
- [x] src/horse.js (postureState, renderHorse, HorseView)
- [x] every posture mapping cited to bibliography
- [x] playground.html panel (horse + trace + live stream)
- [x] el() fork class bug fixed
- [x] test/horse.test.js (23 tests)
- [x] npm test wired: debugger + horse suites now run
- [x] npm test + npm run check green (13 suites, 382 tests)
- [x] examples/moods.horse + samples.js "the moods"
- [x] GRAMMAR.md §12n.1 + README updated
- [x] docs/horse/ + docs/trace/ webp gallery (9 screenshots)
- [x] browser verification (contented, agonistic, divided, rearing, sunken, tense)
- [ ] committed on debugger and PUSHED
- [ ] PR debugger -> main on pgrandin/HORSEtxt

## Verified end-to-end (session 3)
- All 15 samples compile via `npm run check`; "the moods" runs through
  all 7 postures: contented, agonistic (not-attending silence), divided,
  head-high, head-low, flared-nostrils, tense+tail-raised.
- Playground live: contented horse on first paint; sample "agonistic ears"
  → horse dims/retreats; sample "the trace" → divided horse + trace fork
  (left eye / right eye); head-high sample → rears.
- Horse panel aria-label reads `the horse: ears X, head Y` for each state.
- Horse view feeds from the same onChord/onSignal stream as the trace;
  signal landing shows transient attendPulse (visible nostril flare).
- Geometry checks confirm all elements land inside viewBox: eyes in face
  region, ears above eyes, legs at ground, tail right of body; agonistic
  retreat/rotate/retreat verified; head rise/sink values correct.