# HORSEtxt — Grammar

Version 0.1, draft 7. Each draft closed gaps the previous one could not see; §12a–§12e
record what was found and how, in the order it happened.

Register: **prose for keywords, terse for expressions.** Indentation-delimited blocks.
Lowercase. Minimal punctuation. ASCII only — see §1.1.

---

## 0. Principle zero

**Where there is no honest equine analogue, HORSEtxt stays plain.**

Horses have nothing to say about DOM selection, string formatting, or integer division.
Inventing correspondences for those is the failure mode this language is most exposed to:
the moment one token is invented for convenience, every real token loses its credibility.

So the mapping is selective and defensible. Behaviour, execution, scope, failure,
persistence and I/O map onto real ethology because real ethology genuinely covers them —
each carries its citation in `BIBLIOGRAPHY.md`. Arithmetic does not map, and stays
arithmetic. Everything unmapped looks like a normal language, and that contrast is what
makes the mapped parts land.

The stricter form of the same rule governs anything deliberately confounding:
**every confounding behaviour must be derivable from published horse behaviour.** If a
rule cannot be traced to a citation, it is not foreign. It is just bad.

A consequence worth stating, because it is easy to reach for by reflex: **the tooling does
not explain.** Errors cite. There is no resolver that hands you the meaning of a token in
context — that would convert foreign into annotated, and the difficulty is the point.

---

## 1. Lexical

### 1.1 Character set

**ASCII only, no exceptions.** Plenty of pages in the wild declare no charset at all, and
a non-ASCII mark in one of those is a program that stops parsing for reasons nowhere near
where it broke. The usual escape hatch does not apply either: **HTML entities are not
decoded inside `<script>` elements**, so `&#94;` would stay literal and the language
cannot spell its own syntax that way.

Every mark must therefore be one ASCII character reachable in one keystroke. That rules
out the genuinely exotic options, and it is the right kind of hostile: foreign to read,
not impossible to type.

### 1.2 Marks

| Mark | Role |
|---|---|
| `^` | erect ear — opens or closes a chord |
| `_` | flattened ear — opens or closes a chord |
| `~` | graded value |
| `@` | declared individual |
| `:` | affect pair separator (arousal : valence) |
| `#` | comment to end of line |

`:` does **not** introduce blocks. Indentation alone delimits them, which keeps `:` free
for the affect pair.

### 1.3 Tokens

```
comment      = "#" , { any - newline } ;
newline      = "\n" ;
indent       = (* emitted when leading whitespace increases *) ;
dedent       = (* emitted when leading whitespace decreases *) ;

ident        = lower , { lower | digit | "_" | "-" } ;
member       = ( lower | upper ) , { lower | upper | digit | "_" | "-" } ;
lower        = "a".."z" ;
upper        = "A".."Z" ;
facs         = ( "AU" | "AUH" | "EAD" | "AD" ) , digit , { digit } , [ "L" | "R" ] ;

number       = digit , { digit } , [ "." , digit , { digit } ] ;
duration     = number , ( "ms" | "s" | "m" | "h" ) ;
distance     = number , ( "px" | "%" ) ;
string       = '"' , { any - '"' } , '"' ;      (* no escapes, no interpolation *)

tilde        = "~" ;
graded       = tilde , graded_operand ;
graded_operand = [ "-" ] , number | postfix | "(" , expression , ")" ;
affect       = graded , ":" , graded ;
```

**`~` marks any operand as graded, not only a literal.** `~0.3`, `~-0.2`, `~held`,
`~(a + b)` are all graded. Restricting it to numbers made the chord that motivated
`stand … as held` inexpressible — `tension ~held` is the whole point of binding a
progress value.

**Member names may contain uppercase; standalone identifiers may not.** A `.` is followed
by a `member`, everywhere else it is an `ident`. Uppercase stays reserved for EquiFACS in
every position a FACS code can actually appear, and EquiFACS codes never appear in member
position — so there is no collision, and `hands.document.createElement` works. Without
this the escape hatch could not reach JavaScript at all, since every DOM name is camelCase.

`facs` is a distinguished lexical class, not an identifier: `AU101`, `AUH13`, `EAD103L`,
`AD38`. Uppercase is reserved for it, so user identifiers are lowercase-only. EquiFACS
codes are already valid JavaScript identifiers, which is why they are usable verbatim.

Hyphens are legal inside identifiers. Subtraction therefore **requires surrounding
whitespace**: `a - b` subtracts, `a-b` is one name.

### 1.4 Layout suppression

`newline`, `indent`, and `dedent` are **suppressed** inside:

- a chord, between its opening and closing ear
- a bracketed list `[ … ]`
- a parenthesised group `( … )`

So a chord and a list literal may both span lines freely. Everywhere else a newline ends
a statement and indentation delimits a block.

### 1.5 Keywords

Reserved, and there are more of them than in most languages because keywords carry the
foreignness:

```
@ genotype band herd bachelor bachelors context cue release lead mare
walk trot pace canter gallop tolt halt stand back
graze forage regrows recognise weather cold wet wind sun flies hands
and or not
spook flood habituates shy balk leave blank
remember becomes pile when otherwise through empty
whinny nicker squeal snort flehmen
sentinel rotates rest recumbent watch hears
from the left right behind front on every within as at of
```

`tolt` is spelled without the diaeresis. `tölt` would be non-ASCII (§1.1). `recognise` is
spelled with an `s`.

---

## 2. Program

```
program      = [ individual ] , [ genotype ] , { declaration } ;

individual   = "@" , ident , { trait } , newline ;
trait        = number                      (* age in years *)
             | ( "left" | "right" ) , "bias"
             | ( "left" | "right" ) , "eye" , "blind"
             | ident ;                     (* handling history tag *)

genotype     = "genotype" , allele , [ ident ] , newline ;
allele       = "CA" | "AA" | "CC" ;
```

**At most one `@` per program, at the top.** Its presence is the switch: with no declared
individual, training, welfare, and degradation do not exist and calls are unconditioned
and deterministic. With one, every call it makes is conditioned by that animal,
involuntarily. Optional at the boundary, involuntary within.

`genotype` is optional and defaults to `CA` — four-gaited: `walk`, `trot`, `canter`,
`gallop`. Declare `AA` for `pace`; `tolt` additionally requires the breed tag `icelandic`.
Reaching an unavailable gait is a compile error. Most programs never declare a genotype,
so the gate is a cost only where a gated gait is actually used.

```
declaration  = band | herd | bachelor | context | cue | binding | pile | forage ;

band         = "band" , ident , newline , block ;
herd         = "herd" , ident , newline , block ;
bachelor     = ( "bachelor" | "bachelors" ) , ident , newline , block ;

block        = indent , { statement } , dedent ;
```

A `band` warns above natural band size — one stallion, two to four mares, offspring — as
a cohesion lint. See §2.4 for what to do about it.

## 2.4 Herds, and crossing between bands

```
mingles      = "mingles" , "with" , ident , newline ;
```

**A herd is a real level of organisation.** Horses live in a multilevel society: a drone
survey of over a hundred feral horses found association rates that are *bimodal* — units
(individuals staying within 15.5m of each other more than 70% of the time) nested inside a
herd, with inter-unit distances significantly closer than chance. Behaviour synchronises
not only within a unit but *between* units, and horses track the behaviour of individuals
spatially far from them.

