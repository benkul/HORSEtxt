// node test/browser.test.js
//
// The loader is tested against a stub document. It is a small stub on purpose: if a
// test needs more of the DOM than this, the runtime is reaching for the page itself,
// which it must not do.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compile, runSource, load, browserHost, blocks } from "../src/browser.js";
import { SAMPLES } from "../examples/samples.js";

const here = dirname(fileURLToPath(import.meta.url));

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

// ------------------------------------------------------------------- the DOM stub

function fakeDoc(sources) {
  const listeners = new Map();
  const attrs = new Map();
  const scripts = sources.map((s, i) => ({
    textContent: typeof s === "string" ? s : s.source,
    getAttribute: (k) => (typeof s === "string" ? null : (s[k.replace("data-", "")] ?? null)),
  }));
  return {
    readyState: "complete",
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      attrs,
    },
    querySelectorAll: (sel) => (sel === 'script[type="text/horse"]' ? scripts : []),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    fire(type, event) {
      for (const fn of listeners.get(type) || []) fn(event);
    },
    listeners,
  };
}

// Captures console output so a report can be asserted on.
function capture(fn) {
  const lines = [];
  const original = { log: console.log, groupCollapsed: console.groupCollapsed, groupEnd: console.groupEnd };
  console.log = (...a) => lines.push(a.join(" "));
  console.groupCollapsed = (...a) => lines.push(a.join(" "));
  console.groupEnd = () => {};
  return Promise.resolve(fn()).finally(() => Object.assign(console, original)).then(() => lines);
}

const tests = [];
const T = (name, fn) => tests.push([name, fn]);

// -------------------------------------------------------------------- compiling

T("valid source compiles to a bare body, not a module", async () => {
  const out = compile("band a\n    cue b\n        release\n", "t.horse");
  eq(out.errors, []);
  ok(!/export default/.test(out.code), "no module wrapper for the browser");
  ok(/sourceURL=t\.horse/.test(out.code), "names itself for devtools");
});

T("compile reports errors instead of throwing", async () => {
  const out = compile("band a\n    cue b\n        halt\n", "t.horse");
  ok(out.errors.length > 0, "the cue never names an outcome");
  eq(out.code, undefined);
});

T("compile carries warnings through on success", async () => {
  const out = compile([
    "band a",
    "    cue other",
    "        release 1",
    "    cue go",
    "        other",
    "        release",
    "",
  ].join("\n"), "t.horse");
  eq(out.errors, []);
  ok(out.warnings.length > 0, "the bare cue name warns");
});

// ---------------------------------------------------------------------- running

T("runSource executes and the host sees the utterance", async () => {
  const seen = [];
  const r = await runSource(
    "band a\n    lead mare go\n        ^ ears forward ^\n        release\n",
    "t.horse",
    { onChord: (p) => seen.push(p) },
  );
  eq(r.ran, true);
  eq(seen.length, 1);
  eq(seen[0].ears, "forward");
});

T("leaving is reported as leaving, not as a failure", async () => {
  const r = await runSource(
    "band a\n    lead mare go\n        leave\n",
    "t.horse",
    {},
  );
  eq([r.ran, r.left], [true, true]);
  ok(!r.threw, "a leave is not a throw");
});

T("a genuine throw is separated from a refusal", async () => {
  const r = await runSource(
    'band a\n    lead mare go\n        remember x as hands.nothing.here\n        release x\n',
    "t.horse",
    {},
  );
  ok(r.threw, "reaching through a missing member throws");
  ok(!r.refused, "and that is not a refusal");
});

// ----------------------------------------------------------------- the loader

T("the loader finds and runs every inline block", async () => {
  const doc = fakeDoc([
    "band one\n    lead mare go\n        ^ ears forward ^\n        release\n",
    "band two\n    lead mare go\n        _ ears back _\n        release\n",
  ]);
  eq(blocks(doc).length, 2);
  const seen = [];
  const results = await load({ document: doc, host: { onChord: (p) => seen.push(p) } });
  eq(results.length, 2);
  eq(seen.map((p) => p.ears), ["forward", "agonistic"]);
});

T("a block that fails does not stop the ones after it", async () => {
  const doc = fakeDoc([
    "band broken\n    cue b\n        halt\n",
    "band fine\n    lead mare go\n        ^ ears forward ^\n        release\n",
  ]);
  const seen = [];
  const lines = await capture(() =>
    load({ document: doc, host: { onChord: (p) => seen.push(p) } }),
  );
  eq(seen.length, 1, "the second block still ran");
  ok(lines.some((l) => /did not compile/.test(l)), lines.join("\n"));
});

T("a block with no lead mare is real, readable, and dead", async () => {
  const doc = fakeDoc([
    "band quiet\n    cue never\n        ^ ears forward ^\n        release\n",
  ]);
  const seen = [];
  const results = await load({ document: doc, host: { onChord: (p) => seen.push(p) } });
  eq(results[0].errors, []);
  eq(results[0].ran, true);
  eq(seen.length, 0, "nothing ran, and nothing was wrong");
});

