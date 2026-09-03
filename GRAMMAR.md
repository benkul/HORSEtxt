# HORSEtxt — Grammar

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
walk trot pace canter gallop tolt halt stand back stumble
graze forage regrows recognise weather cold wet wind sun flies hands
and or not bare grass in
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
sees it — which is what a test group wants.

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

**A cue held under another name is the same cue.** `remember f as draw` then `(f)` calls
it. The name a call is written under is the handler's word for the signal, not a second
signal — two words for one cue are one cue, and the training stays with the animal rather
than following the word. So the trial count is kept against the name it was taught under,
and `(f)` and `(draw)` are the same repetition.

Arity is checked through the name where the name can be followed home, and so is the
refusal: a binding that plainly holds a number will not be holding a cue by the time it is
called, and that is a compile error. A binding whose contents cannot be known — a
parameter, a grazed item, a value carried by a signal, anything out of `hands` — is left
to the runtime, which refuses to call what is not a cue. **That is where a dispatch table
lives.**

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

**The budget measures latency, not wall time.** Time spent standing, or between the
strides of a gait, is the animal taking the time it was told to take — it answered
immediately and correctly, and it is not late. A `stand` is the one construct whose entire
content is spending time (§7), and charging it to the budget would warn an author for
using the language as written. Lateness belongs to whoever is slow to let go, which is
usually the far side of `hands`.

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
written order is always preserved. Statements have an order, not a limb identity: a
statement is not assigned to a particular hoof, it takes the next beat.

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

### 5a. `stumble`

```
stumble      = "stumble" , newline ;
```

A stride that did not do its work. A stumble is not a fall and it is not a halt: the horse
gathers itself and takes the next one. So `stumble` ends **this stride and nothing else**
— the rest of the body does not run, the suspension does not happen, and the gait carries
on to the next stride.

It exists because there was no way to abandon one attempt and keep going. `otherwise`
falls through, `blank` exits the cue, and `halt` ends the gait, so a stride that should
give up and try again next time had to be written as an inverted guard:

```
walk every 7s
    when not busy
        ...the entire body, nested one deeper
```

which reads backwards and nests again for every condition. With `stumble` the guard says
what it means and the body stays flat:

```
walk every 7s
    when busy
        stumble
    (replace)
```

**A stumble outside a gait is an error, not a no-op** — unlike `halt`, which is quietly
nothing outside one. A stride you are not taking cannot be broken.

**A cue cannot stumble on its caller's behalf.** The check stops at the cue boundary: a
cue called from inside a stride does not know it is in one, and neither does the animal.
The horse that stumbles is the one taking the step.

**A stumble is not an outcome.** A cue still has to end in `release`, `balk`, `leave` or
`blank`; stumbling is something a gait does, not an answer a cue gives.

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

