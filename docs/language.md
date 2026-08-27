# cmdspec Language Reference

This is the complete syntax reference for cmdspec. For motivation and use cases, see [use-cases.md](use-cases.md). For tooling, see [tooling.md](tooling.md).

## Arguments

`ARG` declares a required input. `ARG?` declares an optional input with a default value. Arguments must appear at the top of the file (before any commands) or at the top of a `FN` body (before any commands in that function).

```cmdspec
# Container registry URL
ARG registry: string
# Deploy environment
ARG env: string
# Enable dry-run mode
ARG? dry_run: boolean = false
# Number of replicas
ARG? replicas: number = 2
# Extra CLI flags
ARG? flags: string[] = ["--verbose"]
```

**Types**: `string`, `number`, `boolean`, `string[]`, `number[]`

**Rules**:
- `ARG` (required) must not have a default value
- `ARG?` (optional) must have a default value
- Comments immediately above an ARG serve as its description

### ARG in Functions

Functions declare their parameters as ARG statements at the top of the body, not in a signature:

```cmdspec
FN deploy
  # Deployment target name
  ARG target: string
  # Image version tag
  ARG version: string
  # Replicas to scale to
  ARG? replicas: number = 1

  RUN  kubectl set image deploy/$target app=img:$version
  RUN  kubectl scale deploy/$target --replicas=$replicas
END
```

## Comments

Lines starting with `#`. Inline comments with ` #` (space before `#`).

```cmdspec
# This is a comment
RUN echo hello  # inline comment
```

## Variables

Assignment with `=`. No quoting semantics — a value is always a single unit, never word-split. Reference with `$`.

```cmdspec
name = "my-app"
version = "1.2.3"
ports = [3000, 3001, 8080]
config = {env: "prod", debug: false}

RUN echo $name
RUN echo $ports[0]
```

## String Methods

Methods replace bash parameter expansion. Each method has a direct shell equivalent, but the intent is clearer.

| cmdspec | bash equivalent | meaning |
|---------|----------------|---------|
| `$path.basename()` | `${path##*/}` | filename from path |
| `$path.dirname()` | `${path%/*}` | directory from path |
| `$s.strip()` | `echo "$s" \| xargs` | trim whitespace |
| `$s.to_upper()` | `echo "$s" \| tr a-z A-Z` | uppercase |
| `$s.to_lower()` | `echo "$s" \| tr A-Z a-z` | lowercase |
| `$s.replace(a, b)` | `${s//a/b}` | replace all occurrences |
| `$s.split(delim)` | `IFS=delim read -ra ...` | split to array |
| `$s.starts_with(p)` | `[[ "$s" == p* ]]` | prefix test |
| `$s.ends_with(p)` | `[[ "$s" == *p ]]` | suffix test |
| `$s.contains(p)` | `[[ "$s" == *p* ]]` | substring test |
| `$s.length()` | `${#s}` | character count |
| `$s.slice(start, end)` | `${s:start:len}` | substring |
| `$s.strip_prefix(p)` | `${s#p}` | remove prefix |
| `$s.strip_suffix(p)` | `${s%p}` | remove suffix |

## RUN Statements

`RUN` marks a command for execution. `RUN?` marks a command where failure is acceptable (equivalent to `|| true` in bash).

```cmdspec
RUN  npm install
RUN  npm run build
RUN? rm -rf /tmp/cache  # ok if this fails
```

Default behavior is **fail-fast**: any `RUN` failure halts execution unless caught by `TRY/ON_FAIL`.

## Command Capture

Capture output into a variable with `$()`.

```cmdspec
result = $(curl -s $api_url)
count = $(wc -l < $file)
status = $(RUN docker inspect $cid).State.Status
```

## Redirection

Use `→` for output redirection (never `>`). Named streams for explicit routing.

```cmdspec
RUN  npm install → stdout: /dev/null, stderr: $err_log
RUN  echo "debug" → STDERR
RUN  cmd → $outfile                    # stdout to file
RUN  cmd → stdout: $out, stderr: $err  # split streams
```

