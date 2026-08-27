import { Weather } from "./weather.js";

// HORSEtxt runtime. Emitted code calls into this.
//
// Everything here traces to BIBLIOGRAPHY.md. Where v0.1 implements a shape without
// its full behaviour, the comment says so rather than pretending.

// ---------------------------------------------------------------- terminal outcomes
//
// GRAMMAR.md §10 — balk, leave and blank are terminal successes, not errors. They
// are thrown because that is how control leaves a nested block in JavaScript, but
// nothing treats them as failures and they never reach an error report.

export class Balk {
  constructor(where) { this.where = where; }
}
export class Leave {
  constructor(where) { this.where = where; }
}

// Ceasing locomotion. Not a terminal outcome — the animal is still there, it has
// just stopped moving — so a halt ends the innermost gait it is inside and nothing
// more. Outside a gait there is nothing to stop, and it does nothing.
export class Halted {}

// The release travels the same way. It has to: a gait, a graze and a stand each
// compile their body to a callback, so a plain `return` there would leave the
// callback and not the cue. Every outcome leaves a cue by unwinding to its boundary.
export class Released {
  constructor(value) { this.value = value; }
}

export const REFUSED = Symbol("refused");

// ------------------------------------------------------------------------- affect
//
// F0 and G0 are not harmonically related and do not reduce to one pitch. Making
// valueOf throw is the enforcement: any JavaScript operation that would coerce an
// affect to a number fails at the point of the collapse.

export class Affect {
  constructor(arousal, valence) {
    this.arousal = arousal;
    this.valence = valence;
  }
  valueOf() {
    throw new TypeError(
      "affect does not collapse to one magnitude; name .arousal or .valence\n" +
      "  Briefer et al. 2015, Scientific Reports 9989",
    );
  }
  toString() { return `~${this.arousal}:~${this.valence}`; }
}

// A graded value is a plain number carrying the fact that it is graded. Numbers do
// collapse; that is the difference between §2.5.2(b) and §2.5.2(e).
export function graded(n) { return n; }
export function affect(a, v) { return new Affect(a, v); }

// -------------------------------------------------------------------------- ranges

export function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

// ------------------------------------------------------------------------- forage
//
// A grazed patch depletes and then regrows. Not seeded and not recorded: the order
// is drawn, not chosen. Exposing a position would make it reproducible, so Forage
// has no index, no first and no last (STDLIB.md).

class Forage {
  constructor(source, regrows) {
    this.source = Array.from(source);
    this.regrows = regrows;
    this.remaining = [];
    this.refill();
  }
  refill() {
    this.remaining = Array.from(this.source);
    for (let i = this.remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
    }
  }
  get count() { return this.remaining.length; }
  get empty() { return this.remaining.length === 0; }
  get graze() {
    if (this.remaining.length === 0) {
      if (!this.regrows) throw new Balk("exhausted forage");
      this.refill();
    }
    return this.remaining.pop();
  }
}

export function forage(source, regrows) { return new Forage(source, regrows); }

// -------------------------------------------------------------------------- weather
//
// GRAMMAR.md §6.4, implemented in weather.js: correlated, autocorrelated, and with
// `cold` read against the individual's lower critical temperature. Fixing the shape
// in v0.1 meant this could land as a runtime change and not a syntax change.

const CONDITIONS = new Set(["cold", "wet", "wind", "sun", "flies"]);

// Kept for callers that want a reading with no animal and no host.
export function weather(condition) {
  return new Weather({}).read(condition);
}

// ------------------------------------------------------------------------ recognise
//
// Same input, same identity, every time — a discrimination retained at six years
// and a categorisation at ten. djb2 into xorshift32: a hash with good dispersal
// feeding a PRNG with a short period, which is enough for stable recall.

export function recognise(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  let x = h || 1;
  x ^= x << 13; x |= 0;
  x ^= x >>> 17;
  x ^= x << 5; x |= 0;
  return (x >>> 0) / 4294967296;
}

// ----------------------------------------------------------------------------- pile
//
// Append-only, keyed, persistent — the stud pile. Storage can throw (private mode)
// and can come back empty, and a pile must read correctly with nothing stored.

