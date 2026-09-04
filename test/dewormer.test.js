// node test/dewormer.test.js
//
// The dewormer's truth, watched. The runtime reports every emission through
// onSignal(name, answer) with provenance (line, band, cue, individual, side),
// and a chord is an utterance whose ears are attention (GRAMMAR.md §4). This
// suite feeds a synthetic stream — postures and signals in the order the
// runtime would report them — and reads the trace back as a tree of frames,
// because that tree is the horse's true state and the page is only its
// mirror.
//
// The tests are DOM-lite on purpose, like the module: the renderer's shape is
// a pure function of events and posture, so nothing here needs a document.

import {
  accept, begin, finish, fmt, fork, headOf, render, row, Trace, v,
} from "../src/dewormer.js";

let pass = 0;
const failures = [];

async function test(name, fn) {
  try { await fn(); pass++; }
  catch (e) {
    const message = e && e.message ? e.message : `threw ${String(e)}`;
    failures.push({ name, message });
  }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "expected truthy"); }

// ------------------------------------------------------------------- fixtures
//
// Postures and answers in the exact shape the runtime reports: H.chord()
// hands { ears, states } to onChord, and H.signal() hands { answered, by,
// value, refused, carried } to onSignal. The carried provenance is the
// emitter's own.

const P = {
  forward: { ears: "forward", head: 0, states: [{ channel: "ears", value: { state: "forward" } }, { channel: "head", value: 0 }] },
  high: { ears: "forward", head: 1, states: [{ channel: "ears", value: { state: "forward" } }, { channel: "head", value: 1 }] },
  low: { ears: "forward", head: -1, states: [{ channel: "ears", value: { state: "forward" } }, { channel: "head", value: -1 }] },
  divided: { ears: "divided", head: 0, states: [{ channel: "ears", value: { state: "divided" } }, { channel: "head", value: 0 }] },
  agonistic: { ears: "agonistic", head: null, states: [{ channel: "ears", value: { state: "agonistic" } }] },
};

const S = (over) => ({
  answered: false, by: null, value: undefined, refused: false, carried: {},
  ...over,
});

const at = (line, cue, band = "band one", side = "right") => ({
  line, cue, band, side,
});

const answer = {
  heard: S({ answered: true, by: "grazing", value: "that one moved", carried: at(9, "listen", "room", "left") }),
  refused: S({ answered: true, by: "examine", refused: true, carried: at(12, "go", "holding") }),
  nobody: S({ answered: false, reason: "nobody there", carried: at(3, "go", "band one") }),
  notAttending: S({ answered: false, reason: "not attending", carried: at(8, "go", "band one") }),
};

// ---------------------------------------------------------------------- frames

const tests = [];
const T = (name, fn) => tests.push([name, fn]);

T("an answered signal is a frame naming who answered and the value", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  const f = accept(t, "snort", answer.heard);
  eq(f.name, "snort");
  eq(f.answer.answered, true);
  eq(f.answer.by, "grazing");
  eq(f.summary, "answered by grazing");
  eq(f.head.ears, "forward");
});

T("a refused signal is an answer, not a silence", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  const f = accept(t, "flehmen", answer.refused);
  eq(f.summary, "refused by examine");
  eq(f.answer.refused, true);
  eq(f.answer.answered, true);
});

T("the two silences are different frames and both are kept", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", answer.nobody);
  accept(t, "snort", answer.notAttending);
  eq(t.frames.length, 2);
  eq(t.unansweredByReason, { "nobody there": 1, "not attending": 1 });
  eq(t.silences.map((f) => f.summary), [
    "unanswered (nobody there)",
    "unanswered (not attending)",
  ]);
});

T("two signals can carry the same locus but different attention", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", answer.nobody);
  t.addPosture(P.agonistic);
  accept(t, "snort", answer.notAttending);
  eq([t.frames[0].at.line, t.frames[1].at.line], [3, 8], "same locus kind, different emission sites");
  eq(t.frames.map((f) => f.head.ears), ["forward", "agonistic"]);
});

