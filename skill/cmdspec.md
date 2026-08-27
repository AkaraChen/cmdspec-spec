---
name: cmdspec
description: |
  Reference for reading and writing cmdspec — a pseudo-shell language for
  describing command-line intent to AI agents without bash quirks.
---

# cmdspec — Command Intent Specification

cmdspec describes shell commands for AI agents to interpret and translate into
real executable commands. It is **not executable** — never run a `.cmdspec` file
directly. Instead, read it to understand what commands should be constructed.

## Reading cmdspec

When you encounter a `.cmdspec` file or a ` ```cmdspec ` code block:

1. **`RUN`** = a command to execute. Translate to the target shell.
2. **`RUN?`** = a command where failure is acceptable (like `|| true`).
3. **Variables** (`$name`) = values to resolve from context or user input.
4. **`→`** = output redirection (not a shell operator — translate to `>` or `>>`).
5. **`ASSERT`** = a precondition — verify it before running subsequent commands.
6. **`TRY/ON_FAIL/END`** = error handling — implement appropriate fallback logic.
7. **`ASYNC/END`** = commands that should run concurrently.
8. **`PIPE/END`** = a multi-line pipeline (translate to `cmd1 | cmd2 | ...`).
9. **String methods** (`.basename()`, `.strip()`, etc.) = translate to shell equivalents.

## Keywords

| Keyword | Purpose |
|---------|---------|
| `RUN` | Execute a command |
| `RUN?` | Execute, tolerate failure |
| `PIPE` / `END` | Multi-line pipeline block |
| `IF` / `ELIF` / `ELSE` / `END` | Conditional |
| `FOR` / `IN` / `END` | Iteration |
| `WHILE` / `END` | Loop |
| `TRY` / `ON_FAIL` / `END` | Error handling |
| `FN` / `RETURN` / `END` | Function definition |
| `ASYNC` / `END` | Concurrent execution |
| `ENV` | Set environment variable |
| `ASSERT` | Precondition check |
| `WAIT` | Pause for duration |
| `ABORT` | Halt with message |
| `AND` / `OR` / `NOT` | Logical operators in conditions |

## Condition operators

`==`, `!=`, `>`, `<`, `>=`, `<=` — work for both strings and numbers.

## Assert predicates

`EXISTS`, `NOT_EXISTS`, `IS_FILE`, `IS_DIR`, `IS_EMPTY`, `NOT_EMPTY`, `IN`, `NOT_IN`

## String methods → bash equivalents

| cmdspec | bash |
|---------|------|
| `$v.basename()` | `${v##*/}` |
| `$v.dirname()` | `${v%/*}` |
| `$v.strip()` | `xargs <<< "$v"` |
| `$v.to_upper()` | `${v^^}` |
| `$v.to_lower()` | `${v,,}` |
| `$v.replace(a, b)` | `${v//a/b}` |
| `$v.strip_prefix(p)` | `${v#p}` |
| `$v.strip_suffix(p)` | `${v%p}` |
| `$v.length()` | `${#v}` |
| `$v.slice(s, e)` | `${v:s:e-s}` |

## Writing cmdspec

When asked to describe commands in cmdspec:

1. Use `RUN` for every executable command — never write bare commands.
2. Use `RUN?` when failure is expected and acceptable.
3. Use `ASSERT` for preconditions the user should verify.
4. Use `TRY/ON_FAIL` for error recovery, not just to catch errors.
5. Use `→` for redirection, never `>`.
6. Use `ASYNC/END` only when commands are truly independent.
7. Use string methods instead of bash parameter expansion.
8. Put the code block language as `cmdspec`, never `bash` or `sh`.

## Example

```cmdspec
# Set up and deploy a Node.js app

app_dir = "/opt/myapp"

ASSERT $(which node) EXISTS  "Node.js is required"
ASSERT $(node --version).starts_with("v20")  "Node 20+ required"

RUN  cd $app_dir
RUN  git pull origin main
RUN  npm ci

IF ($NODE_ENV == "production")
  RUN  npm run build
  RUN  pm2 restart ecosystem.config.js
ELSE
  RUN  npm run dev
END
```