The axis names are fixed, so refining what lies behind them stays a runtime change rather
than a syntax change. §7.6 means there is no migration culture here: a rename would break
every program, with no ecosystem able to fix it.

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
handler      = "hears" , signal , [ "as" , ident ] , newline , block ;
signal       = "whinny" | "nicker" | "squeal" | "snort" | ident ;
emission     = signal , [ expression ] , newline ;
```

**A context contains handlers and nothing else** — at least one. That is what a context
is: a set of interpretations.

**`context` is legal both as a declaration and as a statement**, so a handler can scope to
a region inside a cue. Contexts are user-definable; the built-in set is not privileged.
Resolution is lexical then dynamic: nearest enclosing context wins.

**`hears snort as what` names what the signal carried**, so a handler knows not only that
a signal arrived but what it brought.

The binding belongs to **that handler**, not the context: two handlers for two signals are
two interpretations, and a name from one has no meaning in the other. `as` is optional; a
handler that does not care what arrived does not have to name it.

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

## 8a. Truth, and what nothing is

```
bare         = "bare" ;
grass        = "grass" , "in" , list ;
```

A horse distinguishes three things where JavaScript sees two.

| | |
|---|---|
| **an answer** | what a comparison gives back. "No" is as much an answer as "yes" |
| **a thing** | present. `0`, `""`, `[]` are all things that are there |
| **bare** | nothing is there. `null`, `undefined`, and a sum that came back `NaN` |

`when` asks a question of what it is given: an answer, it takes; a thing, it asks whether
the thing is there. So `when` is false for exactly `false` and for bare, and **`when 0` is
true.**

**Zero is a quantity; absence is not.** A horse at a full haynet that has eaten nothing
and a horse standing where there is no haynet are in different situations, and a language
that calls both of them false cannot tell you which one it is looking at.

**Mejdell 2016 is why.** Horses were taught three symbols — blanket on, blanket off, and
no change — and the third was a **blank glyph the animal had to press**. The experimenters
would not read "no change" off a horse standing still, because a horse standing still
might be confused, unmotivated or unable. Silence is not an answer, which is what `blank`
encodes and what the rest of §8a follows from.

`NaN` is bare for the same reason the other two are: it is what a question comes back as
when it had no answer, not an answer of its own.

### Patch use

`or` joins answers and gives an answer back. That is correct for `or` and useless as a
default — `given or 7` is `true`, never `7`.

A default is not a logical join. It is **patch use**: a horse works a patch down and moves
to the next, and bare ground does not feed it. So the first patch with anything in it is
the one that answers.

```
remember name as grass in [stored "unnamed"]
remember src as grass in [chosen last-shown "images/img1.jpg"]
```

A list, because a horse crossing a field passes more than two patches, and nesting a
binary operator to say so would be pretending otherwise. **Every patch is evaluated**,
unlike `or` — an animal walking a line of patches has already seen them, and does not shut
its eyes to the far one because the near one had grass.

All patches bare comes back bare, which is the honest answer and not an error.

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

## 9a. Perception

**Perception applies to what is perceived, and to nothing else.** A value that crossed in
from outside — through `hands`, carried by a signal, handed over by a `graze` — is a thing
in the world. A number you computed is not perceived, it is held, and nothing about eyes
applies to it.

Values do not have positions in a 350° field, and building a spatial model so that "blind
spot" had something to mean would be the invention §0 forbids. What follows is the part of
the body that maps.

**Laterality decides what a look yields.** The left eye feeds the right hemisphere, which
handles novelty, threat, predator detection and escape; the right eye feeds the left,
which does analytical categorisation. The side is not decoration on one operation — it
selects which question was asked:

- `flehmen x from the left` — is this new, is this a threat. Raises `novel` for anything
  this animal has not met, and answers with a truth.
- `flehmen x from the right` — what kind of thing is this. Answers with a category.

Unstated, the ambient side decides. It comes from the individual's bias and shifts with
the enclosing block, because sensory laterality shifts faster and more situationally than
motor laterality.

**Flehmen requires attention.** An animal with both ears flattened is agonistic and is not
attending, and a horse's attention is read from eyes *and* ears together. A chord that
closes agonistic cannot route anything for finer analysis: `flehmen` inside it balks.

**A cue cannot flehmen its own parameters.** A horse cannot see its own muzzle: what it is
holding is exactly what it cannot look at. What was handed to you is at your muzzle — you
may use it, pass it, read a member of it, and you may not route it for analysis. To
inspect it, let it go and meet it again.

**Novelty is keyed to the shape of a thing**, not to its identity. A thing you can hold is
identified by what it is; a thing with parts by its parts — which is why a familiar object
rotated reads as novel again.

**The point of balance gives direction.** Pressure behind the shoulder drives an animal
forward, in front of it drives it back. That is a `graze`'s direction: `from behind`
traverses forward, `from the front` in reverse (§6.1).

Flight zone and pressure zone are the other two thirds of Grandin's approach model and are
not in the language. A flight zone is a property of the animal, sized by its handling
history, rather than a property of its data.

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

**`blank` is not a skip.** It does not filter a `graze`, because it leaves the cue rather
than the iteration. Filtering a graze is a `when` around the work,
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
did not. Only the point of balance is built.

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
is a language where a flag has to be a real reading of something. What counts as true is
§8a; `or` joins **answers** and is not a default (§8a).

**`range` sits above `comparison`**, not inside `primary`. Reachable from `sum` it would
make `1 through 438` ambiguous with itself.

**Comparison does not chain.** `a > b > c` is illegal; parenthesise or split.

**`flehmen` is required for deep reads.** A value's detail is not directly accessible;
flehmen routes it for finer analysis, as the animal routes an odour to the vomeronasal
organ. It is a separate act and it takes time. See §9a.

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

## 11a. The hands boundary

`hands` is where the language touches JavaScript, and the name is not decoration: it is
the human's side of a horse-human interface. §11 makes it flat and unconditioned on
purpose — laterality, provenance and the effect system stop at it. Unconditioned is not
the same as unobserved, and this section is the difference.

### Pressure and release

The grammar of horse-human contact is negative reinforcement: the handler applies
pressure, the animal responds, the pressure is released, and **the release is the
information**. A signal with no release is not a signal — it teaches nothing, and late
release punishes the correct response.

**A member path alone on a line is pressure with no release.** `channel.play` reaches
across the boundary, takes hold of the method and lets go of it without asking anything.
`(channel.play)` calls it. This is an **error**, not a warning: there is no program where
the first was meant, and the failure is otherwise perfectly silent — no throw, no return,
nothing done.

A member read that goes somewhere is fine. `remember v as channel.volume` asked for
something and something came back.

### Opposing signals

Rein and leg together is the canonical fault, and the one that produces conflict behaviour
fastest, because the animal is being asked to go and to stop in the same moment.

**A cue handed to something that needs its answer now is that fault.** A cue is async and
returns a promise. That is exactly right for a listener, which discards what it gets back
— `addEventListener "click" answer` is good HORSEtxt. It is wrong for anything that
coerces the return value: a promise is truthy, so `filter` keeps everything and `sort`
reorders nothing, **with no error either way**.

Refused for a named list of receivers: `sort`, `filter`, `map`, `reduce`, `reduceRight`,
`find`, `findIndex`, `findLast`, `findLastIndex`, `some`, `every`, `flatMap`. That is a
real limit and not a general rule — whether a receiver wants its answer now is not
knowable from the syntax, and the list is where it bites in practice.

**Cues are callbacks, not functions.** That is the sentence to remember.

### Leaving into an empty stall

`leave` ends the program. Past the point where the program has ended there is nothing
left to end — and a cue handed to the page gets called back into long after the lead mare
released. Such a `leave` is **contained and noted** rather than thrown: outside the
program it would land in whatever called it, which in a browser is an uncaught error
inside an event handler, taking the rest of that dispatch with it. Mejdell's rule cuts both ways: an answer has to be given
*to* someone, and an answer with no listener is information about the listener rather than
a fault in the animal.

### Why loud, and not convenient

A horse cannot fail quietly at the human boundary. Unclear or contradictory signals
produce **conflict behaviour** — head-tossing, tail-swishing, teeth-grinding, hollowing —
which is observable, and which the welfare literature is built on reading. Silence arrives
only at the end of the progression, as learned helplessness.

### The weight

A boundary that refuses at compile time and then says nothing ever again is a switch. A
contact is felt continuously, and this is the felt part.

**Every crossing that comes back bare is counted, per path.** One is ordinary — an element
that is not on the page yet, a lookup that missed. Three in a row at the same path is the
handler asking the same question and getting nothing back, and the boundary says so.

- **Consecutive, and an answer resets it.** Pressure that is sometimes released is a
  different signal from pressure that is never released, and only the second is worth
  saying out loud.
- **Bare, not false.** §8a decides what nothing is: `0`, `""` and `[]` are things that are
  there and count as answers. A boundary disagreeing with the rest of the language about
  absence would report a working page.
- **Keyed to the path, not the occasion** — the same shape as `habituates after N`, which
  keys to the structure of a stimulus rather than to where it was met. An index is not
  part of the shape: `images[0]` and `images[1]` are one question asked twice.
- **Said once, then habituates.** Repeating it every time would be the flooding §10 warns
  about.
- **A read is a question; a write is not.** Nothing is asked for on the left of a
  `becomes`, and naming a path on the way to its end asks nothing either. `hands.a.b` is
  one question, not two.

`hands` is `globalThis`, so none of this can be done with a proxy without breaking
identity and slowing every hot path. The emitter knows each path syntactically and wraps
at the emit site instead — which also means the weight is only on paths *rooted in
`hands`*. A method on a locally bound object is not counted: §12 says members are
unresolvable by nature, and guessing which of them came from the boundary would be exactly
that guess.

### The same fault in value position

`channel.play` alone on a line is refused because nothing was asked for. The same
mistake inside an expression cannot be refused, because there the path *does* go
somewhere — and it goes there as a **function**:

| Written | Answers | |
|---|---|---|
| `now.getTime - 1000` | `NaN` | a sum with nothing in it |
| `count.at > 10` | `false` | however many there are, and the wrong branch runs |
| `"n: " + count.at` | `"n: () => 42"` | JavaScript source, in whatever the page shows |

None of the three is an error and all three are wrong. The comparison is the worst,
because it does not even come back as nothing — it comes back as an answer.

**Reported at runtime, not refused at compile time.** The compiler cannot know what is
on the other side of a member path (§12), and the value is not wrong either:
§8a already decided a failed sum is bare, and that bare is the honest answer to a
question that had none. What was missing was anyone saying why it had none.

**`=` and `!=` are exempt.** Two names may hold the same cue and asking whether they do
is a real question. Everything else that treats an operand as a value — `+ - * / %` and
`> < >= <=` — says so when handed a method.

A cue is the provable half of the same fault: `draw - 1` is refused outright, because
the resolver knows what `draw` is.

### Saying it out loud

A diagnostic is said when it happens rather than collected and read out at the end. Most
of what a program has to say happens after the lead mare has released — inside a gait, or
in a cue the page kept and called back into — so a report delivered at the end of the
program would be delivered before any of it.

Late is its own fault here. The language says so about release timing (§3), and the same
applies to what it says about itself: a diagnostic arriving long after the thing it
describes is not information about the thing.

---

## 12. Limits

What the language does not do. Some of these are chosen and some are merely true; the
difference is said in each case.

**Members are unresolvable.** `x.foo` is never checked, so a typo in a member name
survives to runtime. This is the price of `hands` being a flat boundary onto JavaScript
(§11), and it is the right price — checking would mean knowing what is on the other side,
which is the thing the boundary exists not to know.

One shape of it is worth naming: `when hands.SOMETHING.ready` reads the *method* and asks
whether it is there, which it always is. `(hands.SOMETHING.ready)` asks what it answers.
This cannot be refused, because testing that a method exists is feature detection and
legitimate. The catchable half — a path that comes back bare, or one used as a value — is
reported (§11a).

**A duration cannot be computed.** Durations and distances do not mix with numbers
(`STDLIB.md`). `10s + 3` is meaningless and rejecting it is right; `10s * 0.5` is
dimensionally sound and rejected too. So **a gait's interval cannot vary at runtime** —
an interval is a duration literal or a name holding one. A steady gait and a counter is
how a varying wait is written.

Open, rather than settled: whether a horse has any concept of a *varying* tempo, or only
of the gait it is in.

**A value cannot be waited on.** A cue can be handed to `new hands.Promise`, so the
language can produce a promise, and it has no way to wait on one it is holding. Awaiting
happens at call sites only, so asking a held promise for its answer means calling a member
on it — `(p.then)`.

Open, rather than settled: "wait for something already asked for" has no obvious equine
reading, and principle zero forbids inventing a keyword before the reading exists.

**No object literals, and no string escapes.** `f({pan: -1})` is unwritable, and so is
inline JSON, since `"` cannot be escaped. Two plain lines do it — `hands.JSON.parse "{}"`
and then a member assignment. Principle zero says an options bag has no equine reading, so
this is likely correct as it stands.