T("head is carried by the previous chord, and absent means last held", async () => {
  const t = new Trace();
  begin(t, [P.high]);
  accept(t, "snort", answer.heard);
  eq(t.frames[0].head.head, 1, "head high, straight after the high chord");
  t.addPosture({ ...P.agonistic, head: undefined }); // a flattened ear does not re-utter height
  accept(t, "snort", answer.notAttending);
  eq(t.frames[1].head.head, 1, "a head not re-uttered is still held");
});

T("headOf reads a raw head and an absent one", async () => {
  eq(headOf(P.high), 1);
  eq(headOf(P.agonistic), null, "an agonistic chord does not re-utter a head");
});

T("finish reports a depth that respects flattened ears", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", answer.heard);
  accept(t, "snort", answer.nobody);
  t.addPosture(P.agonistic);
  accept(t, "snort", answer.notAttending);
  finish(t);
  ok(t.note.depth > 1, "attended frames built depth");
  ok(t.note.frames === 3, "every frame counted, attended or not");
});

// ----------------------------------------------------------------- rendering

T("render labels the frame with its locus and the answer it got", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", answer.heard);
  const node = render(t);
  eq(node.tag, "div");
  const text = collect(node).join("|");
  ok(/answered/.test(text) && /grazing/.test(text), text);
  ok(/room › listen/.test(text), "locus travels with the frame: " + text);
  ok(/line 9/.test(text) && /from the left/.test(text), "provenance shown: " + text);
});

T("render escapes nothing but keeps the value the handler gave", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", S({ answered: true, by: "grazing", value: "a <b>gate</b>", carried: at(4, "listen") }));
  const node = render(t);
  // The value is raw text in the vnode, not innerHTML — the page must set
  // textContent, and the test proves the renderer never builds markup.
  const text = collect(node).join("|");
  ok(text.includes("a <b>gate</b>"), "value carried verbatim, ready for textContent: " + text);
});

T("ears flattened retreats the trace and hides the answers", async () => {
  const t = new Trace();
  begin(t, [P.agonistic]);
  accept(t, "snort", answer.notAttending);
  const node = render(t);
  eq(node.attrs.cls, "trace t-agonistic");
  ok(node.attrs.style.opacity === 0.42 && node.attrs.style.filter.includes("blur"), "retreats");
  ok(node.attrs.attrs.some(([k]) => k === "ears" && node.attrs.attrs.find(([k]) => k === "ears")[1] === "agonistic"));
  eq(collect(node).join("|").includes("answered"), false, "an unanswered animal shows no answers");
  ok(/not attending/.test(collect(node).join("|")), "and the silence is still legible");
});

T("only a divided frame forks; forward frames stay whole", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  accept(t, "snort", answer.heard);
  const whole = render(t);
  eq(collect(whole).join("|").includes("left eye"), false, "no fork when attending");

  const t2 = new Trace();
  begin(t2, [P.forward]);
  accept(t2, "snort", answer.heard);
  t2.addPosture(P.divided);
  accept(t2, "snort", answer.notAttending);
  const forkNode = render(t2, { ears: "divided", head: 0 });
  const text = collect(forkNode).join("|");
  ok(text.includes("left eye") && text.includes("right eye"), "divided attention splits: " + text);
  ok(/guarding elsewhere/.test(text), "one ear back is a guard, not absence: " + text);
});

T("divided attention is a fork, and each side is a frame", async () => {
  const f = fork([], 0);
  eq(f.cls, "fork");
  eq(f.children.length, 2);
  const sides = f.children.map((c) => c.cls);
  eq(sides, ["fork-side fork-left", "fork-side fork-right"]);
});

T("head high floats the frames; head low sinks them", async () => {
  const t = new Trace();
  begin(t, [P.high]);
  accept(t, "snort", answer.heard);
  const high = render(t);
  ok(high.attrs.bend > 0, "high head bends the waterfall up");
  const label = high.attrs.attrs.find(([k]) => k === "head");
  ok(label[1][0] === "+", "labels the head as raised: " + JSON.stringify(label));

  const t2 = new Trace();
  begin(t2, [P.low]);
  accept(t2, "snort", answer.heard);
  const low = render(t2);
  ok(low.attrs.bend < 0, "low head bends the waterfall down");
});