**Boundaries are held by default, and particular pairs cross anyway.** Units become more
circular and cohesive as another unit approaches, and elongate their shape to avoid
crossing — while specific pairs of units cross and intermix regularly.

So visibility inside a herd is **pairwise and declared**, not hierarchical:

```
herd site
    band gallery
        mingles with listening
        forage deck of 1 through 438 regrows
        cue draw ...

    band listening
        mingles with gallery
        lead mare enter
            release (draw)          # visible: both bands named the other

    bachelors probes
        lead mare check
            release (draw)          # visible: the periphery sees in
```

- **Both sides must declare it.** A crossing is mutual, and one band's edit should not
  silently widen another band's scope. Naming one side alone shares nothing and says
  which side is missing.
- **A herd holds bands and nothing else.** Crossing is only possible inside one; across
  herds there is nothing, because separate groups avoid getting close to one another.
- **Names are distinct across a herd.** Two bands are two sets of individuals, not two
  namespaces.

**A `bachelor` group stands on the periphery.** All-male units occupy the edge of a herd
while large mixed-sex units hold the centre, and inter-unit coordination reaches the edge.
So a bachelor group sees every band in its herd without declaring anything, and no band
sees it — which is what a test group wants, and is the first mechanism behind a claim
`bachelor` has carried since draft 1.

**This is also the remedy for the band-size lint.** Before, the lint said split and the
language gave no way to split without duplicating, because bands could not see each other
at all.

A name that exists in the herd but was not shared reports *that*, rather than reading as
a misspelling.

---

## 3. Cues

```
cue          = [ "lead" , "mare" ] , "cue" , ident , { ident } , newline , block ;
release      = "release" , [ expression ] , newline ;
call         = postfix , argument , { argument } , [ lateral_mod ] ;
argument     = postfix ;
```

`lead mare` marks the entry point — an older mare with knowledge of the home range, not
the stallion.

**Arguments are positional and bare**, whitespace-separated: `develop image`,
`play track side`. There are no named arguments and no trailing modifiers — neither has an
equine analogue, so per principle zero the calling convention stays plain. Clarity lives
at the definition site, in the parameter names.

**A `call` requires at least one argument.** Zero-argument application is only reachable
through parentheses, which is what keeps `draw` (the cue) distinct from `(draw)` (the
call). An `argument` is a `postfix`, so `develop target[1]` and `play tracks.graze` are
both legal.

**Application is left-associative and does not nest without parentheses.** `develop a b`
is `develop(a, b)`, never `develop(a(b))`. To nest, parenthesise: `develop (surface a)`.

**A cue that reaches its end without `release` is a compile error.** Falling off the end
is exactly the implicitness the language forbids elsewhere — `balk` must be stated and
`blank` must be stated, so an implicit terminal outcome cannot be allowed either. Every
path out of a cue names itself: `release`, `balk`, `leave`, or `blank`.

**A cue name in expression position is the cue itself.** No ceremony, no special form —
higher-order use has no equine analogue either. What constrains it is already in the
language: a cue is bound to its animal and its training does not transfer, so passing one
outside its band is meaningless rather than illegal.

That forces a distinction, and it is load-bearing:

| Form | Means |
|---|---|
| `draw` | the cue itself, passed |
| `(draw)` | call it with no arguments |
| `develop image` | call it with one argument |

So `fade-in draw` hands `fade-in` the *cue* `draw`; `fade-in (draw)` hands it the result.
A zero-argument call is the one place the language requires parentheses.

**The one-second contract.** A cue that has not released within its budget emits a
diagnostic, because late release punishes the correct response rather than merely being
slow. Default budget 1s; the documented expected latency for a deliberate choice is ~4s.
Under a declared individual, repeated late release degrades the binding toward learned
helplessness, which retrying cannot repair.

**Training.** Under a declared individual, a newly defined cue is not yet reliable. First
calls fail or partially succeed; reliability rises with repetition toward criterion, and
persists to the `pile` across sessions.

---

## 4. Chords

```
chord        = open_ear , { channel_state } , close_ear , [ lateral_mod ] ;
open_ear     = "^" | "_" ;
close_ear    = "^" | "_" ;
channel_state = channel , ( state | graded | affect )
             | facs ;

channel      = "ears" | "brow" | "lids" | "eyes" | "nostrils" | "lips" | "chin"
             | "jaw" | "mouth" | "tongue" | "head" | "neck" | "tail" | "tension"
             | "voice" ;
state        = ident ;
```

A chord may span multiple lines (§1.4); it ends at its closing ear. Channel states are
whitespace-separated and **simultaneous** — a chord is one utterance, not a sequence.

**Chords do not nest.** A chord inside a chord has no equine reading: an utterance is one
utterance. Illegal, which also keeps the lexer simple.

The ears are independently meaningful, because horses aim them independently and one
forward with one back is a readable state:

| Form | Reading |
|---|---|
| `^ … ^` | both forward — full attention. The default |
| `^ … _` | divided attention — attending here, guarding elsewhere |
| `_ … _` | agonistic. `EAD103` is the ear flattener |

A typo between `^` and `_` produces a valid chord with a different reading rather than an
error. This is intended and the compiler will not warn, because warning would explain.

Meaning within a chord is set by co-occurrence, not by order — identical base units mean
opposite things depending on what they connect to (805 documented combinations).
Reordering a chord's channel states does not change it. Adding one does.

---

## 5. Gaits

Gaits are named regions in a continuous limb-phase space, not discrete keywords. The
underlying construct is a phase vector; these are its anchors.

```
gait         = gait_head , [ "every" , expression ] , newline , block ;
gait_head    = "walk"
             | "trot"
             | "pace"
             | "canter" , [ "on" , "the" , side ]
             | "gallop"
             | "tolt"
             | "back" ;
side         = "left" | "right" ;
halt         = "halt" , newline ;
```

**A gait is a limb-phase vector.** Each limb has a point in the stride at which it
strikes; limbs sharing a phase strike together. The six names below are *anchors* in that
space, and the schedule is derived from the vector rather than written out per gait.

**Statements fill the stride in the order the beats happen**, not by limb. A two-beat
gait therefore runs two statements per beat, a canter runs one, then a pair, then one, and
written order is always preserved. Assigning statement 0 to the left hind was the obvious
reading and it was wrong: statements have an order, not a limb identity, so two statements
in a trot landed on a hind and a fore of the same side — which strike at different times —
and the canonical two-at-once gait ran them sequentially.

A consequence worth stating rather than leaving as a surprise: **a `trot` and a `pace`
schedule identically.** Both are two beats of two. Which limbs pair — diagonal against
lateral — is anatomy, and statements have no limbs. The vectors, tempo and genotype gate
still differ.

| Gait | Beats | LH | LF | RH | RF | Duty | Schedules as |
|---|---|---|---|---|---|---|---|
| `walk` | 4 | 0 | .25 | .50 | .75 | .60 | one at a time, evenly spaced |
| `tolt` | 4 | 0 | .25 | .50 | .75 | .70 | as the walk, but no suspension |
| `trot` | 2 | .50 | 0 | 0 | .50 | .40 | diagonal pairs: LF+RH, then RF+LH |
| `pace` | 2 | 0 | 0 | .50 | .50 | .40 | lateral pairs: the near side, then the off |
| `canter` | 3 | 0 | .25 | .25 | .50 | .35 | one, then a pair, then one |
| `gallop` | 4 | 0 | .40 | .20 | .60 | .30 | four separate beats |

