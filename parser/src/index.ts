export { Lexer } from "./lexer.js";
export type { Token, TokenType } from "./lexer.js";
export { Parser, ParseError } from "./parser.js";
export type * from "./ast.js";
export { validate } from "./validator.js";
export type { Diagnostic } from "./validator.js";

import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { validate } from "./validator.js";
import type { Program } from "./ast.js";
import type { Diagnostic } from "./validator.js";
import type { ParseError } from "./parser.js";

export interface ParseResult {
  ast: Program;
  parseErrors: ParseError[];
  diagnostics: Diagnostic[];
  ok: boolean;
}

export function parse(source: string): ParseResult {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const { ast, errors: parseErrors } = parser.parse();
  const diagnostics = validate(ast);
  const ok =
    parseErrors.length === 0 &&
    diagnostics.filter((d) => d.level === "error").length === 0;
  return { ast, parseErrors, diagnostics, ok };
}
