// HORSEtxt parser. Recursive descent over the token stream from lexer.js.
// Grammar reference: GRAMMAR.md. Deviations are recorded in §12c there.

import { T } from "./lexer.js";

// GRAMMAR.md §4. Channels are not reserved words — they are recognised here, so
// `wind` and `head` stay usable as ordinary names outside a chord.
const CHANNELS = new Set([
  "ears", "brow", "lids", "eyes", "nostrils", "lips", "chin", "jaw",
  "mouth", "tongue", "head", "neck", "tail", "tension", "voice",
]);

// GRAMMAR.md §6.4. Members of `weather`, not keywords.
const CONDITIONS = new Set(["cold", "wet", "wind", "sun", "flies"]);

const BUILTIN_SIGNALS = new Set(["whinny", "nicker", "squeal", "snort"]);

const GAITS = new Set(["walk", "trot", "pace", "canter", "gallop", "tolt", "back", "halt"]);

const GROUP_KEYWORDS = new Set(["band", "herd", "bachelor", "bachelors"]);

// Same budget as the lexer: report below the tolerance threshold rather than flood.
const MAX_REPORTED = 3;

class Parser {
  constructor(tokens, filename) {
    this.toks = tokens;
    this.i = 0;
    this.file = filename || (tokens[0] && tokens[0].file) || "<anonymous>";
    this.errors = [];
  }

  // ------------------------------------------------------------------ plumbing

  peek(offset = 0) {
    return this.toks[Math.min(this.i + offset, this.toks.length - 1)];
  }

  get tok() {
    return this.peek();
  }

  next() {
    const t = this.tok;
    if (this.i < this.toks.length - 1) this.i++;
    return t;
  }

  is(type, value) {
    const t = this.tok;
    if (t.type !== type) return false;
    return value === undefined || t.value === value;
  }

  isKw(...names) {
    return this.tok.type === T.KEYWORD && names.includes(this.tok.value);
  }

  // Glue words like `bias`, `eye`, `blind` and `after` are recognised rather than
  // reserved, so they stay usable as ordinary names. Same policy as channels and
  // weather conditions.
  isWord(name) {
    const t = this.tok;
    return (t.type === T.IDENT || t.type === T.KEYWORD) && t.value === name;
  }

  eatWord(name) {
    return this.isWord(name) ? this.next() : null;
  }

  expectWord(name, section) {
    if (this.isWord(name)) return this.next();
    this.fail(`expected ${JSON.stringify(name)}`, section);
    return null;
  }

  eat(type, value) {
    if (this.is(type, value)) return this.next();
    return null;
  }

  expect(type, value, section) {
    if (this.is(type, value)) return this.next();
    const want = value !== undefined ? JSON.stringify(value) : type;
    this.fail(`expected ${want}`, section);
    return null;
  }

  expectKw(value, section) {
    return this.expect(T.KEYWORD, value, section);
  }

  fail(message, section) {
    const t = this.tok;
    this.errors.push({
      message: `${message}, found ${describe(t)}`,
      section: section || "",
      line: t.line,
      col: t.col,
      file: this.file,
    });
  }

  // Skip to the end of the current logical line, then past any block it opened.
  recover() {
    let depth = 0;
    for (;;) {
      const t = this.tok;
      if (t.type === T.EOF) return;
      if (t.type === T.INDENT) depth++;
      if (t.type === T.DEDENT) {
        if (depth === 0) return;
        depth--;
      }
      if (t.type === T.NEWLINE && depth === 0) {
        this.next();
        return;
      }
      this.next();
    }
  }

  node(type, tok, fields) {
    return { type, line: tok.line, col: tok.col, ...fields };
  }

  // -------------------------------------------------------------------- program

  parseProgram() {
    const start = this.tok;
    let individual = null;
    let genotype = null;
    const body = [];

    this.skipNewlines();

    if (this.is(T.AT)) individual = this.parseIndividual();
    this.skipNewlines();
    if (this.isKw("genotype")) genotype = this.parseGenotype();
    this.skipNewlines();

    while (!this.is(T.EOF)) {
      const before = this.i;
      const decl = this.parseStatement();
      if (decl) body.push(decl);
      if (this.i === before) this.next(); // never spin
      this.skipNewlines();
    }

    return this.node("Program", start, { individual, genotype, body });
  }