`canter`'s beats are genuinely unevenly spaced — its suspension runs twice as long as the
intervals around it — so it is a different scheduler from `walk`, not a rename.

**`duty` is how long a hoof stays down**, and it is the entire difference between a walk
and a tolt: their phase vectors are identical. Above 0.25 in a four-beat gait at least one
hoof is always down, so a held tolt has no gap between strides.

**A gallop is not full fan-out.** Drafts 1–8 scheduled it as "everything at once", which
is not a gait — a moving horse never has four hooves down together. It is four separate
beats and then suspension. No gait runs four statements concurrently, and none should.

**Between two anchors is a gait.** Because the schedule comes from the vector,
interpolating gives real gaits rather than nonsense: halfway from a `walk` to a `pace` is
a **stepping pace** — slightly uneven, lateral, in a 1-2, 3-4 sequence — which falls out
of the arithmetic instead of having to be listed. The runtime exposes this as
`between(a, b, t)`; it has no surface syntax yet.

**A lead mirrors the vector** — the far side is the near side with its pairs swapped —
but it does **not** change the schedule. Mirroring permutes which limb strikes when, not
how many strike together, and statements have no limb to be led by. A lead is real
anatomy that a program cannot feel.

`canter`'s beats are genuinely unevenly spaced — its suspension runs twice as long as the
intervals around it — so it is a different scheduler from `walk`, not a rename.

**`every <duration>` belongs to every gait, not just `tolt`.** A gait is a stride
repeated — a horse does not walk one stride and stop — so any gait may be held. Without
`every` a gait runs its body once.

This was `tolt`-only in drafts 1–5, which made `tolt` the language's **only** unbounded
loop while also gating it behind an Icelandic genotype. Two of three example programs
were declaring a breed purely to obtain a timer. That is not a foreign constraint, it is
a missing feature with a joke in front of it, and it contradicted this section's own
claim that a gait is inherently iterative.

With `every` on all gaits, `tolt`'s distinction is the real one: **no suspension, so no
gap between strides.** Every other gait pauses between repetitions; a tolt does not,
because at least one hoof is always down.

Gaits iterate **strides**, not data. For iteration over a collection see §6.

---

## 6. Traversal

### 6.1 `graze` — iteration over a collection

Grazing is a horse's iteration: 16–18 hours a day moving through forage, taking each
mouthful, progressing rather than depleting one spot. It is the honest analogue and the
only one — gaits iterate strides.

```
graze        = "graze" , expression , [ "as" , ident ] , newline , block ;
```

```
graze targets as t
    develop t
```

Horses are **selective** grazers, so `graze` may skip: a `blank` in the body advances
without acting, and is the filter.

### 6.2 `forage` — draw without replacement

Grazed forage depletes and then regrows. That is a shuffle bag, and giving it its own
construct keeps the three kinds of randomness structurally distinct, as required.

```
forage       = "forage" , ident , "of" , expression , [ "regrows" ] , newline ;
```

```
forage deck of 1 through 438 regrows
```

`deck.graze` draws one and depletes it. Without `regrows`, exhausted forage is empty and
drawing from it balks. With `regrows`, it comes back.

