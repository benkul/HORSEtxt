// node test/parser.test.js

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    failures.push({ name, message: e.message });
  }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}

function run(src) {
  const lex = tokenize(src, "test.horse");
  if (lex.errors.length) {
    throw new Error(`lex errors: ${lex.errors.map((e) => e.message).join("; ")}`);
  }
  return parse(lex.tokens, "test.horse");
}

// Parse and require no errors, returning the program body.
function body(src) {
  const r = run(src);
  if (r.errors.length) {
    throw new Error(`parse errors: ${r.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
  }
  return r.ast.body;
}

function errs(src) {
  return run(src).errors.map((e) => e.message);
}

// ------------------------------------------------------------------- program

test("an individual with traits", () => {
  const r = run("@ flore  13  right eye blind  left bias\n");
  eq(r.errors, []);
  eq(r.ast.individual.name, "flore");
  eq(r.ast.individual.traits, [
    { kind: "age", value: 13 },
    { kind: "blind", side: "right" },
    { kind: "bias", side: "left" },
  ]);
});

test("a program with no individual leaves the layer inert", () => {
  const r = run("band a\n    halt\n");
  eq(r.ast.individual, null);
  eq(r.errors, []);
});

test("genotype with a breed", () => {
  const r = run("genotype AA icelandic\n");
  eq(r.errors, []);
  eq([r.ast.genotype.allele, r.ast.genotype.breed], ["AA", "icelandic"]);
});

// --------------------------------------------------------------------- cues

test("a cue with parameters", () => {
  const b = body("cue develop target image\n    halt\n");
  eq([b[0].type, b[0].name, b[0].params, b[0].lead], ["Cue", "develop", ["target", "image"], false]);
});

test("lead mare needs no `cue` keyword", () => {
  const b = body("lead mare draw\n    halt\n");
  eq([b[0].type, b[0].lead, b[0].name], ["Cue", true, "draw"]);
});

test("lead mare cue also parses", () => {
  const b = body("lead mare cue draw\n    halt\n");
  eq([b[0].lead, b[0].name], [true, "draw"]);
});

test("release with and without a value", () => {
  const b = body("cue a\n    release deck.graze\n");
  eq(b[0].body[0].type, "Release");
  eq(b[0].body[0].value.type, "Member");
  const c = body("cue a\n    release\n");
  eq(c[0].body[0].value, null);
});

// ------------------------------------------------------------------- chords

test("a chord of channel states", () => {
  const b = body("^ ears forward   head ~0.2 ^\n");
  const ch = b[0];
  eq(ch.type, "Chord");
  eq([ch.open, ch.close], ["^", "^"]);
  eq(ch.states.length, 2);
  eq(ch.states[0], { kind: "channel", channel: "ears", value: { type: "State", line: 1, col: 8, name: "forward" }, line: 1, col: 3 });
  eq(ch.states[1].value.type, "Graded");
});

test("mixed ears are preserved, not normalised", () => {
  const b = body("^ tension ~0.1 _\n");
  eq([b[0].open, b[0].close], ["^", "_"]);
});

test("both ears flattened is agonistic and legal", () => {
  const b = body("_ ears back _\n");
  eq([b[0].open, b[0].close], ["_", "_"]);
});

test("a graded channel value may be a name", () => {
  const b = body("^ tension ~held ^\n");
  eq(b[0].states[0].value.value.type, "Name");
  eq(b[0].states[0].value.value.name, "held");
});

test("an affect in a chord keeps both axes", () => {
  const b = body("^ voice ~0.8:~-0.3 ^\n");
  const v = b[0].states[0].value;
  eq(v.type, "Affect");
  eq(v.arousal.value.value, 0.8);
  eq(v.valence.value.value, -0.3);
});

test("a bare EquiFACS code is a chord state", () => {
  const b = body("^ AU101   EAD103L ^\n");
  eq(b[0].states.map((s) => s.code), ["AU101", "EAD103L"]);
});

test("a non-channel in a chord is rejected", () => {
  const e = errs("^ banana forward ^\n");
  eq(e.length >= 1, true);
  eq(/not a channel/.test(e[0]), true);
});

test("a chord takes a lateral modifier", () => {
  const b = body("^ ears forward ^ from the left\n");
  eq(b[0].lateral, "left");
});

// -------------------------------------------------------------------- gaits

test("a canter carries its lead", () => {
  const b = body("canter on the left\n    halt\n");
  eq([b[0].type, b[0].gait, b[0].lead], ["Gait", "canter", "left"]);
});

test("tolt carries an interval", () => {
  const b = body("tolt every 7s\n    halt\n");
  eq(b[0].interval.type, "Duration");
  eq([b[0].interval.value, b[0].interval.unit], [7, "s"]);
});

test("a gait nests a block", () => {
  const b = body("trot\n    halt\n    halt\n");
  eq(b[0].body.length, 2);
});

// -------------------------------------------------------------------- stand

test("stand takes names, not only literals", () => {
  const b = body("stand hold within jitter as held\n    halt\n");
  eq([b[0].duration.type, b[0].within.type, b[0].as], ["Name", "Name", "held"]);
});

test("stand takes literals too", () => {
  const b = body("stand 10s within 20px as held\n    halt\n");
  eq([b[0].duration.type, b[0].within.type], ["Duration", "Distance"]);
});

test("stand otherwise is the broken hold", () => {
  const b = body("stand 10s\n    halt\notherwise\n    balk\n");
  eq(b[0].otherwise.length, 1);
  eq(b[0].otherwise[0].type, "Balk");
});

// ----------------------------------------------------------------- traversal

test("graze binds an element", () => {
  const b = body("graze targets as t\n    halt\n");
  eq([b[0].type, b[0].as], ["Graze", "t"]);
  eq(b[0].source.type, "Name");
});

test("forage declares a depleting source", () => {
  const b = body("forage deck of 1 through 438 regrows\n");
  eq([b[0].type, b[0].name, b[0].regrows], ["Forage", "deck", true]);
  eq(b[0].source.type, "Range");
});

test("forage without regrows", () => {
  const b = body("forage deck of 1 through 5\n");
  eq(b[0].regrows, false);
});

// ------------------------------------------------------------------ weather

test("weather requires a named condition", () => {
  const b = body("cue a\n    when weather.wet > 0.5\n        balk\n    release\n");
  const test_ = b[0].body[0].test;
  eq(test_.left.type, "Weather");
  eq(test_.left.condition, "wet");
});

test("bare weather is rejected", () => {
  const e = errs("cue a\n    when weather > 0.5\n        balk\n    release\n");
  eq(/no scalar weather/.test(e[0]), true);
});

test("an unknown condition is rejected", () => {
  const e = errs("cue a\n    when weather.balmy > 0.5\n        balk\n    release\n");
  eq(/not a weather condition/.test(e[0]), true);
});

// ----------------------------------------------------------------- contexts

test("a context holds handlers", () => {
  const b = body("context room\n    hears snort\n        blank\n    hears squeal\n        halt\n");
  eq(b[0].type, "Context");
  eq(b[0].handlers.map((h) => h.signal), ["snort", "squeal"]);
});

test("a context with no handlers is rejected", () => {
  const e = errs("context room\n    halt\n");
  eq(e.length >= 1, true);
});

test("hears outside a context is rejected", () => {
  const e = errs("hears snort\n    blank\n");
  eq(/only legal inside a context/.test(e[0]), true);
});

// ------------------------------------------------------------------- failure

test("spook habituates", () => {
  const b = body("cue a\n    spook at network\n        shy\n    habituates after 3\n    release\n");
  const sp = b[0].body[0];
  eq([sp.type, sp.habituates], ["Spook", 3]);
});

test("flood cannot habituate", () => {
  const e = errs("cue a\n    flood at network\n        shy\n    habituates after 3\n    release\n");
  eq(/cannot habituate/.test(e[0]), true);
});

test("refusals are their own nodes", () => {
  const b = body("cue a\n    balk\n");
  eq(b[0].body[0].type, "Balk");
});

// ---------------------------------------------------------------- application

test("application is flat, not nested", () => {
  const b = body("cue a\n    develop x y\n");
  const call = b[0].body[0].expression;
  eq(call.type, "Call");
  eq(call.args.length, 2);
  eq(call.args.map((a) => a.name), ["x", "y"]);
});

test("nesting requires parentheses", () => {
  const b = body("cue a\n    develop (surface x)\n");
  const call = b[0].body[0].expression;
  eq(call.args.length, 1);
  eq(call.args[0].type, "Call");
});

test("a parenthesised lone name is a zero-argument call", () => {
  const b = body("cue a\n    fade-in (draw)\n");
  const call = b[0].body[0].expression;
  eq(call.args[0].type, "Call");
  eq(call.args[0].args, []);
});

test("a bare name passes the cue itself", () => {
  const b = body("cue a\n    fade-in draw\n");
  const call = b[0].body[0].expression;
  eq(call.args[0].type, "Name");
});

test("interop reaches camelCase members", () => {
  const b = body('cue a\n    remember s as hands.document.createElement "div"\n    release\n');
  const call = b[0].body[0].value;
  eq(call.type, "Call");
  eq(call.callee.name, "createElement");
  eq(call.args[0].type, "Text");
});

test("member-path assignment", () => {
  const b = body("cue a\n    sheet.style.opacity becomes 0\n");
  const asg = b[0].body[0];
  eq(asg.type, "Assign");
  eq(asg.target.type, "Member");
  eq(asg.target.name, "opacity");
});

// ---------------------------------------------------------------- expressions

test("logical precedence: not binds tighter than and, and tighter than or", () => {
  const b = body("cue a\n    when not a and b or c\n        balk\n    release\n");
  const t = b[0].body[0].test;
  eq(t.op, "or");
  eq(t.left.op, "and");
  eq(t.left.left.type, "Not");
});

test("arithmetic precedence", () => {
  const b = body("cue a\n    remember x as 1 + 2 * 3\n    release\n");
  const v = b[0].body[0].value;
  eq([v.op, v.right.op], ["+", "*"]);
});

test("a list holds elements, not applications", () => {
  const b = body('cue a\n    remember x as ["a" "b"]\n    release\n');
  eq(b[0].body[0].value.items.length, 2);
});

test("a nested list", () => {
  const b = body('cue a\n    remember x as [["a" "b"] ["c" "d"]]\n    release\n');
  const v = b[0].body[0].value;
  eq(v.items.length, 2);
  eq(v.items[0].items.length, 2);
});

test("flehmen takes a lateral modifier", () => {
  const b = body("cue a\n    remember x as flehmen y from the left\n    release\n");
  const f = b[0].body[0].value;
  eq([f.type, f.lateral], ["Flehmen", "left"]);
});

test("recognise is its own node", () => {
  const b = body("cue a\n    remember x as recognise query\n    release\n");
  eq(b[0].body[0].value.type, "Recognise");
});

// ------------------------------------------------------------- error budget

test("parse errors are capped", () => {
  const r = run("^ a b ^\n^ c d ^\n^ e f ^\n^ g h ^\n^ i j ^\n");
  eq(r.errors.length, 3);
  eq(r.suppressedErrors > 0, true);
});

// ---------------------------------------------------------------- examples

test("every example file parses clean", () => {
  const dir = join(here, "..", "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".horse"));
  if (files.length === 0) throw new Error("no example files found");
  const bad = [];
  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    const lex = tokenize(src, f);
    if (lex.errors.length) {
      bad.push(`${f}: LEX ${lex.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
      continue;
    }
    const r = parse(lex.tokens, f);
    if (r.errors.length) {
      bad.push(`${f}: ${r.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
    }
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

// -------------------------------------------------------------------- done

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);
