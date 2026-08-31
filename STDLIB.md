# HORSEtxt — Standard Library

Closes gap 17 in `GRAMMAR.md` §13. Bare section references below are to `GRAMMAR.md`.

**It is small on purpose.** `hands` is the escape hatch for everything that is not
horse, and per principle zero — where there is no honest equine analogue, HORSEtxt stays
plain — a broad standard library would mean inventing horse semantics for string
formatting and integer division. Nothing here exists unless a real program needed it.

Rule for growth: **a member is added when a second program needs it, not the first.** One
program needing something is an argument for `hands`.

---

## Collections

A list (`[ … ]`) responds to:

| Member | Yields | Notes |
|---|---|---|
| `count` | number of items | |
| `empty` | truth | `when deck empty` reads as prose because `empty` is a member, not a keyword |
| `first` | first item | balks on an empty list |
| `last` | last item | balks on an empty list |

Indexing is `list[n]`, zero-based.

There is no `map`, `filter`, or `reduce`. Traversal is `graze` (§6.1) and filtering is a
`blank` in the graze body, because horses are selective grazers. Anything beyond that goes
through `hands`.

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

`~a:~v` responds to `arousal` and `valence` (§9). Nothing else. Every other operation is
the arithmetic rules in §9, and collapsing to one scalar is a type error.

## Numbers, text, truth

Plain. Arithmetic is arithmetic; `+ - * / > < >= <= = !=` and nothing more. Text has no
members — formatting, splitting, casing, and matching all go through `hands`.

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

## Reaching into JavaScript

`hands` is the boundary, and it is loud on purpose (GRAMMAR.md §11a).

**A member path alone on a line is an error.** `channel.play` reads the method and throws
it away; `(channel.play)` calls it. Zero-argument calls need the parens — that is the one
that catches everybody.

**Cues are callbacks, not functions.** Handing a cue to `addEventListener` is right and
idiomatic. Handing one to `sort`, `filter`, `map`, `reduce`, `find`, `some`, `every` or
`flatMap` is refused, because a cue is async and those coerce what they get back: a
promise is truthy, so nothing would be filtered and nothing sorted, silently.

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
