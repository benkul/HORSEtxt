// node test/claims.test.js
//
// Every testable claim the documents make, executed.
//
// The documents are prose and nothing checks prose. Claims in them have been wrong
// for whole releases at a time: members a list never had, a filtering rule the
// grammar had already reversed, an operator the list of operators omitted, four
// rules for affect of which one was implemented. Each was true when written, or
// nearly, and nothing ever asked again.
//
// So each test here is named for the claim it holds, and the section it comes from.
// A failure reads as the sentence in the docs that is no longer true — fix one or
// the other, and never leave them disagreeing.

import { compile, runSource, load, blocks, browserHost } from "../src/browser.js";

let pass = 0;
const failures = [];
const queue = [];
const claim = (where, text, fn) => queue.push([`${where}  ${text}`, fn]);

// ------------------------------------------------------------------- helpers

const band = (body) => `band a\n${body.map((l) => "    " + l).join("\n")}\n`;
const errsOf = (src) => compile(src, "t.horse").errors.map((e) => e.message);
const errs = (body) => errsOf(band(body));
const warns = (body) => compile(band(body), "t.horse").warnings.map((e) => e.message);
const compiles = (body) => errs(body).length === 0 || errs(body);
const refuses = (re, body) => {
  const e = errs(body);
  return e.some((m) => re.test(m)) || `errors were ${JSON.stringify(e)}`;
};
async function ran(body, host = {}) {
  globalThis.OUT = [];
  const r = await runSource(band(body), "t.horse", host);
  if (r.errors.length) throw new Error("compile: " + r.errors.map((e) => e.message).join("; "));
  return { out: globalThis.OUT, r };
}
async function ranSrc(src, host = {}) {
  globalThis.OUT = [];
  const r = await runSource(src, "t.horse", host);
  if (r.errors.length) throw new Error("compile: " + r.errors.map((e) => e.message).join("; "));
  return { out: globalThis.OUT, r };
}
const eq = (a, b) =>
  JSON.stringify(a) === JSON.stringify(b) || `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`;
const herd = (bodies) => "herd h\n" + bodies.join("\n") + "\n";

const fakeDoc = (sources) => {
  const attrs = new Map();
  return {
    readyState: "complete",
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      attrs,
    },
    querySelectorAll: (sel) => (sel === 'script[type="text/horse"]'
      ? sources.map((s) => ({ textContent: s, getAttribute: () => null })) : []),
    addEventListener: () => {}, removeEventListener: () => {},
  };
};

// §1 Lexical ----------------------------------------------------------------
claim("§1.1", "non-ASCII is refused", () =>
  refuses(/non-ASCII/, ["lead mare go", "    # café", "    release"]));

claim("§1.3", "hyphens are legal inside identifiers", () =>
  compiles(["cue a-b", "    release 1", "lead mare go", "    release (a-b)"]) === true || compiles(["cue a-b","    release 1","lead mare go","    release (a-b)"]));

claim("§1.3", "subtraction requires surrounding whitespace; a-b is one name", async () => {
  const e = errs(["lead mare go", "    remember a as 5", "    remember b as 2",
                  "    remember c as a-b", "    release c"]);
  return e.some((m) => /"a-b" is not declared/.test(m)) || `errors ${JSON.stringify(e)}`;
});

claim("§1.3", "member names may contain uppercase", () =>
  compiles(["lead mare go", "    release hands.document.createElement"]) === true ||
  compiles(["lead mare go", "    remember x as hands.document.createElement", "    release x"]));

claim("§1.4", "a list literal may span lines", () =>
  compiles(["lead mare go", "    remember xs as [1", "2", "3]", "    release xs"]));

claim("§1.5", "keywords are reserved and cannot be bound", () =>
  errs(["lead mare go", "    remember rest as 1", "    release rest"]).length > 0 ||
  "rest was accepted as an identifier");

// §2 Program ----------------------------------------------------------------
claim("§2", "genotype defaults to CA, so pace is refused undeclared", () =>
  refuses(/AA allele/, ["lead mare go", "    pace", "        blank", "    release"]));

claim("§2", "declaring AA reaches pace", () =>
  compile("genotype AA\n" + band(["lead mare go", "    pace", "        blank", "    release"]),
          "t.horse").errors.length === 0 || "still refused");

claim("§2", "tolt additionally requires the icelandic tag", () =>
  compile("genotype AA\n" + band(["lead mare go", "    tolt", "        blank", "    release"]),
          "t.horse").errors.some((e) => /Icelandic/.test(e.message)) || "tolt was allowed");

claim("§2", "a band above natural size warns", () => {
  const body = [];
  for (let i = 0; i < 10; i++) body.push(`cue c${i}`, "    release 1");
  body.push("lead mare go", "    release");
  return warns(body).some((m) => /band/.test(m)) || `warnings ${JSON.stringify(warns(body))}`;
});

