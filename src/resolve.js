// HORSEtxt resolver. Runs between parse and emit.
//
// It does the work the grammar explicitly deferred to semantic analysis, plus the
// checks that only become possible once names have scopes:
//
//   - undefined and duplicate names
//   - arity on calls to known cues
//   - signal resolution (GRAMMAR.md §8) — a bare name is an emission if a `hears`
//     introduces it, and a call otherwise
//   - every path out of a cue names itself (§3)
//   - genotype gating as a compile error rather than a runtime throw (§2)
//   - duration and distance where the grammar accepted any expression (§5, §7)
//   - the band-size lint and the flooding warning

const MAX_REPORTED = 3;

// One stallion, two to four mares, and offspring.
const NATURAL_BAND = 8;

// Reachable everywhere. `weather` and `hands` are their own AST nodes, so they never
// arrive here as names.
const BUILTIN_SIGNALS = ["whinny", "nicker", "squeal", "snort"];

class Scope {
  constructor(parent, kind) {
    this.parent = parent;
    this.kind = kind;
    this.names = new Map();
  }
  declare(name, info) {
    this.names.set(name, info);
  }
  own(name) {
    return this.names.get(name);
  }
  lookup(name) {
    let s = this;
    while (s) {
      const hit = s.names.get(name);
      if (hit) return hit;
      s = s.parent;
    }
    return null;
  }

  // Whether anything up the chain is a gait. A cue boundary stops the search: a cue
  // called from inside a stride does not know it is in one, and neither does the
  // horse -- the animal that stumbles is the one taking the step.
  within(kind) {
    let s = this;
    while (s && s.kind !== "cue" && s.kind !== "group") {
      if (s.kind === kind) return true;
      s = s.parent;
    }
    return false;
  }

  // Which band in this herd owns a name, if the enclosing band cannot see it.
  homeOf(name) {
    let s = this;
    while (s) {
      if (s.elsewhere) return s.elsewhere(name);
      s = s.parent;
    }
    return null;
  }
}

class Resolver {
  constructor(ast, filename) {
    this.ast = ast;
    this.file = filename || "<anonymous>";
    this.errors = [];
    this.warnings = [];
    this.signals = new Set(BUILTIN_SIGNALS);
    this.genotype = "CA";
    this.breed = null;
  }

  fail(node, message, citation) {
    this.errors.push({ message, citation, line: node.line, col: node.col, file: this.file });
  }
  warn(node, message, citation) {
    this.warnings.push({ message, citation, line: node.line, col: node.col, file: this.file });
  }

  run() {
    if (this.ast.genotype) {
      this.genotype = this.ast.genotype.allele;
      this.breed = this.ast.genotype.breed;
    }
    // Signals are file-wide: a `hears` may appear after the emission it explains,
    // which is exactly why §8 leaves this to semantic analysis.
    this.collectSignals(this.ast.body);

    const top = new Scope(null, "program");
    this.block(this.ast.body, top);

    return {
      errors: this.errors.slice(0, MAX_REPORTED),
      warnings: this.warnings.slice(0, MAX_REPORTED),
      suppressedErrors: Math.max(0, this.errors.length - MAX_REPORTED),
      suppressedWarnings: Math.max(0, this.warnings.length - MAX_REPORTED),
    };
  }

  collectSignals(list) {
    for (const s of list || []) {
      if (!s || typeof s !== "object") continue;
      if (s.type === "Context") {
        for (const h of s.handlers) {
          if (h.signal) this.signals.add(h.signal);
          this.collectSignals(h.body);
        }
        continue;
      }
      for (const key of ["body", "then", "otherwise"]) {
        if (Array.isArray(s[key])) this.collectSignals(s[key]);
      }
    }
  }

  // ------------------------------------------------------------------- blocks