T("a block can be named for devtools", async () => {
  const doc = fakeDoc([{ source: "band a\n    cue b\n        release\n", name: "gallery.horse" }]);
  const results = await load({ document: doc, host: {} });
  eq(results[0].name, "gallery.horse");
});

T("errors are reported with a citation and capped", async () => {
  const doc = fakeDoc(["band a\n    cue go\n        pace\n            halt\n        release\n"]);
  const lines = await capture(() => load({ document: doc, host: {} }));
  const text = lines.join("\n");
  ok(/AA allele/.test(text), text);
  ok(/Promerova/.test(text), "cites the paper, does not explain");
});

// -------------------------------------------------------------------- the host

T("the host writes the posture onto the document", async () => {
  const doc = fakeDoc([]);
  const host = browserHost({ document: doc });
  host.onChord({ ears: "agonistic", states: [{ channel: "tension", value: 0.4 }] });
  eq(doc.documentElement.getAttribute("data-ears"), "agonistic");
  eq(doc.documentElement.getAttribute("data-tension"), "0.4");
});

// A chord is one utterance and its channels are simultaneous (§4). What the second
// chord does not say, the animal is not doing — so a page reading `data-lids` never
// has to wonder whether it is looking at a held position or last chord's leftovers.
T("a chord clears the channels it does not name", async () => {
  const doc = fakeDoc([]);
  const host = browserHost({ document: doc });
  host.onChord({
    ears: "forward",
    states: [{ channel: "eyes", value: "wide" }, { channel: "nostrils", value: "AD38" }],
  });
  host.onChord({ ears: "divided", states: [{ channel: "eyes", value: "soft" }] });
  eq(doc.documentElement.getAttribute("data-ears"), "divided");
  eq(doc.documentElement.getAttribute("data-eyes"), "soft");
  eq(doc.documentElement.getAttribute("data-nostrils"), null, "nostrils were not uttered");
});

T("the host tracks the pointer passively", async () => {
  const doc = fakeDoc([]);
  browserHost({ document: doc });
  ok(doc.listeners.has("pointermove"), "listening for movement");
  ok(doc.listeners.has("touchmove"), "and for touch");
});

T("a stand held still resolves; a stand that drifts does not", async () => {
  const doc = fakeDoc([]);
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 1);
  try {
    const host = browserHost({ document: doc });
    doc.fire("pointermove", { clientX: 100, clientY: 100 });

    const progress = [];
    const held = await host.hold({ ms: 30, jitter: 20, onProgress: (t) => { progress.push(t); } });
    eq(held, true, "still enough for long enough");
    ok(progress.length > 0, "progress was reported");
    ok(progress[progress.length - 1] <= 1, "progress is graded 0..1");

    const drifting = host.hold({ ms: 200, jitter: 5, onProgress: null });
    setTimeout(() => doc.fire("pointermove", { clientX: 400, clientY: 400 }), 5);
    eq(await drifting, false, "drifting past the jitter radius breaks the hold");
  } finally {
    globalThis.requestAnimationFrame = raf;
  }
});

T("with no animation frames at all, a stand cannot hold", async () => {
  const doc = fakeDoc([]);
  const raf = globalThis.requestAnimationFrame;
  delete globalThis.requestAnimationFrame;
  try {
    const host = browserHost({ document: doc });
    eq(await host.hold({ ms: 10, jitter: 10, onProgress: null }), false);
  } finally {
    if (raf) globalThis.requestAnimationFrame = raf;
  }
});

T("a stand in a real program runs its otherwise when the hold breaks", async () => {
  const src = [
    "band a",
    "    lead mare go",
    "        stand 10s within 20px as held",
    "            ^ tension ~held ^",
    "        otherwise",
    "            _ ears back _",
    "        release",
    "",
  ].join("\n");
  const seen = [];
  // No host hold at all, so the hold cannot be held.
  const r = await runSource(src, "t.horse", { onChord: (p) => seen.push(p) });
  eq(r.ran, true);
  eq(seen.map((p) => p.ears), ["agonistic"], "the broken hold spoke instead");
});

// ---------------------------------------------------------------- the examples
//
// Importing a module parses it without running it, which is how `graze` over a
// plain list stayed broken while every suite was green. These execute.

// The examples are browser programs and reach through `hands` for the DOM, which is
// the whole point of `hands` being a flat, unconditioned boundary. Node has no DOM,
// so lend them the smallest one that lets the reach succeed.
function lendDOM() {
  const had = "document" in globalThis;
  const previous = globalThis.document;
  const el = () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {} });
  globalThis.document = {
    createElement: el,
    querySelector: el,
    body: { appendChild() {} },
    documentElement: { setAttribute() {}, getAttribute: () => null, removeAttribute() {} },
    addEventListener() {}, removeEventListener() {},
  };
  return () => { if (had) globalThis.document = previous; else delete globalThis.document; };
}

