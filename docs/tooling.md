# cmdspec Tooling

## Reference Parser

A recursive-descent parser in TypeScript is provided for structural validation. It checks that a `.cmdspec` file is syntactically correct — properly nested blocks, valid keywords, balanced `TRY/ON_FAIL/END`, etc.

### Setup

```bash
cd parser
npm install
npm run build
```

### Validate a file

```bash
npx cmdspec check path/to/file.cmdspec
```

Output:

```
✓ path/to/file.cmdspec is valid
```

Or, on error:

```
Parse errors:
  12:5  error  Expected KEYWORD "END", got EOF ""
✗ path/to/file.cmdspec has errors
```

### Parse and inspect

```bash
# Summary
npx cmdspec parse path/to/file.cmdspec

# Full AST as JSON
npx cmdspec parse path/to/file.cmdspec --ast
```

### Programmatic use

```typescript
import { parse } from "cmdspec";

const result = parse(source);

if (result.ok) {
  console.log("Valid:", result.ast.body.length, "statements");
} else {
  for (const err of result.parseErrors) {
    console.error(`${err.line}:${err.column} ${err.message}`);
  }
  for (const d of result.diagnostics) {
    console.warn(`${d.line}:${d.column} [${d.level}] ${d.message}`);
  }
}
```

The parser also runs a validation pass that reports warnings (not just syntax errors):

- `PIPE` block with fewer than 2 commands
- `ASYNC` block with fewer than 2 commands (no concurrency benefit)
- Empty `TRY` or `ON_FAIL` body
- Duplicate function definitions
- Missing duration on `WAIT`
- Empty conditions on `IF`/`WHILE`

### Architecture

```
parser/src/
├── ast.ts        — AST node type definitions
├── lexer.ts      — Tokenizer (keywords, strings, variables, operators)
├── parser.ts     — Recursive descent parser → AST
├── validator.ts  — Semantic validation pass
├── index.ts      — Public API (parse function)
└── cli.ts        — CLI entry point
```

## Claude Code Skills

Two skill variants are provided for agents that read or write cmdspec:

### `skill/cmdspec.md` — Standard

Lightweight reference. Covers all keywords, operators, string methods, and reading/writing rules. No parser dependency — the agent uses its own judgment for structural correctness.

Best for: agents that need to read cmdspec files and translate them, or write cmdspec in conversation.

### `skill/cmdspec-strict.md` — Strict

Includes everything in the standard skill, plus instructions to validate output with the parser. The agent runs `cmdspec check` on any `.cmdspec` file it writes and fixes errors before reporting completion.

Best for: workflows where cmdspec files are committed to a repo and must be syntactically valid.

## Formal Grammar

[grammar.ebnf](../grammar.ebnf) contains the full EBNF grammar. It's authoritative — if the parser and the EBNF disagree, the EBNF is correct and the parser has a bug.

## File Extension

cmdspec files use the `.cmdspec` extension. Code blocks use the `cmdspec` language identifier:

````markdown
```cmdspec
RUN echo hello
```
````
