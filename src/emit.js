// HORSEtxt emitter. Walks the AST from parser.js and produces JavaScript that
// calls into runtime.js. Emitted code is readable on purpose — a stranger who
// finds the output should see ordinary code, and only find the .horse if they look.

const RESERVED_JS = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof",
  "interface", "let", "new", "null", "package", "private", "protected", "public",
  "return", "static", "super", "switch", "this", "throw", "true", "try", "typeof",
  "var", "void", "while", "with", "yield", "H", "arguments", "eval",
]);

// HORSEtxt identifiers may contain hyphens; JavaScript's may not. `$_` is the
// bridge, and `$` is not legal in a HORSEtxt identifier, so nothing can collide.
function js(name) {
  const safe = name.replace(/-/g, "$_");
  return RESERVED_JS.has(safe) ? `${safe}$` : safe;
}

class Emitter {
  // `wrap` decides the shape of the output. "module" exports a default function, for
  // Node and for tests. "body" emits bare statements, for the browser loader, which
  // builds an async function from them — `new Function` cannot take a module.
  constructor(filename, wrap = "module") {
    this.file = filename || "program.horse";
    this.wrap = wrap;
    this.out = [];
    this.depth = 0;
    this.band = null;
    this.cue = null;
    this.params = [];
    this.crossing = false; // inside a `hands` path already being weighed (§11a)
  }

  line(text) {
    this.out.push("  ".repeat(this.depth) + text);
  }
  blank() {
    if (this.out.length && this.out[this.out.length - 1] !== "") this.out.push("");
  }
  indent(fn) {
    this.depth++;
    fn();
    this.depth--;
  }

  // Provenance is injected at every emission site, so there is no way to write an
  // anonymous signal — a whinny carries identity whether the animal intends it or not.
  provenance(node) {
    const parts = [`line: ${node.line}`];
    if (this.band) parts.push(`band: ${JSON.stringify(this.band)}`);
    if (this.cue) parts.push(`cue: ${JSON.stringify(this.cue)}`);
    return `{ ${parts.join(", ")} }`;
  }

  // -------------------------------------------------------------------- program

  program(ast) {
    const bare = this.wrap === "body";
    this.line(`// compiled from ${this.file}`);
    if (!bare) this.line("export default async function program(H) {");
    const emitBody = () => {
      if (ast.individual) {
        this.line(`H.declare(${JSON.stringify({
          name: ast.individual.name,
          traits: ast.individual.traits,
        })});`);
      }
      if (ast.genotype) {
        this.line(`H.genotype(${JSON.stringify(ast.genotype.allele)}, ${JSON.stringify(ast.genotype.breed)});`);
      }
      if (ast.individual || ast.genotype) this.blank();
      this.statements(ast.body);
    };
    if (bare) emitBody();
    else this.indent(emitBody);
    if (!bare) this.line("}");
    // Names the script in devtools. Line numbers are the generated ones; HORSEtxt
    // lines travel with the provenance the runtime carries on every emission.
    this.line(`//# sourceURL=${this.file}`);
    return this.out.join("\n") + "\n";
  }

  // Bindings inside a block are hoisted, because gait bodies compile each statement
  // to its own thunk and a `const` inside one would not be visible to the next.
  //
  // `spook` and `context` are different from every other statement: they govern what
  // follows them. A spook guards the rest of its block, and a context interprets the
  // signals raised in the rest of its block. So both take the remainder as their
  // scope rather than compiling in place.
  // Names a block declares, for hoisting.
  declared(list) {
    const bound = [];
    for (const s of list) {
      if (s.type === "Binding" || s.type === "Pile" || s.type === "Forage" || s.type === "Cue") {
        bound.push(js(s.name));
      }
    }
    return bound;
  }

  hoist(list) {
    const bound = this.declared(list);
    if (bound.length) this.line(`let ${bound.join(", ")};`);
  }

  statements(list) {
    this.hoist(list);
    this.statementList(list);
  }