T("every example file runs", async () => {
  const dir = join(here, "..", "examples");
  const files = ["exposure.horse", "gallery.horse", "listening.horse"];
  const restore = lendDOM();
  const bad = [];
  try {
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      // Two examples hold a gait forever, which is right in a page and a hang here.
      // A host that stops immediately lets one stride run and then ends it.
      const r = await runSource(src, f, { stop: () => true });
      if (r.errors.length) bad.push(`${f}: ${r.errors.map((e) => e.message).join("; ")}`);
      else if (r.threw) bad.push(`${f}: threw ${r.threw.message || r.threw}`);
    }
  } finally {
    restore();
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

T("grazing works over a list, a forage and a pile", async () => {
  const { Horse: H0, forage, pile } = await import("../src/runtime.js");
  const H = new H0({});

  const fromList = [];
  await H.graze([4, 5, 6], async (x) => { fromList.push(x); });
  eq(fromList, [4, 5, 6], "a plain list");

  const fromForage = [];
  await H.graze(forage([1, 2, 3], false), async (x) => { fromForage.push(x); });
  eq(fromForage.slice().sort(), [1, 2, 3], "forage, drawn not ordered");

  const p = pile("graze.test");
  p.append("a"); p.append("b");
  const fromPile = [];
  await H.graze(p, async (x) => { fromPile.push(x); });
  eq(fromPile, ["a", "b"], "a pile, in the order it was left");

  let threw = false;
  try { await H.graze(7, async () => {}); } catch (e) { threw = /cannot be grazed/.test(e.message); }
  ok(threw, "a number cannot be grazed, and says so");
});

// ------------------------------------------------------------- the playground

T("every playground sample compiles", async () => {
  const bad = [];
  for (const [name, src] of Object.entries(SAMPLES)) {
    const out = compile(src, `${name}.horse`);
    if (out.errors.length) {
      bad.push(`${name}: ${out.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
    }
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

T("every playground sample runs without throwing", async () => {
  const bad = [];
  for (const [name, src] of Object.entries(SAMPLES)) {
    const r = await runSource(src, `${name}.horse`, {});
    // Leaving and balking are successes. A throw is not.
    if (r.threw) bad.push(`${name}: ${r.threw.message || r.threw}`);
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

T("the samples demonstrate what they claim", async () => {
  // agonistic ears really do stop the handler firing, and the field says why
  const seen = [];
  const heard = [];
  await runSource(SAMPLES["agonistic ears"], "s.horse", {
    onChord: (p) => seen.push(p),
    onSignal: (name, a) => heard.push([name, a.answered, a.reason]),
  });
  eq(seen.map((p) => p.ears), ["agonistic"], "the handler's chord never uttered");
  eq(heard, [["snort", false, "not attending"]], "and the silence is reported, not inferred");

  // affect exposes its axes and refuses to collapse
  const r = await runSource(SAMPLES["affect will not collapse"], "s.horse", {});
  ok(!r.threw, "reading .arousal is fine");

  // a late release is noticed. the sample stops itself with `halt`, so nothing
  // needs to interrupt it — it simply takes longer than the budget.
  const late = await runSource(SAMPLES["a late release is punishing"], "s.horse", {});
  ok(
    late.horse.diagnostics.some((d) => /punishes/.test(d.message)),
    `expected a late-release note, got: ${JSON.stringify(late.horse.diagnostics)}`,
  );

  // a cue held under another name is the same cue, and answers as itself
  const named = await runSource(SAMPLES["a cue held under another name"], "s.horse", {});
  ok(!named.threw, named.threw && named.threw.message);

  // a held gait halts itself rather than running forever
  const held = await runSource(SAMPLES["halting a held gait"], "s.horse", {});
  ok(!held.threw, "the halt ended the gait");
  eq(held.left, false, "halting is not leaving");
});

T("an answered signal names who answered", async () => {
  const heard = [];
  await runSource(SAMPLES["a context"], "s.horse", {
    onSignal: (name, a) => heard.push([name, a.answered, a.by]),
  });
  eq(heard, [["snort", true, "grazing"]]);
});

T("a signal with nobody listening is unanswered for a different reason", async () => {
  const heard = [];
  await runSource(
    "band a\n    lead mare go\n        ^ ears forward ^\n        snort\n        release\n",
    "s.horse",
    { onSignal: (name, a) => heard.push([name, a.answered, a.reason]) },
  );
  eq(heard, [["snort", false, "nobody there"]], "attending, but alone");
});

T("the playground pulls its samples from the shared module", async () => {
  const html = readFileSync(join(here, "..", "playground.html"), "utf8");
  ok(/from "\.\/examples\/samples\.js"/.test(html), "imports the samples");
  ok(!/const SAMPLES = \{/.test(html), "does not carry its own copy");
});

// ------------------------------------------------------------------------- done

for (const [name, fn] of tests) await test(name, fn);

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);
