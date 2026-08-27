export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export type TokenType =
  | "KEYWORD"
  | "IDENT"
  | "STRING"
  | "NUMBER"
  | "DURATION"
  | "OP"
  | "PAREN_OPEN"
  | "PAREN_CLOSE"
  | "BRACKET_OPEN"
  | "BRACKET_CLOSE"
  | "BRACE_OPEN"
  | "BRACE_CLOSE"
  | "ARROW"
  | "COMMA"
  | "COLON"
  | "DOT"
  | "PIPE"
  | "DOLLAR_PAREN"
  | "VARIABLE"
  | "ASSIGN"
  | "PLUS_ASSIGN"
  | "COMPARATOR"
  | "COMMAND_TEXT"
  | "NEWLINE"
  | "EOF";

const KEYWORDS = new Set([
  "RUN",
  "RUN?",
  "PIPE",
  "IF",
  "ELIF",
  "ELSE",
  "END",
  "FOR",
  "IN",
  "WHILE",
  "TRY",
  "ON_FAIL",
  "FN",
  "RETURN",
  "ASYNC",
  "ENV",
  "ASSERT",
  "WAIT",
  "ABORT",
  "AND",
  "OR",
  "NOT",
  "EXISTS",
  "NOT_EXISTS",
  "IS_FILE",
  "IS_DIR",
  "IS_EMPTY",
  "NOT_EMPTY",
  "NOT_IN",
]);

const COMPARATORS = new Set(["==", "!=", ">=", "<=", ">", "<"]);

