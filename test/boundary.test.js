// node test/boundary.test.js
//
// GRAMMAR.md §11a. The hands boundary, and why it is loud.
//
// `hands` is where the language touches JavaScript, and the name is not decoration:
// it is the human's side of a horse-human interface. The grammar of that interface is
// pressure and release -- the handler applies pressure, the animal responds, the
// pressure is released, and *the release is the information*. A signal with no release
// is not a signal; it teaches nothing.
//
// The reason to make this loud rather than convenient: a horse cannot fail quietly at
// the human boundary. Unclear or contradictory signals produce conflict behaviour --
// head-tossing, tail-swishing, hollowing -- which is observable, and which the whole
// welfare literature is built on reading. Silence arrives only at the end of the
// progression, as learned helplessness. Before v0.4 this boundary sat permanently at
// that end: a forgotten call did nothing, a cue handed to `filter` passed everything,
// and nothing was ever said.

import { compile, runSource } from "../src/browser.js";

let pass = 0;
const failures = [];
const queue = [];
const T = (name, fn) => queue.push([name, fn]);

function ok(cond, what) { if (!cond) throw new Error(what || "expected truthy"); }
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}

const band = (body) => `band a\n${body.map((l) => `    ${l}`).join("\n")}\n`;

function errorsOf(body) {
  return compile(band(body), "t.horse").errors.map((e) => e.message);
}

// ------------------------------------------------------- pressure with no release

T("a bare member path on a line is refused", () => {
  const errs = errorsOf(["lead mare go", "    hands.OUT.play", "    release"]);
  ok(errs.some((m) => /releases nothing/.test(m)), JSON.stringify(errs));
});

T("and the error quotes the line back", () => {
  const errs = errorsOf(["lead mare go", "    hands.OUT.play", "    release"]);
  ok(errs.some((m) => /hands\.OUT\.play/.test(m)), JSON.stringify(errs));
  ok(errs.some((m) => /\(hands\.OUT\.play\)/.test(m)), "it says how to fix it");
});

T("an index path too", () => {
  const errs = errorsOf([
    "lead mare go", "    remember xs as [1 2]", "    xs[0]", "    release",
  ]);
  ok(errs.some((m) => /releases nothing/.test(m)), JSON.stringify(errs));
});

T("the called form is fine", async () => {
  const log = [];
  globalThis.OUT = { play: () => log.push("played") };
  const r = await runSource(
    band(["lead mare go", "    (hands.OUT.play)", "    release"]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  eq(log, ["played"]);
});

// A member read that goes somewhere is not pressure without release -- something was
// asked for and something came back.
T("a member read that is used is fine", () => {
  eq(errorsOf([
    "lead mare go", "    remember v as hands.OUT.count", "    release v",
  ]), []);
});

// ----------------------------------------------------------- opposing signals

T("a cue handed to sort is refused", () => {
  const errs = errorsOf([
    "cue compare x y", "    release 1",
    "lead mare go", "    remember xs as [3 1 2]", "    xs.sort compare", "    release",
  ]);
  ok(errs.some((m) => /answer now/.test(m)), JSON.stringify(errs));
});

T("and to filter, map, some, every, find, reduce", () => {
  for (const method of ["filter", "map", "some", "every", "find", "reduce", "flatMap"]) {
    const errs = errorsOf([
      "cue pick n", "    release n",
      "lead mare go", "    remember xs as [1 2]",
      `    remember r as xs.${method} pick`, "    release r",
    ]);
    ok(errs.some((m) => /answer now/.test(m)), `${method}: ${JSON.stringify(errs)}`);
  }
});

// A listener discards what it gets back, so a cue is exactly right there. This is the
// distinction the check has to preserve: cues are callbacks, not functions.
T("a cue handed to a listener is not refused", () => {
  eq(errorsOf([
    "cue answer", "    release 0",
    "lead mare go", `    hands.document.addEventListener "click" answer`, "    release",
  ]), []);
});

T("and a plain value handed to sort is not refused", () => {
  eq(errorsOf([
    "lead mare go", "    remember xs as [1 2]", "    xs.sort 1", "    release",
  ]), []);
});

// ------------------------------------------------------ leaving into an empty stall

T("a leave from a cue the page called is contained", async () => {
  const listeners = [];
  globalThis.document = { addEventListener: (t, fn) => listeners.push(fn) };
  const r = await runSource(
    band([
      "cue answer", "    leave",
      "lead mare go", `    hands.document.addEventListener "click" answer`, "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));

  let escaped = null;
  try { await listeners[0]({}); } catch (e) { escaped = e.constructor.name; }
  eq(escaped, null, "a Leave in an event handler is an uncaught error in the page");
  ok(
    r.horse.diagnostics.some((d) => /nothing was listening/.test(d.message)),
    JSON.stringify(r.horse.diagnostics),
  );
});

// Inside the program, `leave` still ends the program. That is the whole point of it.
T("a leave inside the program still ends it", async () => {
  const r = await runSource(
    band(["lead mare go", "    leave"]), "t.horse", { stop: () => true },
  );
  eq(r.left, true);
});

// ------------------------------------------------- a handler names what it carried

T("a handler can name what the signal carried", async () => {
  const log = [];
  globalThis.OUT = { note: (x) => log.push(x) };
  const r = await runSource(
    band([
      "cue creaked", `    snort "the near gate"`, "    release 0",
      "lead mare go",
      "    context gates",
      "        hears snort as what",
      `            hands.OUT.note ("heard: " + what)`,
      "            release 0",
      "    (creaked)",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(!r.threw, r.threw && r.threw.message);
  eq(log, ["heard: the near gate"]);
});

T("the binding belongs to its own handler", () => {
  const errs = errorsOf([
    "lead mare go",
    "    context gates",
    "        hears snort as what",
    "            release what",
    "        hears squeal",
    "            release what",
    "    release",
  ]);
  ok(errs.some((m) => /"what" is not declared/.test(m)), JSON.stringify(errs));
});

T("a handler with no binding still works", async () => {
  const r = await runSource(
    band([
      "cue creaked", "    snort 1", "    release 0",
      "lead mare go",
      "    context gates",
      "        hears snort",
      "            release 0",
      "    (creaked)",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(!r.threw, r.threw && r.threw.message);
});

// ------------------------------------------------------------------------- report

for (const [name, fn] of queue) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
for (const f of failures) process.stdout.write(`\nFAIL  ${f.name}\n  ${f.message}\n`);
process.stdout.write(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
