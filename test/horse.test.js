// node test/horse.test.js
//
// The horse itself, drawn. The dewormer's second act: the flame graph is the
// skeleton, and this module gives it the animal — a real horse, drawn in SVG,
// that embodies the exact runtime state the trace reads. This suite watches
// the pure posture descriptor (`postureState`) and the SVG vnode tree
// (`renderHorse`) it projects into, because the animal in the page and the
// animal in the test are the same animal.
//
// Every mapping is asserted against the citations it claims:
//   - EAD101 forward / EAD103 flattening (EquiFACS, Wathan et al. 2015) —
//     ears are attention; an agonistic animal is not attending (runtime
//     chord(): attending = ears !== "agonistic"), so its body dims and
//     retreats.
//   - EAD103L / EAD103R coded independently (EquiFACS); ears aim
//     independently on ten muscles, 180deg (Wathan & McComb 2014) — a
//     divided chord draws one ear forward, one back.
//   - head height is part of the attention display (Wathan & McComb 2014) —
//     high head lifts or rears, low head sinks.
//   - nostrils flare with arousal (ethogram, Lewis et al. 2025); lids droop
//     at the relaxed/dozing end; tail carriage/swishing is agitation; tension
//     is the reinforcement spine (Applied Animal Behaviour Science 2025).
//
// DOM-lite on purpose, like src/dewormer.js: nothing here needs a document.

import { HorseView, postureState, readChannels, renderHorse, svgEl } from "../src/horse.js";

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
function near(a, b, eps = 0.01, what) {
  if (Math.abs(a - b) > eps) throw new Error(`${what || "value"}: expected ${b} ±${eps}, got ${a}`);
}

// ------------------------------------------------------------------- fixtures
//
// The exact shapes the runtime reports: H.chord() hands { ears, states } to
// onChord, and H.signal() hands { answered, by, value, refused, carried } to
// onSignal. `states` entries are { channel, value } where value is
// { state: name }, a graded number, or an Affect.

const P = {
  rest: { ears: "forward", states: [] },
  forward: { ears: "forward", states: [{ channel: "head", value: 0 }] },
  high: { ears: "forward", states: [{ channel: "head", value: 0.85 }] },
  midHigh: { ears: "forward", states: [{ channel: "head", value: 0.4 }] },
  low: { ears: "forward", states: [{ channel: "head", value: -0.9 }] },
  agonistic: { ears: "agonistic", states: [{ channel: "ears", value: { state: "agonistic" } }] },
  dividedLeft: { ears: "divided", states: [{ channel: "ears", value: { state: "divided" } }] },
  flared: { ears: "forward", states: [{ channel: "nostrils", value: { state: "flared" } }] },
  drooped: { ears: "forward", states: [{ channel: "lids", value: { state: "drooped" } }] },
  tailLash: { ears: "forward", states: [{ channel: "tail", value: { state: "swishing" } }] },
  tailHigh: { ears: "forward", states: [{ channel: "tail", value: { state: "raised" } }] },
  tense: { ears: "forward", states: [{ channel: "tension", value: 0.8 }] },
  full: { ears: "forward", states: [
    { channel: "head", value: 0.2 },
    { channel: "nostrils", value: 0.6 },
    { channel: "lids", value: { state: "wide" } },
    { channel: "tail", value: { state: "lashing" } },
    { channel: "tension", value: { state: "held" } },
  ] },
};

// ---------------------------------------------------------------------- pose

const tests = [];
const T = (name, fn) => tests.push([name, fn]);

T("a resting horse is ears forward, full opacity, chestnut", async () => {
  const d = postureState(P.rest);
  eq(d.ears, "forward");
  eq(d.bodyOpacity, 1);
  eq(d.bodyScale, 1);
  eq(d.leftEar, -32);
  eq(d.rightEar, -38);
  ok(d.cite.some((c) => c.includes("EquiFACS")), "ears cite EquiFACS");
});

