# HORSEtxt — Bibliography

This is the manual.

There is no tutorial and no semantic reference. Every construct in HORSEtxt is derived
from published equine ethology, and the paper is the documentation. Error messages cite
this file rather than explaining.

If a language behaviour cannot be traced to an entry here, it is a bug — not a feature of
the language. Foreign is not the same as arbitrary.

Ordered by what it explains.

---

## Chords — `^ … ^`, `_ … _`

**Wathan, Burrows, Waller & McComb (2015). EquiFACS: The Equine Facial Action Coding
System.** *PLOS ONE* 10(8): e0131738.
The token inventory: 17 Action Units, 4 Ear Action Descriptors, 7 Action Descriptors.
Left and right ears coded independently (`EAD103L`, `EAD103R`). The `H`/`1` prefix
convention. Also: horses have 17 AUs against 13 in chimpanzees.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0131738

**Lewis, McBride, Micheletta, Parker, Rincon, Wathan & Proops (2025). An ethogram of
facial behaviour in domestic horses.** *PeerJ* 13: e19309.
805 AU/AD combinations across 22 behaviours. Which movements are significantly associated
with agonistic, play, and attentional contexts. Why reordering a chord changes nothing and
adding to it changes everything.
https://peerj.com/articles/19309/

**(2025). Characterisation of facial expressions and behaviours of horses in response to
positive and negative emotional anticipation using network analysis.** *PLOS ONE*.
The load-bearing finding: positive and negative anticipation share an identical base and
differ only in what it connects to. *"It is the combination of action units that will
define the profile of a facial expression."*
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0319315

**Wathan & McComb (2014). The eyes and ears are visual indicators of attention in domestic
horses.** *Current Biology* 24(15).
Why the ear is the language's primary mark. Mask the ears and a horse can no longer read
another's attention. Ears rotate 180° on ten muscles and are aimed independently — one
forward and one back is divided attention, and it is readable.
https://www.sciencedaily.com/releases/2014/08/140804123009.htm

---

## Contextual meaning — signals, contexts, `hears`

**Wheeler & Fischer (2012). Functionally referential signals: a promising paradigm whose
time has passed.** *Evolutionary Anthropology* 21(5).
Why a signal does not have a fixed meaning, and why the field stopped modelling them that
way. The paper that HORSEtxt's spine is built on.
https://onlinelibrary.wiley.com/doi/10.1002/evan.21319

**Townsend & Manser (2013). Functionally Referential Communication in Mammals.**
*Ethology* 119(1).
https://onlinelibrary.wiley.com/doi/abs/10.1111/eth.12015

**Stanford Encyclopedia of Philosophy — Animal Communication.**
https://plato.stanford.edu/archives/fall2025/entries/animal-communication/

**Graded Signals.** *Encyclopedia of Animal Cognition and Behavior*, Springer.
Why `~` means "the receiver reads the variation" and not "roughly." A signal is graded
only if receivers perceive the variation as meaningful and adjust their responses —
gradedness is a property of uptake.
https://link.springer.com/rwe/10.1007/978-3-319-55065-7_1691

**Stomp et al. (2018). An unexpected acoustic indicator of positive emotions in horses.**
*PLOS ONE* 13(7): e0197898.
Snorts are reliably positive, twice as frequent at pasture as in stalls, rarer in horses
with degraded welfare. Cited to correct a common error: the snort is *not* the ambiguous
signal.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0197898

---

## Affect — `~a:~v`, and why it cannot collapse

**Briefer, Maigrot, Mandel, Freymond, Bachmann & Hillmann (2015). Segregation of
information about emotional arousal and valence in horse whinnies.** *Scientific Reports*
5: 9989.
Every whinny contains two fundamentals, F0 and G0, not harmonically related. F0 and the
energy spectrum encode arousal; G0 and duration encode valence. They vary independently.
This is why flattening affect to one magnitude is a type error.
https://www.nature.com/articles/srep09989

Also the source of involuntary provenance: a whinny encodes identity, sex, and body size
whether the animal intends it or not.

---

## Gaits — `walk`, `trot`, `pace`, `canter`, `gallop`, `tolt`