// §3 Cues -------------------------------------------------------------------
claim("§3", "arity is checked against a known cue", () =>
  refuses(/takes 1 argument/, ["cue one n", "    release n", "lead mare go", "    release one 1 2"]));

claim("§3", "a cue reaching its end without an outcome is refused", () =>
  refuses(/./, ["cue c", "    remember x as 1", "lead mare go", "    release"]));

claim("§3", "a zero-argument call needs parentheses", async () => {
  const { out } = await ran(["cue answer", "    release 7",
                             "lead mare go", "    hands.OUT.push (answer)", "    release"]);
  return eq(out, [7]);
});

claim("§3", "a bare cue name on a line warns that it is not a call", () =>
  warns(["cue answer", "    release 7", "lead mare go", "    answer", "    release"])
    .some((m) => /not a call/.test(m)) || "no warning");

claim("§3", "application is left-associative and does not nest", async () => {
  const { out } = await ran(["cue double n", "    release n * 2",
    "lead mare go", "    hands.OUT.push (double 3 + 1)", "    hands.OUT.push (double (3 + 1))", "    release"]);
  return eq(out, [7, 8]);
});

claim("§3", "a cue held under another name is callable", async () => {
  const { out } = await ran(["cue answer", "    release 7",
    "lead mare go", "    remember f as answer", "    hands.OUT.push (f)", "    release"]);
  return eq(out, [7]);
});

claim("§3", "arity is checked through the holding name", () =>
  refuses(/holds cue/, ["cue one n", "    release n",
    "lead mare go", "    remember f as one", "    release f 1 2"]));

claim("§3", "a name holding a number is refused as a call", () =>
  refuses(/holds a number/, ["lead mare go", "    remember n as 3", "    release (n)"]));

// §4 Chords -----------------------------------------------------------------
claim("§4", "a chord opening and closing forward reads as forward", async () => {
  const seen = [];
  await ran(["lead mare go", "    ^ ears forward ^", "    release"], { onChord: (p) => seen.push(p) });
  return seen[0] && seen[0].ears === "forward" || `got ${seen[0] && seen[0].ears}`;
});

claim("§4", "both ears flattened is agonistic", async () => {
  const seen = [];
  await ran(["lead mare go", "    _ ears back _", "    release"], { onChord: (p) => seen.push(p) });
  return seen[0].ears === "agonistic" || `got ${seen[0].ears}`;
});

claim("§4", "one ear each way is divided", async () => {
  const seen = [];
  await ran(["lead mare go", "    ^ ears forward _", "    release"], { onChord: (p) => seen.push(p) });
  return seen[0].ears === "divided" || `got ${seen[0].ears}`;
});

claim("§4", "a chord that never closes is refused", () =>
  refuses(/chord/, ["lead mare go", "    ^ ears forward", "    release"]));

// §5 Gaits ------------------------------------------------------------------
claim("§5", "a held gait with no halt or leave warns", () =>
  warns(["lead mare go", "    walk every 1s", "        blank", "    release"])
    .some((m) => /nothing to stop it/.test(m)) || "no warning");

claim("§5", "halt ends the innermost gait, not the program", async () => {
  const { out, r } = await ran(["lead mare go", "    remember n as 0",
    "    walk every 0ms", "        n becomes n + 1", "        when n >= 3", "            halt",
    "    hands.OUT.push n", "    release"]);
  return (eq(out, [3]) === true && r.left === false) || `out ${JSON.stringify(out)} left ${r.left}`;
});

claim("§5", "an interval wants a duration, not a number", () =>
  refuses(/duration/, ["lead mare go", "    walk every 5", "        halt", "    release"]));

claim("§5a", "a stumble ends the stride and keeps the gait", async () => {
  const { out } = await ran(["lead mare go", "    remember n as 0",
    "    walk every 0ms", "        n becomes n + 1", "        when n < 3", "            stumble",
    "        hands.OUT.push n", "        halt", "    release"]);
  return eq(out, [3]);
});

claim("§5a", "a stumble outside a gait is refused", () =>
  refuses(/stumble/, ["lead mare go", "    stumble", "    release"]));

// §6 Traversal --------------------------------------------------------------
claim("§6.1", "graze walks a plain list", async () => {
  const { out } = await ran(["lead mare go", "    graze [1 2 3] as n", "        hands.OUT.push n", "    release"]);
  return eq(out, [1, 2, 3]);
});

claim("§6.1", "graze from the front traverses in reverse", async () => {
  const { out } = await ran(["lead mare go", "    graze [1 2 3] from the front as n",
    "        hands.OUT.push n", "    release"]);
  return eq(out, [3, 2, 1]);
});

claim("§6.2", "a forage draws without repeats until exhausted", async () => {
  const { out } = await ran(["forage deck of 1 through 5", "lead mare go",
    "    graze 1 through 5 as i", "        hands.OUT.push deck.graze", "    release"]);
  return new Set(out).size === 5 || `got ${JSON.stringify(out)}`;
});

