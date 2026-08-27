// HORSEtxt lexer.
// Grammar reference: GRAMMAR.md §1. Every rule here traces to a section there.

export const T = {
  NEWLINE: "newline",
  INDENT: "indent",
  DEDENT: "dedent",
  EOF: "eof",

  IDENT: "ident",
  KEYWORD: "keyword",
  FACS: "facs",
  ALLELE: "allele",

  NUMBER: "number",
  DURATION: "duration",
  DISTANCE: "distance",
  STRING: "string",
  TILDE: "tilde",

  EAR_OPEN: "ear-open",
  EAR_CLOSE: "ear-close",

  AT: "at",
  COLON: "colon",
  DOT: "dot",
  LBRACKET: "lbracket",
  RBRACKET: "rbracket",
  LPAREN: "lparen",
  RPAREN: "rparen",
  OP: "op",
};

// GRAMMAR.md §1.5. The five weather conditions are deliberately NOT here: they are
// members reached through `weather.`, so reserving them would cost every program the
// use of `wind` and `sun` as names for nothing.
const KEYWORDS = new Set([
  "genotype", "band", "herd", "bachelor", "bachelors", "mingles", "with",
  "context", "cue",
  "release", "lead", "mare",
  "walk", "trot", "pace", "canter", "gallop", "tolt", "halt", "stand", "back",
  "graze", "forage", "regrows", "recognise", "weather", "chance", "hands", "new",
  "spook", "flood", "habituates", "shy", "balk", "leave", "blank",
  "remember", "becomes", "pile", "when", "otherwise", "through",
  "whinny", "nicker", "squeal", "snort", "flehmen",
  "sentinel", "rotates", "rest", "recumbent", "watch", "hears",
  "from", "the", "left", "right",
  "on", "every", "within", "as", "at", "of",
  "and", "or", "not",
]);

const ALLELES = new Set(["CA", "AA", "CC"]);

// Longest first, so `ms` wins over `m`.
const DURATION_SUFFIXES = ["ms", "h", "m", "s"];
const DISTANCE_SUFFIXES = ["px", "%"];

// `%` is also a distance unit, so it is disambiguated the same way `-` is: a suffix
// binds only when it touches its number. `50%` is a distance, `50 % 3` is modulo.
const OPERATORS = [">=", "<=", "!=", ">", "<", "=", "+", "-", "*", "/", "%"];

// GRAMMAR.md §1 — the compiler reports below the tolerance threshold rather than
// flooding. Flooding produces learned helplessness; see BIBLIOGRAPHY.md, habituation.
const MAX_REPORTED = 3;

const isDigit = (c) => c >= "0" && c <= "9";
const isLower = (c) => c >= "a" && c <= "z";
const isUpper = (c) => c >= "A" && c <= "Z";
const isIdentBody = (c) => isLower(c) || isDigit(c) || c === "_";

class Lexer {
  constructor(source, filename) {
    this.src = source;
    this.file = filename || "<anonymous>";
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
    this.errors = [];

    this.indents = [0];
    this.brackets = 0; // [ and ( depth
    this.inChord = false;
    this.chordAt = null; // where the open ear was, for the unterminated message
    this.spaceBefore = true; // start of file counts as separated
  }

  // GRAMMAR.md §1.4 — newline, indent and dedent are suppressed inside a chord,
  // a bracketed list, and a parenthesised group.
  get suppressed() {
    return this.inChord || this.brackets > 0;
  }

  at(offset = 0) {
    return this.src[this.pos + offset];
  }

