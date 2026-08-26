// node test/lexer.test.js
// No framework, no dependencies — there is no build step.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tokenize, T } from "../src/lexer.js";

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

// Token types only, dropping the trailing NEWLINE/EOF noise.
function types(src) {
  return tokenize(src).tokens.map((t) => t.type);
}
function values(src) {
  return tokenize(src).tokens.filter(
    (t) => t.type !== T.NEWLINE && t.type !== T.EOF &&
           t.type !== T.INDENT && t.type !== T.DEDENT,
  ).map((t) => t.value);
}
function errs(src) {
  return tokenize(src).errors.map((e) => e.message);
}

// ---------------------------------------------------------------- identifiers

test("hyphen joins an identifier", () => {
  eq(values("fade-in"), ["fade-in"]);
});

test("spaced hyphen is subtraction", () => {
  eq(values("a - b"), ["a", "-", "b"]);
});

test("trailing hyphen does not join", () => {
  eq(values("a- b"), ["a", "-", "b"]);
});

test("keyword is a keyword", () => {
  eq(types("walk").slice(0, 1), [T.KEYWORD]);
});

test("a word after a dot is an identifier, not a keyword", () => {
  const t = tokenize("deck.graze").tokens;
  eq([t[0].type, t[1].type, t[2].type], [T.IDENT, T.DOT, T.IDENT]);
});

test("weather conditions are members, not reserved", () => {
  eq(values("wind becomes 1"), ["wind", "becomes", 1]);
});

// ---------------------------------------------------------------------- upper

test("EquiFACS codes lex as FACS", () => {
  for (const code of ["AU101", "AUH13", "EAD103L", "AD38", "AU5"]) {
    const t = tokenize(code).tokens;
    eq(t[0].type, T.FACS, code);
    eq(t[0].value, code, code);
  }
});

test("alleles lex as ALLELE", () => {
  eq(tokenize("AA").tokens[0].type, T.ALLELE);
  eq(tokenize("CA").tokens[0].type, T.ALLELE);
});

test("other uppercase is an error", () => {
  eq(errs("FOO").length, 1);
});

// -------------------------------------------------------------------- numbers

test("durations and distances", () => {
  const t = tokenize("10s 900ms 20px 50% 7").tokens;
  eq(t[0].type, T.DURATION);
  eq(t[0].value, { value: 10, unit: "s" });
  eq(t[1].value, { value: 900, unit: "ms" });
  eq(t[2].value, { value: 20, unit: "px" });
  eq(t[3].value, { value: 50, unit: "%" });
  eq(t[4].type, T.NUMBER);
});

test("a suffix does not swallow an identifier", () => {
  const t = tokenize("10sec").tokens;
  eq([t[0].type, t[1].type], [T.NUMBER, T.IDENT]);
  eq([t[0].value, t[1].value], [10, "sec"]);
});

test("decimals", () => {
  eq(values("0.301"), [0.301]);
});

// --------------------------------------------------------------------- graded

test("the graded mark is its own token", () => {
  const t = tokenize("~0.3").tokens;
  eq([t[0].type, t[1].type], [T.TILDE, T.NUMBER]);
  eq(t[1].value, 0.3);
});

test("a graded operand may be a name, not only a literal", () => {
  const t = tokenize("~held").tokens;
  eq([t[0].type, t[1].type], [T.TILDE, T.IDENT]);
  eq(t[1].value, "held");
});

test("a graded operand may be parenthesised", () => {
  eq(types("~(a + b)").slice(0, 2), [T.TILDE, T.LPAREN]);
});

test("affect is graded colon graded", () => {
  const t = tokenize("~0.8:~-0.3").tokens;
  eq(
    [t[0].type, t[1].type, t[2].type, t[3].type, t[4].type],
    [T.TILDE, T.NUMBER, T.COLON, T.TILDE, T.OP],
  );
});

// --------------------------------------------------------------------- interop

test("member names may be camelCase so interop can reach JavaScript", () => {
  const t = tokenize("hands.document.createElement").tokens;
  eq([t[0].type, t[2].type, t[4].type], [T.KEYWORD, T.IDENT, T.IDENT]);
  eq([t[2].value, t[4].value], ["document", "createElement"]);
});

test("an uppercase-initial member is a name, not a FACS code", () => {
  const t = tokenize("hands.AudioContext").tokens;
  eq(t[2].type, T.IDENT);
  eq(t[2].value, "AudioContext");
  eq(errs("hands.AudioContext").length, 0);
});

test("a FACS code outside member position is still a FACS code", () => {
  eq(tokenize("AU101").tokens[0].type, T.FACS);
});

