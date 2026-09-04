// HORSEtxt in the page.
//
// This is the delivery model the whole architecture exists for: `.horse` source is
// delivered inline, so a visitor who opens View Source reads HORSEtxt rather than
// its output. Nothing is precompiled and nothing is committed.
//
//   <script type="text/horse">
//   band gallery
//       ...
//   </script>
//   <script type="module" src="horsetxt/browser.js"></script>
//
// A <script> with an unrecognised MIME type is inert: the browser does not parse it,
// does not execute it, and reports nothing. It is a data block, which is also why the
// page can read its own source back out of the DOM.

import { tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { resolve } from "./resolve.js";
import { emit } from "./emit.js";
import { Horse, Balk, Leave, Halted, Released } from "./runtime.js";

const TYPE = 'script[type="text/horse"]';

// `new Function` cannot build an async function, and an ES module cannot be built
// from a string at all. This can do both.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Errors are reported below the tolerance threshold. Flooding produces learned
// helplessness — BIBLIOGRAPHY.md, habituation.
const MAX_REPORTED = 3;

// ------------------------------------------------------------------------- the host
//
// What the runtime asks the page for. The runtime never touches the DOM itself.

export function browserHost(options = {}) {
  const doc = options.document || globalThis.document;
  const root = doc && doc.documentElement;

  // Where the pointer is, so a `stand` can tell whether it moved. Tracked passively:
  // a stand is the animal holding still, not a widget waiting to be clicked.
  let pointer = null;
  const track = (e) => {
    const p = (e.touches && e.touches[0]) || e;
    if (p && typeof p.clientX === "number") pointer = { x: p.clientX, y: p.clientY };
  };
  if (doc) {
    for (const type of ["pointermove", "pointerdown", "touchstart", "touchmove", "mousemove"]) {
      doc.addEventListener(type, track, { passive: true });
    }
  }

  // Which channels the last chord wrote, so the next one can clear what it does not say.
  let written = new Set();

  let stopped = false;
  if (globalThis.addEventListener) {
    globalThis.addEventListener("beforeunload", () => { stopped = true; });
  }

  return {
    stop: () => stopped,

    // A chord is an utterance, and ears are attention — so the page can style itself
    // from the posture. `data-ears="agonistic"` is a real selector.
    //
    // A chord is *one* utterance and its channels are simultaneous (§4), so the face
    // is only what this chord says. A channel the chord does not name is cleared:
    // leaving the last one behind would assert a state no chord ever uttered, and a
    // page reading `data-lids` could not tell a held position from a stale one.
    onChord(posture) {
      if (!root) return;
      const named = new Set();
      root.setAttribute("data-ears", posture.ears);
      named.add("ears");
      for (const s of posture.states) {
        if (!s.channel) continue;
        root.setAttribute(`data-${s.channel}`, describe(s.value));
        named.add(s.channel);
      }
      for (const channel of written) {
        if (!named.has(channel)) root.removeAttribute(`data-${channel}`);
      }
      written = named;
    },

    onWatch() { /* the sentinel's business, not the page's */ },

    // What the animal has to say while it is running. Compile errors are the page
    // author's; these are the running program's, and until v0.5 they were collected
    // and dropped — the one-second contract, the band-size lint and the empty stall
    // all went into an array nothing ever read.
    //
    // Said once each, when they happen. Nothing here repeats: a late release is one
    // note per release, and the boundary speaks at the limit and then habituates.
    onNote(note) {
      if (!globalThis.console) return;
      console.log(`%cHORSEtxt%c ${note.message}`, "font-weight:bold", "font-weight:normal");
      if (note.citation) console.log(`  ${note.citation}`);
    },

    // The hold. Stay within `jitter` of where the pointer was for `ms`, and report
    // progress the whole way so a rising tension is expressible.
    //
    // With no pointer yet, it waits for one. A horse standing still waits.
    async hold({ ms, jitter, onProgress }) {
      if (!globalThis.requestAnimationFrame) return false;

      const start = await firstPointer();
      if (!start) return false;

      return new Promise((settle) => {
        const began = performance.now();
        let reporting = false;

        const tick = async () => {
          if (stopped) return settle(false);

          const now = pointer || start;
          const drifted =
            Math.abs(now.x - start.x) > jitter || Math.abs(now.y - start.y) > jitter;
          if (drifted) return settle(false);

          const elapsed = performance.now() - began;
          const t = ms > 0 ? Math.min(elapsed / ms, 1) : 1;

          // Skip a frame rather than overlap: the body is an async cue and may take
          // longer than one frame.
          if (onProgress && !reporting) {
            reporting = true;
            Promise.resolve(onProgress(t)).catch(() => {}).finally(() => { reporting = false; });
          }

          if (t >= 1) return settle(true);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      function firstPointer() {
        if (pointer) return Promise.resolve(pointer);
        if (!doc) return Promise.resolve(null);
        return new Promise((got) => {
          const once = () => {
            doc.removeEventListener("pointermove", once);
            doc.removeEventListener("pointerdown", once);
            doc.removeEventListener("touchstart", once);
            got(pointer);
          };
          doc.addEventListener("pointermove", once, { passive: true, once: true });
          doc.addEventListener("pointerdown", once, { passive: true, once: true });
          doc.addEventListener("touchstart", once, { passive: true, once: true });
        });
      }
    },
  };
}

function describe(value) {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value.state) return value.state;
    if (value.facs) return value.facs;
    if (typeof value.arousal === "number") return `${value.arousal}:${value.valence}`;
  }
  return String(value);
}

// ------------------------------------------------------------------------ compiling

export function compile(source, filename, options = {}) {
  const lex = tokenize(source, filename);
  if (lex.errors.length) {
    return { errors: lex.errors, suppressed: lex.suppressedErrors, warnings: [] };
  }
  const parsed = parse(lex.tokens, filename);
  if (parsed.errors.length) {
    return { errors: parsed.errors, suppressed: parsed.suppressedErrors, warnings: [] };
  }
  const resolved = resolve(parsed.ast, filename);
  if (resolved.errors.length) {
    return {
      errors: resolved.errors,
      suppressed: resolved.suppressedErrors,
      warnings: resolved.warnings,
    };
  }
  const code = emit(parsed.ast, filename, { wrap: options.wrap || "body" });
  return { code, errors: [], warnings: resolved.warnings, suppressed: 0 };
}

// ------------------------------------------------------------------------ running

export async function runSource(source, filename, host) {
  const out = compile(source, filename);
  if (out.errors.length) return { ...out, ran: false };

  const program = new AsyncFunction("H", out.code);
  const H = new Horse(host || browserHost());
  try {
    await program(H);
    return { ...out, ran: true, left: false, horse: H };
  } catch (e) {
    // Balking and leaving are terminal successes travelling out through the same
    // channel an error would use. They are not failures and are not reported.
    if (e instanceof Leave) return { ...out, ran: true, left: true, horse: H };
    if (e instanceof Balk) return { ...out, ran: true, refused: true, horse: H };
    if (e instanceof Released || e instanceof Halted) {
      return { ...out, ran: true, left: false, horse: H };
    }
    return { ...out, ran: true, threw: e, horse: H };
  } finally {
    // Past here the program is over and the animal is still standing there. Anything
    // that calls back in -- a listener, a host, a cue the page was handed -- reaches
    // a horse with nothing left to leave. §11a.
    H.standing = true;
  }
}

// ------------------------------------------------------------------------- the loader

export function blocks(doc = globalThis.document) {
  return doc ? Array.from(doc.querySelectorAll(TYPE)) : [];
}

// A block's name, for devtools and for error reports. `data-name` if it has one,
// otherwise its position, because most blocks will not have one.
function nameOf(el, i) {
  return el.getAttribute("data-name") || `inline-${i + 1}.horse`;
}

export async function load(options = {}) {
  const doc = options.document || globalThis.document;
  const found = blocks(doc);
  const results = [];
  const host = options.host || browserHost({ document: doc });

  for (let i = 0; i < found.length; i++) {
    const el = found[i];
    const name = nameOf(el, i);
    const source = el.textContent || "";

    const result = await runSource(source, name, host);
    results.push({ name, ...result });

    if (result.errors.length) reportErrors(name, result.errors, result.suppressed);
    else if (result.warnings.length) reportWarnings(name, result.warnings);
    if (result.threw) reportThrow(name, result.threw);
    // A block that failed does not stop the ones after it. Some things only work
    // sometimes.
  }
  return results;
}

// ---------------------------------------------------------------------- reporting
//
// Citations, not explanations. The manual is the bibliography.

function head(name, kind) {
  return [`%cHORSEtxt%c ${kind} in ${name}`, "font-weight:bold", "font-weight:normal"];
}

function reportErrors(name, errors, suppressed) {
  if (!globalThis.console) return;
  console.groupCollapsed(...head(name, "did not compile"));
  for (const e of errors.slice(0, MAX_REPORTED)) {
    console.log(`${e.line}:${e.col}  ${e.message}`);
    if (e.citation) console.log(`  ${e.citation}`);
    else if (e.section) console.log(`  GRAMMAR.md ${e.section}`);
  }
  if (suppressed > 0) console.log(`${suppressed} more, not shown.`);
  console.groupEnd();
}

function reportWarnings(name, warnings) {
  if (!globalThis.console) return;
  console.groupCollapsed(...head(name, "compiled with notes"));
  for (const w of warnings.slice(0, MAX_REPORTED)) {
    console.log(`${w.line}:${w.col}  ${w.message}`);
    if (w.citation) console.log(`  ${w.citation}`);
  }
  console.groupEnd();
}

function reportThrow(name, err) {
  if (!globalThis.console) return;
  console.groupCollapsed(...head(name, "stopped"));
  console.log(err);
  console.groupEnd();
}

// -------------------------------------------------------------------------- exposure
//
// The page can read its own source back: `.horse` blocks are inert data in the DOM,
// so a page may display, quote, misquote, or withhold the program that runs it.

export const HORSEtxt = { compile, runSource, load, blocks, browserHost, Horse };

if (globalThis.document) {
  globalThis.HORSEtxt = HORSEtxt;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => load());
  } else {
    load();
  }
}
