# cmdspec

A pseudo-shell language for describing command-line intent to AI agents — unambiguously, without the quirks of bash, and explicitly **not executable**.

```cmdspec
repo = "https://github.com/org/app"

ASSERT $(which docker) EXISTS  "docker is required"

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

## Docs

| | |
|---|---|
| [**Language Reference**](docs/language.md) | Full syntax — variables, commands, control flow, error handling, string methods |
| [**Why cmdspec**](docs/use-cases.md) | The problem, when to use it, when not to, design decisions |
| [**Tooling**](docs/tooling.md) | Parser, CLI, skills, programmatic API |
| [**Grammar (EBNF)**](grammar.ebnf) | Formal grammar |

## Quick Start

### Read cmdspec

- `RUN` = execute this command
- `RUN?` = execute, but failure is ok
- `→` = redirect output (translates to `>` in real shell)
- `ASSERT` = precondition to verify before running
- `TRY/ON_FAIL/END` = error handling with recovery
- `IF/ELIF/ELSE/END`, `FOR/IN/END`, `WHILE/END` = control flow
- `$var.method()` = string operations (e.g. `$path.basename()` → `${path##*/}`)

### Validate cmdspec

```bash
cd parser && npm install && npm run build
npx cmdspec check your-file.cmdspec
```

### Agent skills

- [`skill/cmdspec.md`](skill/cmdspec.md) — standard (language rules only)
- [`skill/cmdspec-strict.md`](skill/cmdspec-strict.md) — strict (language rules + parser validation)

## Examples

- [basic.cmdspec](examples/basic.cmdspec) — variables, pipes, loops, conditionals
- [deploy.cmdspec](examples/deploy.cmdspec) — container deploy with rollback
- [error-handling.cmdspec](examples/error-handling.cmdspec) — TRY/ON_FAIL patterns, retry logic

## License

MIT
