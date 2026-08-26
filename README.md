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

**The compiler works. The delivery model does not exist yet.**

HORSEtxt compiles and runs under Node, through the CLI. But the whole architecture was
chosen so that a visitor who opens View Source reads HORSEtxt — delivered inline as
`<script type="text/horse">`, compiled in the page. **There is no browser loader.** Until
there is, the language works and the reason for its design does not.

Also missing from v0.1: `//# sourceURL` (so stack traces land on `.horse` lines rather
than on generated code), a REPL, and a browser host — which means `stand` compiles but
cannot hold, since it needs pointer events.

Built: lexer, parser, resolver, emitter, runtime, and a CLI.

```
npm test      # lexer, parser, resolver, emitter
npm run check # resolve every example
```

```
horsetxt check <file...>   report errors, print nothing on success
horsetxt emit <file>       print the JavaScript
horsetxt tokens <file>     print the token stream
```

The CLI's job is **validation, not deployment**. Nothing it emits is meant to be
committed or served — the compiler runs in the page, and `.horse` source is delivered
inline so that View Source shows HORSEtxt. This exists so a syntax error cannot ship.

The grammar is in `GRAMMAR.md`, with every gap the implementation found recorded in
§12a–§12d. Worked programs are in `examples/`.

Not yet built: blind spots and the monocular field, the point of balance, `flehmen` as
required routing, phase-vector gaits, trials-to-criterion training, late-release
degradation, and welfare as a capability gate. See §5 of the language design.

## What it is

HORSEtxt is not a JavaScript library with horse-themed names. It is a language whose
semantics are taken from published equine ethology, and whose difficulty is deliberate.

Three properties distinguish it:

**Meaning is contextual.** A signal has no fixed sense. `snort` names an event and hands
it to the nearest enclosing context, which decides what it means — alarm inside a
`spook`, contentment inside `graze`. This is algebraic effects, and it is how the animal
works: the production context constrains the meaning, and the signal itself is
underdetermined.

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

## Design documents

Design lives with its first consumer, in `explainednothing/planning/`:

- `horsetxt-research.md` — the ethology, sourced. The authority for every semantic claim.
- `horsetxt-requirements.md` — what a real site needs a scripting language to do.
- `horsetxt-language.md` — the language design and every decision with its reasoning.

## Licence

Undecided.
