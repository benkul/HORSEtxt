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

// ----------------------------------------------------------------- boundary weight
//
// GRAMMAR.md §11a. Through v0.4 the boundary caught the two faults a compiler can
// see and then went quiet forever, which made it a switch. A contact is felt
// continuously. Every crossing that comes back bare is a signal given and not
// answered, and a run of them at one path is the handler asking the same question
// and getting nothing back.

const notesOf = (r) => (r.horse ? r.horse.diagnostics.map((d) => d.message) : []);

const asking = (n) => band([
  "lead mare go",
  ...Array.from({ length: n }, (_, i) => `    remember v${i} as hands.OUT.find ${i}`),
  "    release",
]);

T("a run of bare crossings at one path is reported", async () => {
  globalThis.OUT = { find: () => null };
  const r = await runSource(asking(3), "t.horse", { stop: () => true });
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(notesOf(r).some((m) => /came back bare 3 times/.test(m)), JSON.stringify(notesOf(r)));
});

T("and it says which path went unanswered", async () => {
  globalThis.OUT = { find: () => null };
  const r = await runSource(asking(3), "t.horse", { stop: () => true });
  ok(notesOf(r).some((m) => /hands\.OUT\.find/.test(m)), JSON.stringify(notesOf(r)));
});

T("two crossings are not a run", async () => {
  globalThis.OUT = { find: () => null };
  const r = await runSource(asking(2), "t.horse", { stop: () => true });
  eq(notesOf(r), [], "two is a coincidence");
});

// Pressure that is sometimes released is a different signal from pressure that is
// never released, and only the second one is worth saying out loud.
T("an answer in the middle resets the count", async () => {
  let n = 0;
  globalThis.OUT = { find: () => (++n === 2 ? "here" : null) };
  const r = await runSource(asking(4), "t.horse", { stop: () => true });
  eq(notesOf(r), [], "it was answered once, so nothing went unreleased three times");
});

// Habituation, the same shape as `habituates after N` (§10). Saying it every time
// would be the flooding the language already warns about.
T("it is said once and then habituates", async () => {
  globalThis.OUT = { find: () => null };
  const r = await runSource(asking(6), "t.horse", { stop: () => true });
  eq(notesOf(r).length, 1, "one note, not four");
});

