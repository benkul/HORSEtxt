// node test/resolve.test.js

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/resolve.js";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const failures = [];

function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { failures.push({ name, message: e.message }); }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what || "value"}\n  expected ${b}\n  got      ${a}`);
}
function ok(cond, what) { if (!cond) throw new Error(what || "expected truthy"); }

function analyse(src) {
  const lex = tokenize(src, "t.horse");
  if (lex.errors.length) throw new Error(`lex: ${lex.errors.map((e) => e.message).join("; ")}`);
  const p = parse(lex.tokens, "t.horse");
  if (p.errors.length) {
    throw new Error(`parse: ${p.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
  }
  const r = resolve(p.ast, "t.horse");
  return { ...r, ast: p.ast };
}

const msgs = (src) => analyse(src).errors.map((e) => e.message);
const warns = (src) => analyse(src).warnings.map((e) => e.message);
const clean = (src) => {
  const r = analyse(src);
  if (r.errors.length) throw new Error(`unexpected: ${r.errors.map((e) => e.message).join("; ")}`);
  return r;
};

// A cue body that names an outcome, for tests about something else.
const B = "        release\n";

// ------------------------------------------------------------------------ names

test("an undefined name is reported", () => {
  const e = msgs(`band a\n    cue go\n        remember x as missing\n${B}`);
  ok(/"missing" is not declared/.test(e[0]), e[0]);
});

test("a declaration is visible before its own line", () => {
  clean([
    "band a",
    "    cue first",
    "        release second",   // declared below
    "    cue second",
    "        release 1",
    "",
  ].join("\n"));
});

test("a duplicate declaration in one scope is reported", () => {
  const e = msgs("band a\n    cue go\n        release\n    cue go\n        release\n");
  ok(/declared twice/.test(e[0]), e[0]);
});

test("a parameter is in scope in its cue", () => {
  clean("band a\n    cue go n\n        release n\n");
});

test("a parameter is not in scope outside it", () => {
  const e = msgs("band a\n    cue go n\n        release n\n    cue other\n        release n\n");
  ok(/"n" is not declared/.test(e[0]), e[0]);
});

test("graze binds its element inside the body only", () => {
  clean("band a\n    cue go xs\n        graze xs as x\n            release x\n        release\n");
  const e = msgs("band a\n    cue go xs\n        graze xs as x\n            release\n        release x\n");
  ok(/"x" is not declared/.test(e[0]), e[0]);
});

test("a stand's progress belongs to the hold, not to the broken hold", () => {
  clean([
    "band a", "    cue go",
    "        stand 10s within 20px as held",
    "            ^ tension ~held ^",
    "        release", "",
  ].join("\n"));
  const e = msgs([
    "band a", "    cue go",
    "        stand 10s within 20px as held",
    "            blank",
    "        otherwise",
    "            release held",
    "        release", "",
  ].join("\n"));
  ok(/"held" is not declared/.test(e[0]), e[0]);
});

// ------------------------------------------------------------------------ calls

test("arity is checked against a known cue", () => {
  const e = msgs("band a\n    cue one n\n        release n\n    cue go\n        release one 1 2\n");
  ok(/takes 1 argument, given 2/.test(e[0]), e[0]);
});

test("calling something that is not a cue is reported", () => {
  const e = msgs('band a\n    pile p at "k"\n    cue go\n        release p 1\n');
  ok(/is not a cue/.test(e[0]), e[0]);
});

test("a member call is not arity-checked", () => {
  clean('band a\n    cue go\n        release hands.JSON.stringify 1\n');
});

// ------------------------------------------------------------- cue termination

test("a cue that can fall off its end is reported", () => {
  const e = msgs("band a\n    cue go\n        halt\n");
  ok(/without naming an outcome/.test(e[0]), e[0]);
});

test("release, balk, leave and blank all terminate", () => {
  for (const k of ["release", "balk", "leave", "blank"]) {
    clean(`band a\n    cue go\n        ${k}\n`);
  }
});

test("a when terminates only when both arms do", () => {
  clean([
    "band a", "    cue go",
    "        when 1 > 0",
    "            release 1",
    "        otherwise",
    "            balk", "",
  ].join("\n"));
  const e = msgs([
    "band a", "    cue go",
    "        when 1 > 0",
    "            release 1", "",
  ].join("\n"));
  ok(/without naming an outcome/.test(e[0]), e[0]);
});

test("an early release still terminates, even followed by a spook", () => {
  clean([
    "band a", "    cue go",
    "        release 1",
    '        spook at "network"',
    "            shy", "",
  ].join("\n"));
});

// ---------------------------------------------------------------- signals (§8)

test("a bare name becomes an emission when a hears introduces it", () => {
  const r = clean([
    "band a", "    cue go",
    "        context room",
    "            hears creak",
    "                blank",
    "        creak",
    "        release", "",
  ].join("\n"));
  const cue = r.ast.body[0].body[0];
  const stmts = cue.body;
  const emitted = stmts.find((s) => s.type === "Emission");
  ok(emitted, `expected an Emission, got ${stmts.map((s) => s.type).join(",")}`);
  eq(emitted.signal, "creak");
});