  // The dispatch shared by `statements` and the context handler. The context
  // remainder is emitted WITHOUT its own hoist: the parent statements() already
  // hoisted the whole list into this block, and a second `let` inside the try
  // would shadow the declarations the lead mare's call needs after it — the
  // entry point runs in this block, not in the try's scope.
  statementList(list) {
    for (let i = 0; i < list.length; i++) {
      const s = list[i];

      if (s.type === "Spook" || s.type === "Flood") {
        // `habituates after N` is parsed as part of the spook, so the guarded
        // region is everything after it in this block.
        const rest = list.slice(i + 1);
        const limit = s.type === "Spook" && s.habituates != null ? String(s.habituates) : "null";
        this.line(`try {`);
        this.indent(() => this.statements(rest));
        this.line(`} catch (_e) {`);
        this.indent(() => {
          this.line(`if (H.terminal(_e)) throw _e; // balking and leaving are not failures`);
          this.line(`const _key = H.shape(_e);`);
          if (s.type === "Flood") {
            this.statements(s.body);
          } else {
            this.line(`if (!H.habituated(_key, ${limit})) {`);
            this.indent(() => {
              this.line(`H.expose(_key);`);
              this.statements(s.body);
            });
            this.line(`}`);
          }
        });
        this.line(`}`);
        return;
      }

      if (s.type === "Context") {
        const rest = list.slice(i + 1);
        // A context governs the rest of its block (§8). The remainder runs
        // inside the try — in this same block, with no inner hoist, so the
        // declarations the lead mare needs stay in scope — and the entry
        // point is the last thing the context watches, still on the stack
        // where the handlers can answer her. The group's own lead logic must
        // not fire twice, so statements() has consumed the remainder and the
        // call is emitted here, exactly once.
        this.statement(s);
        const lead = rest.find((s2) => s2.type === "Cue" && s2.lead);
        this.line(`try {`);
        this.indent(() => {
          this.statementList(rest);
          if (lead) {
            this.blank();
            this.line(`await H.call(${js(lead.name)}, [], null); // lead mare`);
          }
        });
        this.line(`} finally {`);
        this.indent(() => this.line(`H.popContext();`));
        this.line(`}`);
        return;
      }

      this.statement(s);
    }
  }

  // Statements as thunks, for the gait schedulers.
  thunks(list) {
    const parts = [];
    for (const s of list) {
      const sub = new Emitter(this.file, this.wrap);
      sub.depth = this.depth + 1;
      sub.band = this.band;
      sub.cue = this.cue;
      sub.params = this.params;
      sub.statement(s);
      parts.push({ body: sub.out.join("\n") });
    }
    return parts;
  }

  statement(node) {
    if (!node) return;
    const m = this[`s_${node.type}`];
    if (!m) throw new Error(`emit: no rule for statement ${node.type} at line ${node.line}`);
    m.call(this, node);
  }

  block(list, label) {
    this.line(`{`);
    this.indent(() => this.statements(list));
    this.line(`}${label || ""}`);
  }

  // ----------------------------------------------------------------- declarations

  // A herd emits one scope holding every band, because names are unique across a
  // herd and the resolver has already decided who may name what. Lead mares are
  // deferred until every band's declarations exist — a lead mare in one band may
  // call into a band it mingles with, and that band may be declared below it.
  s_Herd(node) {
    const bands = node.body.filter((b) => b.type === "Group");
    this.blank();
    this.line(`// herd ${node.name}`);
    this.line(`await (async () => {`);
    this.indent(() => {
      for (const b of bands) this.hoist(b.body);
      const leads = [];
      for (const b of bands) {
        const prev = this.band;
        this.band = b.name;
        this.blank();
        this.line(`// ${b.kind} ${b.name}`);
        for (const s of b.body) {
          if (s.type === "Mingles") {
            this.line(`// mingles with ${s.other}`);
            continue;
          }
          this.statement(s);
        }
        const lead = b.body.find((s) => s.type === "Cue" && s.lead);
        if (lead) leads.push(lead.name);
        this.band = prev;
      }
      if (leads.length) {
        this.blank();
        this.line(`// the lead mares, once every band is standing`);
        for (const name of leads) this.line(`await H.call(${js(name)}, [], null);`);
      }
    });
    this.line(`})();`);
    this.blank();
  }