  // Declarations are hoisted within their block, so a cue may name one declared
  // later in the same band. The emitter hoists the same set with `let`.
  // `predeclared` is set for a band of a herd, whose declarations were collected
  // before the crossings could be wired.
  block(list, scope, predeclared = false) {
    if (!predeclared) {
      for (const s of list) {
        const name = s.name;
        if (!name) continue;
        if (s.type === "Cue" || s.type === "Binding" || s.type === "Pile" ||
            s.type === "Forage" || s.type === "Group") {
          const existing = scope.own(name);
          if (existing) {
            this.fail(s, `${JSON.stringify(name)} is declared twice in this scope`);
          }
          scope.declare(name, {
            kind: s.type === "Cue" ? "cue" : s.type.toLowerCase(),
            arity: s.type === "Cue" ? s.params.length : null,
            node: s,
          });
        }
      }
    }

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      // Spook and Context govern the rest of their block, so the remainder is
      // resolved inside them rather than beside them.
      if (s.type === "Spook" || s.type === "Flood") {
        this.statement(s, scope);
        this.block(list.slice(i + 1), new Scope(scope, "guarded"));
        return;
      }
      if (s.type === "Context") {
        this.statement(s, scope);
        this.block(list.slice(i + 1), new Scope(scope, "context"));
        return;
      }
      this.statement(s, scope);
    }
  }

  // -------------------------------------------------------------------- herds
  //
  // Units nested in a herd, which is what the drone survey found: association
  // rates are bimodal, and inter-unit distances are closer than chance. Units
  // hold their boundaries — becoming more cohesive as another approaches, and
  // elongating to avoid crossing — while particular pairs cross anyway.
  //
  // So visibility inside a herd is pairwise and declared, not hierarchical, and
  // both sides must declare it: a crossing is mutual, and one band's edit should
  // not silently widen another band's scope.
  //
  // Names are unique across a herd. Two bands in one herd are two sets of
  // individuals, not two namespaces.
  herd(node, outer) {
    const scope = new Scope(outer, "herd");
    const bands = node.body.filter((b) => b.type === "Group");

    for (const s of node.body) {
      if (s.type !== "Group") {
        this.fail(s, "a herd holds bands, and nothing else", "GRAMMAR.md §2.4");
      }
    }

    // What each band declares, and who it says it crosses to.
    const declared = new Map();
    const crossings = new Map();
    for (const b of bands) {
      if (declared.has(b.name)) {
        this.fail(b, `${JSON.stringify(b.name)} is declared twice in this herd`);
      }
      declared.set(b.name, new Map());
      const mine = b.body.filter((s) => s.type === "Mingles");
      for (const s of mine) s.inHerd = true; // consumed here, not a statement
      crossings.set(b.name, new Set(mine.map((s) => s.other)));
    }

    // Collect declarations per band, and refuse a name used by two bands: they
    // are distinct individuals, and the herd is where they are counted.
    const owner = new Map();
    for (const b of bands) {
      const size = b.body.filter((d) => d.type === "Cue" || d.type === "Group").length;
      if (b.kind === "band" && size > NATURAL_BAND) {
        this.warn(
          b,
          `band ${b.name} holds ${size} declarations; a band is one stallion, ` +
          `two to four mares, and their offspring. bands of a herd that name each ` +
          `other with \`mingles with\` can share the work`,
          "IFCE, social organisation in herds of horses",
        );
      }
      for (const d of b.body) {
        if (!d.name) continue;
        if (!["Cue", "Binding", "Pile", "Forage", "Group"].includes(d.type)) continue;
        if (owner.has(d.name)) {
          this.fail(
            d,
            `${JSON.stringify(d.name)} is declared in band ${owner.get(d.name)} as ` +
            `well; names are distinct across a herd`,
            "GRAMMAR.md §2.4",
          );
          continue;
        }
        owner.set(d.name, b.name);
        declared.get(b.name).set(d.name, {
          kind: d.type === "Cue" ? "cue" : d.type.toLowerCase(),
          arity: d.type === "Cue" ? d.params.length : null,
          node: d,
        });
      }
    }

    // Wire the crossings. A crossing both sides declare opens both ways; one side
    // alone opens nothing, and says which side is missing.
    for (const b of bands) {
      const mine = crossings.get(b.name);
      for (const other of mine) {
        if (!declared.has(other)) {
          this.fail(node, `band ${JSON.stringify(other)} is not in this herd`, "GRAMMAR.md §2.4");
          continue;
        }
        if (other === b.name) {
          this.fail(node, `band ${b.name} cannot mingle with itself`, "GRAMMAR.md §2.4");
          continue;
        }
        if (!crossings.get(other).has(b.name)) {
          this.fail(
            node,
            `${b.name} mingles with ${other}, but ${other} does not mingle with ` +
            `${b.name}. a crossing is mutual, so both bands must name the other`,
            "GRAMMAR.md §2.4",
          );
        }
      }
    }

    // Build each band's scope: its own declarations, plus those of any band it
    // mutually crosses to. A bachelor group stands on the periphery of the herd —
    // all-male units occupy the edge, and coordination reaches them — so it sees
    // every band without declaring, and no band sees it.
    const scopes = new Map();
    for (const b of bands) {
      const bs = new Scope(scope, b.kind);
      for (const [name, info] of declared.get(b.name)) bs.declare(name, info);

      const peripheral = b.kind === "bachelor";
      for (const other of bands) {
        if (other.name === b.name) continue;
        const mutual = crossings.get(b.name).has(other.name) &&
                       crossings.get(other.name).has(b.name);
        if (!peripheral && !mutual) continue;
        if (peripheral && other.kind === "bachelor") continue;
        for (const [name, info] of declared.get(other.name)) {
          bs.declare(name, { ...info, fromBand: other.name });
        }
      }
      scopes.set(b.name, bs);
    }

    // A name that exists in the herd but was not shared should say so, rather
    // than reading as a typo.
    for (const b of bands) {
      scopes.get(b.name).elsewhere = (name) => {
        const home = owner.get(name);
        return home && home !== b.name ? home : null;
      };
    }

    for (const b of bands) this.block(b.body, scopes.get(b.name), true);
  }

  // ---------------------------------------------------------------- statements

  statement(s, scope) {
    switch (s.type) {
      // A herd is a real level of organisation, not a filing convenience: units
      // associate to form one, inter-unit distances are closer than chance, and
      // behaviour synchronises *between* units. So bands in a herd may see each
      // other — but only the pairs that say so.
      case "Group": if (s.kind === "herd") return this.herd(s, scope); else {
        const inner = new Scope(scope, "group");
        const declared = s.body.filter(
          (d) => d.type === "Cue" || d.type === "Group",
        ).length;
        // A band is one stallion, two to four mares, and youngsters up to two or
        // three years old — so three to five adults plus offspring, and six to
        // eight members is ordinary. Set at 4 this fired on natural sizes, which
        // real code found immediately.
        if (s.kind === "band" && declared > NATURAL_BAND) {
          this.warn(
            s,
            `band ${s.name} holds ${declared} declarations; a band is one stallion, ` +
            `two to four mares, and their offspring`,
            "IFCE, social organisation in herds of horses",
          );
        }
        this.block(s.body, inner);
        return;
      }

      case "Cue": {
        const inner = new Scope(scope, "cue");
        for (const p of s.params) inner.declare(p, { kind: "param", arity: null, node: s });
        this.block(s.body, inner);
        if (!terminates(s.body)) {
          this.fail(
            s,
            `cue ${JSON.stringify(s.name)} can reach its end without naming an outcome; ` +
            `every path out is release, balk, leave, or blank`,
            "GRAMMAR.md §3",
          );
        }
        return;
      }

      // Wired by `herd`. Outside one there is no sibling band to cross to.
      case "Mingles":
        if (!s.inHerd) {
          this.fail(
            s,
            "`mingles with` only means something between bands of one herd",
            "GRAMMAR.md §2.4",
          );
        }
        return;

      case "Binding":
        this.expr(s.value, scope);
        return;

      case "Forage":
        this.expr(s.source, scope);
        return;

      case "Pile":
        return;

      case "Assign":
        this.expr(s.target, scope);
        this.expr(s.value, scope);
        // A pile is append-only, so writing to one leaves a trace rather than
        // replacing it. Only the resolver knows the target is a pile, so it marks
        // the node for the emitter — without this, `passing becomes now` overwrote
        // the pile with a number and every count read back undefined.
        if (s.target.type === "Name") {
          const info = scope.lookup(s.target.name);
          if (info && info.kind === "pile") s.appends = true;
        }
        return;

      case "Release":
        if (s.value) this.expr(s.value, scope);
        return;

      case "When":
        this.expr(s.test, scope);
        this.block(s.then, new Scope(scope, "when"));
        if (s.otherwise) this.block(s.otherwise, new Scope(scope, "otherwise"));
        return;

      case "Gait":
        this.checkGait(s);
        if (s.interval) {
          this.expr(s.interval, scope);
          this.wantDuration(s.interval, `${s.gait} every`);
          // A held gait repeats until something stops it. In a page that is often
          // right — a page runs until it is closed. Anywhere else it hangs, and it
          // is easy to write by accident.
          if (!canStop(s.body)) {
            this.warn(
              s,
              `${s.gait} every ... repeats with nothing to stop it; no halt or leave ` +
              `in its body`,
              "GRAMMAR.md §5",
            );
          }
        }
        this.block(s.body, new Scope(scope, "gait"));
        return;

      case "Halt":
      case "Balk":
      case "Leave":
      case "Blank":
      case "Shy":
      case "Rest":
        return;

      case "Stumble":
        if (!scope.within("gait")) {
          this.fail(s, "stumble outside a gait; there is no stride to break", "§5a");
        }
        return;

      case "Stand": {
        if (s.duration) { this.expr(s.duration, scope); this.wantDuration(s.duration, "stand"); }
        if (s.within) { this.expr(s.within, scope); this.wantDistance(s.within, "stand within"); }
        const inner = new Scope(scope, "stand");
        if (s.as) inner.declare(s.as, { kind: "progress", arity: null, node: s });
        this.block(s.body, inner);
        // The progress binding belongs to the hold, so it is not in scope once the
        // hold has broken.
        if (s.otherwise) this.block(s.otherwise, new Scope(scope, "broken"));
        return;
      }

      case "Graze": {
        this.expr(s.source, scope);
        const inner = new Scope(scope, "graze");
        if (s.as) inner.declare(s.as, { kind: "item", arity: null, node: s });
        this.block(s.body, inner);
        return;
      }

      case "Spook":
        this.expr(s.stimulus, scope);
        this.block(s.body, new Scope(scope, "spook"));
        return;

      case "Flood":
        this.expr(s.stimulus, scope);
        this.warn(
          s,
          "flooding produces learned helplessness; a spook that habituates is the " +
          "same shape without the harm",
          "IFCE, habituation and sensitization",
        );
        this.block(s.body, new Scope(scope, "flood"));
        return;

      case "Sentinel":
        this.expr(s.interval, scope);
        this.wantDuration(s.interval, "sentinel rotates every");
        this.block(s.body, new Scope(scope, "sentinel"));
        return;

      case "Watch":
        this.expr(s.target, scope);
        return;


      case "Chord":
        this.chord(s, scope);
        return;

      case "Emission":
        if (s.value) this.expr(s.value, scope);
        return;

      case "Context":
        for (const h of s.handlers) {
          this.block(h.body, new Scope(scope, "handler"));
        }
        return;

      case "ExpressionStatement":
        this.expressionStatement(s, scope);
        return;

      default:
        this.fail(s, `resolver: unhandled statement ${s.type}`);
    }
  }

  // GRAMMAR.md §8. A bare name on its own line is an emission when a `hears`
  // introduces it, and a call otherwise. This is the reclassification the parser
  // could not do, because the handler may appear later in the file.
  expressionStatement(s, scope) {
    const e = s.expression;

    if (e && e.type === "Name" && this.signals.has(e.name) && !scope.lookup(e.name)) {
      s.type = "Emission";
      s.signal = e.name;
      s.value = null;
      return;
    }
    if (e && e.type === "Call" && e.callee && e.callee.type === "Name" &&
        this.signals.has(e.callee.name) && !scope.lookup(e.callee.name)) {
      if (e.args.length > 1) {
        this.fail(e, `a signal carries at most one value`, "GRAMMAR.md §8");
      }
      s.type = "Emission";
      s.signal = e.callee.name;
      s.value = e.args[0] || null;
      for (const a of e.args) this.expr(a, scope);
      return;
    }

    this.expr(e, scope);

    // A statement that is only a value does nothing. Bare `draw` passes the cue and
    // then discards it; `(draw)` is how you call it.
    if (e && e.type === "Name") {
      const info = scope.lookup(e.name);
      if (info && info.kind === "cue") {
        this.warn(
          s,
          `${JSON.stringify(e.name)} on its own is the cue, not a call; write ` +
          `(${e.name}) to call it`,
          "GRAMMAR.md §3",
        );
      }
    }
  }

  chord(node, scope) {
    for (const st of node.states) {
      if (st.kind !== "channel") continue;
      const v = st.value;
      if (v && v.type === "Graded") this.expr(v.value, scope);
      else if (v && v.type === "Affect") {
        this.expr(v.arousal.value, scope);
        this.expr(v.valence.value, scope);
      }
      // A State is a bare word naming a posture, not a name to resolve.
    }
  }

  checkGait(s) {
    if (s.gait === "pace" && this.genotype !== "AA") {
      this.fail(
        s,
        "pace requires the AA allele of DMRT3; declare `genotype AA`",
        "Promerova et al. 2014, Animal Genetics",
      );
    }
    if (s.gait === "tolt" && this.breed !== "icelandic") {
      this.fail(
        s,
        "tolt requires an Icelandic; declare `genotype AA icelandic`",
        "Promerova et al. 2014, Animal Genetics",
      );
    }
  }

  // Durations and distances are distinct primitive types, not numbers with
  // suffixes (STDLIB.md). The grammar accepts any expression in these positions;
  // this is where a literal of the wrong kind is caught.
  wantDuration(node, where) {
    if (node.type === "Distance" || node.type === "Number") {
      this.fail(node, `${where} needs a duration, like 10s or 900ms`, "STDLIB.md");
    }
  }
  wantDistance(node, where) {
    if (node.type === "Duration" || node.type === "Number") {
      this.fail(node, `${where} needs a distance, like 20px`, "STDLIB.md");
    }
  }

  // --------------------------------------------------------------- expressions

  expr(e, scope) {
    if (!e || typeof e !== "object") return;
    switch (e.type) {
      case "Name": {
        const info = scope.lookup(e.name);
        if (!info) {
          // If it exists elsewhere in the herd, the problem is that no crossing
          // was declared — which reads as a typo unless it is said.
          const home = scope.homeOf(e.name);
          if (home) {
            this.fail(
              e,
              `${JSON.stringify(e.name)} belongs to band ${home}, which this band ` +
              `does not mingle with. both bands must name the other`,
              "GRAMMAR.md §2.4",
            );
          } else {
            this.fail(e, `${JSON.stringify(e.name)} is not declared in this scope`);
          }
        }
        return;
      }
      case "Call": {
        this.expr(e.callee, scope);
        for (const a of e.args) this.expr(a, scope);
        if (e.callee && e.callee.type === "Name") {
          const info = scope.lookup(e.callee.name);
          if (info && info.kind === "cue" && info.arity !== e.args.length) {
            this.fail(
              e,
              `cue ${JSON.stringify(e.callee.name)} takes ${info.arity} ` +
              `${info.arity === 1 ? "argument" : "arguments"}, given ${e.args.length}`,
              "GRAMMAR.md §3",
            );
          }
          if (info && info.kind !== "cue") {
            this.fail(e, `${JSON.stringify(e.callee.name)} is not a cue`, "GRAMMAR.md §3");
          }
        }
        return;
      }
      case "Member":
        this.expr(e.object, scope);
        return; // the member name itself cannot be checked
      case "Index":
        this.expr(e.object, scope);
        this.expr(e.index, scope);
        return;
      case "Graded":
        this.expr(e.value, scope);
        return;
      case "Affect":
        this.expr(e.arousal, scope);
        this.expr(e.valence, scope);
        return;
      case "Range":
        this.expr(e.from, scope);
        this.expr(e.to, scope);
        return;
      case "List":
        for (const i of e.items) this.expr(i, scope);
        return;
      case "Bare":
        return;
      case "Grass":
        this.expr(e.patches, scope);
        return;
      case "Binary":
      case "Compare":
      case "Logical":
        this.expr(e.left, scope);
        this.expr(e.right, scope);
        return;
      case "Not":
      case "Negate":
        this.expr(e.value, scope);
        return;
      case "Flehmen":
      case "Recognise":
        this.expr(e.value, scope);
        return;
      case "New": {
        this.expr(e.target, scope);
        for (const a of e.args) this.expr(a, scope);
        // Constructors live outside the effect system, and so does everything
        // reached through them. Allowing `new` on a cue would put an unconditioned
        // path into the middle of the language.
        let root = e.target;
        while (root && (root.type === "Member" || root.type === "Index")) root = root.object;
        if (!root || root.type !== "Hands") {
          this.fail(
            e,
            "`new` builds a JavaScript object, so it only applies to a `hands` path",
            "GRAMMAR.md §11",
          );
        }
        return;
      }
      case "Chord":
        this.chord(e, scope);
        return;
      case "Number":
      case "Text":
      case "Duration":
      case "Distance":
      case "Facs":
      case "State":
      case "Hands":
      case "Weather":
      case "Chance":
        return;
      default:
        this.fail(e, `resolver: unhandled expression ${e.type}`);
    }
  }
}

