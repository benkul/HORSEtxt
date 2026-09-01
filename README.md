# HORSEtxt

A general-purpose language for horses. Compiles to JavaScript. Runs in the page.

```
@ flore  13  right eye blind  left bias

band gallery
    forage deck of 1 through 438 regrows

    lead mare draw
        ^ ears forward   head ~0.2 ^
        release deck.graze

    cue shelter
        when weather.flies > 0.7
            release hands.document.body
        balk
```

## Status

**v0.1 runs, in the page.** Lexer, parser, resolver, emitter, runtime, browser loader,
host, CLI, and a playground.

```
npm test      # lexer, parser, resolver, emitter, loader
npm run check # resolve every example
npm run serve # serve the playground — see below
```

```
horsetxt check <file...>   report errors, print nothing on success
horsetxt emit <file>       print the JavaScript
horsetxt tokens <file>     print the token stream
```

The CLI's job is **validation, not deployment**. Nothing it emits is meant to be
committed or served — the compiler runs in the page, and `.horse` source is delivered
inline so that View Source shows HORSEtxt. This exists so a syntax error cannot ship.

### In the page

```html
<script type="text/horse">
band gallery
    lead mare draw
        ^ ears forward   head ~0.2 ^
        release
</script>
<script type="module" src="src/browser.js"></script>
```

The loader finds every `text/horse` block, compiles it, and runs it. A block that fails
to compile does not stop the ones after it. A block with no `lead mare` declares
everything and runs nothing — real, readable, correct, and dead.

The host writes the posture onto `<html>` as `data-ears`, `data-tension` and so on, so a
page can style itself from what its program is doing. It also supplies the pointer that
`stand` holds still against.

## The playground

`playground.html` is the language running in a real page. It carries a live
`<script type="text/horse">` block, an editor with worked samples, the JavaScript each
one compiles to, and a report of every utterance and signal in the order they happened.

**It must be served over HTTP, not opened from disk.** The page loads the compiler as an
ES module, and module imports from a `file://` URL are blocked by CORS in every browser —
you get an opaque loading error rather than anything useful.

```
npm run serve
# then open http://localhost:8777/playground.html
```

That runs `python3 -m http.server 8777` from the project root. Any static server on any
port works just as well — `npx serve`, `php -S localhost:8777`, whatever is to hand.

Four things on the page are worth looking at directly:

- **posture** — read from `<html>`'s data attributes, written by the host from the chord
  in the live block above it. An agonistic chord turns the line red, which is CSS
  reacting to what the program said.
- **its own source** — the live block's text, read back out of the DOM. Because
  `.horse` blocks are inert data, a page can display, quote, misquote, or withhold the
  program that runs it.
- **the `agonistic ears` sample** — the clearest demonstration of contextual dispatch.
  Both ears flattened means the animal is not attending, so the `snort` goes unanswered
  and the handler never fires. The report distinguishes `unanswered (not attending)` from
  `unanswered (nobody there)`: two silences that mean different things.
- **View Source** — the point of the whole architecture. The `.horse` block is there as
  source, and there is no compiled JavaScript anywhere in the page.

## Not built yet

`//# sourceURL` names the compiled script for devtools, but the line numbers are the
generated ones — HORSEtxt lines travel with the provenance the runtime carries on every
emission, not with a source map.

Beyond that, the parts of the design still ahead of the implementation:

- **A real debugger.** `src/debugger.js` renders the horse's true state — every
  emission as a frame, labelled with its locus and the answer it got — and the
  ears/head states change what you see (see `test/debugger.test.js`,
  `examples/trace.horse`, and GRAMMAR.md §12n). The trace is live in the playground;
  what is not built yet is the standalone debugger panel with stepping.
- **History as semantics.** Trials-to-criterion training, so a newly defined cue is not
  reliable until it has been run. Late-release degradation toward learned helplessness.
  Welfare as a capability gate.
- **The approach model**, whole: flight zone, pressure zone and the point of balance are
  one system for moving an animal that would rather you did not, and the size of a flight
  zone is set by handling history. Only the point of balance exists today; the other two
  wait for the individual to have a history to be sized by.
- `hears creak as v` — a handler can see that a signal arrived but not what it carried.

The grammar is in `GRAMMAR.md`, with every gap the implementation found recorded in
§12a–§12e. Worked programs are in `examples/`.

## What it is

HORSEtxt is not a JavaScript library with horse-themed names. It is a language whose
semantics are taken from published equine ethology, and whose difficulty is deliberate.

Three properties distinguish it:

**Meaning is contextual.** A signal has no fixed sense. `snort` names an event and hands
it to the nearest enclosing context, which decides what it means — alarm inside a
`spook`, contentment inside `graze`. This is algebraic effects, and it is how the animal
works: the production context constrains the meaning, and the signal itself is
underdetermined.

**Which eye you look with changes the question.** The left eye feeds the right
hemisphere — novelty, threat, escape — and the right feeds the left, which categorises.
So `flehmen x from the left` asks whether this is new and answers with a truth, while
`from the right` asks what kind of thing it is and answers with a category. An animal
whose ears are flattened is not attending and cannot look at all, and a cue cannot
inspect what it was handed, because a horse cannot see its own muzzle.

**A line is a chord.** Real signalling is ears *and* head height *and* nostrils *and*
tension, simultaneously, and the combination is the utterance. A chord opens and closes
with an ear — `^ … ^` — and the orientation of each ear is meaningful, because horses aim
their ears independently and one forward with one back is divided attention.

**Code does not transfer between individuals.** Meaning is a property of an animal in a
relationship, not of text. A chord lifted from another program is a different animal
signalling into a different history, so it means something else. Training does not come
with the source. **You cannot learn HORSEtxt by copying**, and the answer that worked for
someone else's horse is wrong for yours.

A package, therefore, is a *training program* rather than trained code. You install a
protocol and run it on your animal, over trials, before it does anything. Mejdell's
ten-step program worked on 23 of 23 horses; the trained horse transferred to none of
them.

## Documentation

There isn't any, by design. **The manual is the bibliography** — see `BIBLIOGRAPHY.md`.
Error messages are citations, not explanations:

```
EAD103 in an affiliative context.
  Lewis et al. 2025, PeerJ 19309 — table 3.
```

Every confounding behaviour in this language is derivable from published horse behaviour.
Nothing is arbitrary. If a rule cannot be traced to a citation, it is a bug.

## Where the reasoning lives

- `BIBLIOGRAPHY.md` — the manual. Every construct, and the paper it comes from.
- `GRAMMAR.md` §12a–§12e — every gap the implementation found, in the order it found
  them, with what changed and why. Read as a record of a design meeting reality.
- `STDLIB.md` — what the small standard library holds, and what it deliberately omits.

## Licence

Undecided.
