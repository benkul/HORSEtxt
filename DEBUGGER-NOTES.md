# HorseText Debugger — working notes

Date: 2026-09-01. Sessions 1-2.

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
3. `playground.html` wired: new `#trace` panel + ears/head selects +
   posture legend; `postureOf()` reads the literal channel truth from the
   runtime's `{ ears, states }` (the runtime's `p.ears` reduces
   `_ears back_` to `agonistic`, so ears come from the states — a real bug
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

## Status

- [x] src/debugger.js (trace renderer, ears/head, fork)
- [x] ears/head effect on the render
- [x] playground.html panel
- [x] tests (18 debugger + 1 emit regression)
- [x] examples (trace.horse + sample)
- [x] docs (GRAMMAR §12n, README)
- [x] npm test + npm run check green (11 suites)
- [ ] browser verification (no Chrome in cron env — served, HTTP 200,
      DOM-lite renderer verified in Node instead)
- [ ] PR debugger -> main on pgrandin/HORSEtxt