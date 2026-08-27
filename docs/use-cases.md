# Why cmdspec

## The Problem

When you describe shell commands to an AI agent, you have two bad options:

1. **Bash script** — the agent copies it verbatim and runs it. Placeholders get executed as literals. Error handling is whatever `set -e` provides. The agent doesn't distinguish "this is what to do" from "this is runnable code."

2. **Natural language** — "install the dependencies, then build if it's production, otherwise start the dev server." Ambiguous. Missing edge cases. The agent fills in gaps with guesses.

cmdspec is the third option: structured enough to be unambiguous, obviously-not-bash enough that no agent will try to execute it directly.

## When to Use

### Describing procedures to agents

You have a multi-step operation (deploy, setup, migration) and you want an agent to understand the exact sequence, conditions, and error handling — then translate it to real commands for the target environment.

```cmdspec
# The agent reads this and produces real bash/zsh/fish commands
ASSERT $(which node) EXISTS  "Node.js required"
RUN  npm ci
IF ($NODE_ENV == "production")
  RUN  npm run build
END
```

### Documenting runbooks without executable risk

Runbooks in bash tempt people into running them directly. cmdspec makes the intent clear while being structurally impossible to execute.

### Templating command sequences

When the exact commands depend on runtime context (OS, installed tools, environment), cmdspec describes the intent and lets the agent adapt:

```cmdspec
# Agent translates to apt/brew/pacman depending on detected OS
RUN  install-package "nginx"
RUN  install-package "certbot"
```

### Teaching command patterns

Show the structure of a workflow without readers getting lost in bash quoting, brace expansion, and fd redirection.

## When NOT to Use

- **One-liner commands** — just write the command directly
- **Already-working scripts** — if you have a bash script that works, don't rewrite it
- **Agent-executed automation** — if the agent is meant to run commands itself (not translate for the user), give it real bash
- **Non-shell workflows** — cmdspec is for command-line intent; use pseudocode or flowcharts for application logic

## cmdspec vs Alternatives

| Approach | Precision | Not executable | Error handling | Agent-readable |
|----------|-----------|----------------|----------------|----------------|
| Bash script | High | No | Implicit (`set -e`) | Yes, but will try to run it |
| Natural language | Low | Yes | Usually missing | Yes, but ambiguous |
| YAML steps | Medium | Yes | Verbose | Yes, but wordy for conditionals |
| cmdspec | High | Yes | Explicit | Yes |

## Design Decisions

### Why `RUN` prefix?

Every executable command is explicitly marked. Everything else (variables, conditions, comments) is structural. An agent can scan for `RUN` lines to extract the command list, or read the full structure to understand flow.

### Why `→` instead of `>`?

`→` is syntactically invalid in every shell. An agent that sees `>` might preserve it as-is; `→` forces translation.

### Why `END` instead of `fi`/`esac`/`done`?

Bash uses a different closing keyword for each block type (`fi`, `esac`, `done`, `}`). cmdspec uses `END` universally. Less to remember, impossible to mismatch.

### Why string methods instead of `${}`?

`${var##*/}` is a read-once, understand-never construct for anyone who doesn't write bash daily. `$var.basename()` is self-documenting.

### Why fail-fast by default?

Bash silently continues after failures unless you `set -e` (which has its own quirks). cmdspec halts on any `RUN` failure unless explicitly overridden with `RUN?` or `TRY/ON_FAIL`. No silent corruption.
