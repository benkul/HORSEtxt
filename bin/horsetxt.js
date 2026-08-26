#!/usr/bin/env node
//
// horsetxt — the command line tool.
//
// Its job is validation, not deployment. Nothing it emits is meant to be committed
// or served: the compiler runs in the page, and `.horse` source is delivered inline
// so that View Source shows HORSEtxt. This exists so a syntax error cannot ship.
//
//   horsetxt check <file...>     report errors, print nothing on success
//   horsetxt emit <file>         print the JavaScript
//   horsetxt tokens <file>       print the token stream

import { readFileSync } from "node:fs";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";
import { resolve } from "../src/resolve.js";
import { emit } from "../src/emit.js";

const [command, ...files] = process.argv.slice(2);

if (!command || files.length === 0) {
  process.stderr.write("usage: horsetxt <check|emit|tokens> <file...>\n");
  process.exit(2);
}

// Errors are reported below the tolerance threshold rather than all at once.
// Flooding produces learned helplessness — BIBLIOGRAPHY.md, habituation.
// A citation where there is one, a grammar section otherwise. Nothing explains
// itself: the reference is the explanation.
function report(file, items, suppressed, label) {
  for (const e of items) {
    process.stderr.write(`${file}:${e.line}:${e.col}  ${label ? label + ": " : ""}${e.message}\n`);
    if (e.citation) process.stderr.write(`  ${e.citation}\n`);
    else if (e.section) process.stderr.write(`  GRAMMAR.md ${e.section}\n`);
    process.stderr.write("\n");
  }
  if (suppressed > 0) process.stderr.write(`${suppressed} more, not shown.\n\n`);
  return items.length > 0;
}

function front(file) {
  const src = readFileSync(file, "utf8");
  const lex = tokenize(src, file);
  if (report(file, lex.errors, lex.suppressedErrors)) return null;
  const p = parse(lex.tokens, file);
  if (report(file, p.errors, p.suppressedErrors)) return null;
  const r = resolve(p.ast, file);
  report(file, r.warnings, r.suppressedWarnings, "warning");
  if (report(file, r.errors, r.suppressedErrors)) return null;
  return { src, tokens: lex.tokens, ast: p.ast };
}

let failed = false;

for (const file of files) {
  const r = front(file);
  if (!r) { failed = true; continue; }

  if (command === "check") continue;

  if (command === "tokens") {
    for (const t of r.tokens) {
      const v = typeof t.value === "object" ? JSON.stringify(t.value) : String(t.value);
      process.stdout.write(`${String(t.line).padStart(4)}:${String(t.col).padStart(3)}  ${t.type.padEnd(12)} ${v.replace(/\n/g, "\\n")}\n`);
    }
    continue;
  }

  if (command === "emit") {
    try {
      process.stdout.write(emit(r.ast, file));
    } catch (e) {
      process.stderr.write(`${file}: ${e.message}\n`);
      failed = true;
    }
    continue;
  }

  process.stderr.write(`unknown command ${JSON.stringify(command)}\n`);
  process.exit(2);
}

process.exit(failed ? 1 : 0);
