---
name: cmdspec
description: |
  Read and write cmdspec — a pseudo-shell language for describing command-line
  intent without bash quirks. This skill covers language rules only, no parser.
---

# cmdspec

cmdspec describes shell commands for AI agents to interpret and translate into
real executable commands. It is **not executable** — never run a `.cmdspec` file
or ` ```cmdspec ` block directly.

## Core Rule

Every command that should be executed is prefixed with `RUN` or `RUN?`. Anything
without a prefix is structural (variables, control flow, comments).

## Reading cmdspec

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

## Conditions

**Comparisons**: `==`, `!=`, `>`, `<`, `>=`, `<=`

**Logic**: `AND`, `OR`, `NOT`

All comparisons work for both strings and numbers — no `-eq`/`-ne` split.

## Assert Predicates

`EXISTS`, `NOT_EXISTS`, `IS_FILE`, `IS_DIR`, `IS_EMPTY`, `NOT_EMPTY`, `IN`, `NOT_IN`

## String Methods

These replace bash parameter expansion. Translate to the target shell equivalent.

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

## ARG types

`string`, `number`, `boolean`, `string[]`, `number[]`

## Writing cmdspec

1. Declare inputs with `ARG`/`ARG?` at the top of the file or FN body, with a `#` comment above each.
2. Prefix every executable command with `RUN` or `RUN?` — no bare commands.
2. Use `→` for redirection, never `>`.
3. Use `ASSERT` for preconditions the consumer should verify first.
4. Use `TRY/ON_FAIL` for recovery logic, `RUN?` for ignore-and-continue.
5. Use string methods, not bash parameter expansion syntax.
6. Close every block with `END` — no `fi`, `esac`, `done`.
7. Use the `cmdspec` language identifier in code fences, never `bash` or `sh`.
8. Execution halts on `RUN` failure by default — only add error handling where recovery is meaningful.
9. FN parameters go inside the body as ARG statements, not in a signature.

## Example

```cmdspec
# Set up and deploy a Node.js app

# Application root directory
ARG app_dir: string
# Target environment
ARG? node_env: string = "development"

ASSERT $(which node) EXISTS  "Node.js is required"

RUN  cd $app_dir
RUN  git pull origin main
RUN  npm ci

IF ($node_env == "production")
  RUN  npm run build
  RUN  pm2 restart ecosystem.config.js
ELSE
  RUN  npm run dev
END
```