export class Lexer {
  private source: string;
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];
  private inCommandContext = false;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceInLine();

      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      if (ch === "\n") {
        this.push("NEWLINE", "\n");
        this.advance();
        this.inCommandContext = false;
        continue;
      }

      if (ch === "#") {
        this.readComment();
        continue;
      }

      if (this.inCommandContext) {
        this.readCommandText();
        continue;
      }

      if (ch === '"') {
        this.readString();
        continue;
      }

      if (ch === "$" && this.peek(1) === "(") {
        this.push("DOLLAR_PAREN", "$(");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === "$") {
        this.readVariable();
        continue;
      }

      if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.peek(1)))) {
        this.readNumber();
        continue;
      }

      if (ch === "→") {
        this.push("ARROW", "→");
        this.advance();
        continue;
      }

      if (ch === "+" && this.peek(1) === "=") {
        this.push("PLUS_ASSIGN", "+=");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === "=" && this.peek(1) === "=") {
        this.push("COMPARATOR", "==");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === "!" && this.peek(1) === "=") {
        this.push("COMPARATOR", "!=");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === ">" && this.peek(1) === "=") {
        this.push("COMPARATOR", ">=");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === "<" && this.peek(1) === "=") {
        this.push("COMPARATOR", "<=");
        this.advance();
        this.advance();
        continue;
      }

      if (ch === ">") {
        this.push("COMPARATOR", ">");
        this.advance();
        continue;
      }

      if (ch === "<") {
        this.push("COMPARATOR", "<");
        this.advance();
        continue;
      }

      if (ch === "=") {
        this.push("ASSIGN", "=");
        this.advance();
        continue;
      }

      const simpleTokens: Record<string, TokenType> = {
        "(": "PAREN_OPEN",
        ")": "PAREN_CLOSE",
        "[": "BRACKET_OPEN",
        "]": "BRACKET_CLOSE",
        "{": "BRACE_OPEN",
        "}": "BRACE_CLOSE",
        ",": "COMMA",
        ":": "COLON",
        ".": "DOT",
        "|": "PIPE",
      };

      if (ch in simpleTokens) {
        this.push(simpleTokens[ch], ch);
        this.advance();
        continue;
      }

      if (this.isIdentStart(ch)) {
        this.readIdentOrKeyword();
        continue;
      }

      this.advance();
    }

    this.push("EOF", "");
    return this.tokens;
  }

  private readComment() {
    const start = this.pos;
    while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
      this.advance();
    }
    // comments are skipped in tokenization, but we still record them
    this.push("COMMAND_TEXT", this.source.slice(start, this.pos));
  }

  private readString() {
    this.advance(); // skip opening "
    let value = "";
    while (this.pos < this.source.length && this.source[this.pos] !== '"') {
      if (this.source[this.pos] === "\\" && this.pos + 1 < this.source.length) {
        this.advance();
        value += this.source[this.pos];
      } else {
        value += this.source[this.pos];
      }
      this.advance();
    }
    if (this.pos < this.source.length) this.advance(); // skip closing "
    this.push("STRING", value);
  }

  private readVariable() {
    this.advance(); // skip $
    let name = "";
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      name += this.source[this.pos];
      this.advance();
    }
    this.push("VARIABLE", name);
  }

  private readNumber() {
    let num = "";
    if (this.source[this.pos] === "-") {
      num += "-";
      this.advance();
    }
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      num += this.source[this.pos];
      this.advance();
    }
    if (this.pos < this.source.length && this.source[this.pos] === ".") {
      num += ".";
      this.advance();
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        num += this.source[this.pos];
        this.advance();
      }
    }
    // Check for duration suffix
    const suffixStart = this.pos;
    let suffix = "";
    if (this.pos < this.source.length) {
      const rest = this.source.slice(this.pos, this.pos + 2);
      if (rest === "ms") {
        suffix = "ms";
      } else if (rest[0] === "s" || rest[0] === "m" || rest[0] === "h") {
        suffix = rest[0];
      }
    }
    if (suffix) {
      for (let i = 0; i < suffix.length; i++) this.advance();
      this.push("DURATION", num + suffix);
    } else {
      this.push("NUMBER", num);
    }
  }

  private readIdentOrKeyword() {
    let word = "";
    const startCol = this.column;
    const startLine = this.line;
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      word += this.source[this.pos];
      this.advance();
    }

    // RUN? is a special keyword
    if (word === "RUN" && this.pos < this.source.length && this.source[this.pos] === "?") {
      word += "?";
      this.advance();
    }

    if (KEYWORDS.has(word)) {
      this.tokens.push({ type: "KEYWORD", value: word, line: startLine, column: startCol });

      // After RUN/RUN?, switch to command context
      if (word === "RUN" || word === "RUN?") {
        this.inCommandContext = true;
      }
    } else {
      this.tokens.push({ type: "IDENT", value: word, line: startLine, column: startCol });
    }
  }

  private readCommandText() {
    this.skipWhitespaceInLine();
    let text = "";
    const startLine = this.line;
    const startCol = this.column;

    while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
      // Handle inline comment
      if (this.source[this.pos] === " " && this.peek(1) === "#") {
        break;
      }
      // Handle redirect arrow
      if (this.source[this.pos] === "→") {
        if (text.trim()) {
          this.tokens.push({
            type: "COMMAND_TEXT",
            value: text.trim(),
            line: startLine,
            column: startCol,
          });
        }
        this.push("ARROW", "→");
        for (let i = 0; i < "→".length; i++) this.advance();
        text = "";
        // Read the rest as command text (redirect target)
        this.skipWhitespaceInLine();
        let target = "";
        while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
          if (this.source[this.pos] === " " && this.peek(1) === "#") break;
          target += this.source[this.pos];
          this.advance();
        }
        if (target.trim()) {
          this.tokens.push({
            type: "COMMAND_TEXT",
            value: target.trim(),
            line: this.line,
            column: this.column,
          });
        }
        return;
      }
      text += this.source[this.pos];
      this.advance();
    }

    if (text.trim()) {
      this.tokens.push({
        type: "COMMAND_TEXT",
        value: text.trim(),
        line: startLine,
        column: startCol,
      });
    }
  }

  private push(type: TokenType, value: string) {
    this.tokens.push({ type, value, line: this.line, column: this.column });
  }

  private advance() {
    if (this.source[this.pos] === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.pos++;
  }

  private peek(offset: number): string {
    return this.source[this.pos + offset] ?? "";
  }

  private skipWhitespaceInLine() {
    while (
      this.pos < this.source.length &&
      (this.source[this.pos] === " " || this.source[this.pos] === "\t")
    ) {
      this.advance();
    }
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === "-";
  }
}
