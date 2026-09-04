// HORSEtxt dewormer — the horse itself, drawn.
//
// The flame graph is the skeleton. This module gives it the animal: a real
// horse, drawn in the page (SVG), that embodies the exact runtime state the
// trace reads. It is not a mascot. It is state. Watch the horse and you are
// watching the program — a chord that flattens the ears flattens the drawn
// ears, an agonistic run dims and retreats the whole body, a high head lifts
// or rears, a low head sinks, and a divided ear points one ear each way
// while the two eyes look different ways.
//
// Every mapping is traceable, in code, to the same citations as the trace:
//
//   - ears = attention. EAD101 forward is attention; EAD103 is the agonistic
//     ear flattener (EquiFACS, Wathan et al. 2015). The runtime says it
//     itself: `attending = ears !== "agonistic"` (runtime.js, chord()).
//   - left and right ears are coded independently (EAD103L / EAD103R,
//     EquiFACS) and a horse aims them independently on ten muscles, rotating
//     180deg (Wathan & McComb 2014). So a divided chord draws one ear
//     forward and one back: not a blend, two aims.
//   - head height is part of the attention display (Wathan & McComb 2014,
//     second half). The head channel is a signed tissue fraction (~-1..~1,
//     GRAMMAR.md §4); the drawing carries it literally — high head lifts,
//     low head sinks, and a high enough head rears.
//   - nostrils: flare is an arousal/agonistic display (ethogram, Lewis et
//     al. 2025). The nostril dilates with the `/nostrils` channel.
//   - lids: eyelid movement is coded in EquiFACS and the ethogram; a drooped
//     lid is the relaxed/dozing end, a wide lid the alert end. The drawing
//     drops the lid over the eye with the `/lids` channel.
//   - tail: carriage and swishing are arousal/agitation displays (ethogram;
//     weather `flies` is the largest behavioural driver — tail swishing,
//     BIBLIOGRAPHY.md). Raised tail = alert/aroused; lashing = agitation.
//   - tension: rein tension release timing is the language's reinforcement
//     spine (Applied Animal Behaviour Science 2025, cited in runtime.js), and
//     `tension ~held` is what binding is for (GRAMMAR.md §4). The drawing
//     tightens the neck and darkens the body with the `/tension` channel.
//
// The module is DOM-lite by design, like src/dewormer.js: the core is a pure
// function from posture to a numeric *posture descriptor* (the testable
// truth), and `renderHorse` projects that descriptor into an SVG vnode tree
// the page turns into real DOM. The tests watch the descriptor — "ears
// flattened => leftEar/rightEar rotated back, bodyOpacity dimmed" — and the
// tree, because the animal in the page and the animal in the test are the
// same animal.

// ------------------------------------------------------------------ channels
//
// A chord's states arrive as `{ channel, value }` pairs. The value is a
// `{ state: name }` for a bare word, a plain number for a graded channel, or
// an Affect. Head is the signed tissue fraction the trace already carries.

function valueOf(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if (typeof v.state === "string") return v.state;
    if (typeof v.value === "number") return v.value;
    if (typeof v.arousal === "number") return v;
  }
  return null;
}

export function readChannels(posture) {
  const out = {};
  for (const s of (posture && posture.states) || []) {
    if (s && s.channel) out[s.channel] = valueOf(s.value);
  }
  return out;
}

// State-name groups, so a bare word like `nostrils flared` and a graded
// `nostrils ~0.7` both read. The names are the states the chord channel
// accepts (GRAMMAR.md §4: `state = ident`), so a horse can utter any of
// them; the drawing maps the ones the ethogram and EquiFACS name.

const FLARE = new Set(["flare", "flared", "wide", "open"]);
const PINCH = new Set(["pinched", "tight", "closed"]);
const DROOP = new Set(["droop", "drooped", "low", "heavy", "half"]);
const WIDE_LID = new Set(["wide", "alert", "flared"]);
const CLOSED_LID = new Set(["closed", "sleep", "dozing"]);
const TAIL_HIGH = new Set(["high", "raised", "flagged", "carried"]);
const TAIL_LOW = new Set(["low", "hanging", "clamped", "tucked"]);
const TAIL_LASH = new Set(["lashing", "swishing", "agitated", "switching"]);
const TENSE = new Set(["held", "tense", "tight", "braced", "set"]);
const LOOSE = new Set(["loose", "free", "soft", "relaxed"]);