claim("§6.2", "an exhausted forage without regrows balks", async () => {
  const { r } = await ran(["forage deck of 1 through 2", "cue drain",
    "    graze 1 through 3 as i", "        hands.OUT.push deck.graze", "    release 0",
    "lead mare go", "    remember x as (drain)", "    release"]);
  return !r.threw || `threw ${r.threw}`;
});

claim("§6.3", "recognise is stable for the same input", async () => {
  const { out } = await ran(["lead mare go", '    hands.OUT.push (recognise "x")',
    '    hands.OUT.push (recognise "x")', "    release"]);
  return out[0] === out[1] || `got ${JSON.stringify(out)}`;
});

claim("§6.5", "chance gives independent draws", async () => {
  const { out } = await ran(["lead mare go", "    graze 1 through 40 as i",
    "        hands.OUT.push chance", "    release"]);
  return new Set(out).size > 30 || `only ${new Set(out).size} distinct`;
});

claim("§6.4", "weather read repeatedly gives one answer", async () => {
  const { out } = await ran(["lead mare go", "    graze 1 through 5 as i",
    "        hands.OUT.push weather.wet", "    release"]);
  return new Set(out).size === 1 || `got ${new Set(out).size} distinct`;
});

// §7 stand ------------------------------------------------------------------
claim("§7", "a broken hold runs otherwise", async () => {
  const { out } = await ran(["lead mare go", "    stand 10s within 20px as held",
    "        blank", "    otherwise", '        hands.OUT.push "broke"', "    release"], {});
  return eq(out, ["broke"]);
});

claim("§7", "a stand's body iterates while the hold is held", async () => {
  const { out } = await ran(["lead mare go", "    stand 50ms within 20px as held",
    "        hands.OUT.push held", "    release"], {
    stop: () => false,
    hold: ({ onProgress }) => new Promise((s) => {
      let n = 0;
      const tick = () => { onProgress(n / 3); if (++n > 3) return s(true); setTimeout(tick, 0); };
      tick();
    }),
  });
  return out.length === 4 || `ran ${out.length} times`;
});

// §8 Contexts ---------------------------------------------------------------
claim("§8", "the nearest context interprets a signal", async () => {
  const { out } = await ran(["cue creak", "    snort 1", "    release 0",
    "lead mare go", "    context near", "        hears snort", '            hands.OUT.push "heard"',
    "    (creak)", "    release"]);
  return eq(out, ["heard"]);
});

claim("§8", "a handler can name what the signal carried", async () => {
  const { out } = await ran(["cue creak", '    snort "gate"', "    release 0",
    "lead mare go", "    context near", "        hears snort as what", "            hands.OUT.push what",
    "    (creak)", "    release"]);
  return eq(out, ["gate"]);
});

claim("§8", "a signal with no context is not an error", async () => {
  const { r } = await ran(["lead mare go", "    snort 1", "    release"]);
  return !r.threw || `threw ${r.threw}`;
});

claim("§9a", "an agonistic chord stops a handler firing", async () => {
  const { out } = await ran(["lead mare go", "    context near", "        hears snort",
    '            hands.OUT.push "heard"', "    _ ears back _", "    snort 1", "    release"]);
  return eq(out, []);
});

// §8 a context declared beside the lead mare -------------------------------
//
// A context governs the rest of its block (§8), and the lead mare is part of that
// rest when she is declared after it — so she runs with it still on the stack.
// Declared before it, she is not governed by it and is still the group's to call.
// Either way she is entered exactly once.

claim("§8", "a context before the lead mare governs her", async () => {
  const { out } = await ranSrc(`band a
    context near
        hears snort
            hands.OUT.push "heard"
    lead mare go
        snort 1
        release`);
  return eq(out, ["heard"]);
});

claim("§8", "a context after the lead mare does not stop her running", async () => {
  const { out } = await ranSrc(`band a
    lead mare go
        hands.OUT.push "ran"
        release
    context near
        hears snort
            hands.OUT.push "heard"`);
  return eq(out, ["ran"]);
});

claim("§8", "the lead mare is entered once, however many contexts precede her", async () => {
  const { out } = await ranSrc(`band a
    context outer
        hears snort
            release 0
    context inner
        hears snort
            release 0
    lead mare go
        hands.OUT.push "ran"
        release`);
  return eq(out, ["ran"]);
});

claim("§8", "and the nearest of them answers her", async () => {
  const { out } = await ranSrc(`band a
    context outer
        hears snort
            hands.OUT.push "outer"
    context inner
        hears snort
            hands.OUT.push "inner"
    lead mare go
        snort 1
        release`);
  return eq(out, ["inner"]);
});

claim("§8", "the same holds inside a herd", async () => {
  const { out } = await ranSrc(`herd h
    band one
        context near
            hears snort
                hands.OUT.push "heard"
        lead mare go
            snort 1
            release`);
  return eq(out, ["heard"]);
});

