// node test/perception.test.js
//
// GRAMMAR.md §12g. Laterality only means something if perceiving is an act with
// limits, and these are the limits.
//
// Several of these probe the runtime directly rather than running a program. A balk
// inside a cue is caught at the cue boundary and returned as a refusal, so a program
// that balks correctly and a program that never balked at all look identical from
// outside. That is exactly what let this whole model look fine while untested.

import { Horse, Balk, forage, pile } from "../src/runtime.js";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/resolve.js";
import { emit } from "../src/emit.js";

let pass = 0;
const failures = [];
const tests = [];
const T = (name, fn) => tests.push([name, fn]);

function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what || "value"}\n  expected ${y}\n  got      ${x}`);
}
function ok(c, what) { if (!c) throw new Error(what || "expected truthy"); }

// Did this balk? Returns the balk, or throws if it did not.
async function balked(fn) {
  try {
    const v = await fn();
    throw new Error(`expected a balk, got ${JSON.stringify(v)}`);
  } catch (e) {
    if (e instanceof Balk) return e;
    throw e;
  }
}

function compile(src, file = "p.horse") {
  const lex = tokenize(src, file);
  if (lex.errors.length) throw new Error(`lex: ${lex.errors.map((e) => e.message).join("; ")}`);
  const p = parse(lex.tokens, file);
  if (p.errors.length) throw new Error(`parse: ${p.errors.map((e) => e.message).join("; ")}`);
  const r = resolve(p.ast, file);
  if (r.errors.length) throw new Error(`resolve: ${r.errors.map((e) => e.message).join("; ")}`);
  return emit(p.ast, file);
}
async function run(src, host = {}) {
  const code = compile(src);
  const mod = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(code));
  const H = new Horse(host);
  try { await mod.default(H); return { H }; }
  catch (e) { return { H, threw: e }; }
}

// ------------------------------------------------- laterality decides the question
//
// Left eye feeds the right hemisphere: novelty, threat, escape. Right eye feeds the
// left: analytical categorisation. The side is not decoration on one operation — it
// selects which question was asked.

T("from the left asks whether this is new", async () => {
  const H = new Horse({});
  eq(await H.flehmen("a stranger", "left", []), true, "never met");
  eq(await H.flehmen("a stranger", "left", []), false, "met now");
});

// Habituation is stimulus-specific: desensitising to one object leaves the response
// to others intact. Keying novelty on the *kind* of a value made every string one
// stimulus, so meeting one counted as meeting all of them.
T("one thing met is not every thing met", async () => {
  const H = new Horse({});
  eq(await H.flehmen("a gate", "left", []), true);
  eq(await H.flehmen("a person", "left", []), true, "a different thing is still new");
  eq(await H.flehmen("a gate", "left", []), false, "and the first one is not");
});

// A familiar object, rotated, reads as novel again.
T("a thing with different parts is a different thing", async () => {
  const H = new Horse({});
  eq(await H.flehmen({ a: 1 }, "left", []), true);
  eq(await H.flehmen({ a: 2 }, "left", []), false, "same parts, met before");
  eq(await H.flehmen({ a: 1, b: 2 }, "left", []), true, "different parts, novel again");
});

T("a first look from the left raises novel", async () => {
  const H = new Horse({});
  const heard = [];
  H.pushContext("field", { novel: async (v) => { heard.push(v); return "seen"; } });
  await H.flehmen("a stranger", "left", []);
  eq(heard, ["a stranger"], "the novelty was announced");
  await H.flehmen("a stranger", "left", []);
  eq(heard.length, 1, "and not announced twice");
});

T("from the right asks what kind of thing this is", async () => {
  const H = new Horse({});
  const kind = (v) => H.flehmen(v, "right", []);
  eq(await kind([1, 2, 3]), "many");
  eq(await kind(7), "number");
  eq(await kind("a"), "string");
  eq(await kind(forage([1], false)), "forage");
  eq(await kind(pile("perception.test")), "pile");
  eq(await kind(H.affect(0.5, -0.2)), "affect");
  eq(await kind(null), "nothing");
});

T("a cue is recognised as a cue, and a foreign function is not", async () => {
  const H = new Horse({});
  const c = H.cue("draw", [], async () => 1);
  eq(await H.flehmen(c, "right", []), "cue");
  eq(await H.flehmen(function () {}, "right", []), "hands");
});

T("the ambient side decides when none is named", async () => {
  const H = new Horse({});
  eq(await H.flehmen("x", null, []), "string", "right by default: categorise");
  H.side = "left";
  eq(await H.flehmen("y", null, []), true, "now it asks whether it is new");
});

T("the individual's bias sets the ambient side", async () => {
  const H = new Horse({});
  H.declare({ name: "flore", traits: [{ kind: "bias", side: "left" }] });
  eq(H.side, "left");
  eq(await H.flehmen("z", null, []), true, "a left-biased animal asks about novelty");
});

// ---------------------------------------------------------- attention gates looking
//
// Both ears flattened is agonistic, and attention is read from eyes and ears
// together. An animal that is not attending is not looking either.

T("flehmen balks when the last chord closed agonistic", async () => {
  const H = new Horse({});
  await H.chord("_", "_", [], null);
  const b = await balked(() => H.flehmen("x", "right", []));
  ok(/not attending/.test(b.where), b.where);
});

T("attending again restores the look", async () => {
  const H = new Horse({});
  await H.chord("_", "_", [], null);
  await balked(() => H.flehmen("x", "right", []));
  await H.chord("^", "^", [], null);
  eq(await H.flehmen("x", "right", []), "string");
});

T("divided attention is still attention", async () => {
  const H = new Horse({});
  await H.chord("^", "_", [], null);
  eq(H.posture.ears, "divided");
  eq(await H.flehmen("x", "right", []), "string");
});

// ------------------------------------------------------------- the muzzle rule
//
// A horse cannot see its own muzzle. What was handed to you is what you cannot look
// at.

T("a cue cannot flehmen what it was handed", async () => {
  const H = new Horse({});
  const held = { a: 1 };
  const b = await balked(() => H.flehmen(held, "right", [held]));
  ok(/muzzle/.test(b.where), b.where);
});

T("but it can look at anything else", async () => {
  const H = new Horse({});
  const held = { a: 1 };
  eq(await H.flehmen({ b: 2 }, "right", [held]), "thing", "a different thing is visible");
});

T("the emitter hands a cue its own parameters", async () => {
  const code = compile([
    "band a",
    "    cue look thing other",
    "        release flehmen thing",
    "",
  ].join("\n"));
  ok(/H\.flehmen\(thing, null, \[thing, other\]\)/.test(code), `params not carried:\n${code}`);
});

T("a cue with no parameters carries nothing", async () => {
  const code = compile("band a\n    cue look\n        release flehmen 1\n");
  ok(/H\.flehmen\(1, null, \[\]\)/.test(code), code);
});

T("end to end: looking at your own argument refuses the cue", async () => {
  const src = [
    "band a",
    "    cue look thing",
    "        release flehmen thing",
    "    lead mare go",
    "        remember got as look [1 2]",
    "        ^ tension ~0.1 ^",
    "        release got",
    "",
  ].join("\n");
  const seen = [];
  const { threw } = await run(src, { onChord: (p) => seen.push(p) });
  ok(!threw, threw && threw.message);
  eq(seen.length, 1, "the caller carried on; only the cue refused");
});

// --------------------------------------------------------- the point of balance
//
// Pressure behind the shoulder drives forward, in front of it drives back. One third
// of the approach model; the rest waits for v0.3.

T("from behind traverses forward", async () => {
  const H = new Horse({});
  const order = [];
  await H.graze([1, 2, 3], async (x) => { order.push(x); }, "forward");
  eq(order, [1, 2, 3]);
});

T("from the front traverses in reverse", async () => {
  const H = new Horse({});
  const order = [];
  await H.graze([1, 2, 3], async (x) => { order.push(x); }, "back");
  eq(order, [3, 2, 1]);
});

T("unstated, pressure comes from behind", async () => {
  const H = new Horse({});
  const order = [];
  await H.graze([1, 2, 3], async (x) => { order.push(x); });
  eq(order, [1, 2, 3]);
});

T("driving back does not disturb the source", async () => {
  const H = new Horse({});
  const xs = [1, 2, 3];
  await H.graze(xs, async () => {}, "back");
  eq(xs, [1, 2, 3], "the list was not reversed in place");
});

T("the direction reaches the runtime from the syntax", async () => {
  const forward = compile("band a\n    cue go\n        graze [1 2] from behind as x\n            blank\n        release\n");
  ok(/"forward"/.test(forward), "from behind");
  const back = compile("band a\n    cue go\n        graze [1 2] from the front as x\n            blank\n        release\n");
  ok(/"back"/.test(back), "from the front");
  const plain = compile("band a\n    cue go\n        graze [1 2] as x\n            blank\n        release\n");
  ok(!/"forward"|"back"/.test(plain), "unstated passes nothing and defaults");
});

T("nonsense pressure is refused", async () => {
  let msg = "";
  try { compile("band a\n    cue go\n        graze [1 2] from the side as x\n            blank\n        release\n"); }
  catch (e) { msg = e.message; }
  ok(/behind|front/.test(msg), msg);
});

// -------------------------------------------------------------- zones are gone

T("the zone construct no longer exists", async () => {
  let msg = "";
  try { compile("band a\n    flight zone\n        remember h as 0\n    lead mare go\n        release h\n"); }
  catch (e) { msg = e.message; }
  ok(msg.length > 0, "a zone should not compile");
});

T("flight, pressure and zone are ordinary names again", async () => {
  // Unreserved, so v0.3 can decide their syntactic role. Recognise, don't reserve.
  const code = compile([
    "band a",
    "    lead mare go",
    "        remember flight as 1",
    "        remember pressure as 2",
    "        remember zone as 3",
    "        release flight + pressure + zone",
    "",
  ].join("\n"));
  ok(/flight/.test(code) && /pressure/.test(code) && /zone/.test(code));
});

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
