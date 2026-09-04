// node test/affect.test.js
//
// GRAMMAR.md §9. Arousal and valence are non-harmonically related and do not reduce
// to one pitch, so an affect never collapses to a magnitude. That refusal is the
// rule the construct exists for, and it was the only part of §9 that was built:
// every arithmetic and comparison §9 describes threw on the way through `valueOf`.
//
// The refusal is about *collapsing*, not about arithmetic. These hold it to both.

import { runSource } from "../src/browser.js";

let pass = 0;
const failures = [];
const tests = [];
const T = (name, fn) => tests.push([name, fn]);

function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what || "value"}\n  expected ${y}\n  got      ${x}`);
}
function ok(c, what) { if (!c) throw new Error(what || "expected truthy"); }

async function run(body) {
  globalThis.OUT = [];
  const src = `band t\n    lead mare go\n${body.map((l) => "        " + l).join("\n")}\n        release`;
  const r = await runSource(src, "t.horse", {});
  if (r.errors.length) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}

const got = async (body) => { await run(body); return globalThis.OUT; };

// ------------------------------------------------------------- affect and affect

T("two affects combine component-wise", async () => {
  eq(await got([
    "remember a as ~0.8:~0.3",
    "remember b as ~0.1:~0.2",
    "remember c as a + b",
    "hands.OUT.push c.arousal",
    "hands.OUT.push c.valence",
  ]), [0.9, 0.5]);
});

T("and stay a pair, rather than becoming one number", async () => {
  eq(await got([
    "remember a as ~0.8:~0.4",
    "remember b as ~0.2:~0.1",
    "remember c as a - b",
    "hands.OUT.push c.arousal",
    "hands.OUT.push c.valence",
  ]), [0.6000000000000001, 0.30000000000000004]);
});

// ------------------------------------------------------------- affect and scalar
//
// Arousal is intensity and valence is sign. Scaling a sign is meaningless, so a
// scalar reaches arousal and leaves valence alone.

T("a scalar applies to arousal only", async () => {
  eq(await got([
    "remember a as ~0.8:~0.3",
    "remember c as a * 2",
    "hands.OUT.push c.arousal",
    "hands.OUT.push c.valence",
  ]), [1.6, 0.3]);
});

T("valence survives a scalar untouched, sign and all", async () => {
  eq(await got([
    "remember a as ~0.2:~-0.9",
    "remember c as a * 3",
    "hands.OUT.push c.valence",
  ]), [-0.9]);
});

T("the scalar may come first, and the order is kept", async () => {
  eq(await got([
    "remember a as ~0.3:~0.5",
    "remember c as 1 - a",
    "hands.OUT.push c.arousal",
    "hands.OUT.push c.valence",
  ]), [0.7, 0.5]);
});

// A graded value is a plain number, so it is a scalar here.
T("a graded value is a scalar", async () => {
  eq(await got([
    "remember a as ~0.8:~0.3",
    "remember c as a * ~0.5",
    "hands.OUT.push c.arousal",
  ]), [0.4]);
});

// ---------------------------------------------------------------- comparison
//
// Arousal is the axis with an order. Comparing valence means naming the axis.

T("comparison reads arousal", async () => {
  eq(await got([
    "remember a as ~0.8:~0.3",
    "remember b as ~0.1:~0.9",
    "hands.OUT.push (a > b)",
  ]), [true], "0.8 is more aroused than 0.1, whatever the valence says");
});

T("and compares against a plain number too", async () => {
  eq(await got([
    "remember a as ~0.8:~0.3",
    "hands.OUT.push (a > 0.5)",
    "hands.OUT.push (a < 0.5)",
  ]), [true, false]);
});

// ------------------------------------------------------------------- the refusal
//
// The rule the whole construct exists to enforce. Anything that wants one magnitude
// out of a pair is a type error, and the message names the axes rather than
// explaining itself.

async function threw(body) {
  const r = await run(body);
  return r.threw ? String(r.threw.message || r.threw) : null;
}

T("joining an affect to text is refused", async () => {
  const m = await threw(['remember a as ~0.8:~0.3', 'hands.OUT.push ("x: " + a)']);
  ok(m && /does not collapse/.test(m), String(m));
});

T("handing one to JavaScript arithmetic is refused", async () => {
  const m = await threw(["remember a as ~0.8:~0.3", "hands.OUT.push (hands.Math.floor a)"]);
  ok(m && /does not collapse/.test(m), String(m));
});

T("the refusal names the axes", async () => {
  const m = await threw(['remember a as ~0.8:~0.3', 'hands.OUT.push ("x: " + a)']);
  ok(/\.arousal/.test(m) && /\.valence/.test(m), String(m));
  ok(/Briefer/.test(m), "it cites rather than explains");
});

// Component access is how you get one number out, and it always worked.
T("naming an axis yields a number", async () => {
  eq(await got([
    "remember a as ~0.8:~-0.3",
    "hands.OUT.push a.arousal",
    "hands.OUT.push a.valence",
  ]), [0.8, -0.3]);
});

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