  s_Group(node) {
    if (node.kind === "herd") return this.s_Herd(node);
    this.blank();
    const prev = this.band;
    this.line(`// ${node.kind} ${node.name}`);
    this.line(`H.band(${JSON.stringify(node.name)}, ${countDeclarations(node.body)});`);
    this.line(`await (async () => {`);
    this.indent(() => {
      this.band = node.name;
      // A context handler emits the entry point itself (the lead mare runs
      // after the handlers in the same block), so the group must not fire it
      // a second time.
      const handledByContext = node.body.some(
        (s) => s.type === "Context" && node.body.some((c) => c.type === "Cue" && c.lead),
      );
      this.statements(node.body);
      // The lead mare is the entry point — an older mare who knows the home range.
      // An entry point nothing calls is not one, so the group runs hers once its
      // declarations are in place.
      if (handledByContext) return;
      const lead = node.body.find((s) => s.type === "Cue" && s.lead);
      if (lead) {
        this.blank();
        this.line(`await H.call(${js(lead.name)}, [], null); // lead mare`);
      }
    });
    this.band = prev;
    this.line(`})();`);
    this.blank();
  }

  s_Cue(node) {
    const params = node.params.map(js);
    const prev = this.cue;
    const prevParams = this.params;
    this.cue = node.name;
    this.params = node.params;
    this.blank();
    this.line(
      `${js(node.name)} = H.cue(${JSON.stringify(node.name)}, ${JSON.stringify(node.params)}, ` +
      `async (${params.join(", ")}) => {`,
    );
    this.indent(() => this.statements(node.body));
    this.line(`}, { lead: ${node.lead} });`);
    this.cue = prev;
    this.params = prevParams;
    this.blank();
  }

  s_Release(node) {
    this.line(`H.release(${node.value ? this.expr(node.value) : "undefined"});`);
  }

  s_Binding(node) {
    this.line(`${js(node.name)} = ${this.expr(node.value)};`);
  }

  s_Assign(node) {
    // Writing to a pile appends; a pile has no delete and nothing to overwrite.
    if (node.appends) {
      this.line(`H.leaveTrace(${this.expr(node.target)}, ${this.expr(node.value)});`);
      return;
    }
    this.line(`${this.unasked(() => this.expr(node.target))} = ${this.expr(node.value)};`);
  }

  s_Pile(node) {
    this.line(`${js(node.name)} = H.pile(${JSON.stringify(node.key)});`);
  }

  s_Forage(node) {
    this.line(`${js(node.name)} = H.forage(${this.expr(node.source)}, ${node.regrows});`);
  }

  // ------------------------------------------------------------------- statements

  s_When(node) {
    this.line(`if (H.truth(${this.expr(node.test)})) {`);
    this.indent(() => this.statements(node.then));
    if (node.otherwise) {
      this.line(`} else {`);
      this.indent(() => this.statements(node.otherwise));
    }
    this.line(`}`);
  }

  s_Gait(node) {
    const interval = node.interval ? this.expr(node.interval) : "null";
    const lead = node.lead ? JSON.stringify(node.lead) : "null";
    // Each statement in a gait body compiles to its own thunk, so anything the body
    // declares has to be hoisted out here or the thunks cannot see it — and, since
    // a held gait repeats, so that it survives between strides.
    this.hoist(node.body);
    this.line(`await H.gait(${JSON.stringify(node.gait)}, [`);
    this.indent(() => {
      for (const t of this.thunks(node.body)) {
        this.line(`async () => {`);
        this.out.push(t.body);
        this.line(`},`);
      }
    });
    this.line(`], { interval: ${interval}, lead: ${lead} });`);
  }

  s_Halt(node) {
    this.line(`H.halt();`);
  }