function grade(v, on, off, dflt) {
  if (typeof v === "number") return Math.max(0, Math.min(1, Math.abs(v)));
  if (typeof v === "string") {
    if (on.has(v)) return 1;
    if (off.has(v)) return 0;
  }
  return dflt == null ? 0 : dflt;
}

// ------------------------------------------------------------------ the pose
//
// The pure, testable truth: every channel the program uttered becomes a
// number the drawing can hold, plus the citation that grounds it. This is
// the function the tests watch.

export function postureState(posture, opts = {}) {
  const ch = readChannels(posture);
  const ears = (posture && posture.ears) || ch.ears || "forward";
  const head = typeof ch.head === "number" ? ch.head : 0;
  const side = opts.side || "left";

  // Ears. Degrees of rotation at the poll: 0 = straight up; negative tips
  // forward (the horse faces left in the drawing), positive tips back.
  // EAD101 forward, EAD103 flattening (EquiFACS); one ear each way is
  // divided (EAD103L / EAD103R, and Wathan & McComb 2014: aimed
  // independently, 180deg on ten muscles).
  const FORWARD = -32;
  const BACK = 62;
  const FLAT = 74;
  let leftEar, rightEar, eyesSplit;
  if (ears === "agonistic") { leftEar = FLAT; rightEar = FLAT - 6; eyesSplit = 0; }
  else if (ears === "divided") {
    // The attending side is the side that asked (the provenance `side`).
    // The other ear guards. The two eyes look different ways because the
    // hemispheres do different work (§12g): the left eye feeds the right
    // hemisphere (novelty, threat), the right feeds the left
    // (categorisation).
    const leftForward = side !== "right";
    leftEar = leftForward ? FORWARD : BACK + 8;
    rightEar = leftForward ? BACK : FORWARD - 4;
    eyesSplit = 1;
  } else { leftEar = FORWARD; rightEar = FORWARD - 6; eyesSplit = 0; }

  // Head. Signed fraction of the channel range; the drawing carries it
  // literally. High head lifts (and rears past a threshold); low head sinks.
  const headF = Math.max(-1, Math.min(1, head));
  const rise = -headF; // px: negative = up
  const rearing = headF > 0.55 ? (headF - 0.55) / 0.45 : 0;
  const sunk = headF < -0.3 ? (-headF - 0.3) / 0.7 : 0;

  // Nostrils. Flare is arousal/agonistic (ethogram); graded value reads
  // directly. A resting nose is slightly open.
  const nostril = ch.nostrils == null ? 0.25 : grade(ch.nostrils, FLARE, PINCH, 0.25);

  // Lids. Droop is the relaxed/dozing end, wide/alert the attending end.
  const lid = ch.lids == null ? 0.1 : grade(ch.lids, DROOP, WIDE_LID, 0.1);
  const lidWide = ch.lids != null && (WIDE_LID.has(ch.lids) || (typeof ch.lids === "number" && ch.lids < 0));

  // Tail. Carriage and swishing (ethogram; flies in the weather chapter).
  let tail = 0, tailLash = 0;
  if (ch.tail != null) {
    if (typeof ch.tail === "number") tail = Math.max(-1, Math.min(1, ch.tail));
    else if (TAIL_HIGH.has(ch.tail)) tail = 1;
    else if (TAIL_LOW.has(ch.tail)) tail = -1;
    else if (TAIL_LASH.has(ch.tail)) { tail = 0; tailLash = 1; }
  }

  // Tension. Rein tension release timing is the reinforcement spine
  // (runtime.js cites Applied Animal Behaviour Science 2025); a held chord
  // is tension set. The body tightens and darkens with it.
  const tension = ch.tension == null ? 0 : grade(ch.tension, TENSE, LOOSE, 0);

  // Voice is arousal-carrying (Briefer 2015 in the bibliography, whinny
  // affect); a whinny flares the nostril a little.
  const voiced = ch.voice != null ? 0.25 : 0;

  // Agonistic retreat. EAD103 both ears flattened is the agonistic display
  // and the runtime is explicit that an agonistic animal is *not attending*
  // (chord(): attending = ears !== "agonistic"). The whole body dims and
  // moves away, matching the trace's retreat — you cannot read what the
  // horse is not attending to.
  const agonistic = ears === "agonistic";
  const bodyOpacity = agonistic ? 0.42 : 1;
  const bodyScale = agonistic ? 0.88 : 1;
  const retreatX = agonistic ? 18 : 0;

  // A signal that just landed: the horse visibly attends — a transient
  // nostril flare and a flick of the ears — so the deworming and the
  // animal are the same thing. The pulse decays; the posture stays.
  const attendPulse = opts.signal ? Math.max(0, Math.min(1, opts.signal)) : 0;

  const cite = [];
  cite.push("ears: EAD101 forward / EAD103 flattening (EquiFACS, Wathan et al. 2015 PLOS ONE 10(8)); ears aimed independently, 180deg on ten muscles (Wathan & McComb 2014, Current Biology 24(15))");
  cite.push("head: head height is part of the attention display (Wathan & McComb 2014)");
  cite.push("divided: EAD103L/EAD103R coded independently (EquiFACS); left eye feeds the right hemisphere (novelty, threat), right eye feeds the left (categorisation) — GRAMMAR.md §12g");
  cite.push("nostrils: nostril flare is arousal/agonistic (ethogram, Lewis et al. 2025 PeerJ 13:e19309)");
  cite.push("lids: eyelid movement coded in EquiFACS; droop is the relaxed/dozing end (ethogram)");
  cite.push("tail: carriage and swishing are agitation displays (ethogram; weather/flies, BIBLIOGRAPHY.md)");
  cite.push("tension: rein tension release timing (Applied Animal Behaviour Science 2025, cited in runtime.js); tension ~held is what a binding is for (GRAMMAR.md §4)");

  return {
    // ears
    ears, leftEar, rightEar, eyesSplit,
    // head
    head: headF, rise, rearing, sunk,
    // face
    nostril: Math.min(1, nostril + attendPulse * 0.35 + voiced),
    lid, lidWide,
    // tail
    tail, tailLash,
    // body
    tension,
    bodyOpacity, bodyScale, retreatX,
    // attention pulse (signal just landed)
    attendPulse,
    // provenance
    side,
    // the channels the program uttered, and the citations that ground them
    channels: Object.keys(ch),
    cite,
  };
}