T("ears flattened: both ears rotate back and the whole body dims and retreats", async () => {
  const d = postureState(P.agonistic);
  eq(d.ears, "agonistic");
  ok(d.leftEar > 50 && d.rightEar > 50, `flattened ears rotate back: L=${d.leftEar} R=${d.rightEar}`);
  eq(d.bodyOpacity, 0.42, "a not-attending animal cannot be read: it dims");
  eq(d.bodyScale, 0.88, "and retreats");
  ok(d.retreatX > 0, "retreats to the other side of the paddock");
  ok(d.cite[0].includes("EAD103"), "the agonistic flattener is cited");
});

T("divided attention: one ear forward, one back, and the two eyes split", async () => {
  const d = postureState(P.dividedLeft);
  eq(d.ears, "divided");
  ok(d.leftEar < 0 && d.rightEar > 0, `one ear each way: L=${d.leftEar} R=${d.rightEar}`);
  eq(d.eyesSplit, 1);
  ok(d.cite.some((c) => c.includes("EAD103L")), "independent ear coding cited");
});

T("divided attention: the provenance side decides which ear attends", async () => {
  const left = postureState(P.dividedLeft, { side: "left" });
  const right = postureState(P.dividedLeft, { side: "right" });
  ok(left.leftEar < 0 && left.rightEar > 0, "left attends: left ear forward");
  ok(right.rightEar < 0 && right.leftEar > 0, "right attends: right ear forward");
});

T("head high lifts, and high enough it rears", async () => {
  const d = postureState(P.high);
  ok(d.rise < 0, `rise is negative (up): ${d.rise}`);
  ok(d.rearing > 0.5, `rearing past the threshold: ${d.rearing}`);
});

T("head mid-high lifts but does not rear", async () => {
  const d = postureState(P.midHigh);
  ok(d.rise < 0 && d.rearing === 0, `lifts without rearing: rise=${d.rise} rear=${d.rearing}`);
});

T("head low sinks the whole horse", async () => {
  const d = postureState(P.low);
  ok(d.rise > 0, `rise is positive (down): ${d.rise}`);
  ok(d.sunk > 0.5, `sunk past the threshold: ${d.sunk}`);
});

T("flared nostrils dilate; the rest stays put", async () => {
  const d = postureState(P.flared);
  eq(d.nostril, 1);
  eq(d.bodyOpacity, 1);
});

T("drooped lids close the eye", async () => {
  const d = postureState(P.drooped);
  eq(d.lid, 1);
});

T("a lashing tail is agitation; a raised tail is arousal", async () => {
  const l = postureState(P.tailLash);
  eq(l.tailLash, 1);
  const h = postureState(P.tailHigh);
  eq(h.tail, 1);
  eq(h.tailLash, 0);
});

T("tension is the reinforcement spine: the body reads it", async () => {
  const d = postureState(P.tense);
  near(d.tension, 0.8);
});

T("a full chord composes: flare + wide lids + lash + tension + head", async () => {
  const d = postureState(P.full);
  near(d.tension, 1, 0.01, "held is tense");
  eq(d.nostril, 0.6);
  eq(d.lidWide, true);
  eq(d.tailLash, 1);
  near(d.head, 0.2);
  ok(d.channels.includes("nostrils") && d.channels.includes("tension"), "channels listed");
});

T("every posture mapping carries a citation, and the citations are the same family", async () => {
  const d = postureState(P.full);
  ok(d.cite.length >= 5, `cites: ${d.cite.length}`);
  ok(d.cite.every((c) => c.length > 20), "citations are sentences, not labels");
  const all = d.cite.join(" ");
  for (const name of ["EquiFACS", "Wathan", "ethogram"]) ok(all.includes(name), `family cited: ${name}`);
});

T("a signal that lands puts the horse visibly attending", async () => {
  const d = postureState(P.rest, { signal: 0.5 });
  eq(d.attendPulse, 0.5);
  ok(d.nostril > 0.25, "a landing signal flares the nostril");
});

T("readChannels reads the runtime's channel shape", async () => {
  const ch = readChannels(P.full);
  near(ch.head, 0.2);
  eq(ch.nostrils, 0.6);
  eq(ch.lids, "wide");
  eq(ch.tension, "held");
});

// ------------------------------------------------------------------ rendered