// §8a Truth -----------------------------------------------------------------
claim("§8a", "when 0 is true", async () => {
  const { out } = await ran(["lead mare go", "    when 0", '        hands.OUT.push "yes"', "    release"]);
  return eq(out, ["yes"]);
});

claim("§8a", "when bare is false", async () => {
  const { out } = await ran(["lead mare go", "    when bare", '        hands.OUT.push "yes"',
    "    otherwise", '        hands.OUT.push "no"', "    release"]);
  return eq(out, ["no"]);
});

claim("§8a", "an empty string and empty list are things that are there", async () => {
  const { out } = await ran(["lead mare go", '    when ""', '        hands.OUT.push "s"',
    "    when []", '        hands.OUT.push "l"', "    release"]);
  return eq(out, ["s", "l"]);
});

claim("§8a", "grass in yields the first patch with anything in it", async () => {
  const { out } = await ran(["lead mare go", "    remember v as grass in [bare bare 7]",
    "    hands.OUT.push v", "    release"]);
  return eq(out, [7]);
});

claim("§8a", "grass over all-bare comes back bare", async () => {
  const { out } = await ran(["lead mare go", "    remember v as grass in [bare bare]",
    "    hands.OUT.push v", "    release"]);
  return eq(out, [null]);
});

claim("§8a", "every patch is evaluated, unlike or", async () => {
  const { out } = await ran(["cue mark n", "    hands.OUT.push n", "    release n",
    "lead mare go", "    remember v as grass in [(mark 1) (mark 2)]", "    release"]);
  return eq(out, [1, 2]);
});

// §10 Failure ---------------------------------------------------------------
claim("§10", "a spook catches and habituates after N", async () => {
  // A spook guards the rest of its block, so the thing that throws comes after it.
  const { out } = await ran(["lead mare go", "    graze 1 through 4 as i",
    "        spook at bare", '            hands.OUT.push "caught"',
    "        habituates after 2",
    "        remember x as hands.NOTHING.here", "    release"]);
  return eq(out, ["caught", "caught"]);
});

claim("§10", "flood compiles with a warning", () =>
  warns(["lead mare go", "    flood at hands.X.y", "        blank", "    release"])
    .some((m) => /helplessness/.test(m)) || "no warning");

claim("§10", "balk is not an error and not a leave", async () => {
  const { r } = await ran(["cue c", "    balk", "lead mare go", "    remember x as (c)", "    release"]);
  return (!r.threw && r.left === false) || `threw ${r.threw} left ${r.left}`;
});

claim("§10", "leave ends the program", async () => {
  const { out, r } = await ran(["lead mare go", "    leave", '    hands.OUT.push "after"']);
  return (r.left === true && eq(out, []) === true) || `left ${r.left} out ${JSON.stringify(out)}`;
});

claim("§10", "blank leaves the cue rather than skipping", async () => {
  const { out } = await ran(["lead mare go", "    graze [1 2 3] as n", "        when n = 2",
    "            blank", "        hands.OUT.push n", '    hands.OUT.push "after"', "    release"]);
  return eq(out, [1]);
});

// §11 Statements ------------------------------------------------------------
claim("§11", "comparison does not chain", () =>
  refuses(/./, ["lead mare go", "    when 1 > 2 > 3", "        blank", "    release"]));

claim("§11", "writing to a pile appends", async () => {
  const { out } = await ran(['pile trail at "audit.t"', "lead mare go", "    trail becomes 1",
    "    trail becomes 2", "    hands.OUT.push trail.count", "    hands.OUT.push trail.graze", "    release"]);
  return out[0] >= 2 && out[1] === 2 || `got ${JSON.stringify(out)}`;
});

claim("§11", "new constructs through hands", async () => {
  const { out } = await ran(["lead mare go", "    remember d as new hands.Date",
    "    hands.OUT.push (d.getFullYear)", "    release"]);
  return out[0] > 2000 || `got ${JSON.stringify(out)}`;
});

// §11a hands ----------------------------------------------------------------
claim("§11a", "a member path alone on a line is an error", () =>
  refuses(/releases nothing/, ["lead mare go", "    hands.X.y", "    release"]));

claim("§11a", "a cue handed to filter is refused", () =>
  refuses(/answer now/, ["cue pick n", "    release n", "lead mare go",
    "    remember xs as [1 2]", "    remember r as xs.filter pick", "    release r"]));

claim("§11a", "a cue handed to a listener is allowed", () =>
  compiles(["cue answer", "    release 0", "lead mare go",
    '    hands.document.addEventListener "click" answer', "    release"]));