// ------------------------------------------------------------------ rendering
//
// The descriptor becomes an SVG vnode tree — the same DOM-lite shape the
// trace uses, so the page builds it with one small helper and a test can
// read it without a document. The drawing is a side-profile horse facing
// left, head turned a little toward the viewer so both ears and both eyes
// are visible: divided attention must be *seeable*, not inferable.
//
// Structure:
//   svg#horse (viewBox 0 0 480 360)
//     g#horse-root            retreat: translate + scale, then everything
//       g#tail                tail height + lash (behind the body)
//       g#legs-far            far fore + far hind (darker, behind)
//       g#body                barrel; tension darkens it, agonistic dims it
//       g#legs-near           near fore + near hind
//       g#head                the whole head+neck group: head rise/sink/rear
//         path#neck
//         g#ear-left
//         g#ear-right
//         g#face  (forehead/muzzle)
//           path#muzzle
//           path#eye-near
//           path#eye-far
//           path#lid-near
//           path#lid-far
//           ellipse#nostril-near
//           ellipse#nostril-far
//
// The head group carries the head channel; the ears sit on the poll and
// rotate about their bases; the eyes sit on the face and their pupils aim
// with the ears.

const SVG = { xmlns: "http://www.w3.org/2000/svg" };

export function svgEl(tag, attrs = {}, kids = []) {
  return { tag, svg: true, attrs, kids };
}