// ---------------------------------------------------------------------- ears

test("a chord opens and closes", () => {
  const t = tokenize("^ ears forward ^").tokens;
  eq(t[0].type, T.EAR_OPEN);
  eq(t[t.length - 3].type, T.EAR_CLOSE);
});

test("a flattened ear is an ear, not an identifier", () => {
  const t = tokenize("_ ears back _").tokens;
  eq([t[0].type, t[0].value], [T.EAR_OPEN, "_"]);
});

test("mixed ears are allowed and recorded", () => {
  const ears = tokenize("^ tension ~0.1 _").tokens
    .filter((t) => t.type === T.EAR_OPEN || t.type === T.EAR_CLOSE);
  eq(ears.map((t) => [t.type, t.value]), [[T.EAR_OPEN, "^"], [T.EAR_CLOSE, "_"]]);
});

test("underscore still lives inside an identifier", () => {
  eq(values("foo_bar"), ["foo_bar"]);
});

test("newlines are suppressed inside a chord", () => {
  const t = types("^ ears forward\n  head ~0.2 ^\n");
  eq(t.includes(T.INDENT), false, "no INDENT inside a chord");
  eq(t.filter((x) => x === T.NEWLINE).length, 1, "one NEWLINE, after the chord");
});

test("an unclosed chord is reported", () => {
  eq(errs("^ ears forward\n").length, 1);
});

// ------------------------------------------------------------------- brackets

test("newlines are suppressed inside a list", () => {
  const t = types('[\n  "a"\n  "b"\n]\n');
  eq(t.includes(T.INDENT), false);
  eq(t.filter((x) => x === T.NEWLINE).length, 1);
});

test("unmatched closer is reported", () => {
  eq(errs("a]").length, 1);
});

// ---------------------------------------------------------------- indentation

test("indent and dedent", () => {
  const t = types("cue a\n    walk\n        halt\nband b\n");
  eq(t, [
    T.KEYWORD, T.IDENT, T.NEWLINE,
    T.INDENT, T.KEYWORD, T.NEWLINE,
    T.INDENT, T.KEYWORD, T.NEWLINE,
    T.DEDENT, T.DEDENT, T.KEYWORD, T.IDENT, T.NEWLINE,
    T.EOF,
  ]);
});

test("blank and comment-only lines carry no layout", () => {
  const t = types("cue a\n\n    # just a note\n\n    halt\n");
  eq(t.filter((x) => x === T.INDENT).length, 1);
  eq(t.filter((x) => x === T.NEWLINE).length, 2);
});

test("dangling dedents are emitted at end of file", () => {
  const t = types("cue a\n    walk\n");
  eq(t[t.length - 2], T.DEDENT);
  eq(t[t.length - 1], T.EOF);
});

test("a misaligned dedent is reported", () => {
  eq(errs("cue a\n        walk\n    halt\n").length, 1);
});

test("a tab in leading whitespace is reported", () => {
  eq(errs("cue a\n\twalk\n").length, 1);
});

// ------------------------------------------------------------------- strings

test("strings have no escapes", () => {
  eq(values('"a\\b"'), ["a\\b"]);
});

test("an unterminated string is reported", () => {
  eq(errs('"abc\n').length, 1);
});

// --------------------------------------------------------------------- ascii

test("non-ASCII is rejected", () => {
  const e = errs("cue tölt\n");
  eq(e.length, 1);
  eq(/non-ASCII/.test(e[0]), true);
});

// -------------------------------------------------------------- error budget

test("errors are capped below the tolerance threshold", () => {
  const r = tokenize("FOO BAR BAZ QUX QUUX");
  eq(r.errors.length, 3);
  eq(r.suppressedErrors, 2);
});

// ------------------------------------------------------------------ examples

test("every example file lexes clean", () => {
  const dir = join(here, "..", "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".horse"));
  if (files.length === 0) throw new Error("no example files found");
  const bad = [];
  for (const f of files) {
    const r = tokenize(readFileSync(join(dir, f), "utf8"), f);
    if (r.errors.length) {
      bad.push(`${f}: ${r.errors.map((e) => `${e.line}:${e.col} ${e.message}`).join("; ")}`);
    }
  }
  if (bad.length) throw new Error(bad.join("\n  "));
});

// ---------------------------------------------------------------------- done

console.log(`${pass} passed, ${failures.length} failed`);
for (const f of failures) {
  console.log(`\nFAIL  ${f.name}\n  ${f.message.replace(/\n/g, "\n  ")}`);
}
process.exit(failures.length ? 1 : 0);