test("a handler declared after the emission still resolves it", () => {
  const r = clean([
    "band a", "    cue go",
    "        creak",
    "        release",
    "    cue elsewhere",
    "        context room",
    "            hears creak",
    "                blank",
    "        release", "",
  ].join("\n"));
  const go = r.ast.body[0].body[0];
  ok(go.body.some((s) => s.type === "Emission"), "resolved across the file");
});

test("a bare name with no hears and no declaration is undefined", () => {
  const e = msgs("band a\n    cue go\n        creak\n        release\n");
  ok(/"creak" is not declared/.test(e[0]), e[0]);
});

test("a signal may carry one value", () => {
  const r = clean([
    "band a", "    cue go",
    "        context room",
    "            hears creak",
    "                blank",
    "        creak 1",
    "        release", "",
  ].join("\n"));
  const em = r.ast.body[0].body[0].body.find((s) => s.type === "Emission");
  eq(em.value.value, 1);
});

test("a built-in signal needs no declaration", () => {
  clean("band a\n    cue go\n        snort\n        release\n");
});

// --------------------------------------------------------------------- genotype

test("pace without the AA allele is a compile error", () => {
  const e = msgs("band a\n    cue go\n        pace\n            halt\n        release\n");
  ok(/AA allele/.test(e[0]), e[0]);
});

test("pace with AA is fine", () => {
  clean("genotype AA\nband a\n    cue go\n        pace\n            halt\n        release\n");
});

test("tolt without an Icelandic is a compile error", () => {
  const e = msgs("genotype AA\nband a\n    cue go\n        tolt\n            halt\n        release\n");
  ok(/Icelandic/.test(e[0]), e[0]);
});

test("every gait can be held, not only tolt", () => {
  clean("band a\n    cue go\n        walk every 7s\n            halt\n        release\n");
  clean("band a\n    cue go\n        gallop every 100ms\n            halt\n        release\n");
});

// ------------------------------------------------------------------------ types

test("stand wants a duration and a distance", () => {
  const e = msgs("band a\n    cue go\n        stand 20px\n            blank\n        release\n");
  ok(/needs a duration/.test(e[0]), e[0]);
  const e2 = msgs("band a\n    cue go\n        stand 10s within 3s\n            blank\n        release\n");
  ok(/needs a distance/.test(e2[0]), e2[0]);
});

test("every wants a duration", () => {
  const e = msgs("band a\n    cue go\n        walk every 20px\n            halt\n        release\n");
  ok(/needs a duration/.test(e[0]), e[0]);
});

// --------------------------------------------------------------------- warnings

test("an oversized band warns with its citation", () => {
  const src = ["band big"].concat(
    [1, 2, 3, 4, 5].map((n) => `    cue c${n}\n        release`),
  ).join("\n") + "\n";
  const w = analyse(src).warnings;
  ok(/2-4 mares/.test(w[0].message), w[0].message);
  ok(/IFCE/.test(w[0].citation), w[0].citation);
});

test("a held gait with no way out warns", () => {
  const w = warns("band a\n    cue go\n        walk every 7s\n            blank\n        release\n");
  ok(/nothing to stop it/.test(w[0]), w[0]);
});

test("a held gait with a halt does not warn", () => {
  const w = warns([
    "band a", "    cue go",
    "        walk every 7s",
    "            when 1 > 0",
    "                halt",
    "        release", "",
  ].join("\n"));
  eq(w, []);
});

test("a held gait with a leave does not warn", () => {
  const w = warns([
    "band a", "    cue go",
    "        walk every 7s",
    "            when 1 > 0",
    "                leave",
    "        release", "",
  ].join("\n"));
  eq(w, []);
});

test("an unheld gait is not a loop and is not warned about", () => {
  const w = warns("band a\n    cue go\n        walk\n            blank\n        release\n");
  eq(w, []);
});

test("flood warns about learned helplessness", () => {
  const w = warns([
    "band a", "    cue go",
    '        flood at "network"',
    "            shy",
    "        release", "",
  ].join("\n"));
  ok(/learned helplessness/.test(w[0]), w[0]);
});

test("a bare cue name as a statement warns that it is not a call", () => {
  const w = warns([
    "band a",
    "    cue other",
    "        release 1",
    "    cue go",
    "        other",
    "        release", "",
  ].join("\n"));
  ok(/is the cue, not a call/.test(w[0]), w[0]);
});

// --------------------------------------------------------------------- examples

test("every example resolves clean", () => {
  const dir = join(here, "..", "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".horse"));
  if (!files.length) throw new Error("no examples");
  const bad = [];
  for (const f of files) {
    const src = readFileSync(join(dir, f), "utf8");
    const lex = tokenize(src, f);
    const p = parse(lex.tokens, f);
    const r = resolve(p.ast, f);
    if (lex.errors.length || p.errors.length || r.errors.length) {
      const all = [...lex.errors, ...p.errors, ...r.errors];
      bad.push(`${f}: ${all.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
    }
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

// ------------------------------------------------------------------------ done

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);