T("an ears/head override re-renders what a different attention would show", async () => {
  // The horse's own last posture is agonistic — the default render retreats.
  const t = new Trace();
  begin(t, [P.agonistic]);
  accept(t, "snort", answer.notAttending);
  const retreated = render(t);
  eq(retreated.attrs.cls, "trace t-agonistic");
  // The paddock watcher can still look: override the horse's attention.
  const inspected = render(t, { ears: "forward", head: 0.2 });
  eq(inspected.attrs.cls, "trace t-normal");
  ok(inspected.attrs.bend > 0, "and the inspected head floats a little");
});

T("a divided frame forks, and the answering side carries the answer", async () => {
  // One ear forward, one back. The horse is attending on one side only; the
  // handler on that side hears, the guarding side hears nothing. The fork
  // must give the real answer to the attending eye and the guarded silence
  // to the other, and the provenance's side says which eye asked.
  const t = new Trace();
  begin(t, [P.divided]);
  const a = { ...answer.heard, carried: { line: 9, band: "trace", cue: "show", side: "left" } };
  accept(t, "snort", a, P.divided);
  const node = render(t, { ears: "divided", head: 0 });
  ok(node.attrs.cls === "trace t-normal" && /"fork"/.test(JSON.stringify(node)), "divided attention forks");
  const text = collect(node).join("|");
  ok(/attending here/.test(text) && /guarding elsewhere/.test(text), "both plaques present");
  ok(/answered/.test(text) && /divided/.test(text), "the answer and the guarded silence both appear");
  // The answer sits under the attending side — the side that asked.
  const leftSide = node.attrs && node;
  const forkObj = (function findFork(n) { if (n && n.cls === "fork") return n; for (const k of (n && n.kids) || []) { const r = findFork(k); if (r) return r; } return null; })(node);
  ok(forkObj, "fork in the tree");
  const sideCls = (k) => k && k.attrs ? k.attrs.cls || "" : k && k.cls ? k.cls : k && k.text || "";
  const leftKids = forkObj.children[0].kids.map(sideCls).join("|");
  ok(/hd-answer/.test(leftKids), "the left eye (that asked) hears the answer");
  ok(/hd-silent/.test(forkObj.children[1].kids.map(sideCls).join("|")), "the right eye is guarding");
});

T("an empty trace renders as an empty paddock, not an error", async () => {
  const t = new Trace();
  const node = render(t);
  ok(/nothing was emitted/.test(collect(node).join("|")));
});

T("row keeps the handler's silence for a refused signal", async () => {
  const t = new Trace();
  begin(t, [P.forward]);
  const f = accept(t, "flehmen", answer.refused);
  const rows = row(f);
  const text = rows.map(collect).map((a) => a.join("|")).join("\n");
  ok(/refused/.test(text) && /examine/.test(text), text);
});

T("v builds vnodes and skips falsy children", async () => {
  const n = v("div", { cls: "x" }, v("span", {}, "a"), false, null, [v("i", {}, "b")]);
  eq(n.tag, "div");
  eq(n.kids.length, 2);
});

// ------------------------------------------------------------------- helpers

//                                                                    writes text
// A fork is a subtree hanging off a waterfall row: its frame's children
// include the fork object itself, whose own `children` are the two sides.
export function collect(node) {
  const out = [];
  if (node && node.text != null) out.push(node.text);
  for (const k of (node && (node.kids || node.children)) || []) {
    out.push(...collect(typeof k === "string" ? { text: k } : k));
  }
  return out;
}

// Every vnode/fork in a rendered trace, in order, for shape assertions.
export function walk(node, out = []) {
  if (node && typeof node === "object") {
    if (node.tag && !node.cls) out.push(node);
    for (const k of (node.kids || node.children) || []) walk(typeof k === "string" ? { text: k } : k, out);
  }
  return out;
}

// ------------------------------------------------------------------------- done

for (const [name, fn] of tests) await test(name, fn);

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);