**The rhythm of horse gaits.** *PMC11776444*.
The scheduler timings. Inter-onset intervals: walk median 0.301s, trot 0.352s, canter
bimodal at 0.148 and 0.267s. Walk and trot isochronous; canter carries ratios of 1:1,
1:2 and 2:1 because its suspension runs twice as long as the intervals around it. This is
why `canter` is a different scheduler and not a rename.
https://pmc.ncbi.nlm.nih.gov/articles/PMC11776444/

**The Characteristics, Distribution, Function, and Origin of Alternative Lateral Horse
Gaits (2023).** *Animals* 13(16): 2557.
Why gaits are regions in a continuous phase space rather than keywords. The stepping pace
is explicitly uneven and sits between others.
https://www.mdpi.com/2076-2615/13/16/2557

**Promerová et al. (2014). Worldwide frequency distribution of the 'Gait keeper' mutation
in the DMRT3 gene.** *Animal Genetics*.
`genotype`. CA is four-gaited; AA is permissive for pace; tolt belongs to Icelandics.
https://pubmed.ncbi.nlm.nih.gov/24444049/

---

## `cue` / `release`, and the one-second contract

**What is reinforced? The timing of the release of rein tension and the horse's response
latency for trot to walk transitions (2025).** *Applied Animal Behaviour Science*.
Release is the reinforcer, not the pressure. Releasing within one second of the first
attempt cut required tension by roughly half. **Late release punishes the correct
response.** The budget is not a style preference.
https://www.sciencedirect.com/science/article/pii/S0168159125000887

**McGreevy & McLean (2009). Punishment in horse-training and the concept of ethical
equitation.** *Journal of Veterinary Behavior*.
How poorly timed negative reinforcement escalates to learned helplessness, which retrying
cannot repair.
https://www.sciencedirect.com/science/article/abs/pii/S1558787808001123

---

## `spook`, `habituates`, `flood`

**Christensen et al. (2011). Behavioural fear and heart rate responses of horses after
exposure to novel objects: Effects of habituation.** *Applied Animal Behaviour Science*.
Habituation is stimulus-specific: desensitising to one object leaves the response to
others intact. This is why the exposure count is keyed per stimulus and not per handler.
https://www.sciencedirect.com/science/article/abs/pii/S0168159111000530

**Evaluating the Reaction to a Complex Rotated Object in the American Quarter Horse
(2021).** *Animals*.
A familiar object, rotated, reads as novel again. This is why the habituation key is a
*structural* hash and why changing an error's shape resets the count.
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8152253/

**Habituation and sensitization.** IFCE Équipédia.
Staged sub-threshold exposure. Why `flood` warns: flooding produces learned helplessness.
Also the model for compiler error reporting — a few at a time, below the tolerance
threshold, never all at once.
https://equipedia.ifce.fr/en/equipedia-the-universe-of-the-horse-ifce/health-and-animal-well-being/animal-behaviour-and-well-being/relationship-between-man-and-horse/habituation-and-sensitization

---

## `balk`, `leave`, `blank` — refusal as a terminal success

**Mejdell, Buvik, Jørgensen & Bøe (2016). Horses can learn to use symbols to communicate
their preferences.** *Applied Animal Behaviour Science* 184.
Three glyphs — horizontal stroke, vertical stroke, and **a blank meaning "no change"**.
23 of 23 horses, two weeks, a ten-step program. `blank` must be actively emitted, never
implied. Also the source of the package model: the *protocol* transferred to every horse;
no trained horse transferred at all.
https://www.sciencedirect.com/science/article/pii/S0168159116302192

**Garrano Horses Perceive Letters of the Alphabet on a Touchscreen System (2022).**
*Animals*.
Horses free to leave; 2.7% of sessions ended in refusal, recorded as data. Also: mean
response latency 3.98s (range 2–6), and individual differences that were not noise —
younger horses out-learned older, one animal failed to criterion entirely, and Flore
(right eye non-functional) needed trials launched only after she turned her head left,
then learned to position herself.
https://pmc.ncbi.nlm.nih.gov/articles/PMC9774258/

---

## `weather`, `forage`, `recognise` — the three kinds of uncertainty

