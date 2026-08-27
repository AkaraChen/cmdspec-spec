# cmdspec

A pseudo-shell language for describing command-line intent to AI agents — unambiguously, without the quirks of bash, and explicitly **not executable**.

## Why

When you give an AI agent a bash script as a reference, it will try to run it verbatim. When you describe commands in natural language, details get lost. `cmdspec` sits in between: structured enough to be precise, obviously-not-bash enough that no agent will `chmod +x` it.

## Design Principles

1. **`RUN` prefix** — every executable command is explicitly marked; everything else is description
2. **No quoting hell** — variables are values, not word-split landmines
3. **Normal control flow** — `IF/ELIF/ELSE/END`, not `fi`/`esac`/`done`
4. **Methods over hieroglyphs** — `.basename()` instead of `${var##*/}`
5. **Explicit error handling** — fail-fast by default, `TRY/ON_FAIL` for recovery, `RUN?` to ignore
6. **`→` not `>`** — visually distinct, syntactically invalid in any shell
7. **`ASSERT`** — preconditions that bash can't express
8. **`ASYNC/END`** — concurrency without `&` + `wait` incantations

## Quick Example

```cmdspec
# Deploy a service with health check

repo = "https://github.com/org/app"
health_url = "https://app.example.com/health"

ASSERT $(which docker) EXISTS  "docker is required"
ASSERT $(which kubectl) EXISTS "kubectl is required"

RUN  git clone $repo → ./app
RUN  cd ./app

TRY
  RUN  docker build -t app:latest .
  RUN  docker push registry.example.com/app:latest
  RUN  kubectl rollout restart deploy/app
ON_FAIL
  RUN  docker compose logs → $logfile
  ABORT "Deploy failed, logs at $logfile"
END

WHILE ($(curl -s -o /dev/null -w "%{http_code}" $health_url) != "200")
  WAIT 5s
END
```

## Spec

### Comments

Lines starting with `#`. Inline comments with ` #` (space before `#`).

```cmdspec
# This is a comment
RUN echo hello  # inline comment
```

### Variables

Assignment with `=`. No quoting semantics — a value is always a single unit. Reference with `$`.

```cmdspec
name = "my-app"
version = "1.2.3"
ports = [3000, 3001, 8080]
config = {env: "prod", debug: false}

RUN echo $name
RUN echo $ports[0]
```

### String Methods

Methods replace bash parameter expansion hieroglyphs.

| cmdspec | bash equivalent | meaning |
|---------|----------------|---------|
| `$path.basename()` | `${path##*/}` | filename from path |
| `$path.dirname()` | `${path%/*}` | directory from path |
| `$s.strip()` | `echo "$s" \| xargs` | trim whitespace |
| `$s.to_upper()` | `echo "$s" \| tr a-z A-Z` | uppercase |
| `$s.to_lower()` | `echo "$s" \| tr A-Z a-z` | lowercase |
| `$s.replace(a, b)` | `${s//a/b}` | replace all |
| `$s.split(delim)` | `IFS=delim read -ra ...` | split to array |
| `$s.starts_with(p)` | `[[ "$s" == p* ]]` | prefix test |
| `$s.ends_with(p)` | `[[ "$s" == *p ]]` | suffix test |
| `$s.contains(p)` | `[[ "$s" == *p* ]]` | substring test |
| `$s.length()` | `${#s}` | character count |
| `$s.slice(start, end)` | `${s:start:len}` | substring |
| `$s.strip_prefix(p)` | `${s#p}` | remove prefix |
| `$s.strip_suffix(p)` | `${s%p}` | remove suffix |

### RUN Statements

`RUN` executes a command. `RUN?` executes but tolerates failure (equivalent to `|| true`).

```cmdspec
RUN  npm install
RUN  npm run build
RUN? rm -rf /tmp/cache  # ok if this fails
```

### Command Capture

Capture output into a variable with `$()`.