// Read fresh every time, and never cached. Caching the reference meant a page that
// swapped `localStorage` kept writing to the old one; caching the *failure* meant
// storage stayed off forever once any probe threw. Access can throw and can come
// back empty, so both are simply tried.
function storage() {
  try {
    const s = globalThis.localStorage;
    s.getItem("horsetxt.probe");
    return s;
  } catch (e) {
    return null;
  }
}

class Pile {
  constructor(key) {
    this.key = key;
    this.entries = this.load();
  }
  load() {
    try {
      const s = storage();
      const raw = s && s.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  save() {
    try {
      const s = storage();
      if (s) s.setItem(this.key, JSON.stringify(this.entries));
    } catch (e) { /* a pile that cannot be written is still a pile */ }
  }
  append(value) { this.entries.push(value); this.save(); return value; }
  get count() { return this.entries.length; }
  get empty() { return this.entries.length === 0; }
  get graze() { return this.entries[this.entries.length - 1]; }

  // Every mark, oldest first, and indexable — unlike forage, whose order is *drawn*
  // and where exposing a position would make the draw reproducible. A pile's order
  // is the order things happened, so reading a trail off it is the point.
  //
  // A copy: a pile is append-only, and handing out the array would let a caller
  // rewrite what was already left.
  get marks() { return this.entries.slice(); }
}

export function pile(key) { return new Pile(key); }

// ------------------------------------------------------------------- the individual
//
// GRAMMAR.md §2 and design §2.6.3 — optional at the boundary, involuntary within.
// With no declared individual, training, welfare, degradation and gait tempo do not
// exist. With one, everything it does is conditioned, and nothing can opt out.

const NATURAL_BAND = 8; // one stallion, two to four mares, and offspring

// Measured inter-onset intervals, in milliseconds (BIBLIOGRAPHY.md, gaits).
const TEMPO = { walk: 301, trot: 352, pace: 352, canter: 148, gallop: 148, tolt: 301, back: 301 };

// A gait is a limb-phase vector, not a case in a switch. Each number is the point in
// the stride at which that limb strikes, as a fraction of the cycle; limbs sharing a
// phase strike together. The named gaits are anchors in that space, which is what
// §5 has always said they were.
//
// `duty` is how long a hoof stays down. Above 0.25 in a four-beat gait, at least one
// hoof is always down — which is the whole difference between a walk and a tolt,
// since their phase vectors are identical.
//
//                                    LH    LF    RH    RF
const LIMBS = ["LH", "LF", "RH", "RF"];
const ANCHORS = {
  // Four beats, evenly spaced, lateral sequence: LH, LF, RH, RF.
  walk:   { phases: [0.00, 0.25, 0.50, 0.75], duty: 0.60 },
  // The same sequence and the same spacing, held longer: no suspension, so the
  // strides of a held tolt run back to back.
  tolt:   { phases: [0.00, 0.25, 0.50, 0.75], duty: 0.70 },
  // Two beats, diagonal pairs: LF with RH, then RF with LH.
  trot:   { phases: [0.50, 0.00, 0.00, 0.50], duty: 0.40 },
  // Two beats, lateral pairs: LF with LH, then RF with RH.
  pace:   { phases: [0.00, 0.00, 0.50, 0.50], duty: 0.40 },
  // Three beats and a suspension twice as long as the intervals around it, which is
  // the 1:1, 1:2, 2:1 the measurements show. Right lead: LH, then RH with LF, then RF.
  canter: { phases: [0.00, 0.25, 0.25, 0.50], duty: 0.35 },
  // The canter with its diagonal pair broken: four separate beats, then suspension.
  gallop: { phases: [0.00, 0.40, 0.20, 0.60], duty: 0.30 },
};

// A gait on the far side of a lead is its mirror: the pairs swap sides.
function mirrored(vector) {
  const [lh, lf, rh, rf] = vector.phases;
  return { phases: [rh, rf, lh, lf], duty: vector.duty };
}

// The stride's shape: how many limbs strike at each beat, in the order the beats
// happen. A trot is [2, 2] — two pairs. A canter is [1, 2, 1]. A walk is [1,1,1,1].
function shapeOf(vector) {
  const counts = new Map();
  for (const p of vector.phases) counts.set(p, (counts.get(p) || 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

// Statements are filled into the stride **in the order the beats happen**, not
// assigned to named limbs.
//
// Assigning statement 0 to the left hind was the obvious reading and it was wrong:
// statements have an order, not a limb identity. It meant two statements in a trot
// landed on a hind and a fore of the same side — which strike at different times —
// so the canonical two-at-once gait ran them sequentially, and statement 0 could
// happen last for no reason a reader could derive.
function schedule(vector, thunks) {
  const sizes = shapeOf(vector);
  const groups = [];
  let i = 0;
  while (i < thunks.length) {
    for (const size of sizes) {
      if (i >= thunks.length) break;
      groups.push(thunks.slice(i, i + size));
      i += size;
    }
  }
  return groups;
}

// Between two anchors. Halfway from a walk to a pace is a stepping pace — a real
// gait, slightly uneven and lateral, which falls out of the arithmetic rather than
// having to be listed.
export function between(a, b, t) {
  const x = ANCHORS[a], y = ANCHORS[b];
  if (!x || !y) throw new TypeError(`${!x ? a : b} is not a gait`);
  return {
    phases: x.phases.map((p, i) => p + (y.phases[i] - p) * t),
    duty: x.duty + (y.duty - x.duty) * t,
  };
}

export { ANCHORS as gaits };

export class Horse {
  // A spook must not swallow a terminal outcome: balking and leaving are successes
  // travelling out through the same channel errors use.
  static Balk = Balk;
  static Leave = Leave;

  constructor(host = {}) {
    this.host = host;
    this.individual = null;
    this.genotypeAllele = "CA";
    this.breed = null;

    this.sky = new Weather(host);
    this.contexts = [];   // effect handler stack
    this.loops = 0;       // gaits and sentinels currently running, for `halt`
    this.attending = true; // set by chords; ears are attention
    this.side = "right";   // ambient laterality
    this.posture = null;

    this.exposures = new Map(); // habituation counts, keyed per stimulus shape
    this.trials = new Map();    // cue -> times called
    this.diagnostics = [];
    this.releaseBudget = 1000;  // ms; release is the reinforcer
    this.left = false;          // set when `leave` ends the program
  }

  // -------------------------------------------------------------- declarations

  declare(individual) {
    this.individual = individual;
    this.sky.individual = individual;
    for (const t of individual.traits || []) {
      if (t.kind === "bias") this.side = t.side;
    }
    return individual;
  }

  genotype(allele, breed) {
    this.genotypeAllele = allele;
    this.breed = breed;
    return allele;
  }

  // A gait is reachable only if the genotype permits it.
  checkGait(gait) {
    if (gait === "pace" && this.genotypeAllele !== "AA") {
      throw new TypeError(
        "pace requires the AA allele of DMRT3\n" +
        "  Promerova et al. 2014, Animal Genetics",
      );
    }
    if (gait === "tolt" && this.breed !== "icelandic") {
      throw new TypeError(
        "tolt requires an Icelandic\n" +
        "  Promerova et al. 2014, Animal Genetics",
      );
    }
  }

  get conditioned() { return this.individual !== null; }

  band(name, size) {
    if (size > NATURAL_BAND) {
      this.note(
        `band ${name} holds ${size} declarations; a band is one stallion, ` +
        `2-4 mares and offspring`,
        "IFCE, social organisation in herds of horses",
      );
    }
  }

  note(message, citation) {
    this.diagnostics.push({ message, citation });
  }

  // ---------------------------------------------------------------------- cues
  //
  // Release is the reinforcer, not the pressure. Releasing within one second of the
  // first attempt cut required rein tension by about half; late release punishes the
  // correct response. v0.1 reports it. Degradation toward learned helplessness is
  // v0.3, and needs the declared individual to persist.

  cue(name, params, body, opts = {}) {
    const self = this;
    const fn = async (...args) => {
      const started = Date.now();
      const contextDepth = self.contexts.length;
      self.trials.set(name, (self.trials.get(name) || 0) + 1);
      try {
        const out = await body(...args);
        self.checkRelease(name, started);
        return out;
      } catch (e) {
        if (e instanceof Released) {
          self.checkRelease(name, started);
          return e.value;
        }
        if (e instanceof Balk) {
          self.checkRelease(name, started);
          return REFUSED;
        }
        throw e;
      } finally {
        self.contexts.length = contextDepth;
      }
    };
    fn.cueName = name;
    fn.isCue = true;
    fn.arity = params.length;
    fn.lead = !!opts.lead;
    return fn;
  }

  checkRelease(name, started) {
    const elapsed = Date.now() - started;
    if (elapsed > this.releaseBudget) {
      this.note(
        `${name} released after ${elapsed}ms; the release is the reinforcer, and a ` +
        `late release punishes the response it should reward`,
        "Applied Animal Behaviour Science 2025, rein tension release timing",
      );
    }
  }

  // Unwinds to the cue boundary, so a release from inside a gait, a graze or a
  // stand releases the cue rather than merely returning from a callback.
  release(value) { throw new Released(value); }

  balk(where) { throw new Balk(where); }
  leave(where) { throw new Leave(where); }
  // Mejdell's third symbol was a blank glyph meaning "no change", and the horse had
  // to press it: the no-change answer is *given*, not inferred from silence. So it
  // is a terminal outcome like the others, and it leaves the cue.
  //
  // It was a plain no-op through v0.2.1, which made every `when ... blank` guard
  // fall straight through while §3 and the resolver both listed it as a way out.
  blank() { throw new Released(undefined); }

  // A halt inside a gait ends that gait, including a held one. Outside a gait there
  // is nothing to stop. This is the only way a program can end its own `every` loop:
  // `leave` ends everything, and the host's stop belongs to the host.
  halt() {
    if (this.loops > 0) throw new Halted();
    return undefined;
  }

  // Calls route through here so laterality and provenance apply. `hands` does not:
  // it is a flat, unconditioned boundary (GRAMMAR.md §11).
  async call(callee, args, side) {
    if (typeof callee !== "function") {
      throw new TypeError(`${String(callee)} is not a cue`);
    }
    const previous = this.side;
    if (side) this.side = side;
    try {
      return await callee(...args);
    } finally {
      this.side = previous;
    }
  }

  // -------------------------------------------------------------------- chords
  //
  // Ears are attention. EAD101 forward is attention; EAD103 is the ear flattener
  // and is agonistic; a horse cannot read another's attention with the ears masked.
  // So a chord's ears set whether this animal is attending — and an animal that is
  // not attending does not answer signals. Silence is a result, not an error.

  async chord(open, close, states, lateral) {
    const ears =
      open === "^" && close === "^" ? "forward" :
      open === "_" && close === "_" ? "agonistic" : "divided";

    this.posture = { ears, states, lateral: lateral || this.side };
    this.attending = ears !== "agonistic";
    if (this.host.onChord) this.host.onChord(this.posture);
    return this.posture;
  }

  state(name) { return { state: name }; }
  facs(code) { return { facs: code }; }

  // ------------------------------------------------------------------- contexts
  //
  // A signal has no meaning of its own. It names an event and hands it to the
  // nearest enclosing context, which decides what it means here. This is the
  // algebraic-effects reading of Wheeler & Fischer 2012.

  pushContext(name, handlers) {
    this.contexts.push({ name, handlers });
  }

  popContext() {
    this.contexts.pop();
  }

  // Back off. The caller decides whether to try again — a shy is not a refusal.
  shy() { return undefined; }

  terminal(e) {
    return e instanceof Balk || e instanceof Leave ||
           e instanceof Released || e instanceof Halted;
  }

  // Every emission carries its emitter's provenance whether it wants to or not: a
  // whinny encodes identity, sex and body size in the source. There is no way to
  // call this without one.
  async signal(name, value, provenance) {
    const carried = {
      ...provenance,
      individual: this.individual ? this.individual.name : null,
      side: this.side,
    };

    const field = async () => {
      // Ears are attention, and an animal that is not attending does not answer.
      if (!this.attending) {
        return { answered: false, by: null, reason: "not attending", carried };
      }
      for (let i = this.contexts.length - 1; i >= 0; i--) {
        const ctx = this.contexts[i];
        const handler = ctx.handlers[name];
        if (!handler) continue;
        // A handler is not a cue, so an outcome raised inside one stops here: its
        // answer is the answer to this signal. Without this, a handler that blanked
        // unwound past the handler and terminated whichever cue had emitted the
        // signal — silently truncating the caller.
        let result;
        try {
          result = await handler(value, carried);
        } catch (e) {
          if (e instanceof Released) result = e.value;
          else if (e instanceof Balk) return { answered: true, by: ctx.name, refused: true, carried };
          else throw e;
        }
        return { answered: true, by: ctx.name, value: result, carried };
      }
      // Nobody answered. That is information, not a timeout.
      return { answered: false, by: null, reason: "nobody there", carried };
    };

    const answer = await field();
    // An emission returns the field rather than a value, so the field is worth
    // watching: silence is a result, and it is otherwise visible only as absence.
    if (this.host.onSignal) this.host.onSignal(name, answer);
    return answer;
  }

  // ---------------------------------------------------------------------- gaits
  //
  // A gait is a named region of limb-phase space. v0.1 implements the scheduling
  // structure — which statements are simultaneous, and in what grouping — from the
  // published footfall sequences. Tempo is real only under a declared individual,
  // because tempo is conditioned by the animal.

  async gait(name, thunks, opts = {}) {
    this.checkGait(name);
    this.loops++;
    try {
      // `every` holds the gait: the body repeats. Every gait pauses between strides
      // except the tolt, which has no suspension — at least one hoof is always down,
      // so the next stride begins without a gap.
      if (opts.interval != null) {
        const ms = durationMs(opts.interval);
        for (;;) {
          await this.stride(name, thunks, opts);
          if (this.left) return;
          if (this.host.stop && this.host.stop()) return;
          if (name !== "tolt") await sleep(ms);
        }
      }
      return await this.stride(name, thunks, opts);
    } catch (e) {
      // A halt ends this gait and only this gait, so a nested gait halts first.
      if (e instanceof Halted) return;
      throw e;
    } finally {
      this.loops--;
    }
  }

  // One stride. The schedule comes from the gait's phase vector: limbs that strike
  // together run together, and the groups run in phase order. `back` is the one
  // exception — reversing is not a phase relationship, it is a direction.
  async stride(name, thunks, opts = {}) {
    const beat = this.conditioned ? (TEMPO[name] || 0) : 0;

    if (name === "back") {
      for (const t of Array.from(thunks).reverse()) {
        await t();
        if (beat) await sleep(beat);
      }
      return;
    }

    let vector = opts.vector || ANCHORS[name];
    if (!vector) throw new TypeError(`${name} is not a gait`);
    // A lead is which side leads; the far side is the mirror of the near one.
    if (opts.lead === "left") vector = mirrored(vector);

    for (const group of schedule(vector, thunks)) {
      if (group.length === 1) await group[0]();
      else await Promise.all(group.map((t) => t()));
      if (beat) await sleep(beat);
    }

    // The suspension: what is left of the stride after the last hoof leaves. A tolt
    // has none, which is why its strides run back to back.
    if (beat) {
      const last = Math.max(...vector.phases);
      const suspension = Math.max(0, 1 - last - vector.duty);
      if (suspension > 0.01) await sleep(beat * suspension * 4);
    }
  }


  // ---------------------------------------------------------------------- stand
  //
  // The one input in the language that withholds motion rather than producing it.
  // It needs a pointer; with no host providing one the hold cannot be held, so it
  // breaks — and a broken hold runs `otherwise`.

  async stand(opts, body, otherwise) {
    const ms = opts.duration == null ? 0 : durationMs(opts.duration);
    const jitter = opts.within == null ? Infinity : distancePx(opts.within);

    if (!this.host.hold) {
      if (otherwise) return otherwise();
      throw new Balk("nothing to hold still against");
    }
    const held = await this.host.hold({ ms, jitter, onProgress: body });
    if (!held && otherwise) return otherwise();
    if (!held) throw new Balk("the hold broke");
    return undefined;
  }

  // -------------------------------------------------------------------- traversal
  //
  // Grazing is the horse's iteration: 16-18 hours a day moving through forage,
  // taking each mouthful. Horses are selective grazers, so a `blank` in the body
  // advances without acting — that is the filter.

  async graze(source, body, driven = "forward") {
    // Order matters, and `source.entries` is a trap: every Array has one as a
    // *method*, so a truthiness check on it grabs the function and grazing a plain
    // list silently fails.
    let items;
    if (source instanceof Forage) items = drain(source);
    else if (source instanceof Pile) items = source.entries.slice();
    else if (source == null) items = [];
    else if (Array.isArray(source)) items = source;
    else if (typeof source[Symbol.iterator] === "function") items = Array.from(source);
    else throw new TypeError(`${String(source)} cannot be grazed`);

    // The point of balance is at the shoulder. Pressure behind it drives the animal
    // forward; pressure in front of it drives it back (GRAMMAR.md §12g).
    if (driven === "back") items = items.slice().reverse();

    for (const item of items) {
      await body(item);
      if (this.left) return;
    }
  }

  // ------------------------------------------------------------------------ spook
  //
  // Habituation is stimulus-specific, and a rotated familiar object reads as novel
  // again — so the count is keyed to the *shape* of the stimulus. Change the shape
  // and the count resets, which is why the key is structural.

  shape(err) {
    if (err === null || err === undefined) return "nothing";
    if (err instanceof Error) return `${err.constructor.name}:${err.message.slice(0, 80)}`;
    if (typeof err === "object") return `object:${Object.keys(err).sort().join(",")}`;
    return `${typeof err}`;
  }

  habituated(key, limit) {
    if (limit == null) return false;
    const seen = this.exposures.get(key) || 0;
    return seen >= limit;
  }

  expose(key) {
    this.exposures.set(key, (this.exposures.get(key) || 0) + 1);
  }

  // ------------------------------------------------------------- flehmen, looking
  //
  // There is no direct deep read. Flehmen routes a thing for finer analysis, as the
  // animal routes an odour to the vomeronasal organ. It is a separate act.
  //
  // Laterality: the left eye feeds the right hemisphere — novelty, threat, escape.
  // So a left-side inspection of something this animal has not met raises `novel`,
  // which a `spook` can handle. The right eye feeds the left hemisphere and
  // categorises instead.

  // GRAMMAR.md §12g. The side is not decoration on one operation — it selects which
  // question was asked, because the hemispheres do different work.
  //
  // `held` is what the enclosing cue was handed. A horse cannot see its own muzzle,
  // so what you are holding is what you cannot look at.
  async flehmen(value, side, held = []) {
    // Both ears flattened is agonistic, and an agonistic animal is not attending.
    // Attention is read from eyes and ears together; without it there is no looking.
    if (!this.attending) {
      throw new Balk("not attending; a flattened ear is not a look");
    }
    if (held.some((h) => h === value)) {
      throw new Balk("that is at your muzzle");
    }

    const s = side || this.side;
    const key = this.trace(value);
    const met = this.exposures.has(key);
    this.expose(key);

    // Left eye, right hemisphere: novelty, threat, escape. The question is whether
    // this is new, and the answer is a truth.
    if (s === "left") {
      if (!met) await this.signal("novel", value, { via: "flehmen" });
      return !met;
    }

    // Right eye, left hemisphere: analytical categorisation. The question is what
    // kind of thing this is, and the answer is a category.
    return this.category(value);
  }

  // What makes one thing the same thing as another, for the purpose of having met
  // it before. Distinct from `shape`, which keys habituation on the *kind* of a
  // failure — reusing that here made every string one stimulus, so meeting one
  // string counted as having met them all.
  //
  // A thing you can hold is identified by what it is; a thing with parts is
  // identified by its parts, which is why a familiar object rotated reads as novel.
  trace(value) {
    if (value === null || value === undefined) return "nothing";
    const t = typeof value;
    if (t === "number" || t === "string" || t === "boolean") return `${t}:${value}`;
    if (t === "function") return `cue:${value.cueName || "hands"}`;
    if (Array.isArray(value)) return `many:${value.length}:${value.map((v) => this.trace(v)).join(",")}`;
    if (value instanceof Affect) return `affect:${value.arousal}:${value.valence}`;
    try {
      return `thing:${Object.keys(value).sort().join(",")}`;
    } catch (e) {
      return "thing";
    }
  }

  category(value) {
    if (value === null || value === undefined) return "nothing";
    if (value instanceof Affect) return "affect";
    if (value instanceof Forage) return "forage";
    if (value instanceof Pile) return "pile";
    if (Array.isArray(value)) return "many";
    if (typeof value === "function") return value.isCue ? "cue" : "hands";
    if (typeof value === "object") return "thing";
    return typeof value; // number, string, boolean
  }

  // -------------------------------------------------------------- rest, sentinel
  //
  // One member stays awake while the others sleep, and the role rotates. Standing
  // sleep on the stay apparatus is upright and near-costless; REM needs lateral
  // recumbency and full muscle relaxation, so it is expensive to leave.

  async sentinel(interval, thunks) {
    const ms = durationMs(interval);
    let turn = 0;
    this.loops++;
    try {
      for (;;) {
        const watcher = thunks[turn % thunks.length];
        if (watcher) await watcher();
        turn++;
        await sleep(ms);
        if (this.left) return;
        if (this.host.stop && this.host.stop()) return;
      }
    } catch (e) {
      if (e instanceof Halted) return; // the watch ends; the rotation stops
      throw e;
    } finally {
      this.loops--;
    }
  }

  async rest(deep) {
    if (!deep) return undefined;          // stay apparatus: upright, ready
    await sleep(0);                        // recumbent: fully yielded
    return undefined;
  }

  watch(target) { if (this.host.onWatch) this.host.onWatch(target); return target; }

  get hands() { return globalThis; }

  // ------------------------------------------------------------- value builders
  //
  // These are methods, not bare exports, because emitted code reaches everything
  // through `H` — and because they will need the animal. `weather.cold` must read
  // against this individual's lower critical temperature in v0.2, which a free
  // function could not do.

  range(from, to) { return range(from, to); }
  forage(source, regrows) { return forage(source, regrows); }
  pile(key) { return pile(key); }

  // Append-only, spatially addressed, left for whoever passes. A pile is added to,
  // never replaced.
  leaveTrace(p, value) {
    if (!(p instanceof Pile)) {
      throw new TypeError("only a pile can be left a trace");
    }
    return p.append(value);
  }

  // `weather.cold` is read against *this* animal's lower critical temperature, so
  // the same weather is a different reading for a different individual — the same
  // pattern as everything else here: conditioned by the receiver.
  weather(condition) { return this.sky.read(condition); }

  // A fresh independent draw, 0..1. Plain, per principle zero: a coin flip has no
  // equine analogue. It is emphatically not `weather`, which is slow, shared and
  // correlated — read three times in an instant, weather gives one answer and
  // `chance` gives three.
  chance() { return Math.random(); }
  recognise(value) { return recognise(value); }
  graded(n) { return graded(n); }
  affect(a, v) { return affect(a, v); }
  duration(value, unit) { return { value, unit }; }
  distance(value, unit) { return { value, unit }; }

  truth(v) {
    if (v instanceof Affect) {
      throw new TypeError("an affect is not a truth; name .arousal or .valence");
    }
    return !!v;
  }
}

// -------------------------------------------------------------------------- helpers

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

function pairs(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

function drain(f) {
  const out = [];
  while (!f.empty) out.push(f.graze);
  return out;
}

const DURATION_MS = { ms: 1, s: 1000, m: 60000, h: 3600000 };

export function durationMs(d) {
  if (typeof d === "number") return d;
  if (d && typeof d === "object" && d.unit in DURATION_MS) return d.value * DURATION_MS[d.unit];
  throw new TypeError(`${JSON.stringify(d)} is not a duration`);
}

export function distancePx(d) {
  if (typeof d === "number") return d;
  if (d && typeof d === "object" && (d.unit === "px" || d.unit === "%")) return d.value;
  throw new TypeError(`${JSON.stringify(d)} is not a distance`);
}

export function duration(value, unit) { return { value, unit }; }
export function distance(value, unit) { return { value, unit }; }

// Runs an emitted program. `leave` ends it successfully, having done nothing.
export async function run(program, host) {
  const H = new Horse(host);
  try {
    await program(H);
    return { left: false, diagnostics: H.diagnostics, horse: H };
  } catch (e) {
    // A release outside any cue has nothing to release to. Nothing was wrong.
    if (e instanceof Released) {
      return { left: false, diagnostics: H.diagnostics, horse: H };
    }
    if (e instanceof Halted) {
      return { left: false, diagnostics: H.diagnostics, horse: H };
    }
    if (e instanceof Leave) {
      H.left = true;
      return { left: true, diagnostics: H.diagnostics, horse: H };
    }
    if (e instanceof Balk) {
      return { left: false, refused: true, diagnostics: H.diagnostics, horse: H };
    }
    throw e;
  }
}
