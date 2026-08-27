import type { Token, TokenType } from "./lexer.js";
import type * as AST from "./ast.js";

export class ParseError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number
  ) {
    super(`[${line}:${column}] ${message}`);
    this.name = "ParseError";
  }
}

export class Parser {
  private tokens: Token[];
  private pos = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): { ast: AST.Program; errors: ParseError[] } {
    const body = this.parseBody(null);
    const ast: AST.Program = {
      type: "Program",
      body,
      pos: { line: 1, column: 1 },
    };
    return { ast, errors: this.errors };
  }

  private parseBody(terminators: Set<string> | null): AST.Node[] {
    const nodes: AST.Node[] = [];

    while (!this.isEOF()) {
      this.skipNewlines();
      if (this.isEOF()) break;

      const tok = this.current();

      if (terminators && tok.type === "KEYWORD" && terminators.has(tok.value)) {
        break;
      }

      const node = this.parseStatement();
      if (node) nodes.push(node);
    }

    return nodes;
  }

  private parseStatement(): AST.Node | null {
    const tok = this.current();

    if (tok.type === "NEWLINE") {
      this.advance();
      return null;
    }

    if (tok.type === "COMMAND_TEXT" && tok.value.startsWith("#")) {
      return this.parseComment();
    }

    if (tok.type === "KEYWORD") {
      switch (tok.value) {
        case "RUN":
        case "RUN?":
          return this.parseRun();
        case "PIPE":
          return this.parsePipeBlock();
        case "IF":
          return this.parseIf();
        case "FOR":
          return this.parseFor();
        case "WHILE":
          return this.parseWhile();
        case "TRY":
          return this.parseTry();
        case "FN":
          return this.parseFn();
        case "ASYNC":
          return this.parseAsync();
        case "ENV":
          return this.parseEnv();
        case "ASSERT":
          return this.parseAssert();
        case "WAIT":
          return this.parseWait();
        case "ABORT":
          return this.parseAbort();
        case "RETURN":
          return this.parseReturn();
        default:
          return this.parseAssignmentOrError();
      }
    }

    if (tok.type === "IDENT") {
      return this.parseAssignment();
    }

    this.error(`Unexpected token: ${tok.type} "${tok.value}"`);
    this.advance();
    return null;
  }

  private parseComment(): AST.Comment {
    const tok = this.current();
    this.advance();
    this.consumeNewline();
    return {
      type: "Comment",
      text: tok.value.replace(/^#\s*/, ""),
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseRun(): AST.RunStatement {
    const tok = this.current();
    const tolerant = tok.value === "RUN?";
    this.advance();

    let command = "";
    let redirect: string | null = null;

    if (this.check("COMMAND_TEXT")) {
      command = this.current().value;
      this.advance();
    }

    if (this.check("ARROW")) {
      this.advance();
      if (this.check("COMMAND_TEXT")) {
        redirect = this.current().value;
        this.advance();
      }
    }

    this.consumeNewline();

    return {
      type: "RunStatement",
      tolerant,
      command,
      redirect,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parsePipeBlock(): AST.PipeBlock {
    const tok = this.current();
    this.expect("KEYWORD", "PIPE");
    this.consumeNewline();

    const commands: string[] = [];
    let redirect: string | null = null;

    while (!this.isEOF()) {
      this.skipNewlines();
      if (this.checkKeyword("END")) break;

      if (this.check("ARROW")) {
        this.advance();
        redirect = this.readRestOfLine().trim();
        continue;
      }

      const line = this.readRestOfLine().trim();
      if (line) commands.push(line);
    }

    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "PipeBlock",
      commands,
      redirect,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseIf(): AST.IfBlock {
    const tok = this.current();
    this.expect("KEYWORD", "IF");

    const condition = this.readParenthesized();
    this.consumeNewline();

    const body = this.parseBody(new Set(["ELIF", "ELSE", "END"]));

    const elifs: { condition: string; body: AST.Node[] }[] = [];
    while (this.checkKeyword("ELIF")) {
      this.advance();
      const elifCond = this.readParenthesized();
      this.consumeNewline();
      const elifBody = this.parseBody(new Set(["ELIF", "ELSE", "END"]));
      elifs.push({ condition: elifCond, body: elifBody });
    }

    let elseBody: AST.Node[] | null = null;
    if (this.checkKeyword("ELSE")) {
      this.advance();
      this.consumeNewline();
      elseBody = this.parseBody(new Set(["END"]));
    }

    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "IfBlock",
      condition,
      body,
      elifs,
      elseBody,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseFor(): AST.ForBlock {
    const tok = this.current();
    this.expect("KEYWORD", "FOR");

    const variable = this.expectIdent();
    this.expect("KEYWORD", "IN");

    let iterable = "";
    while (!this.isEOF() && !this.check("NEWLINE")) {
      iterable += this.current().value;
      this.advance();
    }
    this.consumeNewline();

    const body = this.parseBody(new Set(["END"]));
    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "ForBlock",
      variable,
      iterable: iterable.trim(),
      body,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseWhile(): AST.WhileBlock {
    const tok = this.current();
    this.expect("KEYWORD", "WHILE");

    const condition = this.readParenthesized();
    this.consumeNewline();

    const body = this.parseBody(new Set(["END"]));
    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "WhileBlock",
      condition,
      body,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseTry(): AST.TryBlock {
    const tok = this.current();
    this.expect("KEYWORD", "TRY");
    this.consumeNewline();

    const body = this.parseBody(new Set(["ON_FAIL"]));
    this.expect("KEYWORD", "ON_FAIL");
    this.consumeNewline();

    const onFail = this.parseBody(new Set(["END"]));
    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "TryBlock",
      body,
      onFail,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseFn(): AST.FnBlock {
    const tok = this.current();
    this.expect("KEYWORD", "FN");

    const name = this.expectIdent();
    this.expect("PAREN_OPEN");

    const params: string[] = [];
    while (!this.isEOF() && !this.check("PAREN_CLOSE")) {
      if (params.length > 0) this.expect("COMMA");
      params.push(this.expectIdent());
    }
    this.expect("PAREN_CLOSE");
    this.consumeNewline();

    const body = this.parseBody(new Set(["END"]));
    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "FnBlock",
      name,
      params,
      body,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseAsync(): AST.AsyncBlock {
    const tok = this.current();
    this.expect("KEYWORD", "ASYNC");
    this.consumeNewline();

    const body = this.parseBody(new Set(["END"]));
    this.expect("KEYWORD", "END");
    this.consumeNewline();

    return {
      type: "AsyncBlock",
      body,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseEnv(): AST.EnvStatement {
    const tok = this.current();
    this.expect("KEYWORD", "ENV");

    const name = this.expectIdent();
    let op: "=" | "+=" = "=";

    if (this.check("PLUS_ASSIGN")) {
      op = "+=";
      this.advance();
    } else {
      this.expect("ASSIGN");
    }

    let value = "";
    while (!this.isEOF() && !this.check("NEWLINE")) {
      value += this.current().value;
      if (this.check("STRING")) {
        value = this.current().value;
        this.advance();
        break;
      }
      this.advance();
    }
    this.consumeNewline();

    return {
      type: "EnvStatement",
      name,
      op,
      value: value.trim(),
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseAssert(): AST.AssertStatement {
    const tok = this.current();
    this.expect("KEYWORD", "ASSERT");

    let expr = "";
    while (
      !this.isEOF() &&
      !this.check("NEWLINE") &&
      !(this.check("KEYWORD") && this.isAssertPredicate(this.current().value))
    ) {
      expr += this.current().value + " ";
      this.advance();
    }

    let predicate = "EXISTS";
    if (this.check("KEYWORD") && this.isAssertPredicate(this.current().value)) {
      predicate = this.current().value;
      this.advance();
    }

    let argument: string | null = null;
    let message: string | null = null;

    // Read remaining tokens for argument and message
    while (!this.isEOF() && !this.check("NEWLINE")) {
      if (this.check("STRING")) {
        message = this.current().value;
        this.advance();
        break;
      }
      if (argument === null) argument = "";
      argument += this.current().value + " ";
      this.advance();
    }

    this.consumeNewline();

    return {
      type: "AssertStatement",
      expr: expr.trim(),
      predicate,
      argument: argument?.trim() ?? null,
      message,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseWait(): AST.WaitStatement {
    const tok = this.current();
    this.expect("KEYWORD", "WAIT");

    let duration = "";
    if (this.check("DURATION")) {
      duration = this.current().value;
      this.advance();
    } else if (this.check("NUMBER")) {
      duration = this.current().value;
      this.advance();
      // might have suffix as ident
      if (this.check("IDENT")) {
        duration += this.current().value;
        this.advance();
      }
    }

    this.consumeNewline();

    return {
      type: "WaitStatement",
      duration,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseAbort(): AST.AbortStatement {
    const tok = this.current();
    this.expect("KEYWORD", "ABORT");

    let message = "";
    if (this.check("STRING")) {
      message = this.current().value;
      this.advance();
    } else {
      while (!this.isEOF() && !this.check("NEWLINE")) {
        message += this.current().value + " ";
        this.advance();
      }
      message = message.trim();
    }

    this.consumeNewline();

    return {
      type: "AbortStatement",
      message,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseReturn(): AST.ReturnStatement {
    const tok = this.current();
    this.expect("KEYWORD", "RETURN");

    let value: string | null = null;
    if (!this.isEOF() && !this.check("NEWLINE")) {
      value = "";
      while (!this.isEOF() && !this.check("NEWLINE")) {
        value += this.current().value;
        this.advance();
      }
      value = value.trim();
    }

    this.consumeNewline();

    return {
      type: "ReturnStatement",
      value,
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseAssignment(): AST.Assignment {
    const tok = this.current();
    const name = tok.value;
    this.advance();
    this.expect("ASSIGN");

    let value = "";
    while (!this.isEOF() && !this.check("NEWLINE")) {
      const cur = this.current();
      if (cur.type === "STRING") {
        value += cur.value;
      } else {
        value += cur.value;
      }
      this.advance();
    }
    this.consumeNewline();

    return {
      type: "Assignment",
      name,
      value: value.trim(),
      pos: { line: tok.line, column: tok.column },
    };
  }

  private parseAssignmentOrError(): AST.Node | null {
    this.error(`Unexpected keyword: "${this.current().value}"`);
    this.advance();
    return null;
  }

  // --- Helpers ---

  private readParenthesized(): string {
    this.expect("PAREN_OPEN");
    let depth = 1;
    let content = "";
    while (!this.isEOF() && depth > 0) {
      const tok = this.current();
      if (tok.type === "PAREN_OPEN" || tok.type === "DOLLAR_PAREN") depth++;
      if (tok.type === "PAREN_CLOSE") {
        depth--;
        if (depth === 0) break;
      }
      if (tok.type === "STRING") {
        content += '"' + tok.value + '" ';
      } else if (tok.type === "COMPARATOR") {
        content += tok.value + " ";
      } else if (tok.type === "DOLLAR_PAREN") {
        content += "$( ";
      } else {
        content += tok.value + " ";
      }
      this.advance();
    }
    this.expect("PAREN_CLOSE");
    return content.trim();
  }

  private readRestOfLine(): string {
    let content = "";
    while (!this.isEOF() && !this.check("NEWLINE")) {
      const tok = this.current();
      if (tok.type === "STRING") {
        content += '"' + tok.value + '" ';
      } else {
        content += tok.value + " ";
      }
      this.advance();
    }
    this.consumeNewline();
    return content;
  }

  private isAssertPredicate(value: string): boolean {
    return [
      "EXISTS",
      "NOT_EXISTS",
      "IS_FILE",
      "IS_DIR",
      "IS_EMPTY",
      "NOT_EMPTY",
      "IN",
      "NOT_IN",
    ].includes(value);
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: "EOF", value: "", line: 0, column: 0 };
  }

  private advance(): Token {
    const tok = this.current();
    this.pos++;
    return tok;
  }

  private check(type: TokenType, value?: string): boolean {
    const tok = this.current();
    if (tok.type !== type) return false;
    if (value !== undefined && tok.value !== value) return false;
    return true;
  }

  private checkKeyword(value: string): boolean {
    return this.check("KEYWORD", value);
  }

  private expect(type: TokenType, value?: string): Token {
    if (!this.check(type, value)) {
      const tok = this.current();
      const expected = value ? `${type} "${value}"` : type;
      this.error(`Expected ${expected}, got ${tok.type} "${tok.value}"`);
    }
    return this.advance();
  }

  private expectIdent(): string {
    const tok = this.expect("IDENT");
    return tok.value;
  }

  private consumeNewline() {
    while (this.check("NEWLINE")) this.advance();
  }

  private skipNewlines() {
    while (this.check("NEWLINE")) this.advance();
  }

  private isEOF(): boolean {
    return this.current().type === "EOF";
  }

  private error(msg: string) {
    const tok = this.current();
    this.errors.push(new ParseError(msg, tok.line, tok.column));
  }
}
