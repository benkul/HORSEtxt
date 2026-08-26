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
//
// A .horse file is read whole. An .html file has its inline
// <script type="text/horse"> blocks extracted and checked individually — that is
// where source actually lives, since it has to be inline for View Source to show it.

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

// Every inline block in an HTML page, with the line it starts on so that reported
// positions point into the page rather than into an extracted fragment.
function blocksIn(html) {
  const out = [];
  const re = /<script\b[^>]*type=["']text\/horse["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const before = html.slice(0, m.index);
    const openLines = m[0].slice(0, m[0].indexOf(">") + 1).split("\n").length - 1;
    const nameMatch = /data-name=["']([^"']+)["']/i.exec(m[0]);
    out.push({
      source: m[1],
      name: nameMatch ? nameMatch[1] : `inline-${out.length + 1}.horse`,
      line: before.split("\n").length + openLines,
    });
  }
  return out;
}

// `offset` shifts reported lines so a block extracted from a page still points at
// the page. A block that starts on line 640 should say 640-something.
function front(label, src, offset = 0) {
  const shift = (list) => list.map((e) => ({ ...e, line: e.line + offset }));

  const lex = tokenize(src, label);
  if (report(label, shift(lex.errors), lex.suppressedErrors)) return null;
  const p = parse(lex.tokens, label);
  if (report(label, shift(p.errors), p.suppressedErrors)) return null;
  const r = resolve(p.ast, label);
  report(label, shift(r.warnings), r.suppressedWarnings, "warning");
  if (report(label, shift(r.errors), r.suppressedErrors)) return null;
  return { src, tokens: lex.tokens, ast: p.ast };
}

// One .horse file, or every inline block in an HTML page.
function piecesOf(file) {
  const text = readFileSync(file, "utf8");
  if (!/\.html?$/i.test(file)) return [{ label: file, source: text, offset: 0 }];

  const found = blocksIn(text);
  if (found.length === 0) {
    process.stderr.write(`${file}: no <script type="text/horse"> blocks\n`);
    return [];
  }
  return found.map((b) => ({
    label: `${file} (${b.name})`,
    source: b.source,
    offset: b.line,
  }));
}

let failed = false;

for (const file of files) {
  const pieces = piecesOf(file);
  if (pieces.length === 0) failed = true;

  for (const piece of pieces) {
    const r = front(piece.label, piece.source, piece.offset);
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
        process.stdout.write(emit(r.ast, piece.label));
      } catch (e) {
        process.stderr.write(`${piece.label}: ${e.message}\n`);
        failed = true;
      }
      continue;
    }

    process.stderr.write(`unknown command ${JSON.stringify(command)}\n`);
    process.exit(2);
  }
}

process.exit(failed ? 1 : 0);