  skipNewlines() {
    while (this.is(T.NEWLINE)) this.next();
  }

  // individual = "@" ident { trait } NEWLINE            (GRAMMAR.md §2)
  parseIndividual() {
    const at = this.next();
    const name = this.expect(T.IDENT, undefined, "§2");
    const traits = [];

    while (!this.is(T.NEWLINE) && !this.is(T.EOF)) {
      if (this.is(T.NUMBER)) {
        traits.push({ kind: "age", value: this.next().value });
        continue;
      }
      if (this.isKw("left", "right")) {
        const side = this.next().value;
        if (this.eatWord("bias")) {
          traits.push({ kind: "bias", side });
          continue;
        }
        if (this.eatWord("eye")) {
          if (this.eatWord("blind")) {
            traits.push({ kind: "blind", side });
            continue;
          }
          traits.push({ kind: "tag", value: `${side} eye` });
          continue;
        }
        traits.push({ kind: "tag", value: side });
        continue;
      }
      if (this.is(T.IDENT)) {
        traits.push({ kind: "tag", value: this.next().value });
        continue;
      }
      this.fail("not a trait", "§2");
      break;
    }

    this.expect(T.NEWLINE, undefined, "§2");
    return this.node("Individual", at, { name: name && name.value, traits });
  }

  // genotype = "genotype" allele [ ident ] NEWLINE
  parseGenotype() {
    const kw = this.next();
    const allele = this.expect(T.ALLELE, undefined, "§2");
    let breed = null;
    if (this.is(T.IDENT)) breed = this.next().value;
    this.expect(T.NEWLINE, undefined, "§2");
    return this.node("Genotype", kw, { allele: allele && allele.value, breed });
  }

  // ------------------------------------------------------------------ statements

  parseStatement() {
    const t = this.tok;

    if (t.type === T.EAR_OPEN) return this.parseChordStatement();

    if (t.type === T.KEYWORD) {
      const k = t.value;
      if (GROUP_KEYWORDS.has(k)) return this.parseGroup();
      // A band names the sibling bands whose boundary it crosses. Units maintain
      // their boundaries by default; particular pairs cross anyway (§2.4).
      if (k === "mingles") {
        const kw = this.next();
        this.expectKw("with", "§2.4");
        const other = this.expect(T.IDENT, undefined, "§2.4");
        this.expect(T.NEWLINE, undefined, "§2.4");
        return this.node("Mingles", kw, { other: other && other.value });
      }
      if (k === "context") return this.parseContext();
      if (k === "lead" || k === "cue") return this.parseCue();
      if (k === "release") return this.parseRelease();
      if (k === "remember") return this.parseBinding();
      if (k === "pile") return this.parsePile();
      if (k === "forage") return this.parseForage();
      if (k === "when") return this.parseConditional();
      // `halt` is terminal, not a container. The grammar wrote it as a gait_head
      // with a mandatory block, which is wrong — you cannot do things "during" a
      // halt. Recorded in §12c.
      if (k === "halt") {
        this.next();
        this.expect(T.NEWLINE, undefined, "§5");
        return this.node("Halt", t, {});
      }
      if (GAITS.has(k)) return this.parseGait();
      if (k === "stand") return this.parseStand();
      if (k === "graze") return this.parseGraze();
      if (k === "spook" || k === "flood") return this.parseSpook(k);
      if (k === "shy" || k === "balk" || k === "leave" || k === "blank") {
        this.next();
        this.expect(T.NEWLINE, undefined, "§10");
        return this.node(cap(k), t, {});
      }
      if (k === "stumble") {
        this.next();
        this.expect(T.NEWLINE, undefined, "§5a");
        return this.node("Stumble", t, {});
      }
      if (k === "sentinel") return this.parseSentinel();
      if (k === "rest" || k === "recumbent") {
        this.next();
        this.expect(T.NEWLINE, undefined, "§11");
        return this.node("Rest", t, { deep: k === "recumbent" });
      }
      if (k === "watch") {
        this.next();
        const target = this.parseExpression();
        this.expect(T.NEWLINE, undefined, "§11");
        return this.node("Watch", t, { target });
      }
      if (BUILTIN_SIGNALS.has(k)) return this.parseEmission();
      if (k === "genotype") {
        this.fail("genotype must be the second line of a program, before any declaration", "§2");
        this.recover();
        return null;
      }
      if (k === "hears") {
        this.fail("`hears` is only legal inside a context", "§8");
        this.recover();
        return null;
      }
    }

    return this.parseExpressionOrAssignment();
  }

