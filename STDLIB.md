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
| `count` | entries | |
| `empty` | truth | |
| `graze` | one entry, without removing it | reads; a pile is append-only |

Writing is `pile-name becomes value`, which appends. There is no delete. A pile survives
sessions, which is how training persists, and it must read correctly when nothing is
stored — private-mode storage failure is expected, not exceptional.

## Affect

`~a:~v` responds to `arousal` and `valence` (§9). Nothing else. Every other operation is
the arithmetic rules in §9, and collapsing to one scalar is a type error.

## Numbers, text, truth

Plain. Arithmetic is arithmetic; `+ - * / > < >= <= = !=` and nothing more. Text has no
members — formatting, splitting, casing, and matching all go through `hands`.

`duration` (`10s`, `900ms`) and `distance` (`20px`, `50%`) are distinct primitive types,
not numbers with suffixes. They do not mix with each other or with bare numbers, and
`stand 10s within 20px` type-checks because the two positions want different types.

## What is deliberately absent

No modules beyond `band`/`herd`/`bachelor`. No string library. No math library beyond the
operators. No date or time library — `duration` is a type, not a clock, and clocks come
from `hands`. No JSON. No regular expressions. No I/O other than signals (§8) and
`pile`.

If that feels thin: it is. The language's weight is in `GRAMMAR.md` §4 (chords) and §8
(contexts and signals), and in the mechanisms that make it foreign — laterality, blind
spots, habituation, refusal, training. Not in the library. A horse does not have a
standard library.