  s_Stand(node) {
    const opts = [
      `duration: ${node.duration ? this.expr(node.duration) : "null"}`,
      `within: ${node.within ? this.expr(node.within) : "null"}`,
    ];
    const progress = node.as ? js(node.as) : "_progress";
    this.line(`await H.stand({ ${opts.join(", ")} },`);
    this.indent(() => {
      this.line(`async (${progress}) => {`);
      this.indent(() => this.statements(node.body));
      this.line(`},`);
      if (node.otherwise) {
        this.line(`async () => {`);
        this.indent(() => this.statements(node.otherwise));
        this.line(`});`);
      } else {
        this.line(`null);`);
      }
    });
  }

  s_Graze(node) {
    const bindName = node.as ? js(node.as) : "_item";
    const driven = node.driven ? `, ${JSON.stringify(node.driven)}` : "";
    this.line(`await H.graze(${this.expr(node.source)}, async (${bindName}) => {`);
    this.indent(() => this.statements(node.body));
    this.line(`}${driven});`);
  }

  // Spook and Flood are emitted by `statements`, which hands them the rest of the
  // block as their guarded region. These exist for the case where one appears with
  // nothing after it — a handler guarding nothing.
  s_Spook(node) {
    this.line(`// spook at ${node.stimulus.type}: nothing follows it to guard`);
  }
  s_Flood(node) {
    this.line(`// flood: nothing follows it to guard`);
  }

  s_Shy(node) { this.line(`H.shy();`); }
  s_Balk(node) { this.line(`H.balk(${this.provenance(node)});`); }
  s_Leave(node) { this.line(`H.leave(${this.provenance(node)});`); }
  s_Blank(node) { this.line(`H.blank();`); }

  s_Stumble(node) { this.line(`H.stumble();`); }

  s_Sentinel(node) {
    this.hoist(node.body);
    this.line(`await H.sentinel(${this.expr(node.interval)}, [`);
    this.indent(() => {
      for (const t of this.thunks(node.body)) {
        this.line(`async () => {`);
        this.out.push(t.body);
        this.line(`},`);
      }
    });
    this.line(`]);`);
  }

  s_Rest(node) { this.line(`await H.rest(${node.deep});`); }
  s_Watch(node) { this.line(`H.watch(${this.expr(node.target)});`); }


  // Emitted as a comment by the herd; the crossing itself is a compile-time fact.
  s_Mingles(node) {
    this.line(`// mingles with ${node.other}`);
  }

  s_Chord(node) {
    this.line(`await ${this.chord(node)};`);
  }

  s_Emission(node) {
    const value = node.value ? this.expr(node.value) : "undefined";
    this.line(
      `await H.signal(${JSON.stringify(node.signal)}, ${value}, ${this.provenance(node)});`,
    );
  }

  s_Context(node) {
    this.line(`H.pushContext(${JSON.stringify(node.name)}, {`);
    this.indent(() => {
      for (const h of node.handlers) {
        const carried = h.binding ? js(h.binding) : "_value";
        this.line(`${JSON.stringify(h.signal)}: async (${carried}, _from) => {`);
        this.indent(() => this.statements(h.body));
        this.line(`},`);
      }
    });
    this.line(`});`);
  }

  s_ExpressionStatement(node) {
    this.line(`${this.expr(node.expression)};`);
  }

  // ------------------------------------------------------------------ expressions

  // GRAMMAR.md §11a. Every crossing of the `hands` boundary that comes back bare is
  // counted, per path, and the boundary says so at the limit. `hands` is
  // `globalThis`, so a proxy would break identity and slow every hot path — but the
  // emitter knows every path syntactically, which is where the weight goes instead.
  //
  // Only the outermost crossing in a path is wrapped. `hands.a.b` is one question
  // asked of the boundary, not two, and the intermediate `hands.a` was never asked
  // for on its own.
  expr(node) {
    if (!node) return "undefined";
    const m = this[`e_${node.type}`];
    if (!m) throw new Error(`emit: no rule for expression ${node.type} at line ${node.line}`);
    if (this.crossing || !isCrossing(node)) return m.call(this, node);

    return this.unasked(() => `H.crossed(${JSON.stringify(pathOf(node))}, ${m.call(this, node)})`);
  }