function num(n) { return String(Math.round(n * 100) / 100); }

// Rotate `deg` about (x, y). SVG's rotate is clockwise-positive; the horse
// faces left, so a forward ear (tip toward the horse's front) is a negative
// rotation and a flattened ear is a large positive one.
function rot(deg, x, y) { return `rotate(${num(deg)} ${num(x)} ${num(y)})`; }

// The whole horse, at rest, faces left. viewBox 0 0 480 360, ground 318.
export function renderHorse(d) {
  const rootTransform = [
    `translate(${num(d.retreatX)} 0)`,
    `scale(${num(d.bodyScale)})`,
    // A high head rears: the whole animal rotates back around the hind
    // foot and the forehand lifts off the ground.
    d.rearing > 0 ? `rotate(${num(-9 * d.rearing)} 330 318)` : "",
    d.sunk > 0 ? `translate(0 ${num(10 * d.sunk)})` : "",
  ].filter(Boolean).join(" ");

  // Body fill darkens with tension (the rein-tension spine) and retreats to
  // grey under an agonistic ear. A relaxed horse is a warm chestnut.
  const coat = agonisticCoat(d) ? "#6d5a4c" : "#a9713f";
  const coatDark = agonisticCoat(d) ? "#54443a" : "#8a5a2e";
  const bodyFill = d.tension > 0 ? mixCoat(coat, d.tension) : coat;

  const opacity = d.bodyOpacity;
  const rootAttrs = {
    id: "horse-root",
    transform: rootTransform,
    opacity: num(opacity),
  };

  const tail = tailPath(d);

  const eye = (id, cx, cy, rx, ry, splitDir, lidAmt, wide) => {
    // Almond eye; the pupil aims with the ear that guards/attends. A
    // drooped lid covers the top; a wide lid is a ring.
    const pupilDx = splitDir * (d.eyesSplit ? 3.4 : 0) + (d.ears === "agonistic" ? 1.4 : 0);
    const lidY = cy - ry * (0.2 + 0.7 * lidAmt);
    const kids = [
      svgEl("ellipse", { cx: num(cx), cy: num(cy), rx: num(rx), ry: num(ry), fill: "#241a12" }),
      svgEl("circle", { cx: num(cx + pupilDx), cy: num(cy + (wide ? -0.6 : 0.9)), r: num(rx * 0.42), fill: "#070502" }),
      svgEl("circle", { cx: num(cx + pupilDx - 1.1), cy: num(cy + (wide ? -1.3 : 0.6)), r: num(rx * 0.16), fill: "#f4efe6", opacity: "0.85" }),
      svgEl("path", { d: `M ${num(cx - rx)} ${num(lidY)} Q ${num(cx)} ${num(lidY - 1.8)} ${num(cx + rx)} ${num(lidY)}`, stroke: "#3a2c1c", "stroke-width": num(1.6 + 1.6 * lidAmt), fill: "none", "stroke-linecap": "round" }),
    ];
    return svgEl("g", { id, transform: "" }, kids);
  };

  const ears = (sideSign) => {
    // sideSign -1 = near (left) ear, +1 = far (right) ear.
    const deg = sideSign < 0 ? d.leftEar : d.rightEar;
    const dark = sideSign > 0;
    const x = sideSign < 0 ? 99 : 111;
    const y = sideSign < 0 ? 96 : 92;
    const fill = dark ? "#7d5230" : "#b07a43";
    const dPath = sideSign < 0
      ? `M ${x} ${y} C ${x - 5} ${y - 16}, ${x - 11} ${y - 24}, ${x - 14} ${y - 34} C ${x - 4} ${y - 27}, ${x + 2} ${y - 16}, ${x + 2} ${y} Z`
      : `M ${x} ${y} C ${x + 3} ${y - 14}, ${x + 8} ${y - 22}, ${x + 10} ${y - 31} C ${x + 4} ${y - 25}, ${x - 1} ${y - 15}, ${x - 3} ${y} Z`;
    return svgEl("g", { id: sideSign < 0 ? "ear-left" : "ear-right", transform: rot(deg, x, y) },
      [svgEl("path", { d: dPath, fill, stroke: "#5d3b1e", "stroke-width": "1.4" })]);
  };

  return svgEl("svg", {
    ...SVG,
    id: "horse",
    viewBox: "0 0 480 360",
    role: "img",
    "aria-label": `the horse: ears ${d.ears}, head ${d.head >= 0 ? "+" : ""}${num(d.head)}`,
  }, [
    // ground shadow — the animal is somewhere, even when it retreats
    svgEl("ellipse", { cx: "245", cy: "322", rx: num(120 * d.bodyScale), ry: "7", fill: "#000", opacity: num(0.12 * d.bodyOpacity) }),

    svgEl("g", rootAttrs, [
      // tail, behind the body
      svgEl("g", { id: "tail", transform: tailTransform(d) }, [
        svgEl("path", { d: tail, fill: "#5d3b1e", stroke: "#3a2412", "stroke-width": "1.4" }),
      ]),

      // far legs — darker, behind the barrel
      svgEl("g", { id: "legs-far" }, [
        leg(238, 248, 318, "#7a502a"),
        leg(326, 252, 318, "#7a502a"),
      ]),

      // the barrel
      svgEl("g", { id: "body" }, [
        svgEl("path", {
          id: "barrel",
          d: "M 198 216 C 250 190, 318 190, 354 206 C 372 218, 370 252, 352 266 C 330 284, 258 288, 224 282 C 204 278, 192 260, 196 236 C 197 225, 197 220, 198 216 Z",
          fill: bodyFill,
          stroke: coatDark,
          "stroke-width": "2",
        }),
        // mane along the crest
        svgEl("path", { d: "M 96 100 C 130 162, 165 193, 198 215 C 174 188, 140 156, 104 112 Z", fill: mixCoat("#4a3a26", d.tension) }),
        // a tension arc: the ribcage reads strain (tension is the spine)
        svgEl("path", { d: "M 235 240 Q 260 228 285 238", stroke: coatDark, "stroke-width": num(1 + 2.4 * d.tension), fill: "none", opacity: num(0.5 + 0.5 * d.tension) }),
      ]),

      // near legs
      svgEl("g", { id: "legs-near", transform: d.rearing > 0 ? `translate(0 ${num(-30 * d.rearing)})` : "" }, [
        leg(212, 250, 318, "#b07a43"),
        leg(300, 255, 318, "#b07a43"),
      ]),

      // head + neck — the whole attention apparatus. The head channel moves
      // this group; a high head lifts (and rears), a low head sinks.
      svgEl("g", {
        id: "head",
        transform: [
          `translate(0 ${num(d.rise * 26)})`,
          d.rearing > 0 ? `rotate(${num(6 * d.rearing)} 112 140)` : "",
          d.sunk > 0 ? `rotate(${num(14 * d.sunk)} 112 140)` : "",
        ].filter(Boolean).join(" "),
      }, [
        // neck — its arc tightens with tension (rein tension, applied
        // animal behaviour science 2025); a tightened crest reads braced.
        svgEl("path", {
          id: "neck",
          d: "M 96 100 C 138 168, 172 196, 200 216 C 178 196, 148 170, 118 138 C 106 122, 100 110, 97 104 Z",
          fill: mixCoat(coat, 0.15 + 0.3 * d.tension),
          stroke: coatDark,
          "stroke-width": "2",
        }),
        ears(-1),
        ears(1),
        // face — forehead and muzzle, turned slightly toward the viewer so
        // both eyes are visible
        svgEl("g", { id: "face" }, [
          svgEl("path", {
            id: "muzzle",
            d: "M 96 100 C 84 112, 72 126, 62 136 C 52 147, 45 150, 40 147 C 36 144, 35 139, 39 134 C 46 124, 55 116, 63 112 C 72 107, 82 104, 90 104 C 100 104, 108 112, 112 122 C 116 132, 114 144, 108 152 C 103 158, 94 158, 88 150 C 94 148, 100 144, 104 138 C 108 131, 109 122, 106 115 C 102 108, 97 103, 96 100 Z",
            fill: mixCoat(coat, 0.2),
            stroke: coatDark,
            "stroke-width": "2",
          }),
          // the nostril — flare is arousal; the pair sits at the muzzle tip
          svgEl("ellipse", { id: "nostril-near", cx: "52", cy: "139", rx: num(3.2 + 3.6 * d.nostril), ry: num(2.2 + 2.6 * d.nostril), fill: "#2b1c10" }),
          svgEl("ellipse", { id: "nostril-far", cx: "47", cy: "135", rx: num(2.2 + 2.2 * d.nostril), ry: num(1.6 + 1.7 * d.nostril), fill: "#2b1c10", opacity: "0.7" }),
          // eyes: near eye larger and clear, far eye smaller. The pupils
          // aim with the ears; a drooped lid reads relaxation/dozing.
          eye("eye-near", 79, 124, 6.4, 4.6, -1, d.lid, d.lidWide),
          eye("eye-far", 92, 115, 4.6, 3.4, 1, d.lid * 0.8, d.lidWide),
        ]),
      ]),
    ]),
  ]);
}

