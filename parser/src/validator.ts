import type * as AST from "./ast.js";

export interface Diagnostic {
  level: "error" | "warning";
  message: string;
  line: number;
  column: number;
}

export function validate(program: AST.Program): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const definedFunctions = new Set<string>();
  const definedVariables = new Set<string>();

  function walk(nodes: AST.Node[]) {
    for (const node of nodes) {
      visitNode(node);
    }
  }

  function visitNode(node: AST.Node) {
    switch (node.type) {
      case "Assignment":
        definedVariables.add(node.name);
        break;

      case "EnvStatement":
        definedVariables.add(node.name);
        break;

      case "RunStatement":
        if (!node.command && !node.tolerant) {
          diagnostics.push({
            level: "warning",
            message: "RUN statement with no command",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        break;

      case "PipeBlock":
        if (node.commands.length < 2) {
          diagnostics.push({
            level: "warning",
            message: "PIPE block with fewer than 2 commands — consider using RUN instead",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        break;

      case "IfBlock":
        if (!node.condition) {
          diagnostics.push({
            level: "error",
            message: "IF block with empty condition",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        walk(node.body);
        for (const elif of node.elifs) {
          walk(elif.body);
        }
        if (node.elseBody) walk(node.elseBody);
        break;

      case "ForBlock":
        definedVariables.add(node.variable);
        if (!node.iterable) {
          diagnostics.push({
            level: "error",
            message: "FOR block with empty iterable",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        walk(node.body);
        break;

      case "WhileBlock":
        if (!node.condition) {
          diagnostics.push({
            level: "error",
            message: "WHILE block with empty condition",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        walk(node.body);
        break;

      case "TryBlock":
        if (node.body.length === 0) {
          diagnostics.push({
            level: "warning",
            message: "TRY block with empty body",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        if (node.onFail.length === 0) {
          diagnostics.push({
            level: "warning",
            message: "ON_FAIL block with empty body",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        walk(node.body);
        walk(node.onFail);
        break;

      case "FnBlock":
        if (definedFunctions.has(node.name)) {
          diagnostics.push({
            level: "error",
            message: `Duplicate function definition: ${node.name}`,
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        definedFunctions.add(node.name);
        for (const p of node.params) {
          definedVariables.add(p);
        }
        walk(node.body);
        break;

      case "AsyncBlock":
        if (node.body.length < 2) {
          diagnostics.push({
            level: "warning",
            message: "ASYNC block with fewer than 2 commands — no concurrency benefit",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        walk(node.body);
        break;

      case "WaitStatement":
        if (!node.duration) {
          diagnostics.push({
            level: "error",
            message: "WAIT statement with no duration",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        if (node.duration && !node.duration.match(/^\d+(\.\d+)?(ms|s|m|h)$/)) {
          diagnostics.push({
            level: "error",
            message: `Invalid duration: "${node.duration}" — expected format like 5s, 2m, 500ms`,
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        break;

      case "AssertStatement":
        if (!node.expr) {
          diagnostics.push({
            level: "error",
            message: "ASSERT with no expression",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        break;

      case "AbortStatement":
        if (!node.message) {
          diagnostics.push({
            level: "warning",
            message: "ABORT with no message",
            line: node.pos.line,
            column: node.pos.column,
          });
        }
        break;

      case "ReturnStatement":
        break;

      case "Comment":
        break;

      case "Program":
        walk(node.body);
        break;
    }
  }

  walk(program.body);
  return diagnostics;
}