  // A position where nothing is being asked of the boundary: the left of a
  // `becomes`, the target of a `new`, the callee of a call, and every step along a
  // path on the way to its end. Naming a path is not asking it for anything — what
  // is asked for is whatever is at the end, and that is what gets counted.
  unasked(fn) {
    const was = this.crossing;
    this.crossing = true;
    try { return fn(); } finally { this.crossing = was; }
  }

  // Arguments are their own questions, asked of the boundary in their own right.
  asked(fn) {
    const was = this.crossing;
    this.crossing = false;
    try { return fn(); } finally { this.crossing = was; }
  }

  e_Number(n) { return String(n.value); }
  e_Text(n) { return JSON.stringify(n.value); }
  e_Duration(n) { return `H.duration(${n.value}, ${JSON.stringify(n.unit)})`; }
  e_Distance(n) { return `H.distance(${n.value}, ${JSON.stringify(n.unit)})`; }
  e_Name(n) { return js(n.name); }
  e_Facs(n) { return `H.facs(${JSON.stringify(n.code)})`; }
  e_State(n) { return `H.state(${JSON.stringify(n.name)})`; }
  e_Hands(n) { return `H.hands`; }
  e_Graded(n) { return `H.graded(${this.expr(n.value)})`; }
  e_Affect(n) { return `H.affect(${this.expr(n.arousal)}, ${this.expr(n.valence)})`; }
  e_Range(n) { return `H.range(${this.expr(n.from)}, ${this.expr(n.to)})`; }
  e_List(n) { return `[${n.items.map((i) => this.expr(i)).join(", ")}]`; }

  e_Bare(n) { return `null`; }

  // Every patch is evaluated before the first is chosen, unlike `or`. A horse
  // walking a line of patches has already seen them; it does not shut its eyes to
  // the far one because the near one had grass.
  e_Grass(n) { return `H.grass(${this.expr(n.patches)})`; }
  e_Weather(n) { return `H.weather(${JSON.stringify(n.condition)})`; }
  e_Chance(n) { return `H.chance()`; }
  e_Recognise(n) { return `H.recognise(${this.expr(n.value)})`; }

  // The enclosing cue's parameters travel with the call: they are what this animal
  // is holding, and a horse cannot see its own muzzle (GRAMMAR.md §9a).
  e_Flehmen(n) {
    const held = this.params.length ? `[${this.params.map(js).join(", ")}]` : "[]";
    return `(await H.flehmen(${this.expr(n.value)}, ${side(n.lateral)}, ${held}))`;
  }

  // Plain JavaScript construction, and deliberately not awaited: a constructor is
  // not a cue and is not conditioned by anything.
  e_New(n) {
    const args = this.asked(() => n.args.map((a) => this.expr(a)));
    return `(new ${this.unasked(() => this.expr(n.target))}(${args.join(", ")}))`;
  }

  e_Member(n) { return `${this.expr(n.object)}.${n.name}`; }
  e_Index(n) { return `${this.expr(n.object)}[${this.expr(n.index)}]`; }
  e_Not(n) { return `(!H.truth(${this.expr(n.value)}))`; }
  e_Negate(n) { return `(-${this.expr(n.value)})`; }

  e_Binary(n) { return this.operate(n); }

  // Every operator that treats its operands as values goes through the runtime, so
  // a method used as one is said out loud (§11a). The paths travel with it, so the
  // note can name the side at fault; a literal cannot be a method and carries none.
  operate(n) {
    const left = this.expr(n.left), right = this.expr(n.right);
    const lp = named(n.left), rp = named(n.right);
    const where = lp || rp ? `, ${js0(lp)}, ${js0(rp)}` : "";
    return `H.op(${left}, ${JSON.stringify(n.op)}, ${right}${where})`;
  }
  // Identity stays plain. Two names may hold the same cue and asking whether they
  // do is a real question, so `=` and `!=` are the one place a method is a value.
  e_Compare(n) {
    if (n.op === "=" || n.op === "!=") {
      const op = n.op === "=" ? "===" : "!==";
      return `(${this.expr(n.left)} ${op} ${this.expr(n.right)})`;
    }
    return this.operate(n);
  }
  e_Logical(n) {
    const op = n.op === "and" ? "&&" : "||";
    return `(H.truth(${this.expr(n.left)}) ${op} H.truth(${this.expr(n.right)}))`;
  }