// GRAMMAR.md §3 — a cue that reaches its end without naming an outcome is an error.
//
// Statements run in order, so the *first* unconditional outcome ends the block and
// everything after it is unreachable. Checking only the last statement would report
// a cue that releases and then declares a spook, which is fine.
//
// Conservative on purpose: it reports only when nothing in the body names an
// outcome at all. A false positive here would block correct programs.
function terminates(list) {
  if (!list || list.length === 0) return false;
  for (const s of list) {
    switch (s.type) {
      case "Release":
      case "Balk":
      case "Leave":
      case "Blank":
        return true;
      case "When":
        // Both arms, or control falls through the conditional and carries on.
        if (terminates(s.then) && s.otherwise && terminates(s.otherwise)) return true;
        break;
      default:
        break;
    }
  }
  return false;
}

// Is there anything in this body that could end a held gait? A `halt` stops the
// gait; a `leave` stops the program. Anything nested counts, since a halt inside a
// `when` is the ordinary way to write the exit.
function canStop(list) {
  for (const s of list || []) {
    if (!s || typeof s !== "object") continue;
    if (s.type === "Halt" || s.type === "Leave") return true;
    for (const key of ["body", "then", "otherwise"]) {
      if (Array.isArray(s[key]) && canStop(s[key])) return true;
    }
    if (s.type === "Context") {
      for (const h of s.handlers) if (canStop(h.body)) return true;
    }
  }
  return false;
}

export function resolve(ast, filename) {
  return new Resolver(ast, filename).run();
}

export { terminates };
