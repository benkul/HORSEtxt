// node test/degradation.test.js
//
// GRAMMAR.md §3. Release is the reinforcer, and a late release does not merely take
// longer — it punishes the response it should have rewarded. Repeated, it degrades
// the binding toward learned helplessness, which retrying cannot repair.
//
// Two properties of that are load-bearing and easy to get wrong:
//
//   - The count is **cumulative and does not reset**. A counter that reset on a
//     prompt release would mean retrying repaired the binding, and the whole point
//     of learned helplessness is that it does not: the animal has learned that its
//     behaviour does not control the outcome, and restoring the contingency does
//     not un-teach that.
//   - It happens **only under a declared individual**. Degradation is a history,
//     and with no animal to carry one there is nobody for it to happen to (§2).

import { Horse, LATE_RELEASES } from "../src/runtime.js";
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

// A cue that always releases late, driven directly so the tests do not spend
// seconds waiting. The budget is lowered rather than the work made slow.
function slowHorse({ declared = true, budget = 5 } = {}) {
  const H = new Horse({});
  if (declared) H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = budget;
  const cue = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, budget + 15));
    return "answered";
  });
  return { H, cue };
}

const notes = (H) => H.diagnostics.map((d) => d.message);

// ------------------------------------------------------------------ degradation

T("a cue that keeps releasing late stops answering", async () => {
  const { H, cue } = slowHorse();
  const got = [];
  for (let i = 0; i < LATE_RELEASES + 2; i++) got.push(await cue());
  eq(got.slice(0, LATE_RELEASES), Array(LATE_RELEASES).fill("answered"),
    "it answers until the binding gives out");
  eq(got.slice(LATE_RELEASES), [undefined, undefined], "and then it does not");
});

// Bare, not refused. A balk is an answer — Mejdell's point is that an answer has to
// be given — and helplessness is the absence of one.
T("a helpless cue comes back bare, so `when` on it is false", async () => {
  const { H, cue } = slowHorse();
  for (let i = 0; i < LATE_RELEASES; i++) await cue();
  const answer = await cue();
  eq(answer, undefined, "nothing came back");
  eq(H.truth(answer), false, "and nothing is not an answer");
});

T("the body does not run once it is helpless", async () => {
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  let ran = 0;
  const cue = H.cue("dawdle", [], async () => {
    ran++;
    await new Promise((r) => setTimeout(r, 20));
    return 1;
  });
  for (let i = 0; i < LATE_RELEASES + 3; i++) await cue();
  eq(ran, LATE_RELEASES, "it stopped trying rather than trying and failing");
});

// The property that distinguishes this from ordinary extinction.
T("retrying does not repair it", async () => {
  const { H, cue } = slowHorse();
  for (let i = 0; i < LATE_RELEASES; i++) await cue();
  H.releaseBudget = 10000;           // the handler's timing is now perfect
  eq(await cue(), undefined, "the contingency was restored and it did not help");
  eq(await cue(), undefined);
});

// And the counter behind it does not reset either, which is the same fact stated
// where it is implemented.
T("a prompt release in between does not reset the count", async () => {
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const slow = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20));
    return 1;
  });
  // Late, prompt, late, prompt, late — three late releases in total.
  H.releaseBudget = 5;   await slow();
  H.releaseBudget = 5000; await slow();
  H.releaseBudget = 5;   await slow();
  H.releaseBudget = 5000; await slow();
  H.releaseBudget = 5;   await slow();
  eq(await slow(), undefined, "three late releases is three, however they were spaced");
});

// ------------------------------------------------------- only under an individual

T("nothing degrades without a declared individual", async () => {
  const { cue } = slowHorse({ declared: false });
  const got = [];
  for (let i = 0; i < LATE_RELEASES + 4; i++) got.push(await cue());
  eq(got, Array(LATE_RELEASES + 4).fill("answered"),
    "with no animal to carry a history, there is nobody for this to happen to");
});

T("and the contract is still reported without one", async () => {
  const { H, cue } = slowHorse({ declared: false });
  await cue();
  ok(notes(H).some((m) => /late release punishes/.test(m)), JSON.stringify(notes(H)));
});

// ------------------------------------------------------------------- what is said

T("the crossing into helplessness is said once", async () => {
  const { H, cue } = slowHorse();
  for (let i = 0; i < LATE_RELEASES + 4; i++) await cue();
  const said = notes(H).filter((m) => /stopped answering/.test(m));
  eq(said.length, 1, "said at the crossing, and not again");
  ok(/retrying does not repair/.test(said[0]), said[0]);
});

// §11a: silence arrives only at the end of the progression, as learned
// helplessness. Here that silence is the thing being modelled, not a gap in the
// reporting — so nothing is said on the calls that come back bare.
T("and then it goes quiet, which is the point", async () => {
  const { H, cue } = slowHorse();
  for (let i = 0; i < LATE_RELEASES; i++) await cue();
  const before = H.diagnostics.length;
  for (let i = 0; i < 5; i++) await cue();
  eq(H.diagnostics.length, before, "the animal has stopped answering, including here");
});

// The late-release note habituates per cue, the same rule as the boundary (§11a).
T("the late-release note is said once per cue", async () => {
  const { H, cue } = slowHorse({ declared: false });
  for (let i = 0; i < 6; i++) await cue();
  const said = notes(H).filter((m) => /late release punishes/.test(m));
  eq(said.length, 1, "saying it every time would be the flooding §10 warns about");
});

T("two cues degrade separately", async () => {
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const slow = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20)); return "slow";
  });
  const quick = H.cue("answer", [], async () => "quick");
  for (let i = 0; i < LATE_RELEASES + 1; i++) await slow();
  eq(await slow(), undefined, "the late one gave out");
  eq(await quick(), "quick", "and the prompt one is untouched");
});

// ------------------------------------------------------------- time it was given

// The budget measures latency, not wall time (§3), so a cue that spends its time
// standing or between strides is not late and does not degrade.
T("time spent deliberately waiting does not degrade a binding", async () => {
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const held = H.cue("held", [], async () => {
    await H.waited(30);
    return "answered";
  });
  const got = [];
  for (let i = 0; i < LATE_RELEASES + 2; i++) got.push(await held());
  eq(got, Array(LATE_RELEASES + 2).fill("answered"),
    "it answered immediately every time; it was told to take the time");
});

// --------------------------------------------------------------- in a program

T("a whole program degrades the way the pieces do", async () => {
  globalThis.OUT = [];
  globalThis.WAIT = () => new Promise((r) => setTimeout(r, 20));
  const src = `@ juniper  left bias

band a

    cue dawdle
        remember waited as (hands.WAIT)
        release 1

    lead mare go
        graze 1 through 5 as i
            hands.OUT.push (dawdle)
        release`;
  const r = await runSource(src, "t.horse", {});
  eq(r.errors.length, 0, JSON.stringify(r.errors));
  // The budget cannot be reached from the language, so this leans on the default
  // and a cue that is genuinely slower than it.
  ok(globalThis.OUT.length === 5, `pushed ${globalThis.OUT.length}`);
});

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
