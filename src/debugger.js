// HORSEtxt debugger — the horse's true state, drawn.
//
// The runtime already tells the truth: Horse#signal() calls host.onSignal(name,
// answer) for every emission, and every answer carries provenance — line, band,
// cue, individual, side (runtime.js, `signal`). The playground reports it as a
// flat list. This module renders it as a flame-graph / waterfall: each emission
// is a frame, labelled with its locus and the answer it got — answered by which
// context, refused, or one of the two silences, "not attending" and
// "nobody there".
//
// Ears and head position change what you see, because they change what the
// horse attends to (GRAMMAR.md §4). That is not decoration; both effects trace
// to the bibliography:
//
//   - Wathan & McComb 2014 (Current Biology 24(15)): ears are the visual
//     indicator of attention. Mask the ears and the trace is unreadable; a
//     horse whose ears are down is not attending, so the debugger retreats to
//     match. EAD103 is the agonistic ear flattener (EquiFACS, Wathan et al.
//     2015) — the runtime says so itself: `attending = ears !== "agonistic"`.
//   - Wathan et al. 2015 (EquiFACS, PLOS ONE 10(8)): left and right ears are
//     coded independently, EAD103L / EAD103R, and one ear each way is a
//     readable state. The runtime renders divided attention as a split fork —
//     two signal tracks, left eye and right eye, because the hemispheres do
//     different work (§12g).
//   - Wathan & McComb 2014, same paper, second half: head height is part of
//     the attention display. The trace carries the head literally — high
//     frames float, low frames sink — because the evidence for "height" in
//     the face is verifiable by the eye that reads it.
//
// The module is DOM-lite by design: rendering is a pure function from events
// and posture to a tree of frames, and the test watches that tree. The page
// (playground.html) supplies a real DOM and a real <script type="text/horse">
// block, so the animal in the page and the animal in the trace are the same
// animal.

// A frame of the trace. `head` is the literal head state carried by the
// *previous* chord, because a signal is emitted under the posture the horse
// last uttered — a chord that sinks the head is a chord that has already
// happened by the time the next signal lands. The listener says what the
// horse was attending to, in the exact words the handler chose.
export class Frame {
  constructor(seq, name, answer, at, head) {
    this.seq = seq;
    this.name = name;
    this.answer = answer;
    this.at = at;
    this.head = head;
    this.children = [];
  }
  get summary() {
    if (this.answer.answered) {
      return this.answer.refused
        ? `refused by ${this.answer.by || "?"}`
        : `answered by ${this.answer.by || "?"}`;
    }
    return `unanswered (${this.answer.reason || "?"})`;
  }
}

// The whole trace. Exists so a test (and the page) can read the shape without
// touching the DOM: what the horse attended to, in the horse's own terms.
export class Trace {
  constructor() {
    this.frames = [];
    this.posture = [];
    this.head = 0;
    this.listeners = [];
    this.note = null; // set after a run, once the final depth is certain
  }
  get silences() {
    return this.frames.filter((f) => !f.answer.answered);
  }
  get unansweredByReason() {
    const by = {};
    for (const f of this.silences) {
      const k = f.answer.reason || "?";
      by[k] = (by[k] || 0) + 1;
    }
    return by;
  }
  push(frame) {
    this.frames.push(frame);
    for (const fn of this.listeners) fn(frame);
  }
  addPosture(p) {
    this.posture.push({ ears: p.ears, head: p.head, states: p.states });
    if (p.head != null) this.head = p.head;
  }
  onFrame(fn) { this.listeners.push(fn); }
}

// ------------------------------------------------------------------ attributing
//
// A chord is one utterance, and its ears are attention (GRAMMAR.md §4). The
// runtime keeps only the *latest* posture — `attending` is a flag, and a
// signal checks the flag at the moment it is emitted, not the posture that set
// it. So the debugger must do what the runtime will not: keep every posture,
// in order, and attribute each signal to the one that was in force when the
// signal fired. Two signals in a row can carry the same `carried` while being
// attended to differently, because the animal's ears moved between them.
//
// The debugger violates nothing by doing this: it is a *listener*, the way a
// human watching the paddock is a listener, and the paddock remembers what it
// saw.