  advance(n = 1) {
    for (let i = 0; i < n; i++) {
      if (this.src[this.pos] === "\n") {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.pos++;
    }
  }

  // `pre` records whether whitespace preceded the token. The parser needs it to
  // tell indexing from a fresh list: `a[3]` indexes, `[a] [b]` is two lists.
  push(type, value, line, col) {
    this.tokens.push({ type, value, line, col, pre: this.spaceBefore, file: this.file });
    this.spaceBefore = false;
  }

  // Lexical errors cite GRAMMAR.md sections. Papers are for semantic rules —
  // there is no ethology of an unterminated string.
  fail(message, section, line = this.line, col = this.col) {
    this.errors.push({ message, section, line, col, file: this.file });
  }

  tokenize() {
    while (this.pos < this.src.length) {
      if (this.col === 1 && !this.suppressed) {
        if (!this.layout()) continue;
      }
      this.skipSpaces();
      if (this.pos >= this.src.length) break;

      const c = this.at();

      if (c === "#") {
        this.skipComment();
        continue;
      }

      if (c === "\n") {
        if (this.suppressed) {
          this.advance();
        } else {
          this.push(T.NEWLINE, "\n", this.line, this.col);
          this.advance();
        }
        this.spaceBefore = true;
        continue;
      }

      this.scan();
    }

    if (this.inChord) {
      this.fail(
        "chord opened and never closed",
        "§4",
        this.chordAt.line,
        this.chordAt.col,
      );
    }
    if (this.brackets > 0) {
      this.fail("bracket opened and never closed", "§1.4");
    }

    if (this.tokens.length && this.tokens[this.tokens.length - 1].type !== T.NEWLINE) {
      this.push(T.NEWLINE, "\n", this.line, this.col);
    }
    while (this.indents.length > 1) {
      this.indents.pop();
      this.push(T.DEDENT, "", this.line, this.col);
    }
    this.push(T.EOF, "", this.line, this.col);

    return {
      tokens: this.tokens,
      errors: this.errors.slice(0, MAX_REPORTED),
      suppressedErrors: Math.max(0, this.errors.length - MAX_REPORTED),
    };
  }

  // Indentation. Spaces only — mixed tabs and spaces is a failure mode with no
  // upside, so a tab in leading whitespace is an error rather than a guess.
  // Returns false if the line was blank or comment-only and should be re-entered.
  layout() {
    const startLine = this.line;
    let width = 0;

    while (this.pos < this.src.length) {
      const c = this.at();
      if (c === " ") {
        width++;
        this.advance();
      } else if (c === "\t") {
        this.fail("tab in leading whitespace; HORSEtxt indents with spaces", "§1.3");
        this.advance();
      } else {
        break;
      }
    }

    // Blank and comment-only lines carry no layout. A comment-only line is consumed
    // here rather than in the main loop, so the ASCII check has to live in
    // skipComment or every full-line comment escapes it — which is where all of
    // them are.
    const c = this.at();
    if (c === undefined || c === "\n" || c === "#") {
      if (c === "#") this.skipComment();
      else while (this.pos < this.src.length && this.at() !== "\n") this.advance();
      if (this.at() === "\n") this.advance();
      return false;
    }

    const top = this.indents[this.indents.length - 1];
    if (width > top) {
      this.indents.push(width);
      this.push(T.INDENT, width, startLine, 1);
    } else if (width < top) {
      while (this.indents.length > 1 && this.indents[this.indents.length - 1] > width) {
        this.indents.pop();
        this.push(T.DEDENT, width, startLine, 1);
      }
      if (this.indents[this.indents.length - 1] !== width) {
        this.fail("dedent to a column that was never indented to", "§1.3", startLine, 1);
      }
    }
    this.spaceBefore = true;
    return true;
  }

  // A comment runs to end of line, and its text is checked for ASCII like
  // everything else. §1.1 says no exceptions and it means it: inline source sits in
  // the page, so a stray byte here shows up garbled in View Source, which is the
  // one surface the delivery model exists to serve.
  skipComment() {
    while (this.pos < this.src.length && this.at() !== "\n") {
      if (this.at().charCodeAt(0) > 127) {
        this.fail(
          `non-ASCII character ${JSON.stringify(this.at())} in a comment`,
          "§1.1",
        );
      }
      this.advance();
    }
  }

  skipSpaces() {
    while (this.pos < this.src.length) {
      const c = this.at();
      if (c === " " || c === "\r") { this.spaceBefore = true; this.advance(); }
      else if (c === "\t") {
        this.spaceBefore = true;
        this.fail("tab; HORSEtxt indents and separates with spaces", "§1.3");
        this.advance();
      } else break;
    }
  }

  scan() {
    const line = this.line;
    const col = this.col;
    const c = this.at();

    // GRAMMAR.md §1.1 — ASCII only. A page may declare no charset, and entities are
    // not decoded inside <script>, so a non-ASCII byte is a program that stops
    // parsing somewhere nowhere near where it broke.
    if (c.charCodeAt(0) > 127) {
      this.fail(`non-ASCII character ${JSON.stringify(c)}`, "§1.1", line, col);
      this.advance();
      return;
    }

    // Ears. `^` is never part of anything else. A bare `_` can only be an ear:
    // identifiers may contain `_` but never begin with one, and we are at a token
    // boundary here. Chords do not nest (§4), so one flag is the whole state.
    if (c === "^" || c === "_") {
      this.advance();
      if (this.inChord) {
        this.inChord = false;
        this.chordAt = null;
        this.push(T.EAR_CLOSE, c, line, col);
      } else {
        this.inChord = true;
        this.chordAt = { line, col };
        this.push(T.EAR_OPEN, c, line, col);
      }
      return;
    }

    // `~` marks its operand as graded (GRAMMAR.md §1.3). The operand may be a
    // literal, a path, or a parenthesised expression, so the lexer emits the mark
    // and the parser reads what follows.
    if (c === "~") {
      this.advance();
      return this.push(T.TILDE, "~", line, col);
    }
    if (c === '"') return this.string(line, col);
    if (isDigit(c)) return this.number(line, col);
    if (isLower(c)) return this.word(line, col);
    // An uppercase start in member position is a JavaScript name, not a FACS code.
    if (isUpper(c)) {
      return this.afterDot() ? this.word(line, col) : this.upper(line, col);
    }

    if (c === "@") { this.advance(); return this.push(T.AT, "@", line, col); }
    if (c === ":") { this.advance(); return this.push(T.COLON, ":", line, col); }
    if (c === ".") { this.advance(); return this.push(T.DOT, ".", line, col); }

    if (c === "[") { this.advance(); this.brackets++; return this.push(T.LBRACKET, "[", line, col); }
    if (c === "(") { this.advance(); this.brackets++; return this.push(T.LPAREN, "(", line, col); }
    if (c === "]") {
      this.advance();
      if (this.brackets > 0) this.brackets--;
      else this.fail("unmatched ]", "§1.4", line, col);
      return this.push(T.RBRACKET, "]", line, col);
    }
    if (c === ")") {
      this.advance();
      if (this.brackets > 0) this.brackets--;
      else this.fail("unmatched )", "§1.4", line, col);
      return this.push(T.RPAREN, ")", line, col);
    }

    for (const op of OPERATORS) {
      if (this.src.startsWith(op, this.pos)) {
        this.advance(op.length);
        return this.push(T.OP, op, line, col);
      }
    }

    this.fail(`unexpected character ${JSON.stringify(c)}`, "§1.2", line, col);
    this.advance();
  }

  // A word following a `.` is always an identifier, never a keyword — so `deck.graze`,
  // `weather.wind` and `x.arousal` all work without reserving those names.
  afterDot() {
    const prev = this.tokens[this.tokens.length - 1];
    return prev !== undefined && prev.type === T.DOT;
  }

  // In member position (after a `.`) uppercase is allowed, so interop can reach
  // camelCase JavaScript — `hands.document.createElement`. EquiFACS codes never
  // appear as members, so uppercase stays reserved everywhere it could collide.
  word(line, col) {
    const member = this.afterDot();
    let text = "";
    while (this.pos < this.src.length) {
      const c = this.at();
      if (isIdentBody(c) || (member && isUpper(c))) {
        text += c;
        this.advance();
        continue;
      }
      // GRAMMAR.md §1.3 — a hyphen joins only when it is immediately followed by
      // more identifier. So `fade-in` is one name and `a - b` is subtraction.
      const next = this.at(1);
      if (c === "-" && next !== undefined && (isIdentBody(next) || (member && isUpper(next)))) {
        text += c;
        this.advance();
        continue;
      }
      break;
    }

    if (!member && KEYWORDS.has(text)) {
      return this.push(T.KEYWORD, text, line, col);
    }
    return this.push(T.IDENT, text, line, col);
  }

  // Uppercase is reserved. It is either an EquiFACS code or a DMRT3 allele, and
  // nothing else — which is what lets AU101 and EAD103L be written verbatim.
  upper(line, col) {
    let text = "";
    while (this.pos < this.src.length && (isUpper(this.at()) || isDigit(this.at()))) {
      text += this.at();
      this.advance();
    }

    if (ALLELES.has(text)) return this.push(T.ALLELE, text, line, col);

    // AUH before AU, so AUH13 is not read as AU followed by H13.
    const m = /^(AUH|AU|EAD|AD)(\d+)([LR]?)$/.exec(text);
    if (m) return this.push(T.FACS, text, line, col);

    this.fail(
      `uppercase is reserved for EquiFACS codes and alleles; ${JSON.stringify(text)} is neither`,
      "§1.3",
      line,
      col,
    );
  }

  number(line, col) {
    let text = "";
    while (this.pos < this.src.length && isDigit(this.at())) {
      text += this.at();
      this.advance();
    }
    if (this.at() === "." && isDigit(this.at(1))) {
      text += ".";
      this.advance();
      while (this.pos < this.src.length && isDigit(this.at())) {
        text += this.at();
        this.advance();
      }
    }

    // A suffix binds only with no space, and only when nothing identifier-shaped
    // follows it — so `10s` is a duration and `10sec` is 10 then `sec`.
    const suffix = (list) => {
      for (const s of list) {
        if (!this.src.startsWith(s, this.pos)) continue;
        const after = this.at(s.length);
        if (after !== undefined && isIdentBody(after)) continue;
        this.advance(s.length);
        return s;
      }
      return null;
    };

    const d = suffix(DURATION_SUFFIXES);
    if (d) return this.push(T.DURATION, { value: Number(text), unit: d }, line, col);

    const p = suffix(DISTANCE_SUFFIXES);
    if (p) return this.push(T.DISTANCE, { value: Number(text), unit: p }, line, col);

    return this.push(T.NUMBER, Number(text), line, col);
  }

  // No escapes and no interpolation (GRAMMAR.md §11). Formatting goes through `hands`.
  string(line, col) {
    this.advance(); // opening quote
    let text = "";
    while (this.pos < this.src.length && this.at() !== '"') {
      if (this.at() === "\n") {
        this.fail("string not closed before end of line", "§1.3", line, col);
        return this.push(T.STRING, text, line, col);
      }
      text += this.at();
      this.advance();
    }
    if (this.pos >= this.src.length) {
      this.fail("string not closed before end of file", "§1.3", line, col);
      return this.push(T.STRING, text, line, col);
    }
    this.advance(); // closing quote
    this.push(T.STRING, text, line, col);
  }
}

export function tokenize(source, filename) {
  return new Lexer(source, filename).tokenize();
}

// Rendered the way the compiler reports: a few at a time, below the threshold.
export function formatErrors(result) {
  const lines = result.errors.map(
    (e) => `${e.file}:${e.line}:${e.col}  ${e.message}\n  GRAMMAR.md ${e.section}`,
  );
  if (result.suppressedErrors > 0) {
    lines.push(`${result.suppressedErrors} more, not shown.`);
  }
  return lines.join("\n\n");
}
