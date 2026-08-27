---
name: cmdspec-strict
description: |
  Read and write cmdspec with parser validation. Extends the standard cmdspec
  skill — all cmdspec files must pass `cmdspec check` before completion.
---

# cmdspec (strict mode)

cmdspec describes shell commands for AI agents to interpret and translate into
real executable commands. It is **not executable** — never run a `.cmdspec` file
or ` ```cmdspec ` block directly.

**This is the strict variant.** Every `.cmdspec` file you write must pass the
reference parser before you report the task as done.

---

## Language Rules

### Core Rule

Every command that should be executed is prefixed with `RUN` or `RUN?`. Anything
without a prefix is structural (variables, control flow, comments).

### Syntax Reference

| Syntax | Meaning |
|--------|---------|
| `ARG name: type` | Required input parameter |
| `ARG? name: type = default` | Optional input with default |
| `RUN cmd` | Execute `cmd`; halt on failure |
| `RUN? cmd` | Execute `cmd`; ignore failure |
| `var = value` | Variable assignment |
| `var = $(cmd)` | Capture command output |
| `→` | Redirect output (translate to `>` in target shell) |
| `IF (cond) ... ELIF ... ELSE ... END` | Conditional |
| `FOR var IN expr ... END` | Iteration |
| `WHILE (cond) ... END` | Loop |
| `TRY ... ON_FAIL ... END` | Error recovery |
| `FN name ... ARG ... RETURN ... END` | Function (params via ARG in body) |
| `ASYNC ... END` | Run enclosed commands in parallel |
| `PIPE ... END` | Multi-line pipeline |
| `ENV var = value` | Set environment variable |
| `ENV var += value` | Append to environment variable |
| `ASSERT expr PREDICATE message` | Precondition |
| `WAIT duration` | Pause (`5s`, `2m`, `500ms`, `1h`) |
| `ABORT message` | Halt with message |

### Conditions

**Comparisons**: `==`, `!=`, `>`, `<`, `>=`, `<=`

**Logic**: `AND`, `OR`, `NOT`

### Assert Predicates

`EXISTS`, `NOT_EXISTS`, `IS_FILE`, `IS_DIR`, `IS_EMPTY`, `NOT_EMPTY`, `IN`, `NOT_IN`

### String Methods

| cmdspec | meaning | bash equivalent |
|---------|---------|-----------------|
| `$v.basename()` | filename from path | `${v##*/}` |
| `$v.dirname()` | directory from path | `${v%/*}` |
| `$v.strip()` | trim whitespace | `xargs <<< "$v"` |
| `$v.to_upper()` | uppercase | `${v^^}` |
| `$v.to_lower()` | lowercase | `${v,,}` |
| `$v.replace(a, b)` | replace all | `${v//a/b}` |
| `$v.split(delim)` | split to array | `IFS=delim read -ra` |
| `$v.starts_with(p)` | prefix test | `[[ "$v" == p* ]]` |
| `$v.ends_with(p)` | suffix test | `[[ "$v" == *p ]]` |
| `$v.contains(p)` | substring test | `[[ "$v" == *p* ]]` |
| `$v.length()` | character count | `${#v}` |
| `$v.slice(s, e)` | substring | `${v:s:e-s}` |
| `$v.strip_prefix(p)` | remove prefix | `${v#p}` |
| `$v.strip_suffix(p)` | remove suffix | `${v%p}` |

### Writing Rules

1. Prefix every executable command with `RUN` or `RUN?` — no bare commands.
2. Use `→` for redirection, never `>`.
3. Use `ASSERT` for preconditions the consumer should verify first.
4. Use `TRY/ON_FAIL` for recovery logic, `RUN?` for ignore-and-continue.
5. Use string methods, not bash parameter expansion syntax.
6. Close every block with `END` — no `fi`, `esac`, `done`.
7. Use the `cmdspec` language identifier in code fences, never `bash` or `sh`.
8. Execution halts on `RUN` failure by default — only add error handling where recovery is meaningful.
9. FN parameters go inside the body as ARG statements, not in a signature.

---

## Parser Validation

### Setup (one-time)

If the parser is not already built in this project:

```bash
cd <repo-root>/parser
npm install
npm run build
```

### Validation Workflow

After writing or modifying any `.cmdspec` file:

1. Run the parser on the file:
   ```bash
   npx cmdspec check path/to/file.cmdspec
   ```

2. If it reports errors, fix them:
   - **"Expected KEYWORD END"** — unclosed block (missing `END`)
   - **"Unexpected token"** — likely a bare command without `RUN`, or wrong keyword
   - **"Expected PAREN_OPEN"** — condition missing parentheses after `IF`/`WHILE`

3. If it reports warnings, review them:
   - **"PIPE block with fewer than 2 commands"** — use `RUN` instead
   - **"ASYNC block with fewer than 2 commands"** — no concurrency benefit
   - **"Empty TRY/ON_FAIL body"** — missing commands in error handling

4. Only report the file as complete when it passes: `✓ file.cmdspec is valid`

### Programmatic Validation

When generating cmdspec content programmatically:

```typescript
import { parse } from "cmdspec";

const result = parse(source);
if (!result.ok) {
  // Fix and retry — do not emit invalid cmdspec
}
```

### Common Parser Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Expected KEYWORD "END"` | Unclosed `IF`/`FOR`/`WHILE`/`TRY`/`FN`/`ASYNC`/`PIPE` | Add the missing `END` |
| `Expected KEYWORD "ON_FAIL"` | `TRY` without `ON_FAIL` | Add `ON_FAIL` section |
| `Expected PAREN_OPEN` | `IF`/`WHILE` condition without `()` | Wrap condition in parentheses |
| `Unexpected keyword` | Using a keyword as a variable name | Rename the variable |
| `Duplicate function definition` | Two `FN` blocks with the same name | Rename one |
| `Invalid duration` | `WAIT` with bad format | Use `5s`, `2m`, `500ms`, or `1h` |