// The stimulus is the path, not the occasion — two paths are two questions, and
// neither of them has gone unanswered three times.
T("separate paths are counted separately", async () => {
  globalThis.OUT = { find: () => null, get: () => null };
  const r = await runSource(
    band([
      "lead mare go",
      "    remember a as hands.OUT.find 1",
      "    remember b as hands.OUT.get 2",
      "    remember c as hands.OUT.find 3",
      "    remember d as hands.OUT.get 4",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  eq(notesOf(r), [], "two questions, asked twice each");
});

// An index is not part of the shape, for the same reason: `images[0]` and
// `images[1]` are one question asked twice, not two questions.
T("indices collapse into one path", async () => {
  globalThis.OUT = { images: [null, null, null] };
  const r = await runSource(
    band([
      "lead mare go",
      "    remember p as hands.OUT.images[0]",
      "    remember q as hands.OUT.images[1]",
      "    remember s as hands.OUT.images[2]",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(
    notesOf(r).some((m) => /hands\.OUT\.images\[\] came back bare 3 times/.test(m)),
    JSON.stringify(notesOf(r)),
  );
});

// §8a. Zero is a quantity and absence is not. The boundary has to agree with the
// rest of the language about what nothing is, or it reports a working page.
T("a crossing that answers zero has been answered", async () => {
  globalThis.OUT = { find: () => 0 };
  const r = await runSource(asking(3), "t.horse", { stop: () => true });
  eq(notesOf(r), [], "0 is a thing that is there");
});

T("a write across the boundary is not a question", async () => {
  globalThis.OUT = { held: 1 };
  const r = await runSource(
    band([
      "lead mare go",
      "    hands.OUT.held becomes 1",
      "    hands.OUT.held becomes 2",
      "    hands.OUT.held becomes 3",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  eq(notesOf(r), [], "nothing was asked for");
});

// A note is said when it happens. Most of what the animal has to say happens after
// the lead mare has released — in a gait, or in a cue the page kept — and a report
// delivered at the end of the program would be delivered before any of it.
T("a note reaches the host as it happens", async () => {
  globalThis.OUT = { find: () => null };
  const said = [];
  const r = await runSource(
    asking(3), "t.horse", { stop: () => true, onNote: (n) => said.push(n.message) },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(said.some((m) => /came back bare/.test(m)), JSON.stringify(said));
});

// --------------------------------------------------------- arithmetic on a method
//
// GRAMMAR.md §11a, §12f. `now.getTime - 1000` subtracts from the *function*: the
// pressure-with-no-release fault in value position. §11a refuses it as a statement
// and cannot see it here, because in an expression the path does go somewhere.
//
// §12f recorded this in v0.2 — "the rule is right; the failure is quiet" — and it
// stayed quiet for four releases. A `when` on the result is then silently false.
//
// Noted rather than thrown: a failed sum is bare, and §8a already decided that is
// the honest answer to a question with none. What was missing is why it had none.

T("arithmetic on a method is reported", async () => {
  globalThis.OUT = { at: () => 5 };
  const r = await runSource(
    band(["lead mare go", "    remember n as hands.OUT.at - 1", "    release n"]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  ok(notesOf(r).some((m) => /used as a value rather than asked/.test(m)), JSON.stringify(notesOf(r)));
});

T("and it names the path at fault", async () => {
  globalThis.OUT = { at: () => 5 };
  const r = await runSource(
    band(["lead mare go", "    remember n as hands.OUT.at - 1", "    release n"]),
    "t.horse", { stop: () => true },
  );
  ok(notesOf(r).some((m) => /hands\.OUT\.at was used/.test(m)), JSON.stringify(notesOf(r)));
  ok(notesOf(r).some((m) => /write \(hands\.OUT\.at\)/.test(m)), "it says how to fix it");
});

T("either side is caught", async () => {
  globalThis.OUT = { at: () => 5 };
  const r = await runSource(
    band(["lead mare go", "    remember n as 10 * hands.OUT.at", "    release n"]),
    "t.horse", { stop: () => true },
  );
  ok(notesOf(r).some((m) => /hands\.OUT\.at was used/.test(m)), JSON.stringify(notesOf(r)));
});

T("the called form is silent", async () => {
  globalThis.OUT = { at: () => 5 };
  const r = await runSource(
    band(["lead mare go", "    remember n as (hands.OUT.at) - 1", "    release n"]),
    "t.horse", { stop: () => true },
  );
  eq(notesOf(r), [], "asked, and answered");
});

// A sum that fails for an ordinary reason is not this. §8a blesses bare as the
// honest answer to a question that had none, and most of those are not mistakes.
T("an ordinary failed sum says nothing", async () => {
  globalThis.OUT = { at: () => 5, missing: undefined };
  const r = await runSource(
    band(["lead mare go", "    remember n as hands.OUT.missing - 1", "    release n"]),
    "t.horse", { stop: () => true },
  );
  ok(!notesOf(r).some((m) => /used as a value rather than asked/.test(m)),
    JSON.stringify(notesOf(r)));
});

// A comparison against a method is the worst of the three, because it does not
// even come back as nothing: it comes back false, and the wrong branch runs.
T("a comparison against a method is reported", async () => {
  globalThis.OUT = { at: () => 42 };
  const taken = [];
  globalThis.TOOK = (s) => taken.push(s);
  const r = await runSource(
    band([
      "lead mare go",
      "    when hands.OUT.at > 10",
      '        hands.TOOK "over"',
      "    otherwise",
      '        hands.TOOK "under"',
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(notesOf(r).some((m) => /hands\.OUT\.at was used/.test(m)), JSON.stringify(notesOf(r)));
  eq(taken, ["under"], "the value is unchanged; only the silence is fixed");
});

// And concatenation puts JavaScript source into whatever the page shows.
T("joining a method to text is reported", async () => {
  globalThis.OUT = { at: () => 42 };
  const r = await runSource(
    band(['lead mare go', '    remember s as "n: " + hands.OUT.at', "    release s"]),
    "t.horse", { stop: () => true },
  );
  ok(notesOf(r).some((m) => /hands\.OUT\.at was used/.test(m)), JSON.stringify(notesOf(r)));
});

T("ordinary concatenation says nothing", async () => {
  const r = await runSource(
    band(['lead mare go', '    remember s as "n: " + 1', "    release s"]),
    "t.horse", { stop: () => true },
  );
  eq(notesOf(r), []);
  ok(!r.threw, r.threw && String(r.threw));
});

// Every operator still answers what it always answered. Routing them through the
// runtime is a place to look from, not a change of arithmetic.
T("the operators are unchanged", async () => {
  globalThis.OUT = [];
  const r = await runSource(
    band([
      "lead mare go",
      "    hands.OUT.push (7 - 2)",
      "    hands.OUT.push (7 * 2)",
      "    hands.OUT.push (7 / 2)",
      '    hands.OUT.push ("a" + "b")',
      "    hands.OUT.push (7 > 2)",
      "    hands.OUT.push (7 < 2)",
      "    hands.OUT.push (7 >= 7)",
      "    hands.OUT.push (7 <= 2)",
      "    release",
    ]),
    "t.horse", { stop: () => true },
  );
  ok(!r.errors.length, JSON.stringify(r.errors));
  eq(globalThis.OUT, [5, 14, 3.5, "ab", true, false, true, false]);
});

// The provable half. A cue in arithmetic is the same fault and the resolver knows,
// so it is refused at compile time rather than noted at runtime.
T("a cue in arithmetic is refused outright", () => {
  const errs = errorsOf([
    "cue draw", "    release 1",
    "lead mare go", "    remember x as draw - 1", "    release x",
  ]);
  ok(errs.some((m) => /arithmetic on a cue/.test(m)), JSON.stringify(errs));
});

T("and so is a cue held under another name", () => {
  const errs = errorsOf([
    "cue draw", "    release 1",
    "lead mare go", "    remember f as draw", "    remember x as f * 2", "    release x",
  ]);
  ok(errs.some((m) => /arithmetic on a cue/.test(m)), JSON.stringify(errs));
});

// Identity is a real question. Two names may hold the same cue, and asking is not
// arithmetic.
T("comparing two cues is still allowed", () => {
  eq(errorsOf([
    "cue draw", "    release 1",
    "lead mare go", "    remember f as draw",
    "    when f = draw", "        release 1", "    release 0",
  ]), []);
});

// ------------------------------------------------------------------------- report

for (const [name, fn] of queue) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
for (const f of failures) process.stdout.write(`\nFAIL  ${f.name}\n  ${f.message}\n`);
process.stdout.write(`\n${pass} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