claim("§11a", "three bare crossings at one path are reported", async () => {
  globalThis.MISS = { at: () => null };
  const { r } = await ran(["lead mare go", "    remember a as hands.MISS.at 1",
    "    remember b as hands.MISS.at 2", "    remember c as hands.MISS.at 3", "    release"]);
  return r.horse.diagnostics.some((d) => /came back bare 3 times/.test(d.message)) ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "a method used as a value is reported", async () => {
  globalThis.MISS = { at: () => 5 };
  const { r } = await ran(["lead mare go", "    remember n as hands.MISS.at - 1", "    release n"]);
  return r.horse.diagnostics.some((d) => /used as a value/.test(d.message)) ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "a cue in arithmetic is refused outright", () =>
  refuses(/arithmetic on a cue/, ["cue draw", "    release 1",
    "lead mare go", "    remember x as draw - 1", "    release x"]));

// §12 Limits ----------------------------------------------------------------
claim("§12", "a list has no members of its own", async () => {
  const { out } = await ran(["lead mare go", "    remember xs as [1 2 3]",
    "    hands.OUT.push xs.count", "    hands.OUT.push xs.empty", "    release"]);
  return eq(out, [null, null]);
});

claim("§12", "a list answers JavaScript's vocabulary", async () => {
  const { out } = await ran(["lead mare go", "    remember xs as [1 2 3]",
    "    hands.OUT.push xs.length", "    release"]);
  return eq(out, [3]);
});

claim("§12", "a duration cannot be built from a number", () =>
  errs(["lead mare go", "    walk every (2 * 3)", "        halt", "    release"]).length > 0 ||
  "a computed interval was accepted");

claim("§12", "a string cannot escape a quote", () =>
  errs(["lead mare go", '    remember s as "a\\"b"', "    release s"]).length > 0 ||
  "an escaped quote was accepted");

// STDLIB --------------------------------------------------------------------
claim("STDLIB", "forage answers count, empty, graze", async () => {
  const { out } = await ran(["forage deck of 1 through 3", "lead mare go",
    "    hands.OUT.push deck.count", "    hands.OUT.push deck.empty", "    release"]);
  return eq(out, [3, false]);
});

claim("STDLIB", "forage cannot be indexed", async () => {
  const { out } = await ran(["forage deck of 1 through 3", "lead mare go",
    "    hands.OUT.push deck[0]", "    hands.OUT.push deck.first", "    release"]);
  return eq(out, [null, null]);
});

claim("STDLIB", "pile marks is indexable, oldest first", async () => {
  const { out } = await ran(['pile t2 at "audit.t2"', "lead mare go", "    t2 becomes 1",
    "    t2 becomes 2", "    hands.OUT.push t2.marks[0]", "    release"]);
  return out[0] === 1 || `got ${JSON.stringify(out)}`;
});

claim("STDLIB", "text has no members of its own", async () => {
  const { out } = await ran(["lead mare go", '    remember s as "abc"',
    "    hands.OUT.push s.count", "    hands.OUT.push s.length", "    release"]);
  return eq(out, [null, 3]);
});

claim("STDLIB", "% is an operator at * precedence", async () => {
  const { out } = await ran(["lead mare go", "    hands.OUT.push (7 % 3)",
    "    hands.OUT.push (1 + 7 % 3)", "    release"]);
  return eq(out, [1, 2]);
});

claim("STDLIB", "duration and distance do not mix with numbers", () =>
  errs(["lead mare go", "    stand 10 within 20px as h", "        blank", "    release"]).length > 0 ||
  "a bare number was accepted as a duration");

// §2 -------------------------------------------------------------------------
claim("§2", "at most one @ per program", () =>
  errsOf("@ a\n@ b\nband x\n    lead mare go\n        release\n").length > 0 ||
  "two individuals were accepted");

claim("§2", "an individual's laterality bias sets the ambient side", async () => {
  const { out } = await ranSrc("@ juniper  left bias\nband a\n    lead mare go\n" +
    '        hands.OUT.push (flehmen "a gate")\n        release\n');
  return out[0] === true || `got ${JSON.stringify(out)} (left eye asks novelty)`;
});

// §2.4 herds -----------------------------------------------------------------

claim("§2.4", "a crossing must be declared by both bands", () => {
  const one = herd([
    "    band one",
    "        mingles with two",
    "        cue shared",
    "            release 1",
    "    band two",
    "        lead mare go",
    "            release (shared)",
  ]);
  return errsOf(one).some((m) => /both bands must name the other/.test(m)) ||
    `errors ${JSON.stringify(errsOf(one))}`;
});

claim("§2.4", "a mutual crossing is allowed", () => {
  const both = herd([
    "    band one",
    "        mingles with two",
    "        cue shared",
    "            release 1",
    "    band two",
    "        mingles with one",
    "        lead mare go",
    "            release (shared)",
  ]);
  return errsOf(both).length === 0 || `errors ${JSON.stringify(errsOf(both))}`;
});

claim("§2.4", "names are distinct across a herd", () => {
  const clash = herd([
    "    band one",
    "        cue same",
    "            release 1",
    "    band two",
    "        cue same",
    "            release 2",
    "        lead mare go",
    "            release 0",
  ]);
  return errsOf(clash).length > 0 || "a duplicate name across bands was accepted";
});

claim("§2.4", "a bachelor group sees every band without declaring", () => {
  const src = herd([
    "    band one",
    "        cue shared",
    "            release 1",
    "    bachelors probes",
    "        lead mare check",
    "            release (shared)",
  ]);
  return errsOf(src).length === 0 || `errors ${JSON.stringify(errsOf(src))}`;
});

claim("§2.4", "and no band sees the bachelor group", () => {
  const src = herd([
    "    bachelors probes",
    "        cue hidden",
    "            release 1",
    "    band one",
    "        lead mare go",
    "            release (hidden)",
  ]);
  return errsOf(src).length > 0 || "a band reached into the bachelor group";
});

// §9a perception -------------------------------------------------------------
claim("§9a", "flehmen from the left answers whether it is new", async () => {
  const { out } = await ran(["lead mare go",
    '    hands.OUT.push (flehmen "gate" from the left)',
    '    hands.OUT.push (flehmen "gate" from the left)', "    release"]);
  return eq(out, [true, false]);
});

claim("§9a", "flehmen from the right answers a category", async () => {
  const { out } = await ran(["lead mare go",
    '    hands.OUT.push (flehmen "gate" from the right)',
    "    hands.OUT.push (flehmen [1 2] from the right)", "    release"]);
  return eq(out, ["string", "many"]);
});

claim("§9a", "a novel thing raises novel, which a context can hear", async () => {
  const { out } = await ran(["lead mare go", "    context field", "        hears novel",
    '            hands.OUT.push "new"', '    remember s as flehmen "gate" from the left', "    release"]);
  return eq(out, ["new"]);
});

claim("§9a", "an agonistic chord cannot look at all", async () => {
  const { out, r } = await ran(["cue look", '    release flehmen "gate" from the left',
    "lead mare go", "    _ ears back _", "    remember x as (look)",
    '    hands.OUT.push "carried on"', "    release"]);
  return eq(out, ["carried on"]) === true && !r.threw || `threw ${r.threw}`;
});

claim("§9a", "a cue cannot flehmen its own parameter", async () => {
  const { out } = await ran(["cue examine thing", "    release flehmen thing",
    "lead mare go", "    remember r as examine [1 2]",
    '    hands.OUT.push "balked"', "    release"]);
  return eq(out, ["balked"]);
});

claim("§9a", "novelty is keyed to shape, so a rotated thing reads as novel", async () => {
  const { out } = await ran(["lead mare go",
    "    hands.OUT.push (flehmen [1 2] from the left)",
    "    hands.OUT.push (flehmen [2 1] from the left)", "    release"]);
  return eq(out, [true, true]);
});

claim("§9a", "a computed number is held, not perceived", async () => {
  const { out } = await ran(["lead mare go", "    remember n as 1 + 1",
    "    hands.OUT.push (flehmen n from the right)", "    release"]);
  return eq(out, ["number"]);
});

// §8 contexts ----------------------------------------------------------------
claim("§8", "a context is legal as a statement inside a cue", () =>
  errs(["cue c", "    context near", "        hears snort", "            release 0",
        "    snort 1", "    release 1", "lead mare go", "    release (c)"]).length === 0 ||
  `errors ${JSON.stringify(errs(["cue c","    context near","        hears snort","            release 0","    snort 1","    release 1","lead mare go","    release (c)"]))}`);

claim("§8", "a context with no handlers is refused", () =>
  refuses(/./, ["lead mare go", "    context near", "        blank", "    release"]));

claim("§8", "the nearest context wins", async () => {
  const { out } = await ran(["cue creak", "    snort 1", "    release 0",
    "lead mare go",
    "    context outer", "        hears snort", '            hands.OUT.push "outer"',
    "    context inner", "        hears snort", '            hands.OUT.push "inner"',
    "    (creak)", "    release"]);
  return eq(out, ["inner"]);
});

claim("§8", "a binding belongs to its own handler", () =>
  refuses(/"what" is not declared/, ["lead mare go", "    context near",
    "        hears snort as what", "            release what",
    "        hears squeal", "            release what", "    release"]));

// §3 degradation -----------------------------------------------------------

claim("§3", "a degraded cue stops answering and comes back bare", async () => {
  const { Horse } = await import("../src/runtime.js");
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const cue = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20)); return "answered";
  });
  const got = [];
  for (let i = 0; i < 5; i++) got.push(await cue());
  return eq(got, ["answered", "answered", "answered", undefined, undefined]);
});