function agonisticCoat(d) { return d.ears === "agonistic"; }

// Blend a coat colour toward near-black with tension (a held chord is a
// braced animal; tension is load-bearing everywhere in the runtime).
function mixCoat(hex, t) {
  if (t <= 0) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(c * (1 - 0.55 * t));
  return `#${[r, g, b].map(f).map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function leg(x, top, ground, fill) {
  // A tapered leg with a hoof, drawn in place. Rearing lifts the near fore
  // via the group transform, not here.
  return svgEl("g", {}, [
    svgEl("path", {
      d: `M ${x - 5} ${top} C ${x - 6} ${top + 34}, ${x - 6} ${ground - 12}, ${x - 6} ${ground - 4} L ${x + 6} ${ground - 4} C ${x + 6} ${ground - 12}, ${x + 6} ${top + 34}, ${x + 5} ${top} Z`,
      fill,
      stroke: "#4a2f15",
      "stroke-width": "1.4",
    }),
    svgEl("path", { d: `M ${x - 7} ${ground - 4} L ${x + 7} ${ground - 4} L ${x + 5} ${ground + 4} L ${x - 5} ${ground + 4} Z`, fill: "#3a2412" }),
  ]);
}

// The tail hangs from the rump; height raises it (alert/arousal), lash
// swings it (agitation — flies are the biggest behavioural driver,
// BIBLIOGRAPHY.md).
function tailPath(d) {
  const base = "M 352 208 C 362 230, 366 258, 358 296";
  const lash = d.tailLash ? "M 352 208 C 368 250, 348 262, 358 296" : base;
  return `${lash} C 350 300, 346 292, 348 262 C 349 244, 348 226, 352 208 Z`;
}

function tailTransform(d) {
  return `rotate(${num(-22 * d.tail)} 352 208)`;
}

// ------------------------------------------------------------------ stream
//
// The page feeds the same stream the trace reads: every chord's posture and
// every signal that lands. `watch` keeps the latest descriptor so the panel
// can re-render cheaply on each event.

export class HorseView {
  constructor() {
    this.posture = null;
    this.desc = null;
    this.signals = 0;
    this.listeners = [];
  }
  chord(posture) {
    this.posture = posture;
    this.desc = postureState(posture);
    for (const fn of this.listeners) fn(this.desc, null);
  }
  signal(name, answer) {
    this.signals++;
    const pulse = answer && answer.answered ? 0.5 : 0.15;
    if (this.posture) {
      this.desc = postureState(this.posture, { signal: pulse, side: (answer && answer.carried && answer.carried.side) || undefined });
    }
    for (const fn of this.listeners) fn(this.desc, { name, answered: !!(answer && answer.answered) });
  }
  on(fn) { this.listeners.push(fn); }
}