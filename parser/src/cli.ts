#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { parse } from "./index.js";

const args = process.argv.slice(2);
const command = args[0];
const file = args[1];
const flags = new Set(args.slice(2));

function usage() {
  console.log(`Usage:
  cmdspec check <file.cmdspec>       Validate a cmdspec file
  cmdspec parse <file.cmdspec>       Parse and show results
    --ast                            Print the AST as JSON`);
  process.exit(1);
}

if (!command || !file) usage();

let source: string = "";
try {
  source = readFileSync(file, "utf-8");
} catch {
  console.error(`Error: Cannot read file "${file}"`);
  process.exit(1);
}

const result = parse(source);

if (command === "check") {
  if (result.parseErrors.length > 0) {
    console.log("Parse errors:");
    for (const err of result.parseErrors) {
      console.log(`  ${err.line}:${err.column}  error  ${err.message}`);
    }
  }

  if (result.diagnostics.length > 0) {
    console.log("Diagnostics:");
    for (const d of result.diagnostics) {
      const icon = d.level === "error" ? "error" : "warn ";
      console.log(`  ${d.line}:${d.column}  ${icon}  ${d.message}`);
    }
  }

  if (result.ok) {
    console.log(`✓ ${file} is valid`);
    process.exit(0);
  } else {
    console.log(`✗ ${file} has errors`);
    process.exit(1);
  }
} else if (command === "parse") {
  if (result.parseErrors.length > 0) {
    console.log("Parse errors:");
    for (const err of result.parseErrors) {
      console.log(`  ${err.line}:${err.column}  ${err.message}`);
    }
  }

  if (flags.has("--ast")) {
    console.log(JSON.stringify(result.ast, null, 2));
  } else {
    console.log(`Parsed ${result.ast.body.length} top-level statements`);
    for (const node of result.ast.body) {
      console.log(`  [${node.pos.line}] ${node.type}`);
    }
  }

  if (result.diagnostics.length > 0) {
    console.log("\nDiagnostics:");
    for (const d of result.diagnostics) {
      const icon = d.level === "error" ? "error" : "warn ";
      console.log(`  ${d.line}:${d.column}  ${icon}  ${d.message}`);
    }
  }
} else {
  usage();
}
