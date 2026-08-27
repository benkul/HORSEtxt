// node test/weather.test.js
//
// GRAMMAR.md §6.4 and §6.5. Weather is a condition, not a draw: shared, slow, and
// correlated in documented directions. `chance` is the draw.

import { Weather } from "../src/weather.js";
import { Horse } from "../src/runtime.js";

let pass = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
function eq(a, b, what) {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what || "value"}\n  expected ${y}\n  got      ${x}`);
}
function ok(c, what) { if (!c) throw new Error(what || "expected truthy"); }

const AXES = ["cold", "wet", "wind", "sun", "flies"];
const at = (ms, individual) => {
  const w = new Weather({ now: () => ms });
  if (individual) w.individual = individual;
  return w;
};

// A year of two-hourly readings, for distribution and correlation.
function year(individual) {
  const t0 = Date.UTC(2026, 0, 1);
  const rows = [];
  for (let h = 0; h < 365 * 24; h += 2) {
    const w = at(t0 + h * 3600000, individual);
    rows.push(Object.fromEntries(AXES.map((a) => [a, w.read(a)])));
  }
  return rows;
}
function corr(xs, ys) {
  const mx = xs.reduce((a, b) => a + b) / xs.length;
  const my = ys.reduce((a, b) => a + b) / ys.length;
  const num = xs.map((v, i) => (v - mx) * (ys[i] - my)).reduce((a, b) => a + b);
  const dx = Math.sqrt(xs.map((v) => (v - mx) ** 2).reduce((a, b) => a + b));
  const dy = Math.sqrt(ys.map((v) => (v - my) ** 2).reduce((a, b) => a + b));
  return dx * dy === 0 ? 0 : num / (dx * dy);
}

const Y = year();
const col = (a) => Y.map((r) => r[a]);

// ------------------------------------------------------------------ the shape

test("every axis is graded 0..1", () => {
  for (const a of AXES) {
    const v = col(a);
    ok(Math.min(...v) >= 0 && Math.max(...v) <= 1, `${a} out of range`);
  }
});

test("an unknown condition is refused", () => {
  let threw = false;
  try { at(0).read("balmy"); } catch (e) { threw = /not a weather condition/.test(e.message); }
  ok(threw);
});

test("every axis actually moves", () => {
  for (const a of AXES) {
    const v = col(a);
    ok(Math.max(...v) - Math.min(...v) > 0.3, `${a} barely varies`);
  }
});

// `flies` is the largest behavioural driver of the five, so an implementation where
// it never rises is not a small inaccuracy. It never passed 0.07 in a year on the
// first attempt, which is what this guards.
test("flies reaches genuinely high values", () => {
  const v = col("flies");
  ok(Math.max(...v) > 0.7, `flies peaks at only ${Math.max(...v).toFixed(2)}`);
});

// --------------------------------------------------------------- autocorrelated

test("read twice in an instant, weather has not moved", () => {
  const w = at(Date.UTC(2026, 5, 1));
  for (const a of AXES) eq(w.read(a), w.read(a), a);
});

test("a minute is nothing to a front", () => {
  const t = Date.UTC(2026, 5, 1);
  for (const a of AXES) {
    const drift = Math.abs(at(t + 60000).read(a) - at(t).read(a));
    ok(drift < 0.02, `${a} moved ${drift.toFixed(3)} in a minute`);
  }
});

test("a season is not nothing", () => {
  const jan = at(Date.UTC(2026, 0, 15)).read("cold");
  const jul = at(Date.UTC(2026, 6, 15)).read("cold");
  ok(jan > jul, `january (${jan.toFixed(2)}) should read colder than july (${jul.toFixed(2)})`);
});

// ------------------------------------------------------------------- shared

test("weather is shared, not rolled per reader", () => {
  const t = Date.UTC(2026, 3, 9);
  for (const a of AXES) eq(at(t).read(a), at(t).read(a), a);
});

test("two animals in the same weather read the same conditions", () => {
  const t = () => Date.UTC(2026, 7, 2);
  const a = new Horse({ now: t });
  const b = new Horse({ now: t });
  a.declare({ name: "a", traits: [] });
  b.declare({ name: "b", traits: [{ kind: "tag", value: "northern" }] });
  for (const axis of ["wet", "wind", "sun", "flies"]) {
    eq(a.weather(axis), b.weather(axis), axis);
  }
});

// -------------------------------------------------------------- correlations

test("wet and wind arrive together", () => {
  ok(corr(col("wet"), col("wind")) > 0.4, "same front, so they co-occur");
});

test("wet and wind suppress flies", () => {
  ok(corr(col("wet"), col("flies")) < -0.1, "rain reduces harassment");
  ok(corr(col("wind"), col("flies")) < -0.1, "so does wind");
});

test("sun amplifies flies", () => {
  ok(corr(col("sun"), col("flies")) > 0.2, "flies are active in sun and avoid shade");
});

// The documented anti-correlation, and the one that makes weather a system rather
// than a bag of numbers.
test("the conditions that make an animal cold relieve it of flies", () => {
  ok(corr(col("cold"), col("flies")) < -0.3, "cold and flies run against each other");
});

// -------------------------------------------------------- the reading is individual

test("cold is read against the individual, the other axes are not", () => {
  const t = Date.UTC(2026, 10, 15);
  const read = (traits) => {
    const w = at(t);
    if (traits) w.individual = { name: "x", traits };
    return w.read("cold");
  };
  const ordinary = read([]);
  const clipped = read([{ kind: "tag", value: "clipped" }]);
  const northern = read([{ kind: "tag", value: "northern" }]);

  ok(clipped > ordinary, "a clipped coat is no coat");
  ok(northern < ordinary, "acclimatisation lowers the critical temperature");
  ok(clipped - northern > 0.4, "and the difference is not cosmetic");
});

test("the young and the old feel it sooner", () => {
  const t = Date.UTC(2026, 10, 15);
  const read = (traits) => { const w = at(t); w.individual = { name: "x", traits }; return w.read("cold"); };
  const grown = read([{ kind: "age", value: 8 }]);
  ok(read([{ kind: "age", value: 1 }]) > grown, "a yearling");
  ok(read([{ kind: "age", value: 24 }]) > grown, "an old horse");
});

test("with no individual there is no body to be cold", () => {
  const t = Date.UTC(2026, 10, 15);
  const bare = at(t).read("cold");
  const w = at(t); w.individual = { name: "x", traits: [] };
  ok(bare !== w.read("cold"), "an unconditioned reading is a different reading");
});

// ------------------------------------------------------------------- chance

test("chance is a fresh draw, and weather is not", () => {
  const H = new Horse({ now: () => Date.UTC(2026, 5, 5) });
  const rolls = [H.chance(), H.chance(), H.chance()];
  ok(new Set(rolls).size === 3, "three draws, three answers");
  const reads = [H.weather("wet"), H.weather("wet"), H.weather("wet")];
  ok(new Set(reads).size === 1, "three reads, one condition");
});

test("chance is graded 0..1", () => {
  const H = new Horse({});
  for (let i = 0; i < 200; i++) {
    const v = H.chance();
    ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

// --------------------------------------------------------------------- done

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
process.exit(failures.length ? 1 : 0);