// The head state the current posture carries, as a signed fraction of the
// ~-1..~1 head channel. Absent, it defaults to the last one: a head that was
// not re-uttered is still held. "Relaxed" is the zero of the channel, which
// is exactly what the range's centre means.
// head is a signed tissue fraction, exactly what the chord channel carries — see test/debugger.test.js P.
export function headOf(p) {
  const h = p && p.head;
  if (h == null) return null;
  if (typeof h === "number") return h;
  if (typeof h === "object" && typeof h.value === "number") return h.value;
  return null;
}

// The ground truth comes in two streams. `before` is the run's declarations
// and `onChord` will re-apply them; for the trace they are simply the first
// postures. The horse is a horse before it says anything.
export function begin(trace, before) {
  for (const p of before || []) trace.addPosture(p);
  return trace;
}

// A signal event, attributed. The frame's posture is the one the previous
// chord set, and its side is the side the carried provenance
// says the question was asked from — which eye you look with changes the
// question (grammar §12g, bibliography "Laterality").
// `now` is optional: the harness hands the *exact* posture in force at the
// moment the signal fired, because the runtime emits the anchor chord (the
// default ears-forward that follows an utterance) as its own onChord, and by
// the time the answer arrives the anchor has overwritten the utterance. The
// trace must not mistake the anchor for attention: it took the last chord
// the horse *struck*, not the echo that followed it.
export function accept(trace, name, answer, now) {
  const p = now && now.ears ? now : trace.posture.length ? trace.posture[trace.posture.length - 1] : null;
  const h = p ? headOf(p) : null;
  const carried = (answer && answer.carried) || {};
  const at = {
    line: carried.line == null ? "?" : carried.line,
    band: carried.band || null,
    cue: carried.cue || null,
    side: carried.side || null,
  };
  const frame = new Frame(trace.frames.length + 1, name, answer || {}, at, {
    ears: p ? p.ears : "forward",
    // A head that was not re-uttered is still held: the chord's ears are what
    // changed this instant, the head is where the animal already put it.
    head: h != null ? h : trace.head,
    relaxed: h === 0 || h == null,
  });
  trace.push(frame);
  return frame;
}

// After the run, the innermost cue of a finished signal is certain. Frames
// are attributed at emit time because an unanswered signal (not attending)
// *never* reached its cue — the cue in the provenance is the one that emitted
// it, and the answer tells you why it stopped there.
export function finish(trace) {
  let depth = 0;
  for (const f of trace.frames) {
    if (f.head.ears === "agonistic") depth = Math.max(0, depth - 0.5);
    else if (f.head.ears === "divided") depth += 0.25;
    else depth += 1;
  }
  trace.note = { depth: Math.max(1, depth), frames: trace.frames.length };
  return trace;
}

// ------------------------------------------------------------------- rendering
//
// Rendering is pure: `tree` is the DOM-lite structure the page turns into
// real elements. Frames spawn in the order the runtime reported them — the
// trace is a waterfall, a line of frames across the paddock — and the only
// nesting is the fork of a divided ear.

const DATA = (k, v) => [k, v];
const CLS = (name) => ({ cls: name });