  block(section) {
    const stmts = [];
    if (!this.expect(T.INDENT, undefined, section)) return stmts;
    while (!this.is(T.DEDENT) && !this.is(T.EOF)) {
      this.skipNewlines();
      if (this.is(T.DEDENT) || this.is(T.EOF)) break;
      const before = this.i;
      const s = this.parseStatement();
      if (s) stmts.push(s);
      if (this.i === before) this.next();
    }
    this.eat(T.DEDENT);
    return stmts;
  }

  // band | herd | bachelor                                 (GRAMMAR.md §2)
  parseGroup() {
    const kw = this.next();
    const name = this.expect(T.IDENT, undefined, "§2");
    this.expect(T.NEWLINE, undefined, "§2");
    const body = this.block("§2");
    const kind = kw.value === "bachelors" ? "bachelor" : kw.value;
    return this.node("Group", kw, { kind, name: name && name.value, body });
  }

  // cue = [ "lead" "mare" ] [ "cue" ] ident { ident } NEWLINE block    (§3)
  //
  // The grammar wrote `"cue"` as mandatory, but `lead mare draw` reads far better
  // than `lead mare cue draw` and every example used the shorter form. `lead mare`
  // already says it is a cue, so `cue` is optional after it. Recorded in §12c.
  parseCue() {
    const start = this.tok;
    let lead = false;
    if (this.isKw("lead")) {
      this.next();
      this.expectKw("mare", "§3");
      lead = true;
    }
    if (!lead) this.expectKw("cue", "§3");
    else this.eat(T.KEYWORD, "cue");

    const name = this.expect(T.IDENT, undefined, "§3");
    const params = [];
    while (this.is(T.IDENT)) params.push(this.next().value);
    this.expect(T.NEWLINE, undefined, "§3");
    const body = this.block("§3");
    return this.node("Cue", start, { lead, name: name && name.value, params, body });
  }

  parseRelease() {
    const kw = this.next();
    let value = null;
    if (!this.is(T.NEWLINE) && !this.is(T.EOF)) value = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§3");
    return this.node("Release", kw, { value });
  }

  parseBinding() {
    const kw = this.next();
    const name = this.expect(T.IDENT, undefined, "§11");
    this.expectKw("as", "§11");
    const value = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§11");
    return this.node("Binding", kw, { name: name && name.value, value });
  }

  parsePile() {
    const kw = this.next();
    const name = this.expect(T.IDENT, undefined, "§11");
    this.expectKw("at", "§11");
    const key = this.expect(T.STRING, undefined, "§11");
    this.expect(T.NEWLINE, undefined, "§11");
    return this.node("Pile", kw, { name: name && name.value, key: key && key.value });
  }

  // forage = "forage" ident "of" expression [ "regrows" ] NEWLINE      (§6.2)
  parseForage() {
    const kw = this.next();
    const name = this.expect(T.IDENT, undefined, "§6.2");
    this.expectKw("of", "§6.2");
    const source = this.parseExpression();
    const regrows = !!this.eat(T.KEYWORD, "regrows");
    this.expect(T.NEWLINE, undefined, "§6.2");
    return this.node("Forage", kw, { name: name && name.value, source, regrows });
  }

  parseConditional() {
    const kw = this.next();
    const test = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§11");
    const then = this.block("§11");
    let otherwise = null;
    this.skipNewlines();
    if (this.isKw("otherwise")) {
      this.next();
      this.expect(T.NEWLINE, undefined, "§11");
      otherwise = this.block("§11");
    }
    return this.node("When", kw, { test, then, otherwise });
  }