**Mejdell, Bøe & Jørgensen (2019). The effect of weather conditions on the preference in
horses for wearing blankets.** *Applied Animal Behaviour Science* 212.
Why the random source is `weather` and not `chance`. Horses asked for a blanket in wet,
windy, cold conditions and refused one in good weather, tracking ambient temperature,
wind, and precipitation they could neither control nor predict. An uncontrolled exogenous
input the animal reads and responds to is what a random source is — so `weather` is read,
never generated.
https://www.sciencedirect.com/science/article/abs/pii/S0168159118306361

`forage` (draw without replacement) and `recognise` (deterministic derivation) are cited
under refusal and retention respectively. The three are separate constructs, and
deliberately so: `forage` depletes, `recognise` is stable, `weather` is read. Silently
substituting one for another is the kind of bug that only shows up much later, so the
grammar makes it impossible rather than discouraged.

### The individual conditions

Each axis of `weather` stands on its own citation. Mejdell is why weather is the random
source; it does not carry every axis.

**Morgan (1998). Thermoneutral zone and critical temperatures of horses.** *Journal of
Thermal Biology* 23(1).
`weather.cold` reads distance below the **lower critical temperature**, not a temperature.
The thermoneutral zone runs roughly 5–25°C for a natural winter coat, and the LCT ranges
from about +5°C in mild climates to −15°C in cold-adapted horses. Full acclimatization
takes around 21 days. **This is why the reading is individual** — the same weather is a
different reading for a different animal.
https://www.sciencedirect.com/science/article/abs/pii/S0306456597000478

**Thermoregulation of horses in cold, winter weather: A review.** *Livestock Production
Science*.
`weather.wet` and `weather.wind`. A wet coat loses up to 90% of its insulating capacity;
rain flattens the hair and defeats the undercoat's trapped air; wind strips the warm layer
off the skin. Cold rain with wind is more demanding than low temperature alone — which is
why the conditions compound rather than sum.
https://www.sciencedirect.com/science/article/abs/pii/0301622694902666

**Protective behaviour of Konik horses in response to insect harassment.** *Animal
Welfare*, Cambridge.
`weather.flies`, and `weather.sun` as its upstream cause. Insect pressure is the largest
behavioural driver on the list: tail swishing, head shaking, leg lifting, skin twitching,
stomping, and bunching for mutual protection. Shelter was used on **69%** of high-fly days
against **14%** of low-fly days. Critically, **wet and windy weather significantly reduces
insect harassment**, and flies are active in sun and avoid shade — which is the documented
anti-correlation that makes `weather` a system rather than a bag of random numbers.
https://www.cambridge.org/core/journals/animal-welfare/article/abs/protective-behaviour-of-konik-horses-in-response-to-insect-harassment/F091DCB38B2AA52B20C469C6D695B6F9

**Not cited because not supported:** barometric pressure. Widely claimed as something
horses sense, weakly evidenced. Recorded as a rejection so the constraint is visibly
load-bearing.

---

## Laterality — `from the left`, `from the right`

**Horses show individual level lateralisation when inspecting an unfamiliar and unexpected
stimulus (2021).**
Left eye feeds the right hemisphere: novelty, threat, predator detection, escape, negative
valence. Right eye feeds the left: analytical categorisation. Sensory laterality shifts
faster and more situationally than motor laterality, which is why the current side is
ambient rather than fixed.
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8341651/

**Heart and brain: change in cardiac entropy is related to lateralised visual inspection
in horses (2023).** *PLOS ONE*.
https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0289753

---

## Scope — `flight zone`, `pressure zone`, the point of balance

**Grandin. Understanding Flight Zone and Point of Balance for Low Stress Handling.**
Flight zone: approach and it moves away. Pressure zone: it turns to face you but does not
move. Point of balance at the shoulder: pressure behind drives forward, in front drives
back.
https://www.grandin.com/behaviour/principles/flight.zone.html

---

## `band`, `herd`, `bachelor`, `lead mare`

