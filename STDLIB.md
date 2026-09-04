# HORSEtxt — Standard Library

Bare section references below are to `GRAMMAR.md`.

**It is small on purpose.** `hands` is the escape hatch for everything that is not
horse, and per principle zero — where there is no honest equine analogue, HORSEtxt stays
plain — a broad standard library would mean inventing horse semantics for string
formatting and integer division. Nothing here exists unless a real program needed it.

Rule for growth: **a member is added when a second program needs it, not the first.** One
program needing something is an argument for `hands`.

---

## Collections

A list (`[ … ]`) is a plain sequence and **has no members of its own**. Indexing is
`list[n]`, zero-based; traversal is `graze` (§6.1); everything else reaches JavaScript
through the flat boundary, so `xs.length` and `xs.slice 1` are how you ask.

That is the difference between a list and the two structures below it. A `forage` and a
`pile` are the language's own, so they answer in its vocabulary. A list is a value, and
§11 makes the boundary onto values flat on purpose.

There is no `map`, `filter`, or `reduce`. **Filtering a graze is a `when` around the
work** — not a `blank`, which leaves the cue rather than the iteration (§10). Selective
grazing is the animal moving on, rather than issuing a statement about moving on.

## Forage

`forage` (§6.2) responds to:

| Member | Yields | Notes |
|---|---|---|
| `graze` | one item, depleted | balks when exhausted unless declared `regrows` |
| `count` | items remaining | not the original size |
| `empty` | truth | |

Forage is not a list. It cannot be indexed, and it has no `first` or `last` — **the order
is drawn, not chosen**, and exposing a position would make the draw reproducible. That is
enforced by the type rather than asked for politely: a shuffle nobody can index is a
shuffle nobody can seed.

## Piles

A `pile` (§11) responds to:

| Member | Yields | Notes |
|---|---|---|
| `count` | marks left | |
| `empty` | truth | |
| `graze` | the most recent mark, without removing it | reads; a pile is append-only |
| `marks` | every mark, oldest first | a copy, and indexable |

Writing is `pile-name becomes value`, which **appends**. There is no delete.

**A pile is ordered and may be read by position**, which forage may not. The difference is
where the order comes from: a pile's order is the order things happened, so reading a trail
off it is the whole point, while forage's order is *drawn* and exposing a position would
make the draw reproducible. `trail.marks[0]` is the oldest mark;
`trail.marks[trail.count - 1]` is the newest, and so is `trail.graze`.

`graze trail as mark` walks every mark, oldest first.

A pile survives sessions, which is how training persists, and it must read correctly when
nothing is stored — private-mode storage failure is expected, not exceptional.

## Affect

`~a:~v` responds to `arousal` and `valence` (§9). Nothing else.

Arithmetic is the rules in §9: two affects combine component-wise and stay a pair, a
scalar reaches arousal and leaves valence alone, and a comparison reads arousal.
Collapsing to one scalar — joining an affect to text, or handing it to JavaScript
arithmetic — is a type error.

## Numbers, text, truth

Plain. Arithmetic is arithmetic; `+ - * / %`, compared with `> < >= <= = !=`, and nothing
more. `%` binds with `*` and `/`. Text has no members — formatting, splitting, casing,
and matching all go through `hands`.

**A method used as a value is reported.** `count.at - 1`, `count.at > 10` and
`"n: " + count.at` all take hold of the method and use it instead of asking it for
anything — the §11a fault in value position. The first is nothing, the second is false
however many there are, and the third puts JavaScript source into whatever the page
displays. All three say so at runtime. `=` and `!=` are the exception: two names may
hold the same cue, and asking whether they do is a real question.

`bare` is nothing being there. **It is not zero** — zero is a quantity, and `when 0` is
true. `when` is false for exactly `false` and for bare (`null`, `undefined`, `NaN`).
GRAMMAR.md §8a has the reasoning; the short version is that a horse at a full haynet that
has eaten nothing is not a horse standing where there is no haynet.

`grass in [a b c]` is the first patch with anything in it — the default form. **`or` is
not a default**: it joins answers and gives an answer back, so `given or 7` is `true`,
never `7`.

```
remember name as grass in [stored "unnamed"]
```

`duration` (`10s`, `900ms`) and `distance` (`20px`, `50%`) are distinct primitive types,
not numbers with suffixes. They do not mix with each other or with bare numbers, and
`stand 10s within 20px` type-checks because the two positions want different types.

**No arithmetic produces either one.** A sum where a duration or distance belongs is a
compile error, and a bare number in that position is refused at runtime as well — so
`every 5` and `every (2 + 3)` are both refused rather than one of them meaning five
milliseconds.

## Reaching into JavaScript

`hands` is the boundary, and it is loud on purpose (GRAMMAR.md §11a).

**A member path alone on a line is an error.** `channel.play` reads the method and throws
it away; `(channel.play)` calls it. Zero-argument calls need the parens — that is the one
that catches everybody.

**A path that keeps coming back bare is reported.** Three unanswered crossings in a row at
one path and the boundary says so, once, and then habituates. An answer resets the count,
and `0`, `""` and `[]` are answers — §8a decides what nothing is, and the boundary agrees
with it. A note at runtime rather than a compile error: a lookup that misses is ordinary,
and a lookup that never lands is a question nobody is answering.

**Cues are callbacks, not functions.** Handing a cue to `addEventListener` is right and
idiomatic. Handing one to `sort`, `filter`, `map`, `reduce`, `find`, `some`, `every` or
`flatMap` is refused, because a cue is async and those coerce what they get back: a
promise is truthy, so nothing would be filtered and nothing sorted, silently.

That is a fact about the *boundary*, not a claim that cues are second-class inside the
language. A cue held under another name is the same cue and calls fine — `remember f as
draw`, then `(f)` — which is how a dispatch table is written (§3).

If you need something sorted, do the work in HORSEtxt and hand JavaScript the result — or
better, ask whether it is a sort at all. Separating into two groups is a thing horses do;
ranking a list is not.

**No object literals.** `f({pan: -1})` is unwritable; build it in two lines.

```
remember opts as hands.JSON.parse "{}"
opts.pan becomes (0 - 1)
```

## What is deliberately absent

No modules beyond `band`/`herd`/`bachelor`. No string library. No math library beyond the
operators. No date or time library — `duration` is a type, not a clock, and clocks come
from `hands`. No JSON. No regular expressions. No I/O other than signals (§8) and
`pile`.

If that feels thin: it is. The language's weight is in `GRAMMAR.md` §4 (chords) and §8
(contexts and signals), and in the mechanisms that make it foreign — laterality, blind
spots, habituation, refusal, training. Not in the library. A horse does not have a
standard library.