  // gait = gait_head NEWLINE block                                     (§5)
  parseGait() {
    const kw = this.next();
    const gait = kw.value;
    let lead = null;
    let interval = null;

    if (gait === "canter" && this.isKw("on")) {
      this.next();
      this.expectKw("the", "§5");
      const side = this.tok;
      if (this.isKw("left", "right")) lead = this.next().value;
      else this.fail("a canter lead is left or right", "§5");
      void side;
    }
    // `every` holds any gait, not only a tolt. A gait is a stride repeated.
    if (this.isKw("every")) {
      this.next();
      interval = this.parseExpression();
    }

    this.expect(T.NEWLINE, undefined, "§5");
    const body = this.block("§5");
    return this.node("Gait", kw, { gait, lead, interval, body });
  }

  // stand = "stand" [ expression ] [ "within" expression ] [ "as" ident ]
  //         NEWLINE block [ "otherwise" NEWLINE block ]                (§7)
  //
  // The grammar wrote literal `duration` and `distance` here; real programs bind
  // them to names (`stand hold within jitter`). Expressions, type-checked later.
  parseStand() {
    const kw = this.next();
    let duration = null;
    let within = null;
    let as = null;

    if (!this.is(T.NEWLINE) && !this.isKw("within", "as")) duration = this.parseExpression();
    if (this.isKw("within")) {
      this.next();
      within = this.parseExpression();
    }
    if (this.isKw("as")) {
      this.next();
      const id = this.expect(T.IDENT, undefined, "§7");
      as = id && id.value;
    }

    this.expect(T.NEWLINE, undefined, "§7");
    const body = this.block("§7");
    let otherwise = null;
    this.skipNewlines();
    if (this.isKw("otherwise")) {
      this.next();
      this.expect(T.NEWLINE, undefined, "§7");
      otherwise = this.block("§7");
    }
    return this.node("Stand", kw, { duration, within, as, body, otherwise });
  }

  // graze = "graze" expression [ "as" ident ] NEWLINE block            (§6.1)
  parseGraze() {
    const kw = this.next();
    const source = this.parseExpression();
    let as = null;
    // The point of balance sits at the shoulder: pressure behind it drives forward,
    // pressure in front of it drives back (GRAMMAR.md §12g).
    let driven = null;
    if (this.isKw("from")) {
      this.next();
      if (this.is(T.IDENT, "behind")) { this.next(); driven = "forward"; }
      else if (this.isKw("the")) {
        this.next();
        if (this.is(T.IDENT, "front")) { this.next(); driven = "back"; }
        else this.fail("pressure is applied from behind, or from the front", "§12g");
      } else {
        this.fail("pressure is applied from behind, or from the front", "§12g");
      }
    }
    if (this.isKw("as")) {
      this.next();
      const id = this.expect(T.IDENT, undefined, "§6.1");
      as = id && id.value;
    }
    this.expect(T.NEWLINE, undefined, "§6.1");
    const body = this.block("§6.1");
    return this.node("Graze", kw, { source, as, body, driven });
  }

  // spook = "spook" "at" expression NEWLINE block [ habituates ]       (§10)
  parseSpook(kind) {
    const kw = this.next();
    this.expectKw("at", "§10");
    const stimulus = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§10");
    const body = this.block("§10");

    let habituates = null;
    this.skipNewlines();
    if (this.isKw("habituates")) {
      this.next();
      this.expectWord("after", "§10");
      const n = this.expect(T.NUMBER, undefined, "§10");
      habituates = n && n.value;
      this.expect(T.NEWLINE, undefined, "§10");
    }
    if (kind === "flood" && habituates !== null) {
      this.fail("`flood` cannot habituate; that is what makes it flooding", "§10");
    }
    return this.node(kind === "flood" ? "Flood" : "Spook", kw, { stimulus, body, habituates });
  }