// A waterfall row: the frame's own line, then its children. Row 0 is the
// signal's locus and answer, row 1 the answering context. A refused signal
// is an answer, so the handler's empty silence still gets its row with a
// "refused" plaque.
export function row(frame) {
  const at = frame.at;
  const locus = [at.band, at.cue].filter(Boolean).join(" \u203a ") || "top";
  const answer = frame.answer;
  const out = [];

  if (answer.answered) {
    out.push(
      v("div", { cls: "hd hd-answered" },
        v("span", { cls: "plaque plaque-answer" }, "answered"),
        v("span", { cls: "locus" }, locus),
        v("span", { cls: "who" }, answer.by || "?"),
        v("span", { cls: "line" }, `line ${at.line}`),
        v("span", { cls: "side" }, at.side ? `from the ${at.side}` : "blank side"),
        v("span", { cls: "value" }, fmt(answer.value)),
      ),
    );
    out.push(
      v("div", { cls: "hd hd-handler" },
        v("span", { cls: "plaque plaque-handler" }, "heard"),
        v("span", { cls: "who" }, answer.by || "?"),
        v("span", { cls: "line" }, `line ${at.line}`),
        v("span", { cls: "side" }, at.side ? `from the ${at.side}` : "blank side"),
        v("span", { cls: "value" }, fmt(answer.value)),
      ),
    );
    if (answer.refused) {
      out.push(
        v("div", { cls: "hd hd-refused" },
          v("span", { cls: "plaque plaque-refused" }, "refused"),
          v("span", { cls: "who" }, answer.by || "?"),
          v("span", { cls: "value" }, "balk"),
        ),
      );
    }
  } else {
    const reason = answer.reason || "?";
    out.push(
      v("div", { cls: "hd hd-silent" },
        v("span", { cls: "plaque plaque-silent" }, reason),
        v("span", { cls: "name" }, frame.name),
        v("span", { cls: "locus" }, locus),
        v("span", { cls: "line" }, `line ${at.line}`),
        v("span", { cls: "side" }, at.side ? `from the ${at.side}` : "blank side"),
      ),
    );
  }
  for (const c of frame.children) out.push(...row(c));
  return out;
}

// The fork of divided attention. One ear forward is attention here, one ear
// back is guarding elsewhere — EAD103L against EAD103R (EquiFACS), and the
// left eye feeds the right hemisphere (novelty, threat) while the right feeds
// the left (categorisation). The trace is the only place the horse's two
// attentions can be told apart, because the runtime keeps one `attending`
// flag and the flag says "divided" without saying *where*.
//
// The frame being forked is the horse's whole answer under a divided ears:
// the handler on the attending side hears it (the frame's own answer), while
// the guarding side hears nothing. `frames[0]` carries that truth; the fork
// gives the answer to the attending side and the guarded silence to the
// other, and the *provenance* says which side asked.
export function fork(frames, head = 0, side = "left") {
  const n = frames.length;
  const h = { ears: "divided", head, relaxed: head === 0 };
  const src = frames[0];
  const attending = new Frame(n + 1, side === "left" ? "left eye" : "right eye",
    src ? src.answer : { answered: false, by: null, reason: "divided", carried: {} },
    src ? src.at : { line: "?", side },
    h);
  const guarding = new Frame(n + 2, side === "left" ? "right eye" : "left eye",
    { answered: false, by: null, reason: "divided", carried: {} },
    { line: src && src.at ? src.at.line : "?", side: side === "left" ? "right" : "left" },
    h);
  const left = side === "left" ? attending : guarding;
  const right = side === "left" ? guarding : attending;
  return {
    cls: "fork",
    children: [
      { tag: "div", cls: "fork-side fork-left", kids: [
        { tag: "div", cls: "fork-head", kids: [{ text: "^ \u2026 _ \u2022 " + left.name }] },
        { tag: "span", cls: "plaque plaque-divided", kids: [{ text: left === attending ? "attending here" : "guarding elsewhere" }] },
        ...row(left),
      ] },
      { tag: "div", cls: "fork-side fork-right", kids: [
        { tag: "div", cls: "fork-head", kids: [{ text: "_ \u2026 ^ \u2022 " + right.name }] },
        { tag: "span", cls: "plaque plaque-divided", kids: [{ text: right === attending ? "attending here" : "guarding elsewhere" }] },
        ...row(right),
      ] },
    ],
  };
}

