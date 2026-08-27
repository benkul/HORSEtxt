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

T("the trot runs its diagonal pairs together", async () => {
  const seq = await order(new Horse({}), "trot");
  eq(seq.slice(0, 2).sort(), [1, 2], "left fore and right hind struck together");
  eq(seq.slice(2).sort(), [0, 3], "then right fore and left hind");
});

T("the pace runs its lateral pairs together", async () => {
  const H = new Horse({});
  H.genotype("AA", null);
  const seq = await order(H, "pace");
  eq(seq.slice(0, 2).sort(), [0, 1], "the near side");
  eq(seq.slice(2).sort(), [2, 3], "then the off side");
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

T("more statements than limbs wrap around the stride", async () => {
  // Six statements on four limbs: 0 and 4 share a phase, 1 and 5 share the next.
  // Within a group the order is whichever finishes first, so compare as sets.
  const seq = await order(new Horse({}), "walk", 6);
  eq(seq.length, 6);
  eq(seq.slice(0, 2).sort(), [0, 4], "the fifth statement strikes with the first");
  eq(seq.slice(2, 4).sort(), [1, 5], "and the sixth with the second");
  eq(seq.slice(4), [2, 3], "the rest keep their own beats");
});

T("a lead mirrors the vector", async () => {
  const near = await order(new Horse({}), "canter", 4, { lead: "right" });
  const far = await order(new Horse({}), "canter", 4, { lead: "left" });
  ok(JSON.stringify(near) !== JSON.stringify(far), "the far side is not the near one");
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

// ---------------------------------------------------------------------- done

for (const [name, fn] of tests) {
  try { await fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