  parseSentinel() {
    const kw = this.next();
    this.expectKw("rotates", "§11");
    this.expectKw("every", "§11");
    const interval = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§11");
    const body = this.block("§11");
    return this.node("Sentinel", kw, { interval, body });
  }

  // context = "context" ident NEWLINE INDENT handler { handler } DEDENT  (§8)
  parseContext() {
    const kw = this.next();
    const name = this.expect(T.IDENT, undefined, "§8");
    this.expect(T.NEWLINE, undefined, "§8");

    const handlers = [];
    if (this.expect(T.INDENT, undefined, "§8")) {
      while (!this.is(T.DEDENT) && !this.is(T.EOF)) {
        this.skipNewlines();
        if (this.is(T.DEDENT) || this.is(T.EOF)) break;
        if (!this.isKw("hears")) {
          this.fail("a context holds only `hears` handlers", "§8");
          this.recover();
          continue;
        }
        const hk = this.next();
        const sig = this.parseSignalName();
        // `hears creak as v`. The emitter has always passed the carried value; until
        // v0.4 there was no way to name it, so a handler could see that a signal had
        // arrived but not what it brought.
        let binding = null;
        if (this.isKw("as")) {
          this.next();
          const b = this.expect(T.IDENT, undefined, "§8");
          binding = b && b.value;
        }
        this.expect(T.NEWLINE, undefined, "§8");
        const body = this.block("§8");
        handlers.push(this.node("Handler", hk, { signal: sig, binding, body }));
      }
      this.eat(T.DEDENT);
    }
    if (handlers.length === 0) {
      this.fail("a context needs at least one handler; a context is a set of interpretations", "§8");
    }
    return this.node("Context", kw, { name: name && name.value, handlers });
  }

  parseSignalName() {
    if (this.tok.type === T.KEYWORD && BUILTIN_SIGNALS.has(this.tok.value)) {
      return this.next().value;
    }
    if (this.is(T.IDENT)) return this.next().value;
    this.fail("expected a signal name", "§8");
    return null;
  }

  // Only the four built-ins are parsed as emissions. A bare user name is left as a
  // call for the resolver, because a `hears` that introduces it may appear later in
  // the file — GRAMMAR.md §8 puts this in semantic analysis by design.
  parseEmission() {
    const kw = this.next();
    let value = null;
    if (!this.is(T.NEWLINE) && !this.is(T.EOF)) value = this.parseExpression();
    this.expect(T.NEWLINE, undefined, "§8");
    return this.node("Emission", kw, { signal: kw.value, value });
  }

  parseExpressionOrAssignment() {
    const start = this.tok;
    const target = this.parsePostfix();
    if (target === null) {
      this.recover();
      return null;
    }
    if (this.isKw("becomes")) {
      this.next();
      const value = this.parseExpression();
      this.expect(T.NEWLINE, undefined, "§11");
      return this.node("Assign", start, { target, value });
    }
    // Application, if arguments follow.
    const expr = this.finishApplication(target);
    this.expect(T.NEWLINE, undefined, "§11");
    return this.node("ExpressionStatement", start, { expression: expr });
  }

  // ---------------------------------------------------------------------- chords

  // chord = ear { channel_state } ear [ lateral_mod ]                   (§4)
  parseChordStatement() {
    const chord = this.parseChord();
    this.expect(T.NEWLINE, undefined, "§4");
    return chord;
  }

  parseChord() {
    const open = this.next();
    const states = [];

    while (!this.is(T.EAR_CLOSE) && !this.is(T.EOF)) {
      if (this.is(T.EAR_OPEN)) {
        // The lexer cannot produce this — an open inside a chord lexes as a close —
        // but keep the guard so the rule is stated where a reader will look.
        this.fail("chords do not nest; an utterance is one utterance", "§4");
        break;
      }
      if (this.is(T.FACS)) {
        const f = this.next();
        states.push({ kind: "facs", code: f.value, line: f.line, col: f.col });
        continue;
      }
      if (this.is(T.IDENT)) {
        const name = this.next();
        if (!CHANNELS.has(name.value)) {
          this.fail(`${JSON.stringify(name.value)} is not a channel`, "§4");
          continue;
        }
        const value = this.parseChannelValue();
        states.push({ kind: "channel", channel: name.value, value, line: name.line, col: name.col });
        continue;
      }
      this.fail("expected a channel or an EquiFACS code", "§4");
      break;
    }

    const close = this.expect(T.EAR_CLOSE, undefined, "§4");
    const lateral = this.parseLateral();
    return this.node("Chord", open, {
      open: open.value,
      close: close ? close.value : null,
      states,
      lateral,
    });
  }