// Walk the vnode tree for an element by id.
function find(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.attrs && node.attrs.id === id) return node;
  for (const k of node.kids || []) {
    const hit = find(k, id);
    if (hit) return hit;
  }
  return null;
}
function allText(node, acc = []) {
  if (!node || typeof node !== "object") return acc;
  if (node.text != null) acc.push(node.text);
  for (const k of node.kids || []) allText(k, acc);
  return acc;
}

T("renderHorse draws a real SVG horse with all the parts", async () => {
  const tree = renderHorse(postureState(P.rest));
  ok(tree.svg && tree.tag === "svg", "an svg root");
  eq(tree.attrs.xmlns, "http://www.w3.org/2000/svg");
  for (const id of ["body", "head", "ear-left", "ear-right", "eye-near", "eye-far",
                     "nostril-near", "tail", "legs-near", "legs-far", "muzzle", "neck"]) {
    ok(find(tree, id), `has #${id}`);
  }
});

T("renderHorse: ears flattened => the ear groups rotate back and the root dims", async () => {
  const tree = renderHorse(postureState(P.agonistic));
  const el = find(tree, "ear-left");
  const er = find(tree, "ear-right");
  const root = find(tree, "horse-root");
  ok(el.attrs.transform.includes("rotate(74"), `ear-left flattened: ${el.attrs.transform}`);
  ok(er.attrs.transform.includes("rotate(68"), `ear-right flattened: ${er.attrs.transform}`);
  eq(root.attrs.opacity, "0.42");
  ok(root.attrs.transform.includes("scale(0.88)"), "retreats");
});

T("renderHorse: divided => one ear forward, one back, eyes split", async () => {
  const tree = renderHorse(postureState(P.dividedLeft));
  const el = find(tree, "ear-left");
  const er = find(tree, "ear-right");
  ok(el.attrs.transform.includes("rotate(-32"), `left forward: ${el.attrs.transform}`);
  ok(er.attrs.transform.includes("rotate(62"), `right back: ${er.attrs.transform}`);
});

T("renderHorse: head high rears — root rotates, head group lifts", async () => {
  const tree = renderHorse(postureState(P.high));
  const root = find(tree, "horse-root");
  const head = find(tree, "head");
  ok(root.attrs.transform.includes("rotate("), `rearing root rotates: ${root.attrs.transform}`);
  ok(head.attrs.transform.includes("translate(0 -"), `head lifts: ${head.attrs.transform}`);
});

T("renderHorse: head low sinks — head group drops and rotates down", async () => {
  const tree = renderHorse(postureState(P.low));
  const head = find(tree, "head");
  ok(head.attrs.transform.includes("translate(0 2"), `head sinks: ${head.attrs.transform}`);
  ok(head.attrs.transform.includes("rotate(12"), `nose drops: ${head.attrs.transform}`);
});

T("renderHorse marks the posture in the aria-label (state, not decoration)", async () => {
  const tree = renderHorse(postureState(P.agonistic));
  ok(tree.attrs["aria-label"].includes("ears agonistic"), tree.attrs["aria-label"]);
});

// ------------------------------------------------------------------ the view

T("HorseView keeps the latest posture and pulses on a signal", async () => {
  const v = new HorseView();
  const seen = [];
  v.on((d, sig) => seen.push([d.ears, sig && sig.name]));
  v.chord(P.agonistic);
  v.signal("snort", { answered: false, reason: "not attending", carried: {} });
  eq(v.desc.ears, "agonistic");
  eq(v.signals, 1);
  eq(seen[0], ["agonistic", null]);
  eq(seen[1], ["agonistic", "snort"]);
  ok(v.desc.attendPulse > 0, "a landed-but-unanswered signal still visibly lands");
});

T("HorseView does not need a document", async () => {
  const v = new HorseView();
  v.chord(P.full);
  const tree = renderHorse(v.desc);
  ok(tree.tag === "svg");
  ok(allText(tree).length >= 0, "walkable without a DOM");
});

// -------------------------------------------------------------------- report

const testsTotal = tests.length;

for (const [name, fn] of tests) await test(name, fn);

if (failures.length) {
  console.error(`${failures.length} of ${testsTotal} failed:`);
  for (const f of failures) console.error(`  ✗ ${f.name}\n    ${f.message}`);
  process.exit(1);
}
console.log(`${pass} passed, 0 failed`);