Not `pasture`: a pasture is enclosed, managed, rotated land — a human's unit, and its own
self-description. Considered and rejected: `range`, which is the ethologically correct
spatial term (a band's home range, known best by the older mares) but names the *place*.
What depletes and returns is the forage in it, and this construct is depletion.

**Not seeded and not recorded.** The order is drawn, not chosen.

### 6.3 `recognise` — deterministic derivation

A horse recognises an individual from their whinny, consistently, for years — a
discrimination retained at six years, a categorisation at ten. Same input, same identity,
every time.

```
recognise    = "recognise" , expression ;
```

`recognise query` yields a stable value derived from its argument. The same query always
recognises the same thing. This is the deterministic flavour, and it is a different word
from the other two so it can never be silently substituted for them.

### 6.4 `weather` — the uncontrolled condition

```
weather      = "weather" , "." , condition ;
condition    = "cold" | "wet" | "wind" | "sun" | "flies" ;
```

Each condition is a graded value in 0..1, **read rather than generated**.

**Bare `weather` in a comparison is an error.** There is no scalar weather. A horse does
not respond to "bad weather" — it responds to being cold, or wet, or buffeted, or bitten.
Naming which is mandatory.

Not `chance`. Probability is a human abstraction and principle zero would have kept it
plain — but there is a real analogue, and it is well documented. Mejdell measured exactly
this: horses asked for a blanket in wet, windy, cold conditions and refused one in good
weather, tracking temperature, wind, and precipitation they could neither control nor
predict. **An uncontrolled exogenous input the animal reads and responds to is what a
random source is.**

#### The conditions, each on its own citation

Derivability does not mean one study. Mejdell is why weather is the random source; it does
not have to carry every axis.

| Condition | What it reads | Grounded in |
|---|---|---|
| `cold` | distance **below the lower critical temperature** — 0 inside the thermoneutral zone, rising as it falls below | TNZ is roughly 5–25°C for a natural winter coat; LCT ranges from +5°C in mild climates to −15°C in cold-adapted horses |
| `wet` | coat saturation | a wet coat loses **up to 90%** of its insulating capacity; rain flattens the hair and defeats the undercoat's trapped air |
| `wind` | air movement over the skin | wind strips the warm layer off the skin surface |
| `sun` | solar load | drives heat load, and drives `flies` |
| `flies` | insect pressure | the largest behavioural driver on the list — tail swishing, head shaking, leg lifting, skin twitching, stomping, bunching for mutual protection, and shelter used on **69%** of high-fly days against **14%** of low-fly days |

**Rejected: `balmy`.** It is a human comfort judgment, the outside view again — the same
error class as `pasture` and `handler`. And the numbers make it concrete rather than
pedantic: a balmy day to a person is 22–25°C, which sits at the *top* of a horse's
thermoneutral zone, and for an acclimatized winter-coated animal is active heat stress.
"Balmy" names a comfort state the horse may not be in. Its physiological equivalent is
distance from thermoneutral, which `cold` already is.

**Rejected: barometric pressure.** Widely claimed, weakly evidenced. Noted so the
constraint is visibly load-bearing.

`sun` survives on its own merits — solar load is real, and flies are active in sun and
avoid shade, so it is causally upstream of the most behaviourally significant axis.

#### The conditions are correlated, in documented directions

This is what makes `weather` genuinely not a random number generator. Independent uniforms
would be *less* faithful than a single scalar, just more verbose.

- **`cold` + `wet` + `wind` compound**, and worse than their sum. The literature is
  explicit that cold rain with wind is more demanding than low temperature alone —
  Mejdell's horses wanted blankets at a mild +5 to +10°C *when combined with* rain or
  strong wind.
- **`wet` and `wind` suppress `flies`.** Wet and windy weather significantly reduces
  insect harassment. The conditions that make an animal cold are the conditions that
  relieve it of flies.
- **`sun` and still air amplify `flies`.**

So weather is a small correlated system. It is also **autocorrelated** — read it twice in
a minute and it should barely move, because weather changes slowly.

#### The reading is individual

`weather.cold` is not a global. The lower critical temperature depends on the animal's
acclimatization — +5°C for a horse in a mild climate against −15°C for one adapted to
cold, with full acclimatization taking about 21 days. Coat and age shift it further.

**So the same weather reads differently for different declared individuals** (§2), which
is the pattern the rest of the language already uses: meaning conditioned by the receiver,
and individual differences that are not noise.

#### Staging

v0.1 returns independent fresh values behind these axis names. v0.2 adds the correlations,
the autocorrelation, and the individual conditioning. **The shape is fixed now** so that is
a runtime change and not a syntax change — §7.6 means there is no migration culture here,
so a later rename would break every program with no ecosystem able to fix it.

### 6.5 `chance` — a fresh draw

```
chance       = "chance" ;
```

A fresh independent value in 0..1. Plain, per principle zero: a coin flip has no equine
analogue.

**`chance` and `weather` are not the same thing, and merging them was a mistake.** In
drafts 6 and 7 `weather` replaced `chance` on the reasoning that weather is the
uncontrolled condition a horse actually reads. That reasoning is sound *about weather* —
and implementing it properly proved it is not a random source. Weather is slow, shared
and correlated: read it three times in an instant and it gives one answer, because a
front does not turn over between two lines of a program. A weighted gate needs three
different answers.

The program that exposed it gated three audio channels on `weather.wet > 0.5` and made
all three fall silent together, when the whole point was that each declines
independently.

**Four constructs, three of them ways of not knowing:**

| | |
|---|---|
| `forage` | depletes — a draw without replacement, order not chosen and not recorded |
| `recognise` | stable — the same input recognised the same way, for years |
| `chance` | fresh — an independent draw, every time |
| `weather` | **read** — a condition, not a draw. Shared, slow, correlated |

Requirements §2.5 forbids silently substituting one for another, and the grammar makes it
impossible rather than discouraged.

---

## 7. `stand`

Not a gait. It is the absence of gait, and it is the only construct that can be *broken*.

```
stand        = "stand" , [ duration ] , [ "within" , distance ] , [ "as" , ident ] ,
               newline , block , [ "otherwise" , newline , block ] ;
```

Hold within a jitter radius for a duration. `as` binds a graded 0..1 progress value.

**The body iterates while the hold is held** — the bound progress value updates each pass,
which is what makes a rising tension expressible.

**`otherwise` runs if the hold breaks.** Explicit, because implicit refusal would
contradict `blank` having to be stated.

---

## 8. Contexts and signals

A signal has no fixed meaning. It names an event and hands it to the nearest enclosing
context.

```
context      = "context" , ident , newline , indent , handler , { handler } , dedent ;
handler      = "hears" , signal , newline , block ;
signal       = "whinny" | "nicker" | "squeal" | "snort" | ident ;
emission     = signal , [ expression ] , newline ;
```

**A context contains handlers and nothing else** — at least one. That is what a context
is: a set of interpretations. (In draft 2 `handler` was defined but unreachable, since a
context's body was a general `block` and no statement form admitted `hears`.)

**`context` is legal both as a declaration and as a statement**, so a handler can scope to
a region inside a cue. Contexts are user-definable; the built-in set is not privileged.
Resolution is lexical then dynamic: nearest enclosing context wins.

**Signal names are resolved, not guessed.** Because `signal` admits a bare `ident`, an
emission and a zero-argument statement are lexically identical. The rule: a bare
identifier on its own line is an **emission** if that name is one of the four built-ins or
is introduced by a `hears` handler visible in scope, and a **call** otherwise. This is
settled in semantic analysis rather than by the parser, and it is the one place the
grammar alone is not sufficient.

**Every emission carries its emitter's provenance involuntarily** — band, arousal, size.
There is no anonymous signal, because a whinny structurally encodes identity, sex, and
body size whether the animal intends it or not.

**An emission returns the field, not a value.** You learn who answered. Silence is a
result, not a timeout — no answer means no one is there, which is information.

---

## 9. Affect

`~a:~v` is a pair: arousal and valence. F0 and G0 are non-harmonically related and do not
reduce to one pitch.

- **Component access:** `x.arousal`, `x.valence`.
- **Affect and affect:** arithmetic applies component-wise.
- **Affect and scalar:** applies to **arousal only**. Arousal is intensity; valence is
  sign, and scaling a sign is meaningless.
- **Comparison** compares arousal. Comparing valence requires naming the axis.
- **Any operation yielding a single scalar from an affect is a type error.** This is the
  rule the whole construct exists to enforce.

---

## 10. Failure, refusal, scope, laterality

```
spook        = "spook" , "at" , expression , newline , block , [ habituates ] ;
habituates   = "habituates" , "after" , number , newline ;
flood        = "flood" , "at" , expression , newline , block ;
shy          = "shy" , newline ;
balk         = "balk" , newline ;
leave        = "leave" , newline ;
blank        = "blank" , newline ;
lateral_mod  = "from" , "the" , side ;
```

`habituates after N` retires the handler after N exposures, keyed to a **structural hash
of the stimulus** — habituation is stimulus-specific, and a rotated familiar object reads
as novel again, so changing an error's shape resets the count.

`flood` compiles with a warning: flooding produces learned helplessness.

`balk`, `leave`, and `blank` are **terminal successes, not errors**. `balk` declines this
cue. `leave` ends the program having done nothing. `blank` answers "no change" and leaves
the cue — Mejdell's third symbol was a blank glyph the horse had to *press*, so the
no-change answer is given rather than inferred from silence.

**`blank` is not a skip.** Earlier drafts said it filtered a `graze`; it does not, because
it leaves the cue rather than the iteration. Filtering a graze is a `when` around the work,
which is how selective grazing reads anyway: the animal moves on rather than issuing a
statement about moving on.

**Inside a `hears` handler, an outcome stops at the handler.** A handler is not a cue, so
`blank` there is the handler's answer to the signal and does not touch whichever cue
emitted it.

The **point of balance** at the shoulder is a directional operator: pressure behind it
drives an animal forward, in front of it drives it back. In the language that is the
direction a `graze` traverses — `from behind` forward, `from the front` reversed (§6.1).

It is one third of a model, not a modifier on iteration. Flight zone, pressure zone and
the point of balance are Grandin's one system for moving an animal that would rather you
did not, and the other two wait for v0.3 — see §12g.3.

**Laterality attaches to three forms** — calls, chords, and `flehmen` — because all three
are acts of perception or expression, and those have a side. It is otherwise ambient: the
individual carries a bias, the enclosing block supplies the current side and it shifts,
and the modifier forces it. Left eye feeds the right hemisphere (novelty, threat, escape,
negative valence); right eye feeds the left (analytical categorisation). **The same
operation behaves differently by which side it is approached from.**

---

## 11. Statements and expressions

```
statement    = chord | gait | stand | graze | cue | release | binding | assignment
             | pile | forage | conditional | spook | flood | shy | balk | leave
             | blank | emission | context | sentinel | rest | watch
             | expression_stmt ;

binding      = "remember" , ident , "as" , expression , newline ;
assignment   = postfix , "becomes" , expression , newline ;
pile         = "pile" , ident , "at" , string , newline ;

conditional  = "when" , expression , newline , block ,
               [ "otherwise" , newline , block ] ;

sentinel     = "sentinel" , "rotates" , "every" , duration , newline , block ;
rest         = ( "rest" | "recumbent" ) , newline ;
watch        = "watch" , expression , newline ;

expression_stmt = expression , newline ;

expression   = disjunction ;
disjunction  = conjunction , { "or" , conjunction } ;
conjunction  = negation , { "and" , negation } ;
negation     = [ "not" ] , range ;
range        = comparison , [ "through" , comparison ] ;
comparison   = sum , [ ( ">" | "<" | ">=" | "<=" | "=" | "!=" ) , sum ] ;
sum          = product , { ( "+" | "-" ) , product } ;
product      = unary , { ( "*" | "/" | "%" ) , unary } ;
unary        = [ "-" ] , postfix ;
postfix      = primary , { "." , member | "[" , expression , "]" } ;
primary      = number | string | duration | distance | graded | affect
             | ident | facs | list | weather
             | recognise
             | "flehmen" , expression , [ lateral_mod ]
             | "hands"
             | "new" , postfix , { argument }
             | call
             | "(" , expression , ")" ;
list         = "[" , { expression } , "]" ;
```

`=` is equality. Assignment is `becomes` and takes a **path** on the left, so
`sheet.style.opacity becomes 0` is legal. Binding is `remember … as`. There is no `==`.

**Logical operators are `and`, `or`, `not`** — prose, per the settled register, with the
conventional precedence (`not` binds tightest, then `and`, then `or`). Boolean logic has no
equine analogue, so per principle zero it stays plain. There are no truth *literals*:
truth comes from comparisons and from members like `empty`, and a language with no `true`
is a language where a flag has to be a real reading of something.

**`range` sits above `comparison`**, not inside `primary`. In draft 2 it was a `primary`
reachable from `sum`, which made `1 through 438` ambiguous with itself.

**Comparison does not chain.** `a > b > c` is illegal; parenthesise or split.

**`flehmen` is required for deep reads.** A value's detail is not directly accessible;
flehmen routes it for finer analysis, as the animal routes an odour to the vomeronasal
organ. It is a separate act and it takes time.

`pile` is append-only, keyed, and persistent — the stud pile. It survives sessions, which
is how training persists.

**`hands` is the JavaScript escape hatch and sits outside the effect system.** It is flat
and unconditioned: not subject to laterality, welfare, or training. Horses signal to humans
deliberately and differently than to conspecifics; a separate channel, not a dialect of the
same one.

**`new` constructs, and only through `hands`.** Without it the escape hatch is one-way —
methods callable, properties readable, constructors out of reach — which was discovered
the first time a real program needed `new Date(…)`. Constructing a JavaScript object has no
equine analogue, so per principle zero it stays plain, and it is confined to a `hands` path
so that no unconditioned construction can appear in the middle of the language:

```
remember epoch as new hands.Date 2000 0 6 18 14 0
remember asked as new hands.URLSearchParams hands.location.search
```

Arguments are positional and bare, as everywhere else. A constructor is not a cue, so the
call is not awaited and is subject to nothing.

Not `handler` — that is the human's own job title, the outside view again. From the
horse's side the salient fact about a human is **hands**: they open gates, carry buckets,
work latches. The prehensile upper lip is dexterous but cannot operate a catch, which is
precisely why Ringhofer's horses *recruited* a human when a task was unsolvable. Interop
exists to do what the language cannot do itself, so it is named for the capability.

Rejected: `leader`, which contradicts §2 — the **lead mare** leads, and the alpha-human
framing is the same error as the alpha-stallion one. Runner-up: `feeder`, well grounded in
every training study, but it names the *relationship* where interop is about *capability*.

**Values are graded by default and discrete by exception**, inverting a normal language.
`~` marks a continuum whose variation the receiver reads as meaningful.

**Blind spots.** A value held too close cannot be read — a horse cannot see its own
muzzle. And with 65° binocular of a ~350° field, structural comparison works only in a
narrow cone ahead: depth is unavailable for most values.

---

## 12. Closed in draft 2

| # | Gap | Resolution |
|---|---|---|
| 1 | Chord nesting | Illegal — an utterance is one utterance (§4) |
| 2, 10 | Multi-line chords, newlines in brackets | Layout suppressed inside chords, `[ ]`, `( )` (§1.4) |
| 3 | Affect arithmetic | Component-wise; scalars hit arousal only; collapse is a type error (§9) |
| 4 | Where laterality attaches | Calls, chords, `flehmen` (§10) |
| 5 | Range syntax | Keep `through`. It reads, and it's cheap |
| 6 | `stand` classification | Own statement class — it is the absence of gait, and the only breakable form (§7) |
| 8 | `stand … otherwise` | Explicit. Implicit refusal would contradict `blank` (§7) |
| 9 | Does a `stand` body iterate | Yes, and the bound progress updates each pass (§7) |
| 11 | `context` as a statement | Legal at both declaration and statement level (§8) |
| 12 | Collection iteration | `graze` — the horse's actual iteration behaviour (§6.1) |
| 13 | Higher-order cues | Bare name in expression position. No analogue, so no ceremony (§3) |
| 14 | Randomness | Three distinct constructs: `forage`, `recognise`, `weather` (§6.2–6.4) |
| 15 | Member-path assignment | `assignment` takes a `postfix` path (§11) |
| 16 | Trailing call modifiers | Removed. Positional bare arguments only (§3) |
| 19 | `genotype` tax | Optional, defaults to `CA`. Only gated gaits pay (§2) |

## 12a. Closed in draft 3 — found by auditing the grammar, not the examples

Eight of these made the grammar unimplementable as written. None were on the open list;
they were found by reading the productions against each other.

| Gap | Problem | Resolution |
|---|---|---|
| Zero-argument call | `call` allowed `{ argument }`, so bare `draw` was both `ident` and a zero-arg `call` — ambiguous, and it destroyed the cue-vs-call distinction | `call` requires ≥1 argument; zero-arg only via `(draw)` (§3) |
| Argument type | `argument = primary`, so `develop target[1]` could not parse — indexing lives in `postfix` | `argument = postfix` (§3) |
| Application nesting | Unstated whether `develop a b` means `develop(a,b)` or `develop(a(b))` | Left-associative; nesting requires parentheses (§3) |
| `expression_stmt` | Referenced in `statement`, never defined | Defined (§11) |
| `handler` unreachable | Defined, but no statement form admitted `hears`, so no context could contain one | A context *is* a set of handlers — `{ handler }`, at least one (§8) |
| No logical operators | `comparison` allowed one comparison and nothing joined them. `when a > 1 and b < 2` was inexpressible | `and`, `or`, `not` with conventional precedence (§11) |
| Emission vs call | `signal` admits a bare `ident`, so a lone identifier on a line was both | Resolved in semantic analysis: emission if the name is built-in or a visible `hears`, else a call (§8) |
| `range` ambiguity | `range = sum "through" sum` sat inside `primary`, which is reachable from `sum` — ambiguous with itself | Lifted above `comparison` (§11) |

Also settled while auditing: no truth literals (truth comes from comparisons and members —
a language with no `true` is one where a flag must be a real reading of something); no
string escapes or interpolation (formatting goes through `hands`); comparison does not
chain; and **a cue that reaches its end without `release` is a compile error**, since an
implicit terminal outcome is exactly what `balk` and `blank` exist to forbid.

## 12b. Closed in draft 4 — found by running the lexer

Two gaps that only surfaced once real files were tokenized. Both made a documented
feature impossible to write, and neither was reachable by reading the grammar.

| Gap | Problem | Resolution |
|---|---|---|
| `~` only prefixed literals | `graded = "~" , ["-"] , number` meant `tension ~held` could not parse — so the chord that motivates `stand … as held` was inexpressible, and the progress binding had nothing to bind into | `~` marks any operand: literal, path, or parenthesised expression (§1.3) |
| Uppercase was reserved everywhere | Every DOM name is camelCase — `createElement`, `backgroundImage`, `addEventListener` — so `hands` could not reach JavaScript at all. The escape hatch was sealed | Member position admits uppercase; standalone identifiers do not. FACS codes never appear as members, so nothing collides (§1.3) |

The second is the more instructive: `hands` was specified, documented, cited, and used in
an example, and it could not have worked. Nothing short of tokenizing a real file would
have caught it.

## 12c. Closed in draft 5 — found by running the parser

Eight more. The pattern by now is clear: **specifying a literal where a program will
want a name** accounts for most of them, and no amount of reading catches that.

| Gap | Problem | Resolution |
|---|---|---|
| `lead mare cue draw` | The grammar made `cue` mandatory after `lead mare`; every example wrote `lead mare draw`, which reads far better and is what `lead mare` already means | `cue` is optional after `lead mare` (§3) |
| `halt` demanded a block | `halt` sat in `gait_head`, so `gait = gait_head newline block` required a body. Nothing happens *during* a halt | `halt` is a terminal statement with no block (§5) |
| `stand 10s` only | `stand` took a literal `duration` and `distance`, but real programs bind them — `stand hold within jitter`. Same class as the `~` bug in draft 4 | `stand`, `tolt every`, and `sentinel rotates every` take expressions, type-checked later (§5, §7, §11) |
| Indexing was ambiguous | `[` after any expression indexed it, so `[["a" "b"] ["c" "d"]]` read the second list as a subscript of the first and silently lost an element | Indexing binds only when it touches its object: `target[1]` indexes, `[a] [b]` is two lists. Needs a whitespace flag from the lexer |
| `[a b]` was ambiguous | Between two elements and one application | A list element is a `postfix`, not an application. Parenthesise to call — consistent with arguments (§11) |
| Glue words unreachable | `bias` and `after` are not keywords, so `left bias` and `habituates after 3` both failed | `bias`, `eye`, `blind`, `after` are *recognised*, not reserved — the same policy as channels and weather conditions |
| `ears back` was illegal | A state is `ident`, but `back` is a gait keyword — so the most ordinary ear position in the language could not be written | Channel states accept keywords as state names (§4) |
| `(draw)` vs `(x + y)` | Parenthesising a lone path forces a zero-argument call, so `(x)` and `(x + y)` mean structurally different things | Kept as specified. Redundant parentheses around a single name are the only casualty, and nobody writes those — but it is a wart, recorded rather than hidden |

Reserved-word policy, now settled across three passes: **recognise, don't reserve.**
Channels, weather conditions, and glue words are all matched by the parser rather than
claimed by the lexer, so `wind`, `head`, `bias`, and `after` all stay usable as names.
Only words that begin a statement are keywords.

## 12d. Closed in draft 6 — found by writing the resolver

The resolver is `src/resolve.js`, between parse and emit. Writing it closed the last
three deferred items and found one genuine design fault.

**The design fault, and it is the important one.** Until now `every <duration>` belonged
to `tolt` alone. That made `tolt` the language's **only unbounded loop** while also
gating it behind an Icelandic genotype — so two of three example programs were declaring
a breed purely to obtain a timer. Open item 19 asked whether the genotype gate was a tax;
it was worse than a tax, it was a missing feature with a joke in front of it. It also
contradicted §5's own claim that a gait is inherently iterative.

`every` now holds **any** gait, which is what "a stride repeated" always meant. `tolt`
keeps the distinction that is actually real: no suspension, so no gap between strides,
where every other gait pauses.

| Item | Resolution |
|---|---|
| Undefined and duplicate names | Reported, with declarations hoisted per block so forward references within a band work |
| Arity | Checked against known cues; member calls are not checked, because the member cannot be known |
| **Signal resolution (§8)** | Implemented. A bare name is an emission when a `hears` introduces it anywhere in the file — including *after* the emission — and a call otherwise. This is why the parser could not do it |
| **Cue termination (§3)** | Enforced for the first time. It was specified in draft 2 and checked nowhere. Conservative: it reports only when nothing in the body names an outcome |
| **Genotype gating (§2)** | Moved from a runtime throw to a compile error, which is what §2 always said it was |
| Duration and distance (§5, §7) | Checked where the grammar accepts any expression, so `stand 20px` and `walk every 20px` are caught |
| Band-size lint, flooding warning | Moved from runtime to compile time, where a lint belongs |
| A bare cue name as a statement | New warning: `draw` alone is the cue, not a call. `(draw)` calls it |

**`halt` is no longer part of `gait_head`.** It has its own production, since it takes no
block and no `every`.

Every example program failed the resolver on its first run — `fade-in`, `fade-out`,
`oldest` and `play` were all free variables. They had been passing the emit tests because
importing a module parses it without running it. The examples are now self-contained.

## 12e. Closed in draft 7 — found by building the browser host

The loader is `src/browser.js`; the page is `playground.html`. Building the delivery
model found six bugs, three of which meant a documented feature had never worked.

| Gap | Problem | Resolution |
|---|---|---|
| **A held gait had no exit** | `halt` was a no-op, so `walk every 7s` ran forever. Only `leave` (ends the program) or the host could stop it — a program could not stop its own loop. Found by a test suite that hung | `halt` ends the innermost gait or sentinel it is inside, and nothing more. Outside a gait there is nothing to stop and it does nothing (§5) |
| **`release` did not release** | Inside a gait, `graze` or `stand` body, `release` compiled to `return` inside that body's callback — so it left the callback and the cue carried on. Silently returned the wrong value | Every outcome now unwinds to the cue boundary, as `balk` and `leave` already did |
| **`graze` over a list never worked** | Every Array has `.entries` as a *method*, and the Pile check tested it for truthiness — so grazing a plain list grabbed the function and threw. `exposure.horse` had been broken the whole time | Ordered checks: Forage, Pile, null, Array, iterable, then a refusal that says so |
| Gait and sentinel bodies did not hoist | Each statement compiles to its own thunk, so a `remember` inside one emitted an undeclared assignment | Bodies hoist, and a held gait's bindings survive between strides |
| `~(x)` exempted itself | Graded parsing handled `(` itself, bypassing the rule that parenthesising a lone path calls it — so `~(draw)` was the cue, not its result | Graded operands go through `postfix` like everything else |
| Nothing warned about an unbounded loop | Written twice by accident inside an hour | A held gait with no `halt` or `leave` anywhere in its body warns. Page programs legitimately have none, and the warning is still right to fire |

**Not a bug, now documented:** a `halt` cannot un-strike a hoof already down. A trot's
diagonal pair runs concurrently, so halting one does not stop the other — they had
already landed. Only a sequential gait can be cut mid-stride.

**Three of these were invisible because a test imported a module instead of running
it.** Importing parses; it does not execute. Both the emit and browser suites now run
the examples, with a lent DOM and a host that stops held gaits after one stride.

## 12f. Closed in draft 8 — found by converting production code

The first conversion of a real, live mechanism: a date-gated feature that rewrites a
page's links on one night in twenty-nine and does nothing on the other twenty-eight.
Twenty-two lines of JavaScript. It found six problems, three of which made the language
unable to do the job at all.

| Gap | Problem | Resolution |
|---|---|---|
| **No `new`** | `hands` was a one-way hatch: methods callable and properties readable, but constructors out of reach. Real code needed `new Date(…)` in its first five lines | `new` constructs, confined to a `hands` path. No equine analogue, so it stays plain (§11) |
| **No modulo** | `%` was simply absent. A cyclic calculation cannot be written without it, and this codebase uses it constantly | `%` at product precedence. It is also a distance unit, so it is disambiguated by whitespace exactly as `-` is: `50%` is a distance, `50 % 3` is modulo (§1.2, §11) |
| **Method calls lost their receiver** | A call whose callee was a member routed through `H.call`, which invoked it **detached** — `this` undefined. Every DOM method call in the conversion was broken, and the failure was `Value of "this" must be of type URLSearchParams` at runtime, not at compile time | A cue is always a bare name, so a Member or Index callee is a JavaScript method and is emitted with its receiver attached, unconditioned. Binding a value out of `hands` does not bring it inside the effect system |
| The band lint fired on natural sizes | Set at 4 declarations. But a band is one stallion, two to four mares, *and their offspring* — six to eight is ordinary. The lint was wrong, not the code | Threshold raised to 8, in both the resolver and the runtime |
| Comment-only lines escaped the ASCII check | `layout()` consumes a full-line comment with its own end-of-line skip, so §1.1's "no exceptions" had one — and every comment in the codebase is a full-line comment | The check lives in `skipComment`, which both paths call. This matters most for inline source: a stray byte shows up garbled in View Source, which is the surface the delivery model exists to serve |
| The CLI could not read HTML | Source has to be inline for View Source to show it, so HTML is where source lives — and the validator could only read `.horse` files. A separate `.horse` copy would have been a duplicate waiting to drift | `check`, `emit` and `tokens` extract every inline block from an `.html` file, with line offsets so reported positions point into the page |

### Friction that is not a bug

Two things made the conversion harder to write correctly than it should have been, and
neither is wrong — but both are silent when you get them wrong.

**A zero-argument call needs parentheses**, so `now.getTime` is the method and
`(now.getTime)` calls it. Written the first way inside arithmetic, the program subtracts
two *functions* and gets `NaN` — no error, at compile time or run time. The rule is
right; the failure is quiet.

**Arguments are postfix**, so an expression argument needs parentheses:
`link.setAttribute "href" (base + rest)`. Without them, application stops at `base` and
the `+` dangles.

### The honest cost

Seventy lines of HORSEtxt for twenty-two lines of JavaScript, most of the difference
being that every cue must name its outcome and that one function with early returns
became four cues.

What the length buys is that the ordinary case is now stated rather than implied: the
JavaScript said `if (!isFullMoon()) return;` and the HORSEtxt says `leave` — a terminal
success, twenty-seven nights in twenty-nine. The storage read that might throw says
`spook … habituates after 1` instead of a bare `catch {}`. Whether that is worth three
times the lines is a judgement, and it should be made per mechanism rather than assumed.

## 12g. The perception model (v0.2)

Laterality has been threaded through calls, chords and `flehmen` since v0.1, and has
been consequential in exactly one of them. It only becomes consequential if *perceiving*
is an act with limits — which is what this section settles.

**The risk here is invention.** Values do not have positions in a 350° field. Building a
spatial model so that "blind spot" has something to mean would be precisely the failure
§0 forbids: a rule that cannot be traced to a citation is not foreign, it is bad. So some
of the body's limits map and some do not, and the ones that do not are declined below
rather than forced.

### 12g.1 What perception applies to

**Only to what is perceived.** A value that crossed in from outside — through `hands`,
carried by a signal, or handed over by a `graze` — is a thing in the world. A number you
computed is not perceived, it is held, and nothing about eyes applies to it.

### 12g.2 Adopted

**Laterality decides what a look yields.** The left eye feeds the right hemisphere, which
handles novelty, threat, predator detection and escape; the right eye feeds the left,
which does analytical categorisation. So the side is not decoration on the same
operation — it selects *which question you asked*:

- `flehmen x from the left` — is this new, is this a threat. Raises `novel` for anything
  this animal has not met.
- `flehmen x from the right` — what kind of thing is this. Yields a category.

Unstated, the ambient side decides, and the ambient side comes from the individual's bias
and shifts with the enclosing block, because sensory laterality shifts faster and more
situationally than motor laterality.

**Flehmen requires attention.** An animal with both ears flattened is agonistic and is
not attending, and a horse's attention is read from eyes *and* ears together. So a chord
that closes agonistic cannot route anything for finer analysis: `flehmen` inside it
balks. The two mechanisms were already in the language and were not connected.

**A cue cannot flehmen its own parameters.** A horse cannot see its own muzzle: what it
is holding is exactly what it cannot look at. What was handed to you is at your muzzle.
You may use it, pass it, read a member of it — you may not route it for analysis. To
inspect it, let it go and meet it again.

**The point of balance gives direction.** Pressure behind the shoulder drives an animal
forward; in front of it, backward. So `graze xs from behind` traverses forward and
`graze xs from the front` traverses in reverse.

**The point of balance gives a `graze` its direction**, and that is all of the approach
model that lands here. The rest of it is §12g.3.

### 12g.3 Removed: the zone construct

`flight zone` and `pressure zone` wrapped a block of declarations and were described as
graded access control — approach a binding from outside its band and it moves away. The
construct is **removed**, and not because it was unenforceable.

It described something horses do not have.

**A flight zone is a property of the animal, not of its data.** Grandin is explicit: it
is the animal's personal space, and *its size is determined by the wildness or tameness
of the animal* — animals handled often have smaller flight zones than those with little
contact with people. It is a radius around a horse, not a fence around a possession. The
block form was the human-engineer reading: it pattern-matched `private` and built scope.

Read correctly, the three parts are **one system** — the geometry of being approached:

| | |
|---|---|
| flight zone | get this close and the animal leaves. A cue that declines when reached for |
| pressure zone | it turns to face you but does not move. The call registers; the thing does not happen |
| point of balance | where you stand decides which way it goes |

They were split across three unrelated features, and the point of balance shipped alone
on `graze` without anyone noticing it was a third of a mechanism.

**They wait for v0.3**, because the size of a flight zone is set by handling history —
which is trials-to-criterion arriving from the other direction. An animal handled often
lets you close; an unhandled one keeps its distance and turns to face you. Those inputs
do not exist until the individual has a history, so nothing about the model is
implementable now.

*(The parser never had a `parseZone`, so no program could contain a zone and nothing
breaks by removing it. That absence is why a documented, resolver-aware,
emitter-aware construct sat dead from v0.1 until someone tried to write one.)*

### 12g.4 Declined, and why

**Binocular depth splitting `=`.** The temptation was to make structural comparison
require the narrow forward cone, so `=` is deep when facing and shallow otherwise. There
is no honest route from "65° of binocular field" to "deep versus shallow equality"
without giving values positions, and an `=` that is sometimes deep is unpredictable
rather than foreign. A reader could not derive it, only memorise it. Declined.

**Requiring `flehmen` for ordinary member access.** §2.6.2(d) says there is no direct
deep inspection, and taken literally that would mean `link.getAttribute` needs routing
first. Applied to the first real conversion it would have roughly doubled a page of
straightforward DOM work for nothing. **"Deep read" is therefore narrowed to novelty and
category** — the two things the hemispheres actually specialise in. Reading a named
member of something you already have is eating food you already recognise.

**Dichromacy.** 428nm and 539nm are a constraint on what a host should *render*, not on
what the language should compute. It stays advisory, in the bibliography.

## 12h. Closed in v0.2 — the body and its limits

Weather became a system, laterality became consequential, and gaits became what §5 had
been calling them since draft 1. Five defects surfaced, three of them in claims the
documentation had been making for several drafts.

| Gap | Problem | Resolution |
|---|---|---|
| **`weather` could not be the random source** | Implementing it faithfully proved it: weather is slow, shared and correlated, so three reads in an instant give one answer. A program gating three audio channels on `weather.wet` silenced all of them together | `chance` restored as a fresh draw (§6.5). Four constructs, three of them ways of not knowing |
| **`flies` was unreachable** | Multiplying four sub-unit factors crushed the largest behavioural driver of the five to a maximum of **0.07 across a whole year** | Suppression rather than exclusion. It now peaks in July and is zero all winter |
| **Air temperature sat at freezing year-round** | Averaging two noise signals narrows the distribution toward its middle, so every warm-weather reading downstream was stuck at zero | The year is a real cycle, not noise. Seasons are deterministic |
| **Novelty keyed on the wrong thing** | `flehmen` reused `shape()`, which keys *error* habituation on a value's kind — so every string was one stimulus and meeting one counted as meeting all of them | A separate `trace()`: a thing you can hold is identified by what it is, a thing with parts by its parts. Which is also why a familiar object rotated reads as novel |
| **`gait()` never forwarded its options** | `lead` and a supplied vector were accepted and then dropped, so a canter on the far side was identical to one on the near side | Options reach the stride |

### The gait schedules were wrong

Representing a gait as a phase vector rather than a switch case exposed two schedules
that had been wrong since v0.1 and that nothing could have caught while the answer was
hand-written:

- **A gallop is not full fan-out.** It ran every statement at once. A moving horse never
  has four hooves down together; a gallop is four separate beats and then suspension. No
  gait runs four statements concurrently, and none should.
- **A trot was pairing by adjacency, not diagonally.** The helper grouped statements
  `(0,1)` and `(2,3)`. The diagonals are LF+RH and RF+LH — statements `(1,2)` and
  `(3,0)`. It had been calling itself a diagonal pairing while doing something else.

The payoff for the representation is that interpolation yields real gaits: halfway from a
walk to a pace comes out as a **stepping pace**, uneven and lateral in a 1-2, 3-4
sequence, from the arithmetic rather than from a table.

### Zones were removed

See §12g.3. `flight zone` and `pressure zone` described access control over data; a
flight zone is a property of the *animal*, sized by its handling history. The construct
went, the point of balance stayed, and the model reunites in v0.3 where an individual has
a history for the zone to be sized by.

## 12i. Closed in v0.2.1 — found by porting a second production page

Three defects, all found by writing one real program against v0.2.0 rather than by
reading it. Two had been shipping since v0.1.

| Gap | Problem | Resolution |
|---|---|---|
| **Writing to a pile replaced it** | `STDLIB.md` has said "writing appends" since v0.1; the emitter emitted a plain assignment. So `passing becomes now` overwrote the pile with a number, `passing.count` read back `undefined`, and every derived figure was `NaN` — silently. Only the resolver knows a target is a pile, so it now marks the node | `H.leaveTrace`, and a pile is the only thing that can be left one |
| **Storage was cached wrongly, twice** | The probe cached the `localStorage` *reference*, so a page that swapped it kept writing to the old one. Caching the *failure* instead then left storage permanently off after any throw — which in a plain Node process is always | Neither is cached. Access can throw and can come back empty, so both are simply tried each time |
| **Two statements in a `trot` ran sequentially** | Statements were assigned to limbs by identity — statement 0 to the left hind — which put two of them on a hind and a fore of the *same side*, striking at different times. The canonical two-at-once gait therefore ran them one after the other, contradicting §5's own table | Statements fill the stride **in the order the beats happen**. See §5 |

**A pile may now be read by position** (`marks`), which forage may not. The difference is
where the order comes from: a pile's order is the order things happened, so reading a trail
off it is the point, while forage's order is drawn and a position would make the draw
reproducible.

### Behaviour changed since v0.2.0

The gait fix alters when statements run. A `trot` and a `pace` now pair two statements at a
time for any count and schedule identically; a `canter` runs one, then a pair, then one; and
a **lead no longer changes the schedule**, because mirroring permutes which limb strikes
when rather than how many strike together, and statements have no limb to be led by.

## 12j. Herds became real — v0.2.2

The band-size lint told you to split and the language gave you no way to split, because
bands could not see each other at all. That was the same isolation that killed zones, and
asking whether herds co-mingle turned out to have a precise answer.

**They do, and it is documented.** A drone survey of a hundred-plus feral horses found
association rates that are *bimodal*: units nested inside a herd, inter-unit distances
closer than chance, and behaviour synchronising **between** units. Boundaries are held by
default — units grow cohesive as another approaches and elongate to avoid crossing — while
particular pairs cross and intermix regularly. And all-male units occupy the herd's
periphery while large mixed-sex units hold the centre.

So the mechanism was not a choice to be invented. See §2.4:

- `mingles with` — pairwise, and **both bands must name the other**, because a crossing is
  mutual and one band's edit should not silently widen another's scope
- a herd holds bands and nothing else; across herds, nothing
- names are distinct across a herd: two bands are two sets of individuals
- **a `bachelor` group sees every band without declaring, and none sees it** — the
  periphery, and the first mechanism behind a claim `bachelor` has carried since draft 1

The 13-declaration band that prompted this splits into two bands that mingle, and the
warning goes quiet without duplicating anything.

**A name that exists in the herd but was not shared says so**, rather than reading as a
misspelling — which was the one cost worth worrying about when the design was proposed.

## 13. Still open

17. ~~**The standard library.**~~ Closed — see `STDLIB.md`. Deliberately small; grows only
    when a *second* program needs a member.
19. ~~**The `genotype` tax.**~~ Closed in draft 6, as a real fault rather than a tax.
22. **A `hears` handler cannot name the value it receives.** `hears creak` has no binding
    form, so a handler can see that a signal arrived but not what it carried. The emitter
    passes one; the language cannot reach it. Wants `hears creak as v` or similar.
23. **Members are unresolvable, by nature.** `x.foo` is never checked, so a typo in a
    member name survives to runtime. That is the price of `hands` being a flat boundary
    onto JavaScript, and it is probably the right price.
18. **The voice channels went unused.** Across three ported programs `whinny` and `nicker`
    never appeared, and `snort`/`squeal` only inside a `context` that assigned their
    meaning locally. Evidence that voice is a smaller part of the language than the design
    assumed. Watch it; don't act yet.
20. **Welfare's observable surface.** Welfare gates capability, but nothing says how a
    program reads its own welfare, or whether it may. Deferred to v0.3, where welfare
    lands.
21. **`graze` over `forage`.** `deck.graze` (draw one) and `graze deck as x` (traverse
    all) use the same word for a single draw and a full traversal. Defensible — both are
    grazing — but a reader will trip. Watch.