  parseChannelValue() {
    if (this.is(T.TILDE)) {
      const g = this.parseGraded();
      if (this.is(T.COLON)) {
        this.next();
        const v = this.parseGraded();
        return this.node("Affect", g, { arousal: g, valence: v });
      }
      return g;
    }
    // A state is a bare word. Some are also keywords elsewhere — `back` is a gait
    // and an ear position — so keywords are accepted here as state names.
    if (this.is(T.IDENT) || this.tok.type === T.KEYWORD) {
      const t = this.next();
      return this.node("State", t, { name: t.value });
    }
    if (this.is(T.FACS)) {
      const t = this.next();
      return this.node("Facs", t, { code: t.value });
    }
    this.fail("a channel needs a state, a graded value, or an affect", "§4");
    return null;
  }

  // ------------------------------------------------------------------ expressions

  parseExpression() {
    return this.parseDisjunction();
  }

  parseDisjunction() {
    let left = this.parseConjunction();
    while (this.isKw("or")) {
      const op = this.next();
      const right = this.parseConjunction();
      left = this.node("Logical", op, { op: "or", left, right });
    }
    return left;
  }

  parseConjunction() {
    let left = this.parseNegation();
    while (this.isKw("and")) {
      const op = this.next();
      const right = this.parseNegation();
      left = this.node("Logical", op, { op: "and", left, right });
    }
    return left;
  }

  parseNegation() {
    if (this.isKw("not")) {
      const op = this.next();
      return this.node("Not", op, { value: this.parseNegation() });
    }
    return this.parseRange();
  }

  parseRange() {
    const start = this.tok;
    const from = this.parseComparison();
    if (this.isKw("through")) {
      this.next();
      const to = this.parseComparison();
      return this.node("Range", start, { from, to });
    }
    return from;
  }

  parseComparison() {
    const left = this.parseSum();
    if (this.is(T.OP) && [">", "<", ">=", "<=", "=", "!="].includes(this.tok.value)) {
      const op = this.next();
      const right = this.parseSum();
      return this.node("Compare", op, { op: op.value, left, right });
    }
    return left;
  }

  parseSum() {
    let left = this.parseProduct();
    while (this.is(T.OP) && (this.tok.value === "+" || this.tok.value === "-")) {
      const op = this.next();
      const right = this.parseProduct();
      left = this.node("Binary", op, { op: op.value, left, right });
    }
    return left;
  }

  parseProduct() {
    let left = this.parseUnary();
    while (this.is(T.OP) && ["*", "/", "%"].includes(this.tok.value)) {
      const op = this.next();
      const right = this.parseUnary();
      left = this.node("Binary", op, { op: op.value, left, right });
    }
    return left;
  }

  parseUnary() {
    if (this.is(T.OP) && this.tok.value === "-") {
      const op = this.next();
      return this.node("Negate", op, { value: this.parseUnary() });
    }
    const base = this.parsePostfix();
    return this.finishApplication(base);
  }

  // Application is left-associative and does not nest without parentheses, so an
  // argument is a postfix rather than a full application (§3).
  finishApplication(callee) {
    if (callee === null) return null;
    const args = [];
    while (this.startsArgument()) {
      const a = this.parsePostfix();
      if (a === null) break;
      args.push(a);
    }
    if (args.length === 0) return callee;
    const lateral = this.parseLateral();
    return { type: "Call", line: callee.line, col: callee.col, callee, args, lateral };
  }

