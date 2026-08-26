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
// GRAMMAR.md §6.4. Read, never generated. v0.1 returns independent fresh values
// behind the axis names; the correlations (wet+wind suppress flies), the
// autocorrelation, and the individual conditioning of `cold` against the lower
// critical temperature all land in v0.2. The shape is fixed so that is a runtime
// change and not a syntax change.

const CONDITIONS = new Set(["cold", "wet", "wind", "sun", "flies"]);

export function weather(condition) {
  if (!CONDITIONS.has(condition)) {
    throw new TypeError(`${condition} is not a weather condition`);
  }
  return Math.random();
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

// Probed once. Storage can be absent, can throw on access, and can come back empty.
let store = null;
let storeProbed = false;

function storage() {
  if (storeProbed) return store;
  storeProbed = true;
  try {
    const s = globalThis.localStorage;
    s.getItem("horsetxt.probe");
    store = s;
  } catch (e) {
    store = null;
  }
  return store;
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
  blank() { return undefined; } // stated, never implied

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
        const result = await handler(value, carried);
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
          await this.stride(name, thunks);
          if (this.left) return;
          if (this.host.stop && this.host.stop()) return;
          if (name !== "tolt") await sleep(ms);
        }
      }
      return await this.stride(name, thunks);
    } catch (e) {
      // A halt ends this gait and only this gait, so a nested gait halts first.
      if (e instanceof Halted) return;
      throw e;
    } finally {
      this.loops--;
    }
  }

  async stride(name, thunks) {
    const beat = this.conditioned ? (TEMPO[name] || 0) : 0;

    const runSequential = async (list) => {
      for (const t of list) {
        await t();
        if (beat) await sleep(beat);
      }
    };
    const runGroups = async (groups) => {
      for (const g of groups) {
        await Promise.all(g.map((t) => t()));
        if (beat) await sleep(beat);
      }
    };

    switch (name) {
      case "walk":
        return runSequential(thunks);
      case "back":
        return runSequential(Array.from(thunks).reverse());
      // Trot is diagonal pairs; pace is lateral pairs. Both strike two at a time —
      // the difference is which two, which only shows with four limbs' worth of work.
      case "trot":
      case "pace":
        return runGroups(pairs(thunks));
      // Three beats, unevenly spaced: one, then a pair, then one. The suspension
      // runs twice as long as the intervals around it.
      case "canter": {
        const [first, ...rest] = thunks;
        if (first) { await first(); if (beat) await sleep(beat); }
        const middle = rest.slice(0, Math.max(0, rest.length - 1));
        const last = rest[rest.length - 1];
        if (middle.length) { await Promise.all(middle.map((t) => t())); if (beat) await sleep(beat); }
        if (last) await last();
        if (beat) await sleep(beat * 2); // suspension
        return;
      }
      case "gallop":
        await Promise.all(thunks.map((t) => t()));
        if (beat) await sleep(beat);
        return;
      // Four beats in the walk's sequence, faster, and with no suspension. Held with
      // `every`, it is the one gait whose strides run back to back.
      case "tolt":
      default:
        return runSequential(thunks);
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

  async graze(source, body) {
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

  async flehmen(value, side) {
    const s = side || this.side;
    const key = this.shape(value);
    const met = this.exposures.has(key);
    this.expose(key);
    if (s === "left" && !met) {
      await this.signal("novel", value, { via: "flehmen" });
    }
    return value;
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

  // ----------------------------------------------------------------------- zones
  //
  // v0.1 records the boundary. Enforcement — approach it and it moves away — needs
  // the perception model that lands with blind spots in v0.2.

  async zone(kind, body) {
    if (this.host.onZone) this.host.onZone(kind);
    return body();
  }

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
  weather(condition) { return weather(condition); }
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
