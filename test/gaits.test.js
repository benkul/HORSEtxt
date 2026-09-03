// node test/gaits.test.js
//
// GRAMMAR.md §5. A gait is a limb-phase vector, and the six names are anchors in
// that space rather than cases in a switch. These check that the schedule is
// *derived* from the vector — if it were still hand-coded, the interpolation tests
// would have nothing to interpolate.

import { Horse, gaits, between } from "../src/runtime.js";

let pass = 0;
const failures = [];
const tests = [];
const T = (name, fn) => tests.push([name, fn]);

function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what || "value"}\n  expected ${y}\n  got      ${x}`);
}
function ok(c, what) { if (!c) throw new Error(what || "expected truthy"); }

// Runs n statements under a gait, each taking longer the earlier it is, so anything
// that ran concurrently finishes out of order and anything sequential does not.
async function order(H, gait, n = 4, opts = {}) {
  const seq = [];
  const thunks = Array.from({ length: n }, (_, i) => async () => {
    await new Promise((r) => setTimeout(r, (n - i) * 4));
    seq.push(i);
  });
  await H.gait(gait, thunks, opts);
  return seq;
}

// Distinct strike points, in order.
const beats = (v) => [...new Set(v.phases)].sort((a, b) => a - b);

// ------------------------------------------------------------------ the vectors

T("every named gait is a four-limb vector with a duty factor", () => {
  for (const [name, v] of Object.entries(gaits)) {
    eq(v.phases.length, 4, `${name} limbs`);
    ok(v.phases.every((p) => p >= 0 && p < 1), `${name} phases out of the stride`);
    ok(v.duty > 0 && v.duty < 1, `${name} duty`);
  }
});

T("the walk is four beats, evenly spaced", () => {
  eq(beats(gaits.walk), [0, 0.25, 0.5, 0.75]);
});

T("the trot strikes in diagonal pairs", () => {
  const [lh, lf, rh, rf] = gaits.trot.phases;
  eq(beats(gaits.trot).length, 2, "two beats");
  eq(lf, rh, "left fore with right hind");
  eq(rf, lh, "right fore with left hind");
});

T("the pace strikes in lateral pairs", () => {
  const [lh, lf, rh, rf] = gaits.pace.phases;
  eq(beats(gaits.pace).length, 2, "two beats");
  eq(lf, lh, "the near side together");
  eq(rf, rh, "then the off side");
});

T("the canter is three beats, and its suspension is the long one", () => {
  const b = beats(gaits.canter);
  eq(b.length, 3, "three beats");
  const gaps = b.slice(1).map((x, i) => x - b[i]);
  const suspension = 1 - b[b.length - 1];
  ok(suspension > Math.max(...gaps), "the suspension runs longer than the intervals");
});

T("the gallop is the canter with its pair broken", () => {
  eq(beats(gaits.gallop).length, 4, "four separate beats");
  eq(beats(gaits.canter).length, 3, "against the canter's three");
});

// The one that says the representation is doing real work: a walk and a tolt are
// the same phases and differ only in how long a hoof stays down.
T("a tolt is a walk that keeps a hoof down", () => {
  eq(gaits.tolt.phases, gaits.walk.phases, "identical sequence and spacing");
  ok(gaits.tolt.duty > gaits.walk.duty, "held longer");
  const covered = gaits.tolt.duty * 4;
  ok(covered >= 1, "at least one hoof is always down, so there is no suspension");
});

// ------------------------------------------------------- the schedule follows it

T("the walk runs one statement at a time", async () => {
  eq(await order(new Horse({}), "walk"), [0, 1, 2, 3]);
});

// Statements are filled into the stride in the order the beats happen, so a
// two-beat gait runs them two at a time and their order is preserved.
T("a two-beat gait runs two at a time", async () => {
  const seq = await order(new Horse({}), "trot");
  eq(seq.slice(0, 2).sort(), [0, 1], "the first beat takes the first two");
  eq(seq.slice(2).sort(), [2, 3], "the second beat takes the rest");
});

T("two statements in a trot strike together", async () => {
  // The obvious reading — statement 0 is the left hind — put two statements on a
  // hind and a fore of the same side, which strike at different times. So the
  // canonical two-at-once gait ran them sequentially.
  const H = new Horse({});
  const t0 = Date.now();
  await H.gait("trot", [0, 1].map(() => async () => {
    await new Promise((r) => setTimeout(r, 40));
  }));
  ok(Date.now() - t0 < 70, `expected one beat, took ${Date.now() - t0}ms`);
});

T("a trot and a pace schedule alike; the difference is anatomical", async () => {
  const H = new Horse({});
  H.genotype("AA", null);
  eq(await order(H, "pace"), await order(H, "trot"), "two pairs either way");
  // The vectors still differ, and so does which limbs pair.
  ok(JSON.stringify(gaits.pace.phases) !== JSON.stringify(gaits.trot.phases));
});

T("the canter runs one, then a pair, then one", async () => {
  const seq = await order(new Horse({}), "canter");
  eq(seq[0], 0, "a single hind first");
  eq(seq.slice(1, 3).sort(), [1, 2], "then the diagonal pair");
  eq(seq[3], 3, "then the leading fore");
});

T("back is a direction, not a phase relationship", async () => {
  eq(await order(new Horse({}), "back"), [3, 2, 1, 0]);
});

T("more statements than the stride holds start it again", async () => {
  // Six statements on a four-beat gait: the stride repeats its shape, and the
  // order is preserved throughout.
  eq(await order(new Horse({}), "walk", 6), [0, 1, 2, 3, 4, 5]);
});

T("six statements in a trot make three pairs", async () => {
  const seq = await order(new Horse({}), "trot", 6);
  eq(seq.slice(0, 2).sort(), [0, 1]);
  eq(seq.slice(2, 4).sort(), [2, 3]);
  eq(seq.slice(4).sort(), [4, 5]);
});

// A lead is which foreleg reaches furthest forward. Mirroring permutes which limb
// strikes when, but not how many strike together — and statements have no limb, so
// the schedule is identical. The lead is real anatomy with no scheduling
// consequence, which is worth stating rather than leaving as a surprise.
T("a lead changes the vector but not the schedule", async () => {
  const near = await order(new Horse({}), "canter", 4, { lead: "right" });
  const far = await order(new Horse({}), "canter", 4, { lead: "left" });
  eq(near, far, "statements have no limb to be led by");
});

// --------------------------------------------------------------- interpolation

T("between two anchors is a gait", () => {
  const v = between("walk", "pace", 0.5);
  eq(v.phases.length, 4);
  ok(v.duty > gaits.pace.duty && v.duty < gaits.walk.duty, "duty comes along too");
});

T("at either end, interpolation is the anchor itself", () => {
  eq(between("walk", "pace", 0).phases, gaits.walk.phases);
  eq(between("walk", "pace", 1).phases, gaits.pace.phases);
});

// The stepping pace is a real gait — slightly uneven, lateral, in a 1-2, 3-4
// sequence — and it falls out of the arithmetic rather than being listed.
T("halfway from a walk to a pace is the stepping pace", () => {
  const b = beats(between("walk", "pace", 0.5));
  eq(b.length, 4, "still four beats");
  const gaps = b.slice(1).map((x, i) => x - b[i]);
  ok(gaps[0] < gaps[1] && gaps[2] < gaps[1], `uneven, 1-2 3-4: ${JSON.stringify(gaps)}`);
  // Lateral: the near pair has drawn together, and so has the off pair.
  const v = between("walk", "pace", 0.5);
  ok(Math.abs(v.phases[1] - v.phases[0]) < 0.25, "near side closing");
  ok(Math.abs(v.phases[3] - v.phases[2]) < 0.25, "off side closing");
});

T("an unknown anchor is refused", () => {
  let threw = false;
  try { between("walk", "canter-ish", 0.5); } catch (e) { threw = /is not a gait/.test(e.message); }
  ok(threw);
});

T("a program can be run on an interpolated gait", async () => {
  const H = new Horse({});
  const seq = [];
  await H.gait("walk", [0, 1, 2, 3].map((i) => async () => { seq.push(i); }), {
    vector: between("walk", "pace", 1),
  });
  eq(seq.length, 4, "it ran");
});

// -------------------------------------------------------------------- genotype

T("the genotype still gates which anchors are reachable", async () => {
  const H = new Horse({});
  let threw = false;
  try { await H.gait("pace", [async () => {}]); } catch (e) { threw = /AA allele/.test(e.message); }
  ok(threw, "pace needs the allele even though it is only a vector");
});

// ------------------------------------------------------- pacing is not lateness
//
// GRAMMAR.md §3. The one-second contract is about *latency* — the gap between a
// signal and its answer, which is what the rein-tension work measures. A horse
// asked to stand for ten seconds and standing for ten seconds has answered
// immediately and correctly.
//
// Through v0.4 the budget measured wall time, so a cue holding a gait open was
// charged for every interval it deliberately waited. Nothing ever said so, because
// the diagnostics were collected and never read out.

T("a cue is not late for time spent between strides", async () => {
  const H = new Horse({});
  H.releaseBudget = 60;
  const held = H.cue("held", [], async () => {
    let strides = 0;
    await H.gait("walk", [async () => { if (++strides >= 4) H.halt(); }], { interval: 30 });
  });
  await held();
  eq(H.diagnostics, [], "four 30ms intervals are not a late release");
});

T("but slow work inside the stride is still late", async () => {
  const H = new Horse({});
  H.releaseBudget = 60;
  const grinding = H.cue("grinding", [], async () => {
    await H.gait("walk", [async () => { await new Promise((r) => setTimeout(r, 120)); }]);
  });
  await grinding();
  ok(H.diagnostics.some((d) => /punishes/.test(d.message)), JSON.stringify(H.diagnostics));
});

T("a stand is time the animal was told to take", async () => {
  const H = new Horse({
    hold: ({ ms }) => new Promise((r) => setTimeout(() => r(true), ms)),
  });
  H.releaseBudget = 60;
  const waiting = H.cue("waiting", [], async () => {
    await H.stand({ duration: { value: 120, unit: "ms" } }, async () => {});
  });
  await waiting();
  eq(H.diagnostics, [], "standing still is the answer, not a delay in giving it");
});

// The time belongs to whoever spent it, and it is not double-counted: a cue that
// waits inside another cue clears both of them, because both were being patient.
T("waiting is discounted at every depth", async () => {
  const H = new Horse({});
  H.releaseBudget = 60;
  const inner = H.cue("inner", [], async () => { await H.waited(120); });
  const outer = H.cue("outer", [], async () => { await inner(); });
  await outer();
  eq(H.diagnostics, [], "neither one was late; both were waiting");
});

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