// The whole waterfall. `options.watch` is a listener that sees every frame as
// it lands, which is how the page streams the trace while a gait holds
// forever. `options.head` and `options.ears` override the horse's own posture,
// which is what "show me what it would have looked like attending" means — a
// horse stuck in one agonistic chord can still be inspected, because you,
// the watcher in the paddock, can still see it. The default is the horse's
// own attention: no lies.
export function render(trace, options = {}) {
  const o = {
    ears: trace.posture.length ? trace.posture[trace.posture.length - 1].ears : "forward",
    head: trace.head,
    ...options,
  };
  const kids = (f) => f.children.map((c) => row(c)).flat();

  const ears = o.ears;
  const head = o.head == null ? 0 : o.head;
  const bend = Math.round(8 * Math.max(-1, Math.min(1, head)));
  const retreat = ears === "agonistic"
    ? { transform: "scale(0.92)", filter: "blur(1.2px)", opacity: 0.42 }
    : {};

  const attrs = [
    DATA("ears", ears),
    DATA("head", `${head >= 0 ? "+" : ""}${head.toFixed(2)}`),
  ];

  if (ears === "agonistic") {
    // Ears flattened is the horse not attending. The trace must show that the
    // horse is not here, so it moves away — and because the horse is not
    // attending, the viewer must not be able to read it: no answered frames,
    // no handler rows. What the horse did not attend to is what you get to
    // see, half-visible and retreating. It is honest: retreat was the answer.
    return v("div", { cls: "trace t-agonistic", attrs, style: retreat, bend },
      v("div", { cls: "corral corral-agonistic" }, "both ears flattened \u2014 the trace retreats, because the horse is not attending"),
      ...trace.frames.map((f) =>
        v("div", { cls: "hd hd-silent" },
          v("span", { cls: "plaque plaque-silent" }, f.answer.reason || "?"),
          v("span", { cls: "locus" }, [f.at.band, f.at.cue].filter(Boolean).join(" \u203a ") || "top"),
          v("span", { cls: "line" }, `line ${f.at.line}`),
          v("span", { cls: "side" }, f.at.side ? `from the ${f.at.side}` : "blank side"),
        ),
      ),
    );
  }

  const rows = [];
  for (const f of trace.frames) {
    if (o.ears === "divided" && f.head.ears === "divided") {
      // The horse said divided; the trace is the fork. The provenance says
      // which eye asked, so the attending side is the one that heard.
      const side = f.at.side === "right" ? "right" : "left";
      rows.push(fork([f], head, side));
    } else {
      rows.push(v("div", { cls: "frame" }, ...row(f), ...kids(f)));
    }
  }
  if (rows.length === 0) {
    rows.push(v("div", { cls: "empty" }, "nothing was emitted. the horse grazed, and the grass says nothing."));
  }

  return v("div", {
    cls: "trace t-normal",
    attrs,
    style: { ...retreat, "--bend": `${bend}px` },
    bend,
  },
    v("div", { cls: "corral" }, "ears forward, head relaxed \u2014 every frame sharp"),
    v("div", { cls: "waterfall" }, ...rows),
  );
}

// ------------------------------------------------------------------ vnode helper
//
// The smallest vnode the page needs. A vnode is { tag, attrs, text, kids }.
// `style` and `attrs` are plain objects; children are vnodes or strings.

export function v(tag, attrs, ...kids) {
  const flat = [];
  for (const k of kids) {
    if (Array.isArray(k)) flat.push(...k);
    else if (typeof k === "string") flat.push({ text: k });
    else if (k != null && k !== false) flat.push(k);
  }
  return { tag, attrs: attrs || {}, kids: flat };
}

export function fmt(value) {
  if (value === undefined) return "val pause";
  if (value === null) return "bare";
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.length}]`;
  if (value instanceof Affect) return value.toString();
  return String(value);
}

import { Affect } from "./runtime.js";