## Pipes

Inline with `|` or block form with `PIPE/END` for long pipelines.

```cmdspec
# Inline
RUN  cat access.log | grep "ERROR" | sort | uniq -c → $errors

# Block form
PIPE
  cat access.log
  grep "ERROR"
  sort
  uniq -c
  → $errors
END
```

## Conditionals

`IF/ELIF/ELSE/END` with parenthesized conditions. Standard comparison operators work for both strings and numbers — no `-eq`/`-ne` split.

```cmdspec
IF ($env == "production" AND $cpu > 2)
  RUN  npm run build --mode=release
ELIF ($env == "staging")
  RUN  npm run build --mode=preview
ELSE
  RUN  npm run dev
END
```

**Comparison operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`

**Logical operators**: `AND`, `OR`, `NOT`

## Loops

### FOR

```cmdspec
FOR file IN $(find . -name "*.log")
  RUN  gzip $file
END

FOR port IN $ports
  RUN  curl -s http://localhost:$port/health
END
```

### WHILE

```cmdspec
WHILE ($(curl -s -o /dev/null -w "%{http_code}" $url) != "200")
  WAIT 5s
END
```

## Error Handling

### TRY / ON_FAIL

Catch command failures and run recovery logic.

```cmdspec
TRY
  RUN  docker compose up -d
  RUN  docker compose exec app migrate
ON_FAIL
  RUN  docker compose logs → $logfile
  ABORT "Startup failed, see $logfile"
END
```

### Nesting

TRY blocks can nest for granular recovery.

```cmdspec
TRY
  RUN  docker compose up -d
  TRY
    RUN  docker compose exec app rails db:migrate
  ON_FAIL
    RUN  docker compose exec app rails db:rollback
    ABORT "Migration failed, rolled back"
  END
ON_FAIL
  RUN  docker compose down
  ABORT "Service startup failed"
END
```

## Functions

Functions are declared with `FN` followed by the name. Parameters are declared as `ARG`/`ARG?` statements at the top of the body.

```cmdspec
FN deploy
  # Deployment target
  ARG target: string
  # Image version tag
  ARG version: string

  RUN  kubectl set image deploy/$target app=img:$version
  RUN  kubectl rollout status deploy/$target
  RETURN $?
END

RUN deploy("web", "1.2.3")
RUN deploy("worker", "1.2.3")
```

## Concurrency

`ASYNC/END` runs all enclosed commands in parallel. Execution resumes after all complete.

```cmdspec
ASYNC
  RUN  npm run build
  RUN  npm run test
  RUN  npm run lint
END
# all three done before this line
```

## Environment Variables

```cmdspec
ENV NODE_ENV = "production"
ENV PATH += "/usr/local/go/bin"
```

`=` sets, `+=` appends.

## Assertions

Preconditions that must hold before proceeding. The agent should verify these before constructing executable commands.

```cmdspec
ASSERT $(which docker) EXISTS       "docker must be installed"
ASSERT $port NOT_IN $(lsof -ti:$port)  "port $port is already in use"
ASSERT $file IS_FILE                "expected $file to exist"
ASSERT $dir IS_DIR                  "expected $dir to be a directory"
```

**Predicates**: `EXISTS`, `NOT_EXISTS`, `IS_FILE`, `IS_DIR`, `IS_EMPTY`, `NOT_EMPTY`, `IN`, `NOT_IN`

## Wait

Pause execution for a duration.

```cmdspec
WAIT 5s
WAIT 2m
WAIT 500ms
```

**Units**: `ms` (milliseconds), `s` (seconds), `m` (minutes), `h` (hours)

## Abort

Halt execution with a message.

```cmdspec
ABORT "Cannot continue: $reason"
```

## Formal Grammar

The full EBNF grammar is in [../grammar.ebnf](../grammar.ebnf).