claim("§3", "and `when` on that answer is false", async () => {
  const { Horse } = await import("../src/runtime.js");
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const cue = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20)); return 1;
  });
  for (let i = 0; i < 4; i++) await cue();
  return H.truth(await cue()) === false || "a helpless cue read as an answer";
});

claim("§3", "retrying does not repair it", async () => {
  const { Horse } = await import("../src/runtime.js");
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const cue = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20)); return 1;
  });
  for (let i = 0; i < 3; i++) await cue();
  H.releaseBudget = 10000;
  return (await cue()) === undefined || "restoring the contingency repaired it";
});

claim("§3", "nothing degrades without a declared individual", async () => {
  const { Horse } = await import("../src/runtime.js");
  const H = new Horse({});
  H.releaseBudget = 5;
  const cue = H.cue("dawdle", [], async () => {
    await new Promise((r) => setTimeout(r, 20)); return "answered";
  });
  const got = [];
  for (let i = 0; i < 6; i++) got.push(await cue());
  return eq(got, Array(6).fill("answered"));
});

claim("§3", "time the animal was told to take does not degrade a binding", async () => {
  const { Horse } = await import("../src/runtime.js");
  const H = new Horse({});
  H.declare({ name: "juniper", traits: [] });
  H.releaseBudget = 5;
  const cue = H.cue("held", [], async () => { await H.waited(30); return "answered"; });
  const got = [];
  for (let i = 0; i < 6; i++) got.push(await cue());
  return eq(got, Array(6).fill("answered"));
});