```cmdspec
result = $(curl -s $api_url)
count = $(wc -l < $file)
status = $(RUN docker inspect $cid).State.Status
```

### Redirection

Use `→` for output redirection. Named streams for clarity.

```cmdspec
RUN  npm install → stdout: /dev/null, stderr: $err_log
RUN  echo "debug" → STDERR
RUN  cmd → $outfile                  # stdout to file
RUN  cmd → stdout: $out, stderr: $err  # split streams
```

### Pipes

Inline with `|` or block form with `PIPE/END`.

```cmdspec
# Inline
RUN  cat access.log | grep "ERROR" | sort | uniq -c → $errors

# Block (for long pipelines)
PIPE
  cat access.log
  grep "ERROR"
  sort
  uniq -c
  → $errors
END
```

### Conditionals

`IF/ELIF/ELSE/END` with parenthesized conditions. Standard comparison operators for both strings and numbers.

```cmdspec
IF ($env == "production" AND $cpu > 2)
  RUN  npm run build --mode=release
ELIF ($env == "staging")
  RUN  npm run build --mode=preview
ELSE
  RUN  npm run dev
END
```

Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `AND`, `OR`, `NOT`.

### Loops

```cmdspec
FOR file IN $(find . -name "*.log")
  RUN  gzip $file
END

FOR port IN $ports
  RUN  curl -s http://localhost:$port/health
END

WHILE ($(curl -s -o /dev/null -w "%{http_code}" $url) != "200")
  WAIT 5s
END
```

### Error Handling

Default behavior is **fail-fast**: any `RUN` failure stops execution. Override with:

- `RUN?` — ignore this command's failure
- `TRY/ON_FAIL/END` — catch and handle failure

```cmdspec
TRY
  RUN  docker compose up -d
  RUN  docker compose exec app migrate
ON_FAIL
  RUN  docker compose logs → $logfile
  ABORT "Startup failed, see $logfile"
END
```

### Functions

```cmdspec
FN deploy(target, version)
  RUN  kubectl set image deploy/$target app=img:$version
  RUN  kubectl rollout status deploy/$target
  RETURN $?
END

RUN deploy("web", "1.2.3")
RUN deploy("worker", "1.2.3")
```

### Concurrency

`ASYNC/END` runs enclosed commands in parallel. Execution continues after all complete.

```cmdspec
ASYNC
  RUN  npm run build
  RUN  npm run test
  RUN  npm run lint
END
# all three done before this line
```

### Environment

```cmdspec
ENV NODE_ENV = "production"
ENV PATH += "/usr/local/go/bin"
```

### Assertions

Preconditions that must be true before proceeding. The agent should verify these before constructing executable commands.

```cmdspec
ASSERT $(which docker) EXISTS       "docker must be installed"
ASSERT $port NOT_IN $(lsof -ti:$port)  "port $port is already in use"
ASSERT $file IS_FILE                "expected $file to exist"
ASSERT $dir IS_DIR                  "expected $dir to be a directory"
```

Assertion predicates: `EXISTS`, `NOT_EXISTS`, `IS_FILE`, `IS_DIR`, `IS_EMPTY`, `NOT_EMPTY`, `IN`, `NOT_IN`.

### Wait

```cmdspec
WAIT 5s
WAIT 2m
WAIT 500ms
```

### Abort

Halt execution with a message.

```cmdspec
ABORT "Cannot continue: $reason"
```

## Formal Grammar

See [grammar.ebnf](grammar.ebnf) for the full EBNF grammar.

## Parser

A reference recursive-descent parser (TypeScript) is provided for validation:

```bash
cd parser
npm install
npm run build

# Validate a .cmdspec file
npx cmdspec check examples/deploy.cmdspec

# Parse and print AST
npx cmdspec parse examples/deploy.cmdspec --ast
```

See [parser/](parser/) for source.

## Skill

A Claude Code skill is provided at [skill/cmdspec.md](skill/cmdspec.md) for agents that need to read or write cmdspec.

## License

MIT
