// node test/truth.test.js
//
// GRAMMAR.md §8a. What a horse counts as true, and what it counts as nothing.
//
// The distinction these test is not a convenience. Mejdell 2016 taught horses three
// symbols, and the third -- no change -- was a blank glyph the animal had to press,
// because an experimenter cannot infer "no change" from a horse standing still. A
// horse standing still might be confused, unmotivated or unable. Silence is not an
// answer, so absence must not quietly become one.

import { compile, runSource } from "../src/browser.js";

let pass = 0;
const failures = [];

async function test(name, fn) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
const queue = [];
const T = (name, fn) => queue.push([name, fn]);

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "expected truthy"); }

// Runs a lead mare body and returns whatever it noted, in order.
async function noted(body, host = {}) {
  const log = [];
  globalThis.OUT = { note: (x) => log.push(x) };
  const src = `band a\n    lead mare go\n${body.map((l) => `        ${l}`).join("\n")}\n        release\n`;
  const r = await runSource(src, "t.horse", { stop: () => true, ...host });
  if (r.errors && r.errors.length) {
    throw new Error(r.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; "));
  }
  if (r.threw) throw new Error(r.threw.message || String(r.threw));
  return log;
}

// ------------------------------------------------------------------- what is true

T("zero is a quantity, and quantities are there", async () => {
  eq(await noted([`when 0`, `    hands.OUT.note "yes"`]), ["yes"]);
});

T("an utterance of no length is still an utterance", async () => {
  eq(await noted([`when ""`, `    hands.OUT.note "yes"`]), ["yes"]);
});

T("an empty list is a list", async () => {
  eq(await noted([`when []`, `    hands.OUT.note "yes"`]), ["yes"]);
});

T("bare is nothing being there", async () => {
  eq(await noted([`when bare`, `    hands.OUT.note "no"`]), []);
  eq(await noted([`when not bare`, `    hands.OUT.note "yes"`]), ["yes"]);
});

T("a comparison that comes out no is still an answer", async () => {
  eq(await noted([`when (3 > 5)`, `    hands.OUT.note "no"`]), []);
  eq(await noted([`when (3 < 5)`, `    hands.OUT.note "yes"`]), ["yes"]);
});

// A question that had no answer is not an answer of its own.
T("a failed sum is bare", async () => {
  eq(await noted([
    `remember n as (0 / 0)`,
    `when n`,
    `    hands.OUT.note "no"`,
    `when not n`,
    `    hands.OUT.note "nothing came back"`,
  ]), ["nothing came back"]);
});

T("an affect is still not a truth", async () => {
  let message = "";
  try { await noted([`when ~0.5:~0.5`, `    hands.OUT.note "no"`]); }
  catch (e) { message = e.message; }
  ok(/not a truth/.test(message), message);
});

// --------------------------------------------------------------------- patch use

T("grass is the first patch with anything in it", async () => {
  eq(await noted([`hands.OUT.note (grass in [bare bare "third"])`]), ["third"]);
});

T("and zero counts as something in it", async () => {
  eq(await noted([`hands.OUT.note (grass in [bare 0 7])`]), [0]);
});

T("all patches bare comes back bare", async () => {
  eq(await noted([
    `remember x as grass in [bare bare]`,
    `when not x`,
    `    hands.OUT.note "nothing anywhere"`,
  ]), ["nothing anywhere"]);
});

// The bug this construct exists for: `or` joins answers and gives an answer back,
// which is right for `or` and useless for a default.
T("or still answers, and does not stand in for a patch", async () => {
  eq(await noted([`hands.OUT.note (bare or 7)`]), [true]);
  eq(await noted([`hands.OUT.note (grass in [bare 7])`]), [7]);
});

T("grass wants a list, and says so", async () => {
  const out = compile(`band a\n    lead mare go\n        remember x as grass in 7\n        release\n`, "t.horse");
  ok(out.errors.length === 1, JSON.stringify(out.errors));
  ok(/list of patches/.test(out.errors[0].message), out.errors[0].message);
});

// ---------------------------------------------------------------------- stumbling

T("a stumble ends the stride and not the gait", async () => {
  eq(await noted([
    `remember taken as 0`,
    `remember finished as 0`,
    `walk`,
    `    taken becomes taken + 1`,
    `    when taken`,
    `        stumble`,
    `    finished becomes finished + 1`,
    `hands.OUT.note taken`,
    `hands.OUT.note finished`,
  ]), [1, 0], "the stride began and did not complete");
});

T("a held gait keeps walking after one", async () => {
  let strides = 0;
  eq(await noted([
    `remember got as 0`,
    `walk every 1ms`,
    `    got becomes got + 1`,
    `    when (got < 3)`,
    `        stumble`,
    `    halt`,
    `hands.OUT.note got`,
  ], { stop: () => ++strides > 10 }), [3], "two stumbles, then the third stride finished");
});

T("a stumble outside a gait is refused", async () => {
  const out = compile(`band a\n    lead mare go\n        stumble\n        release\n`, "t.horse");
  ok(out.errors.length === 1, JSON.stringify(out.errors));
  ok(/no stride to break/.test(out.errors[0].message), out.errors[0].message);
});

// A cue called from inside a stride does not know it is in one, and neither does
// the animal: the horse that stumbles is the one taking the step.
T("a cue cannot stumble on its caller's behalf", async () => {
  const out = compile(
    `band a\n    cue helper\n        stumble\n    lead mare go\n        walk\n            (helper)\n        release\n`,
    "t.horse",
  );
  ok(out.errors.some((e) => /no stride to break/.test(e.message)), JSON.stringify(out.errors));
  // And it is not an outcome either -- a cue still has to say how it ends.
  ok(out.errors.some((e) => /naming an outcome/.test(e.message)), JSON.stringify(out.errors));
});

// ------------------------------------------------------------------------- report

for (const [name, fn] of queue) await test(name, fn);
for (const f of failures) process.stdout.write(`\nFAIL  ${f.name}\n  ${f.message}\n`);
process.stdout.write(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