// §10 shy ------------------------------------------------------------------

claim("§10", "a shy hands over to the other side", async () => {
  const { out } = await ranSrc(`@ juniper  left bias
band a
    lead mare go
        hands.OUT.push (flehmen "gate")
        shy
        hands.OUT.push (flehmen "gate")
        release`);
  return eq(out, [true, "string"], "the same expression, either side of a shy");
});

claim("§10", "and reads correctly in both directions", async () => {
  const { out } = await ranSrc(`@ juniper  right bias
band a
    lead mare go
        hands.OUT.push (flehmen "gate")
        shy
        hands.OUT.push (flehmen "hedge")
        release`);
  return eq(out, ["string", true], "categorising, startled, then the flight system");
});

claim("§10", "a shy ends nothing", async () => {
  const { out, r } = await ran(["lead mare go", "    shy",
    '    hands.OUT.push "still here"', "    release"]);
  return (eq(out, ["still here"]) === true && !r.left && !r.threw) ||
    `left ${r.left} threw ${r.threw}`;
});

claim("§10", "a shy does not end the stride, unlike a stumble", async () => {
  const { out } = await ran(["lead mare go", "    remember n as 0",
    "    walk every 0ms", "        n becomes n + 1", "        shy",
    "        hands.OUT.push n", "        when n >= 2", "            halt", "    release"]);
  return eq(out, [1, 2], "the rest of the stride still ran");
});

claim("§10", "a shy takes no argument", () =>
  errs(["lead mare go", '    shy "the bag"', "    release"]).length > 0 ||
  "a stimulus was accepted");

claim("§10", "and takes no side, because the direction is not chosen", () =>
  errs(["lead mare go", "    shy from the left", "    release"]).length > 0 ||
  "a side was accepted");

claim("§10", "the new side lasts to the end of the enclosing cue", async () => {
  const { out } = await ranSrc(`@ juniper  left bias
band a
    cue startle
        shy
        release 0
    lead mare go
        remember x as (startle)
        hands.OUT.push (flehmen "gate")
        shy
        hands.OUT.push (flehmen "hedge")
        release`);
  return eq(out, [true, "string"], "a shy inside a cue is restored when it returns");
});

claim("§10", "a chord after a shy leans the other way", async () => {
  const sides = [];
  await ranSrc(`@ juniper  left bias
band a
    lead mare go
        ^ ears forward ^
        shy
        ^ ears forward ^
        release`, { onChord: (p) => sides.push(p.lateral) });
  return eq(sides, ["left", "right"]);
});

claim("§10", "a signal after a shy carries the other side", async () => {
  const sides = [];
  await ranSrc(`@ juniper  left bias
band a
    lead mare go
        context near
            hears snort
                release 0
        snort 1
        shy
        snort 2
        release`, { onSignal: (n, a) => sides.push(a.carried && a.carried.side) });
  return eq(sides, ["left", "right"]);
});

// §11 statements -------------------------------------------------------------
claim("§11", "becomes writes to a member across the boundary", async () => {
  globalThis.SLOT = { held: 0 };
  await ran(["lead mare go", "    hands.SLOT.held becomes 9", "    release"]);
  return globalThis.SLOT.held === 9 || `got ${globalThis.SLOT.held}`;
});

claim("§11", "only a pile can be left a trace", async () => {
  const { r } = await ran(["lead mare go", "    remember n as 1", "    n becomes 2",
    "    hands.OUT.push n", "    release"]);
  return !r.threw || `threw ${r.threw}`;
});

claim("§11", "a range is inclusive at both ends", async () => {
  const { out } = await ran(["lead mare go", "    graze 1 through 3 as n",
    "        hands.OUT.push n", "    release"]);
  return eq(out, [1, 2, 3]);
});