**Welfare has no observable surface.** Welfare gates capability, and nothing says how a
program reads its own welfare or whether it may. Unbuilt rather than decided.

**`graze` carries two meanings.** `deck.graze` draws one; `graze deck as x` traverses all.
Both are grazing, and a reader will still trip.

**The voice channels are little used.** Across the ported programs `whinny` and `nicker`
do not appear, and `snort`/`squeal` only inside a `context` that assigns their meaning
locally. A whinny is the contact call between separated animals, and every band so far has
shared a scope — so this may be a fact about the programs rather than about the language.

## 13. Off-thread work, designed and unbuilt

A `bachelor` group means *sees every band, and no band sees it* (§2.4). That one-way
visibility is exactly an isolate — data flows in, nothing reaches back except by message —
so work that happens somewhere else belongs there and nowhere else.

- `bachelor rendering out of sight`. `out of sight` is the condition under which a horse
  uses its long-range call, and it is what a worker is: no shared scope, nothing visible
  from either side.
- **A cue out of sight cannot `release`.** There is nobody to hand anything to. It
  `whinny`s, and the band `hears` it later, which is what a whinny is.
- **Work divides by field, not by queue.** Horses have no dispatcher and no work-stealing.
  What a herd divides is *attention*: each animal covers its own direction and coverage is
  the union. So a list is split evenly across the group, one share per animal, once.
- **`hands` becomes one boundary per locale.** A worker's `globalThis` has no document.
  Semantically right for the periphery, and the largest part of the change.
- The worker source is emitted from the same inline block and wrapped in a Blob URL. A
  separate file would break the reason the language is delivered as source.

Cost: a second compilation target, an isolate boundary, and a new meaning for `hands`. Not
to be built without a measurement showing main-thread CPU is the bottleneck.
