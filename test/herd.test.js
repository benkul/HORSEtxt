// node test/herd.test.js
//
// GRAMMAR.md §2.4. Horses have a multilevel society: units nested in a herd, with
// association rates that are bimodal and inter-unit distances closer than chance.
// Units hold their boundaries — becoming more cohesive as another approaches, and
// elongating to avoid crossing — while particular pairs cross anyway.
//
// So visibility inside a herd is pairwise and declared, and both sides must declare
// it. All-male units occupy the periphery, which is why a bachelor group sees in
// without asking.

import { compile, runSource } from "../src/browser.js";

let pass = 0;
const failures = [];
const tests = [];
const T = (name, fn) => tests.push([name, fn]);

function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what || "value"}\n  expected ${y}\n  got      ${x}`);
}
function ok(c, what) { if (!c) throw new Error(what || "expected truthy"); }

const src = (...lines) => lines.join("\n") + "\n";
const errs = (s) => compile(s, "h.horse").errors.map((e) => e.message);
const clean = (s) => {
  const out = compile(s, "h.horse");
  if (out.errors.length) throw new Error(out.errors.map((e) => e.message).join("; "));
  return out;
};

// ------------------------------------------------------------------ the crossing

T("a crossing both bands name opens both ways", async () => {
  clean(src(
    "herd site",
    "    band gallery",
    "        mingles with listening",
    "        cue draw",
    "            release 1",
    "    band listening",
    "        mingles with gallery",
    "        cue play",
    "            release 2",
    "        lead mare enter",
    "            release (draw)",       // reaches into gallery
  ));
  clean(src(
    "herd site",
    "    band gallery",
    "        mingles with listening",
    "        lead mare go",
    "            release (play)",       // and the other way
    "    band listening",
    "        mingles with gallery",
    "        cue play",
    "            release 2",
  ));
});

T("one side alone opens nothing, and says which side is missing", async () => {
  const e = errs(src(
    "herd site",
    "    band gallery",
    "        mingles with listening",
    "        cue draw",
    "            release 1",
    "    band listening",
    "        lead mare enter",
    "            release (draw)",
  ));
  ok(/does not mingle with gallery/.test(e[0]), e[0]);
  ok(/a crossing is mutual/.test(e[0]), "and says why");
});

T("no crossing, no sharing", async () => {
  const e = errs(src(
    "herd site",
    "    band gallery",
    "        cue draw",
    "            release 1",
    "    band listening",
    "        lead mare enter",
    "            release (draw)",
  ));
  ok(/belongs to band gallery/.test(e[0]), e[0]);
});

// A name that exists in the herd but was not shared reads as a typo unless the
// error says otherwise.
T("an unshared name is distinguished from a misspelt one", async () => {
  const shared = errs(src(
    "herd site",
    "    band gallery",
    "        cue draw",
    "            release 1",
    "    band listening",
    "        lead mare enter",
    "            release (draw)",
  ));
  ok(/does not mingle with/.test(shared[0]), "unshared says so");

  const typo = errs(src(
    "herd site",
    "    band listening",
    "        lead mare enter",
    "            release (drwa)",
  ));
  ok(/is not declared in this scope/.test(typo[0]), "a real typo reads as one");
});

T("a band cannot mingle with itself", async () => {
  ok(/cannot mingle with itself/.test(errs(src(
    "herd site",
    "    band a",
    "        mingles with a",
    "        lead mare go",
    "            release 1",
  ))[0]));
});

T("a band cannot mingle with a stranger", async () => {
  ok(/is not in this herd/.test(errs(src(
    "herd site",
    "    band a",
    "        mingles with nowhere",
    "        lead mare go",
    "            release 1",
  ))[0]));
});

T("mingling outside a herd has nothing to cross to", async () => {
  ok(/only means something between bands of one herd/.test(errs(src(
    "band a",
    "    mingles with b",
    "    lead mare go",
    "        release 1",
  ))[0]));
});

// ------------------------------------------------------------------ the periphery
//
// All-male units occupy the edge of the herd, and coordination reaches them. So a
// bachelor group observes without being observed, which is what a test group wants.

T("a bachelor group sees every band without asking", async () => {
  clean(src(
    "herd site",
    "    band gallery",
    "        cue draw",
    "            release 1",
    "    band listening",
    "        cue play",
    "            release 2",
    "    bachelors probes",
    "        lead mare check",
    "            release (draw) + (play)",
  ));
});

T("no band sees a bachelor group", async () => {
  const e = errs(src(
    "herd site",
    "    bachelors probes",
    "        cue helper",
    "            release 1",
    "    band gallery",
    "        lead mare go",
    "            release (helper)",
  ));
  ok(/belongs to band probes/.test(e[0]), e[0]);
});

T("one bachelor group does not see another", async () => {
  const e = errs(src(
    "herd site",
    "    bachelors one",
    "        cue helper",
    "            release 1",
    "    bachelors two",
    "        lead mare go",
    "            release (helper)",
  ));
  ok(e.length > 0, "the periphery is not a shared room");
});

// -------------------------------------------------------------------- the herd

T("names are distinct across a herd", async () => {
  const e = errs(src(
    "herd site",
    "    band a",
    "        cue draw",
    "            release 1",
    "    band b",
    "        cue draw",
    "            release 2",
    "        lead mare go",
    "            release 0",
  ));
  ok(/declared in band a as well/.test(e[0]), e[0]);
});

T("a herd holds bands and nothing else", async () => {
  ok(/holds bands, and nothing else/.test(errs(src(
    "herd site",
    "    cue loose",
    "        release 1",
    "    band a",
    "        lead mare go",
    "            release 1",
  ))[0]));
});

T("the band-size lint points at mingling as the remedy", async () => {
  const many = ["herd site", "    band big"];
  for (let i = 1; i <= 9; i++) many.push(`        cue c${i}`, "            release");
  many.push("    band other", "        lead mare go", "            release");
  const w = compile(many.join("\n") + "\n", "h.horse").warnings;
  ok(w.length > 0, "still warns");
  ok(/mingles with/.test(w[0].message), `offers a remedy: ${w[0].message}`);
});

// ------------------------------------------------------------------- at runtime

T("a lead mare may call into a band declared below it", async () => {
  // Lead mares are deferred until every band is standing, so declaration order
  // inside the herd does not matter.
  const seen = [];
  const r = await runSource(src(
    "herd site",
    "    band early",
    "        mingles with late",
    "        lead mare go",
    "            ^ tension ~(gift) ^",
    "            release",
    "    band late",
    "        mingles with early",
    "        cue gift",
    "            release 7",
  ), "h.horse", { onChord: (p) => seen.push(p.states[0].value) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen, [7], "the call reached a band declared after it");
});

T("every band's lead mare runs", async () => {
  const seen = [];
  const r = await runSource(src(
    "herd site",
    "    band one",
    "        lead mare a",
    "            ^ voice ~0.1 ^",
    "            release",
    "    band two",
    "        lead mare b",
    "            ^ voice ~0.2 ^",
    "            release",
  ), "h.horse", { onChord: (p) => seen.push(p.states[0].value) });
  ok(!r.threw, r.threw && r.threw.message);
  eq(seen, [0.1, 0.2]);
});

T("a crossing is a compile-time fact, not a runtime one", async () => {
  const out = clean(src(
    "herd site",
    "    band a",
    "        mingles with b",
    "        cue x",
    "            release 1",
    "    band b",
    "        mingles with a",
    "        lead mare go",
    "            release (x)",
  ));
  ok(/\/\/ mingles with b/.test(out.code), "recorded as a comment");
  ok(!/H\.mingle/.test(out.code), "and nothing at runtime");
});

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