  startsArgument() {
    const t = this.tok;
    switch (t.type) {
      case T.NUMBER:
      case T.STRING:
      case T.DURATION:
      case T.DISTANCE:
      case T.TILDE:
      case T.IDENT:
      case T.FACS:
      case T.LBRACKET:
      case T.LPAREN:
        return true;
      case T.KEYWORD:
        return t.value === "weather" || t.value === "hands" || t.value === "chance" ||
               t.value === "recognise" || t.value === "flehmen" || t.value === "new" ||
               t.value === "bare" || t.value === "grass";
      default:
        return false;
    }
  }

  parseLateral() {
    if (!this.isKw("from")) return null;
    this.next();
    this.expectKw("the", "§10");
    if (this.isKw("left", "right")) return this.next().value;
    this.fail("a side is left or right", "§10");
    return null;
  }

  parsePostfix() {
    let base = this.parsePrimary();
    if (base === null) return null;
    for (;;) {
      if (this.is(T.DOT)) {
        this.next();
        const name = this.expect(T.IDENT, undefined, "§11");
        if (!name) return base;
        base = this.node("Member", base, { object: base, name: name.value });
        continue;
      }
      // Indexing binds only when it touches its object. `target[1]` indexes;
      // `[a] [b]` is two lists, not one indexed by the other. Without this,
      // `[["a" "b"] ["c" "d"]]` parses as an index and loses an element.
      if (this.is(T.LBRACKET) && !this.tok.pre) {
        this.next();
        const index = this.parseExpression();
        this.expect(T.RBRACKET, undefined, "§11");
        base = this.node("Index", base, { object: base, index });
        continue;
      }
      return base;
    }
  }

  parseGraded() {
    const tilde = this.next(); // ~
    // graded_operand = [ "-" ] number | postfix | "(" expression ")"
    if (this.is(T.OP) && this.tok.value === "-") {
      this.next();
      const n = this.expect(T.NUMBER, undefined, "§1.3");
      return this.node("Graded", tilde, {
        value: this.node("Number", tilde, { value: n ? -n.value : 0 }),
      });
    }
    if (this.is(T.NUMBER)) {
      const n = this.next();
      return this.node("Graded", tilde, { value: this.node("Number", n, { value: n.value }) });
    }
    // A parenthesised operand goes through `postfix`, so `~(draw)` obeys the same
    // rule as everywhere else: parenthesising a lone path calls it. Handling LPAREN
    // separately here quietly exempted graded values from that.
    const p = this.parsePostfix();
    if (p === null) this.fail("~ needs an operand", "§1.3");
    return this.node("Graded", tilde, { value: p });
  }

  parsePrimary() {
    const t = this.tok;

    switch (t.type) {
      case T.NUMBER:
        this.next();
        return this.node("Number", t, { value: t.value });
      case T.STRING:
        this.next();
        return this.node("Text", t, { value: t.value });
      case T.DURATION:
        this.next();
        return this.node("Duration", t, { value: t.value.value, unit: t.value.unit });
      case T.DISTANCE:
        this.next();
        return this.node("Distance", t, { value: t.value.value, unit: t.value.unit });
      case T.FACS:
        this.next();
        return this.node("Facs", t, { code: t.value });
      case T.IDENT:
        this.next();
        return this.node("Name", t, { name: t.value });
      case T.TILDE: {
        const g = this.parseGraded();
        if (this.is(T.COLON)) {
          this.next();
          const v = this.parseGraded();
          return this.node("Affect", g, { arousal: g, valence: v });
        }
        return g;
      }
      case T.LBRACKET:
        return this.parseList();
      case T.LPAREN:
        return this.parseParen();
      case T.EAR_OPEN:
        return this.parseChord();
      default:
        break;
    }

    if (t.type === T.KEYWORD) {
      if (t.value === "weather") return this.parseWeather();
      // A fresh independent draw. Not weather: weather is slow, shared and
      // correlated, which is what it turned out to be once it was implemented
      // properly — and that is not what a coin flip is.
      if (t.value === "chance") {
        this.next();
        return this.node("Chance", t, {});
      }
      if (t.value === "hands") {
        this.next();
        return this.node("Hands", t, {});
      }
      // Nothing is there. Distinct from zero, which is a quantity (§8a).
      if (t.value === "bare") {
        this.next();
        return this.node("Bare", t, {});
      }
      // Patch use: the first patch with anything in it. A list, because a horse
      // moving through a field passes more than two.
      if (t.value === "grass") {
        this.next();
        this.expect(T.KEYWORD, "in", "§8a");
        if (!this.is(T.LBRACKET)) {
          this.fail("grass grows in a list of patches, as `grass in [a b]`", "§8a");
          return this.node("Grass", t, { patches: this.node("List", t, { items: [] }) });
        }
        return this.node("Grass", t, { patches: this.parseList() });
      }
      // Constructing a JavaScript object has no equine analogue, so it stays plain
      // and stays inside the escape hatch: `new hands.Date 2000 0 6`. Without it
      // `hands` is one-way — methods and properties reachable, constructors not.
      if (t.value === "new") {
        this.next();
        const target = this.parsePostfix();
        const args = [];
        while (this.startsArgument()) {
          const a = this.parsePostfix();
          if (a === null) break;
          args.push(a);
        }
        return this.node("New", t, { target, args });
      }
      if (t.value === "recognise") {
        this.next();
        return this.node("Recognise", t, { value: this.parsePostfix() });
      }
      if (t.value === "flehmen") {
        this.next();
        const value = this.parsePostfix();
        const lateral = this.parseLateral();
        return this.node("Flehmen", t, { value, lateral });
      }
    }

    this.fail("expected a value", "§11");
    return null;
  }