// §11a the boundary's details ------------------------------------------------
claim("§11a", "an answer resets the bare-crossing count", async () => {
  let n = 0;
  globalThis.MISS = { at: () => (++n === 2 ? "here" : null) };
  const { r } = await ran(["lead mare go", "    remember a as hands.MISS.at 1",
    "    remember b as hands.MISS.at 2", "    remember c as hands.MISS.at 3",
    "    remember d as hands.MISS.at 4", "    release"]);
  return r.horse.diagnostics.length === 0 ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "zero counts as an answer at the boundary", async () => {
  globalThis.MISS = { at: () => 0 };
  const { r } = await ran(["lead mare go", "    remember a as hands.MISS.at 1",
    "    remember b as hands.MISS.at 2", "    remember c as hands.MISS.at 3", "    release"]);
  return r.horse.diagnostics.length === 0 ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "an index is not part of a path's shape", async () => {
  globalThis.MISS = { rows: [null, null, null] };
  const { r } = await ran(["lead mare go", "    remember a as hands.MISS.rows[0]",
    "    remember b as hands.MISS.rows[1]", "    remember c as hands.MISS.rows[2]", "    release"]);
  return r.horse.diagnostics.some((d) => /rows\[\] came back bare 3 times/.test(d.message)) ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "a write is not a question", async () => {
  globalThis.SLOT = { held: 1 };
  const { r } = await ran(["lead mare go", "    hands.SLOT.held becomes 1",
    "    hands.SLOT.held becomes 2", "    hands.SLOT.held becomes 3", "    release"]);
  return r.horse.diagnostics.length === 0 ||
    `notes ${JSON.stringify(r.horse.diagnostics.map((d) => d.message))}`;
});

claim("§11a", "identity comparison on a cue is allowed", () =>
  errs(["cue draw", "    release 1", "lead mare go", "    remember f as draw",
    "    when f = draw", '        hands.OUT.push "same"', "    release"]).length === 0 ||
  `errors ${JSON.stringify(errs(["cue draw","    release 1","lead mare go","    remember f as draw","    when f = draw",'        hands.OUT.push "same"',"    release"]))}`);

claim("§11a", "a leave from a cue the page kept is contained", async () => {
  const kept = [];
  globalThis.PAGE = { keep: (fn) => kept.push(fn) };
  const { r } = await ran(["cue answer", "    leave",
    "lead mare go", "    hands.PAGE.keep answer", "    release"]);
  let escaped = null;
  try { await kept[0](); } catch (e) { escaped = e.constructor.name; }
  return escaped === null || `a ${escaped} escaped into the page`;
});

// README ---------------------------------------------------------------------

claim("README", "a block with no lead mare runs nothing and is not wrong", async () => {
  const doc = fakeDoc(["band q\n    cue never\n        ^ ears forward ^\n        release\n"]);
  const seen = [];
  const out = await load({ document: doc, host: { onChord: (p) => seen.push(p) } });
  return (out[0].errors.length === 0 && seen.length === 0) ||
    `errors ${JSON.stringify(out[0].errors)} chords ${seen.length}`;
});

claim("README", "a block that fails does not stop the ones after it", async () => {
  const doc = fakeDoc([
    "band broken\n    cue b\n        halt\n",
    "band fine\n    lead mare go\n        ^ ears forward ^\n        release\n",
  ]);
  const seen = [];
  const log = console.log, gc = console.groupCollapsed, ge = console.groupEnd;
  console.log = console.groupCollapsed = console.groupEnd = () => {};
  try {
    await load({ document: doc, host: { onChord: (p) => seen.push(p) } });
  } finally { console.log = log; console.groupCollapsed = gc; console.groupEnd = ge; }
  return seen.length === 1 || `${seen.length} chords`;
});

claim("README", "the host writes the posture onto the document element", async () => {
  const doc = fakeDoc([]);
  const host = browserHost({ document: doc });
  host.onChord({ ears: "agonistic", states: [{ channel: "tension", value: 0.4 }] });
  return (doc.documentElement.getAttribute("data-ears") === "agonistic" &&
          doc.documentElement.getAttribute("data-tension") === "0.4") ||
    `ears ${doc.documentElement.getAttribute("data-ears")}`;
});

claim("README", "a page can read its own source back out of the DOM", async () => {
  const doc = fakeDoc(["band a\n    lead mare go\n        release\n"]);
  return blocks(doc).length === 1 || `${blocks(doc).length} blocks`;
});

claim("README", "errors cite rather than explain", () => {
  const out = compile("band a\n    cue go\n        pace\n            halt\n        release\n", "t.horse");
  return out.errors.some((e) => /Promerova/.test(e.citation || "")) ||
    `citations ${JSON.stringify(out.errors.map((e) => e.citation))}`;
});
// ---------------------------------------------------------------------- done

for (const [name, fn] of queue) {
  try {
    const r = await fn();
    if (r === true) pass++;
    else failures.push({ name, message: String(r) });
  } catch (e) {
    failures.push({ name, message: "THREW " + String(e.message || e).split("\n")[0] });
  }
}
for (const f of failures) console.log(`\nFAIL  ${f.name}\n  ${f.message}`);
console.log(`${pass} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