**Social organisation in herds of horses.** IFCE Équipédia.
A band is one stallion, 2–4 mares, and offspring — the source of the band-size lint. The
leader is an older mare with knowledge of the home range, **not** the stallion. Young
males leave at 2–3 years for bachelor groups, where they spend their time in play and
fight simulation, which is why `bachelor` is the test group.
https://equipedia.ifce.fr/en/equipedia-the-universe-of-the-horse-ifce/health-and-animal-well-being/animal-behaviour-and-well-being/horse-behaviour/social-organisation-in-herds-of-horses

**The Use/Misuse of Leadership and Dominance Concepts in Horse Training.**
Why the alpha-stallion framing is wrong and `lead mare` is the entry point.
https://www.eurodressage.com/2018/12/27/usemisuse-leadership-and-dominance-concepts-horse-training

---

## `sentinel`, `rest`, `recumbent`

**Is Your Horse Getting Enough Sleep?** *The Horse*.
One horse stays watchfully awake while the others sleep, and **the role rotates**. The stay
apparatus allows standing sleep with near-zero muscular effort — a suspended-but-ready
process. REM requires lateral recumbency, full muscle relaxation, and closed eyes: a
process that has truly yielded.
https://thehorse.com/1130383/is-your-horse-getting-enough-sleep/

---

## `flehmen`, `pile`, and the senses

**Sensory Abilities of Horses and Their Importance for Equitation Science (2020).**
*Animals*.
https://pmc.ncbi.nlm.nih.gov/articles/PMC7509108/

**Communication in horses.** IFCE Équipédia.
Flehmen always follows olfactory stimulation and routes a smell for finer analysis — why
there is no direct deep read. Stallions leave accumulating dung piles as a persistent
olfactory trace: append-only, spatially addressed, asynchronous. The `pile`.
https://equipedia.ifce.fr/en/equipedia-the-universe-of-the-horse-ifce/health-and-animal-well-being/animal-behaviour-and-well-being/horse-behaviour/communication-in-horses

---

## Blind spots, dichromacy, and rendering limits

**Photopigment basis for dichromatic color vision in the horse (2003).** *Journal of
Vision* 3(3).
Two cone types, peaks at 428nm and 539nm. Blue and yellow discriminable from grey; red and
green not.
https://jov.arvojournals.org/article.aspx?articleid=2121452

**Vision in the Equine.** Iowa State Extension.
~350° field, ~65° binocular. Blind directly behind, and directly beneath and in front of
the forehead — a horse cannot see its own muzzle. Why a value held too close cannot be
read, and why depth is unavailable for most values.
https://www.extension.iastate.edu/equine/vision-equine

---

## `hands` — why interop sits outside the effect system

**Ringhofer & Yamamoto (2016). Domestic horses send signals to humans when they face with
an unsolvable task.** *Animal Cognition* 20.
Horses recruit human help with visual and tactile signals, and signal **more** when the
human did not witness the event — modulating by the human's apparent knowledge state.
https://link.springer.com/article/10.1007/s10071-016-1056-4

**Ringhofer et al. (2021). Horses with sustained attention follow the pointing of a human
who knows where food is hidden.** *Scientific Reports* 11.
https://www.nature.com/articles/s41598-021-95727-8

Together: horses signal to humans deliberately and *differently* than to conspecifics. A
separate channel, not a dialect of the same one — which is why `hands` is flat and
unconditioned.

And it names the capability rather than the role: the horses *recruited* a human because
the task was unsolvable for them. A prehensile upper lip is dexterous but cannot work a
latch. Interop is for what the language cannot do itself.

---

## Retention — why training persists to the `pile`

**Hanggi & Ingersoll (2009). Long-term memory for categories and concepts in horses.**
*Animal Cognition* 12.
A discrimination retained at six years; a categorisation recalled at ten. Learn the token
once and it holds.
https://link.springer.com/article/10.1007/s10071-008-0205-9

---

## Ethics

**Mancini. Towards an animal-centred ethics for Animal–Computer Interaction.**
*International Journal of Human-Computer Studies*.
The animal is a stakeholder whose characteristics, needs, and wants must directly inform
the design. In HORSEtxt this is not a preamble — it is why welfare gates capability and
why refusal is a terminal success.
https://www.sciencedirect.com/science/article/abs/pii/S1071581916300180