  e_Chord(n) { return this.chord(n); }

  chord(n) {
    const states = n.states.map((s) => {
      if (s.kind === "facs") return `{ facs: ${JSON.stringify(s.code)} }`;
      return `{ channel: ${JSON.stringify(s.channel)}, value: ${this.expr(s.value)} }`;
    });
    return `H.chord(${JSON.stringify(n.open)}, ${JSON.stringify(n.close)}, ` +
           `[${states.join(", ")}], ${side(n.lateral)})`;
  }

  // A cue is always a bare name — cues are declared in a band, never as a member of
  // something. So a Member or Index callee is a JavaScript method, and it must be
  // emitted with its receiver attached: routing `query.get` through H.call would
  // invoke it detached, and `this` would be undefined.
  //
  // That also means a JavaScript method stays unconditioned even when the object it
  // belongs to was bound to a local name — which is right. Binding a value out of
  // `hands` does not bring it inside the effect system.
  e_Call(n) {
    const args = this.asked(() => n.args.map((a) => this.expr(a)));
    if (n.callee.type === "Member" || n.callee.type === "Index" ||
        n.callee.type === "Hands" || rootIsHands(n.callee)) {
      return `(await ${this.unasked(() => this.expr(n.callee))}(${args.join(", ")}))`;
    }
    // The name the call was written under travels with it, so a call on something
    // that turns out not to be a cue can say which word was wrong. It is not always
    // the cue's own name: a cue passed to a cue is called under the receiver's word
    // for it (GRAMMAR.md §3).
    const held = n.callee.type === "Name" ? JSON.stringify(n.callee.name) : "null";
    return `(await H.call(${this.expr(n.callee)}, [${args.join(", ")}], ` +
           `${side(n.lateral)}, ${held}))`;
  }
}

function side(v) {
  return v ? JSON.stringify(v) : "null";
}

function rootIsHands(node) {
  let n = node;
  while (n && (n.type === "Member" || n.type === "Index")) n = n.object;
  return !!n && n.type === "Hands";
}

// A crossing is a path *rooted in `hands`* — syntactically, which is the only way
// the emitter can know. A method call on a locally bound object is not one of these
// and is not counted: §12 already says members are unresolvable by nature,
// and guessing which of them came from the boundary would be exactly that guess.
function isCrossing(node) {
  if (node.type === "Member" || node.type === "Index") return rootIsHands(node);
  if (node.type === "Call") return rootIsHands(node.callee);
  return false;
}

// What to call an operand in a diagnostic, or null when it cannot be a method.
function named(node) {
  if (!node) return null;
  if (node.type === "Member" || node.type === "Index" || node.type === "Name") {
    return pathOf(node);
  }
  return null;
}

function js0(v) { return v === null ? "null" : JSON.stringify(v); }

// The stimulus is the path, not the occasion — so two calls to the same path share
// one count, the way habituation is keyed to the shape of a thing and not to where
// it was met. An index is not part of the shape: `images[0]` and `images[1]` are the
// same question asked twice.
function pathOf(node) {
  if (!node) return "?";
  switch (node.type) {
    case "Hands": return "hands";
    case "Name": return node.name;
    case "Member": return `${pathOf(node.object)}.${node.name}`;
    case "Index": return `${pathOf(node.object)}[]`;
    case "Call": return pathOf(node.callee);
    default: return "?";
  }
}

function countDeclarations(body) {
  return body.filter((s) => s.type === "Cue" || s.type === "Group").length;
}

export function emit(ast, filename, options = {}) {
  return new Emitter(filename, options.wrap || "module").program(ast);
}
