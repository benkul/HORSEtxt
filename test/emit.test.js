// node test/emit.test.js
//
// These tests compile HORSEtxt to JavaScript and then *run* it. Emitting without
// running would only prove the emitter produces text.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/resolve.js";
import { emit } from "../src/emit.js";
import { Horse, Affect, REFUSED, run } from "../src/runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { pass++; })
    // A thrown non-Error is exactly what this language does on purpose — a Balk or
    // a Leave escaping a test would otherwise crash the reporter instead of failing.
    .catch((e) => {
      const message = e && e.message
        ? e.message
        : `threw a non-Error: ${e && e.constructor ? e.constructor.name : String(e)}`;
      failures.push({ name, message });
    });
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || "expected truthy");
}

// The resolver runs here too. Emitting unresolved code was how the examples came to
// contain free variables that threw at runtime while the suite stayed green.
function compile(src, file = "test.horse") {
  const lex = tokenize(src, file);
  if (lex.errors.length) throw new Error(`lex: ${lex.errors.map((e) => e.message).join("; ")}`);
  const p = parse(lex.tokens, file);
  if (p.errors.length) {
    throw new Error(`parse: ${p.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
  }
  const r = resolve(p.ast, file);
  if (r.errors.length) {
    throw new Error(`resolve: ${r.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
  }
  return emit(p.ast, file);
}

async function load(src) {
  const code = compile(src);
  const url = "data:text/javascript;charset=utf-8," + encodeURIComponent(code);
  const mod = await import(url);
  return mod.default;
}

async function exec(src, host) {
  const program = await load(src);
  return run(program, host);
}

const tests = [];
const T = (name, fn) => tests.push([name, fn]);

// ----------------------------------------------------- the emitter/runtime contract
//
// This exists because the first run of this suite was fully green while every
// example threw at runtime: the tests imported runtime helpers directly instead of
// reaching them through `H`, so they proved the runtime's API and not the contract
// the emitter actually depends on. Scraping the emitter for `H.<name>` closes that.

T("every H.<name> the emitter emits exists on the runtime", async () => {
  const emitSrc = readFileSync(join(here, "..", "src", "emit.js"), "utf8");
  const names = new Set();
  for (const m of emitSrc.matchAll(/H\.([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  // Names that appear only inside emitted-code templates read from the AST.
  const H = new Horse({});
  const missing = [];
  for (const n of names) {
    const present = typeof H[n] !== "undefined" || n in H || n in Object.getPrototypeOf(H);
    if (!present) missing.push(n);
  }
  if (missing.length) throw new Error(`runtime is missing: ${missing.sort().join(", ")}`);
});

T("a program that uses every value builder actually runs", async () => {
  const src = [
    "band a",
    "    forage deck of 1 through 3 regrows",
    "    pile seen at \"a.seen\"",
    "    lead mare go",
    "        remember w as weather.wet",
    "        remember r as recognise \"q\"",
    "        remember g as ~0.4",
    "        remember f as ~0.8:~-0.2",
    "        remember d as 10s",
    "        remember p as 20px",
    "        ^ ears forward   tension ~g ^",
    "        release deck.graze",
    "",
  ].join("\n");
  const r = await exec(src);
  ok(!r.refused, "ran to completion");
});

T("the lead mare runs; an entry point nothing calls is not one", async () => {
  const src = [
    "band a",
    "    lead mare go",
    "        ^ ears forward ^",
    "        release",
    "",
  ].join("\n");
  const chords = [];
  await exec(src, { onChord: (c) => chords.push(c) });
  eq(chords.length, 1, "the lead mare's chord was uttered");
  eq(chords[0].ears, "forward");
});

T("a band with no lead mare runs nothing", async () => {
  const src = "band a\n    cue go\n        ^ ears forward ^\n        release\n";
  const chords = [];
  await exec(src, { onChord: (c) => chords.push(c) });
  eq(chords.length, 0);
});

// ------------------------------------------------------------------ compilation

T("emitted output is valid JavaScript", async () => {
  const src = "band a\n    cue b\n        halt\n        release\n";
  const code = compile(src);
  ok(/export default async function program/.test(code), "has an entry point");
  await load(src);
});

T("hyphenated names survive into JavaScript", async () => {
  const code = compile("band a\n    cue fade-in\n        release\n");
  ok(/fade\$_in/.test(code), `expected mangled name, got:\n${code}`);
});

// ------------------------------------------------------------- terminal outcomes

// Mejdell's third symbol was a blank glyph the horse had to press: the no-change
// answer is given, not inferred. So `blank` leaves the cue. It was a plain no-op
// through v0.2.1, which made every `when ... blank` guard fall straight through
// while §3 and the resolver both listed it as a way out.
T("blank leaves the cue", async () => {
  const src = [
    "band a",
    "    cue guard bad",
    "        when bad",
    "            blank",
    "        ^ ears forward ^",
    "        release 1",
    "    lead mare go",
    "        remember stopped as guard 1",
    "        remember went as guard 0",
    "        release", "",
  ].join("\n");
  const seen = [];
  const r = await exec(src, { onChord: (p) => seen.push(p) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen.length, 1, "the guarded call stopped; the unguarded one carried on");
});

// A handler is not a cue. An outcome raised inside one is its answer to the signal
// and must not unwind into whichever cue emitted it.
T("an outcome in a handler stops at the handler", async () => {
  const src = [
    "band a",
    "    lead mare go",
    "        context room",
    "            hears snort",
    "                blank",
    "        snort",
    "        ^ ears forward ^",
    "        release", "",
  ].join("\n");
  const seen = [];
  const r = await exec(src, { onChord: (p) => seen.push(p) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen.length, 1, "the chord after the snort still ran");
});

T("a handler that balks is answered, not an error", async () => {
  const H = new Horse({});
  H.pushContext("room", { snort: async () => { H.balk("no"); } });
  const r = await H.signal("snort", null, { line: 1 });
  eq([r.answered, r.by, r.refused], [true, "room", true]);
});

T("balk is a refusal, not an error", async () => {
  const src = [
    "band a",
    "    cue decline",
    "        balk",
    "    lead mare go",
    "        remember r as (decline)",
    "        release r",
    "",
  ].join("\n");
  const r = await exec(src);
  eq(r.left, false);
  ok(!r.refused, "the program itself did not refuse");
});

T("a balked cue returns REFUSED to its caller", async () => {
  const program = await load("band a\n    cue decline\n        balk\n");
  const H = new Horse({});
  await program(H);
  // the cue is scoped inside the band; check the mechanism directly instead
  const c = H.cue("decline", [], async () => { H.balk("x"); });
  eq(await c(), REFUSED);
});

T("leave ends the program successfully, from inside a cue", async () => {
  const src = [
    "band a",
    "    lead mare go",
    "        leave",
    "        ^ ears forward ^",
    "",
  ].join("\n");
  const chords = [];
  const r = await exec(src, { onChord: (c) => chords.push(c) });
  eq(r.left, true, "the program left");
  ok(!r.refused, "leaving is not refusing");
  eq(chords.length, 0, "nothing after the leave ran");
});

T("a cue does not swallow a leave the way it absorbs a balk", async () => {
  const H = new Horse({});
  const balking = H.cue("b", [], async () => { H.balk("x"); });
  eq(await balking(), REFUSED, "a balk stops at the cue boundary");

  const leaving = H.cue("l", [], async () => { H.leave("x"); });
  let escaped = false;
  try { await leaving(); } catch (e) { escaped = e instanceof Horse.Leave; }
  ok(escaped, "a leave passes through the cue and ends the program");
});

T("run() reports leaving as success", async () => {
  const H = { };
  const r = await run(async (h) => { h.leave("top"); }, H);
  eq(r.left, true);
});

// -------------------------------------------------------------------- affect

T("affect refuses to collapse", async () => {
  const a = new Affect(0.8, -0.3);
  eq([a.arousal, a.valence], [0.8, -0.3]);
  let threw = false;
  try { void (a + 1); } catch (e) { threw = /does not collapse/.test(e.message); }
  ok(threw, "arithmetic on an affect throws");
});

T("an affect is not a truth", async () => {
  const H = new Horse({});
  let threw = false;
  try { H.truth(new Affect(1, 1)); } catch (e) { threw = true; }
  ok(threw);
});

// -------------------------------------------------------------------- forage

T("forage depletes without repeats, then regrows", async () => {
  const H = new Horse({});
  const f = H.constructor ? null : null;
  const { forage } = await import("../src/runtime.js");
  const deck = forage([1, 2, 3], true);
  const first = [deck.graze, deck.graze, deck.graze];
  eq(first.slice().sort(), [1, 2, 3], "every item drawn once");
  eq(deck.empty, true);
  const next = deck.graze; // regrows
  ok([1, 2, 3].includes(next), "regrew");
});

T("exhausted forage without regrows balks", async () => {
  const { forage } = await import("../src/runtime.js");
  const deck = forage([1], false);
  deck.graze;
  let balked = false;
  try { deck.graze; } catch (e) { balked = e instanceof Horse.Balk; }
  ok(balked, "drawing from exhausted forage balks");
});

T("forage has no position", async () => {
  const { forage } = await import("../src/runtime.js");
  const deck = forage([1, 2, 3], true);
  eq(deck.first, undefined);
  eq(deck.last, undefined);
});

// ------------------------------------------------------------------ recognise

T("recognise is stable across calls", async () => {
  const { recognise } = await import("../src/runtime.js");
  eq(recognise("a query") === recognise("a query"), true);
  ok(recognise("a") !== recognise("b"), "different inputs differ");
});

T("weather is read per axis and rejects a bad one", async () => {
  const { weather } = await import("../src/runtime.js");
  const v = weather("wet");
  ok(v >= 0 && v <= 1, "graded 0..1");
  let threw = false;
  try { weather("balmy"); } catch (e) { threw = true; }
  ok(threw, "balmy is not a condition");
});

// ------------------------------------------------------- contexts and signals

T("a signal is answered by the nearest context", async () => {
  const src = [
    "band a",
    "    lead mare go",
    "        context room",
    "            hears snort",
    "                blank",
    "        snort",
    "        release",
    "",
  ].join("\n");
  const code = compile(src);
  ok(/pushContext\("room"/.test(code), "context pushed");
  ok(/H\.signal\("snort"/.test(code), "signal emitted");
  await load(src);
});

T("an unanswered signal returns silence, not an error", async () => {
  const H = new Horse({});
  const r = await H.signal("snort", undefined, { line: 1 });
  eq([r.answered, r.by], [false, null]);
});

T("the nearest context wins", async () => {
  const H = new Horse({});
  const seen = [];
  H.pushContext("outer", { snort: async () => { seen.push("outer"); return 1; } });
  H.pushContext("inner", { snort: async () => { seen.push("inner"); return 2; } });
  const r = await H.signal("snort", null, { line: 1 });
  eq([r.by, r.value, seen], ["inner", 2, ["inner"]]);
});

T("provenance is carried whether asked for or not", async () => {
  const H = new Horse({});
  H.declare({ name: "flore", traits: [] });
  const r = await H.signal("whinny", null, { line: 7, band: "gallery", cue: "draw" });
  eq(r.carried.individual, "flore");
  eq([r.carried.band, r.carried.cue, r.carried.line], ["gallery", "draw", 7]);
});

T("the emitter injects provenance at every emission", async () => {
  const code = compile("band g\n    cue draw\n        snort\n        release\n");
  ok(/band: "g"/.test(code) && /cue: "draw"/.test(code), `provenance missing:\n${code}`);
});

// --------------------------------------------------------------------- chords

T("both ears forward means attending", async () => {
  const H = new Horse({});
  await H.chord("^", "^", [{ channel: "ears", value: { state: "forward" } }], null);
  eq(H.posture.ears, "forward");
  eq(H.attending, true);
});

T("both ears flattened is agonistic and stops answering", async () => {
  const H = new Horse({});
  H.pushContext("room", { snort: async () => "answered" });
  await H.chord("_", "_", [], null);
  eq(H.posture.ears, "agonistic");
  const r = await H.signal("snort", null, { line: 1 });
  eq([r.answered, r.reason], [false, "not attending"]);
});

T("one ear each way is divided attention", async () => {
  const H = new Horse({});
  await H.chord("^", "_", [], null);
  eq(H.posture.ears, "divided");
});

// ---------------------------------------------------------------------- gaits

T("a walk waits, a trot does not", async () => {
  const H = new Horse({});
  const order = [];
  const slow = () => new Promise((r) => setTimeout(() => { order.push("slow"); r(); }, 20));
  const fast = () => { order.push("fast"); return Promise.resolve(); };

  await H.gait("walk", [slow, fast]);
  eq(order, ["slow", "fast"], "four separate beats, so it waits");

  // A trot is two beats, so two statements strike together.
  order.length = 0;
  await H.gait("trot", [slow, fast]);
  eq(order, ["fast", "slow"], "struck together, finished out of order");
});

T("a gallop is four beats, not everything at once", async () => {
  // Full fan-out was never a gait: a moving horse does not put four hooves down
  // together. The gallop is LH, RH, LF, RF and then suspension.
  const H = new Horse({});
  const order = [];
  const slow = () => new Promise((r) => setTimeout(() => { order.push("slow"); r(); }, 20));
  const fast = () => { order.push("fast"); return Promise.resolve(); };
  await H.gait("gallop", [slow, fast]);
  eq(order, ["slow", "fast"], "separate beats, so it waits");
});

T("a trot runs two at a time, in the order written", async () => {
  const H = new Horse({});
  const order = [];
  const mk = (n, ms) => () => new Promise((r) => setTimeout(() => { order.push(n); r(); }, ms));
  // Two beats, so two statements strike per beat, filled in written order.
  await H.gait("trot", [mk("a", 20), mk("b", 1), mk("c", 20), mk("d", 1)]);
  eq(order.slice(0, 2).sort(), ["a", "b"], "the first beat");
  eq(order.slice(2).sort(), ["c", "d"], "then the second");
});

T("back reverses", async () => {
  const H = new Horse({});
  const order = [];
  await H.gait("back", [
    () => { order.push(1); return Promise.resolve(); },
    () => { order.push(2); return Promise.resolve(); },
  ]);
  eq(order, [2, 1]);
});

T("halt ends the innermost gait, and only that one", async () => {
  const H = new Horse({});
  const order = [];
  await H.gait("walk", [
    async () => {
      await H.gait("walk", [
        async () => { order.push("inner"); H.halt(); },
        async () => { order.push("unreached"); },
      ]);
      order.push("outer continues");
    },
  ]);
  eq(order, ["inner", "outer continues"]);
});

T("a halt cannot un-strike a hoof already down", async () => {
  // A trot's diagonal pair strikes together, so halting one does not stop the other
  // — they had already landed. Only a sequential gait can be cut mid-stride.
  const H = new Horse({});
  const order = [];
  await H.gait("trot", [
    async () => { order.push("a"); H.halt(); },
    async () => { order.push("b"); },
  ]);
  eq(order.sort(), ["a", "b"]);
});

T("halt outside a gait does nothing, because there is nothing to stop", async () => {
  const H = new Horse({});
  eq(H.halt(), undefined);
});

T("halt ends a held gait — the only way a program stops its own loop", async () => {
  const H = new Horse({});
  let strides = 0;
  await H.gait("walk", [
    async () => { strides++; if (strides >= 3) H.halt(); },
  ], { interval: { value: 1, unit: "ms" } });
  eq(strides, 3);
});

T("halt ends a sentinel's rotation", async () => {
  const H = new Horse({});
  let turns = 0;
  await H.sentinel({ value: 1, unit: "ms" }, [
    async () => { turns++; if (turns >= 2) H.halt(); },
  ]);
  eq(turns, 2);
});

T("a gait body's bindings are hoisted so its thunks can see them", async () => {
  const code = compile([
    "band a", "    lead mare go",
    "        walk",
    "            remember n as 1",
    "            ^ tension ~n ^",
    "        release", "",
  ].join("\n"));
  // `let n` must sit outside the thunk array, not inside a thunk.
  const letAt = code.indexOf("let n");
  const gaitAt = code.indexOf("H.gait(");
  ok(letAt !== -1 && letAt < gaitAt, `binding not hoisted out of the gait:\n${code}`);
});

T("a release inside a gait releases the cue, not the thunk", async () => {
  const src = [
    "band a",
    "    cue go",
    "        walk",
    "            release 7",
    "        release 1",
    "    lead mare start",
    "        ^ tension ~(go) ^",
    "        release", "",
  ].join("\n");
  const seen = [];
  const r = await exec(src, { onChord: (p) => seen.push(p) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen[0].states[0].value, 7, "the release from inside the walk won");
});

T("a release inside a graze releases the cue", async () => {
  const src = [
    "band a",
    "    cue first xs",
    "        graze xs as x",
    "            release x",
    "        release 0",
    "    lead mare start",
    "        ^ tension ~(first [4 5 6]) ^",
    "        release", "",
  ].join("\n");
  const seen = [];
  const r = await exec(src, { onChord: (p) => seen.push(p) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen[0].states[0].value, 4, "released on the first element");
});

T("tempo is inert with no declared individual", async () => {
  const H = new Horse({});
  const t0 = Date.now();
  await H.gait("walk", [async () => {}, async () => {}, async () => {}]);
  ok(Date.now() - t0 < 50, "no measured tempo without an animal");
});

T("tempo is real under a declared individual", async () => {
  const H = new Horse({});
  H.declare({ name: "flore", traits: [] });
  const t0 = Date.now();
  await H.gait("walk", [async () => {}, async () => {}]);
  ok(Date.now() - t0 >= 500, `expected two walk beats (~602ms), took ${Date.now() - t0}ms`);
});

T("genotype gates pace and tolt", async () => {
  const H = new Horse({});
  let threw = false;
  try { await H.gait("pace", [async () => {}]); } catch (e) { threw = /AA allele/.test(e.message); }
  ok(threw, "pace needs AA");

  H.genotype("AA", null);
  await H.gait("pace", [async () => {}]);

  let tolted = false;
  try { await H.gait("tolt", []); } catch (e) { tolted = /Icelandic/.test(e.message); }
  ok(tolted, "tolt needs an Icelandic");
});

// -------------------------------------------------------------------- release

T("a late release is reported as punishing, not slow", async () => {
  const H = new Horse({});
  H.releaseBudget = 10;
  const slow = H.cue("slow", [], async () => new Promise((r) => setTimeout(r, 40)));
  await slow();
  eq(H.diagnostics.length, 1);
  ok(/punishes/.test(H.diagnostics[0].message), H.diagnostics[0].message);
});

T("a prompt release says nothing", async () => {
  const H = new Horse({});
  const quick = H.cue("quick", [], async () => 1);
  await quick();
  eq(H.diagnostics, []);
});

// ------------------------------------------------------------------ habituation

T("a spook handler retires after N exposures, keyed per shape", async () => {
  const H = new Horse({});
  const key = H.shape(new TypeError("boom"));
  eq(H.habituated(key, 2), false);
  H.expose(key);
  eq(H.habituated(key, 2), false);
  H.expose(key);
  eq(H.habituated(key, 2), true, "retired after two");
  const other = H.shape(new RangeError("boom"));
  eq(H.habituated(other, 2), false, "a different shape is novel again");
});

T("spook guards what follows it in the block", async () => {
  const code = compile([
    "band a",
    "    cue load",
    '        spook at "network"',
    "            shy",
    "        habituates after 3",
    "        release 1",
    "",
  ].join("\n"));
  const guarded = code.indexOf("try {");
  const released = code.indexOf("H.release(1)");
  ok(guarded !== -1 && released > guarded, `release should sit inside the try:\n${code}`);
});

T("a spook does not swallow a balk", async () => {
  const code = compile([
    "band a",
    "    cue load",
    '        spook at "network"',
    "            shy",
    "        balk",
    "",
  ].join("\n"));
  ok(/H\.terminal\(_e\)/.test(code), "terminal outcomes are rethrown");
});

// -------------------------------------------------------------------- storage

// A pile is append-only, so writing to one leaves a trace. This was documented in
// STDLIB.md from v0.1 and emitted as a plain assignment, which replaced the pile
// with whatever was written — so every count afterwards read back undefined.
T("writing to a pile appends rather than replacing it", async () => {
  const code = compile('band a\n    pile p at "k"\n    cue go\n        p becomes 1\n        release p.count\n');
  ok(/H\.leaveTrace\(p, 1\)/.test(code), `expected an append, got:\n${code}`);
  ok(!/^\s*p = 1;/m.test(code), "and not an assignment");
});

T("a pile that is written to still counts", async () => {
  const src = [
    "band a",
    '    pile p at "count.test"',
    "    lead mare go",
    "        p becomes 1",
    "        p becomes 2",
    // `~p.count` reads the member; `~(p.count)` would call it, because
    // parenthesising a lone path forces a zero-argument call.
    "        ^ tension ~p.count ^",
    "        release", "",
  ].join("\n");
  const seen = [];
  const r = await exec(src, { onChord: (c) => seen.push(c) });
  ok(!r.threw, r.threw && r.threw.message);
  ok(seen[0].states[0].value >= 2, `expected at least two traces, got ${seen[0].states[0].value}`);
});

// A pile is ordered by when things happened, so it may be read by position. Forage
// may not: its order is drawn, and a position would make the draw reproducible.
T("a pile can be read by position; forage cannot", async () => {
  const { pile, forage } = await import("../src/runtime.js");
  const p = pile("marks.test");
  p.append("first"); p.append("second"); p.append("third");
  eq(p.marks[0], "first", "oldest first");
  eq(p.marks[p.count - 1], "third", "and the newest last");
  eq(p.graze, "third", "which is also the most recent mark");

  const f = forage([1, 2, 3], false);
  eq(f.marks, undefined, "forage has no marks to index");
  eq(f.first, undefined);
});

T("the marks are a copy; a pile cannot be rewritten", async () => {
  const { pile } = await import("../src/runtime.js");
  const p = pile("copy.test");
  p.append("a");
  const got = p.marks;
  got[0] = "rewritten";
  eq(p.marks[0], "a", "what was left stays left");
});

T("a program can read a trail off a pile", async () => {
  const src = [
    "band a",
    '    pile trail at "trail.test"',
    "    lead mare go",
    '        trail becomes "one"',
    '        trail becomes "two"',
    "        ^ voice ~0.1 ^",
    "        release trail.marks[0]",
    "",
  ].join("\n");
  const r = await exec(src);
  ok(!r.threw, r.threw && r.threw.message);
});

T("only a pile can be left a trace", async () => {
  const H = new Horse({});
  let threw = false;
  try { H.leaveTrace(7, "x"); } catch (e) { threw = /only a pile/.test(e.message); }
  ok(threw);
});

// Caching the storage *reference* meant a page or a test that swapped localStorage
// kept writing to the old one. Only whether it works is cached.
T("a pile reads whichever storage is present now", async () => {
  const { pile } = await import("../src/runtime.js");
  const had = globalThis.localStorage;
  const first = {}, second = {};
  const fake = (d) => ({ getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } });
  try {
    globalThis.localStorage = fake(first);
    pile("swap.test").append("a");
    globalThis.localStorage = fake(second);
    pile("swap.test").append("b");
    ok(first["swap.test"] !== undefined, "the first store was written");
    ok(second["swap.test"] !== undefined, "and so was the second");
  } finally {
    if (had) globalThis.localStorage = had; else delete globalThis.localStorage;
  }
});

T("a pile appends and survives a missing store", async () => {
  const { pile } = await import("../src/runtime.js");
  const p = pile("test.key");
  eq(p.empty, true, "reads correctly with nothing stored");
  p.append(1);
  p.append(2);
  eq([p.count, p.graze], [2, 2]);
});

// --------------------------------------------------------------------- interop

T("hands is a flat, unconditioned boundary", async () => {
  const code = compile('band a\n    cue b\n        remember x as hands.JSON.stringify 1\n        release x\n');
  ok(!/H\.call\(H\.hands/.test(code), "hands calls do not route through H.call");
  ok(/await H\.hands\.JSON\.stringify\(1\)/.test(code), `expected a direct call:\n${code}`);
});

T("a cue call routes through the runtime", async () => {
  const code = compile("band a\n    cue b x\n        release x\n    cue c\n        release b 1\n");
  ok(/H\.call\(b, \[1\]/.test(code), `expected a routed call:\n${code}`);
});

// ------------------------------------------------------------------ band lint

T("an oversized band is noted with its citation", async () => {
  const H = new Horse({});
  H.band("big", 9);
  eq(H.diagnostics.length, 1);
  ok(/2-4 mares/.test(H.diagnostics[0].message));
});

// ---------------------------------------------------------------------- stand

T("with nothing to hold against, a stand breaks", async () => {
  const H = new Horse({});
  let broke = false;
  await H.stand({ duration: { value: 10, unit: "s" } }, async () => {}, async () => { broke = true; });
  eq(broke, true);
});

T("a host can hold the stand", async () => {
  const H = new Horse({ hold: async () => true });
  let broke = false;
  await H.stand({ duration: { value: 1, unit: "ms" } }, async () => {}, async () => { broke = true; });
  eq(broke, false);
});

// -------------------------------------------------------------------- examples

T("every example file compiles and loads", async () => {
  const dir = join(here, "..", "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".horse"));
  const bad = [];
  for (const f of files) {
    try {
      const src = readFileSync(join(dir, f), "utf8");
      const code = compile(src, f);
      const url = "data:text/javascript;charset=utf-8," + encodeURIComponent(code);
      await import(url);
    } catch (e) {
      bad.push(`${f}: ${e.message}`);
    }
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

// ------------------------------------------------------------------------ done

for (const [name, fn] of tests) await test(name, fn);

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);