  // weather = "weather" "." condition                                   (§6.4)
  parseWeather() {
    const kw = this.next();
    if (!this.is(T.DOT)) {
      this.fail(
        "there is no scalar weather; name a condition — cold, wet, wind, sun, or flies",
        "§6.4",
      );
      return this.node("Weather", kw, { condition: null });
    }
    this.next();
    const name = this.expect(T.IDENT, undefined, "§6.4");
    if (name && !CONDITIONS.has(name.value)) {
      this.errors.push({
        message: `${JSON.stringify(name.value)} is not a weather condition; ` +
                 `they are cold, wet, wind, sun, flies`,
        section: "§6.4",
        line: name.line,
        col: name.col,
        file: this.file,
      });
    }
    return this.node("Weather", kw, { condition: name && name.value });
  }

  // A list element is a postfix, not an application — otherwise `[a b]` is
  // ambiguous between two elements and one call. Parenthesise to call. (§12c)
  parseList() {
    const open = this.next();
    const items = [];
    while (!this.is(T.RBRACKET) && !this.is(T.EOF)) {
      const before = this.i;
      const item = this.parsePostfix();
      if (item) items.push(item);
      if (this.i === before) {
        this.next();
        break;
      }
    }
    this.expect(T.RBRACKET, undefined, "§11");
    return this.node("List", open, { items });
  }

  // Parenthesising a lone path calls it with no arguments — that is what keeps
  // `draw` (the cue) distinct from `(draw)` (the call). See §3.
  parseParen() {
    const open = this.next();
    const inner = this.parseExpression();
    this.expect(T.RPAREN, undefined, "§11");
    if (inner && (inner.type === "Name" || inner.type === "Member" || inner.type === "Index")) {
      return { type: "Call", line: open.line, col: open.col, callee: inner, args: [], lateral: null };
    }
    return inner;
  }
}

function cap(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function describe(t) {
  switch (t.type) {
    case T.NEWLINE: return "end of line";
    case T.INDENT: return "an indent";
    case T.DEDENT: return "a dedent";
    case T.EOF: return "end of file";
    case T.EAR_OPEN:
    case T.EAR_CLOSE: return `an ear ${JSON.stringify(t.value)}`;
    default: return JSON.stringify(
      typeof t.value === "object" ? `${t.value.value}${t.value.unit}` : t.value,
    );
  }
}

export function parse(tokens, filename) {
  const p = new Parser(tokens, filename);
  const ast = p.parseProgram();
  return {
    ast,
    errors: p.errors.slice(0, MAX_REPORTED),
    suppressedErrors: Math.max(0, p.errors.length - MAX_REPORTED),
  };
}
