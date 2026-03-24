# Claude Code Skills Pack

Reusable team workflow skills for [Claude Code](https://claude.ai/code). These skills are **generic and portable** — they work with any codebase regardless of language, framework, or architecture.

## Included Skills

| Skill | Slash Command | Description |
|-------|--------------|-------------|
| **Team Feature** | `/team-feature` | Full feature development with planning, implementation, quality gates, testing, docs, and deployment phases |
| **Team i18n** | `/team-i18n` | Hash-based three-mode translation pattern (Auto, Hover Replace, Hover Tooltip) with LLM-powered translation |
| **Team Performance** | `/team-performance` | Performance measurement, analysis, optimization, and validation workflow |
| **Team Review** | `/team-review` | Parallel code review with static analysis, code smell detection, security scanning, and dead code elimination |
| **Team Security** | `/team-security` | OWASP-based security audit with scope options (full, api, frontend, auth, dependencies) |

## Installation

```bash
# Unzip and run the installer
unzip claude-skills-pack.zip
cd claude-skills-pack

# Install to current project
./install.sh

# Or install to a specific project
./install.sh /path/to/your/project
```

The installer copies skill files to `.claude/commands/` in your project. Existing skills with the same name are backed up before updating.

## Usage

In any Claude Code session within your project:

```
/team-feature add user authentication
/team-i18n audit
/team-performance full
/team-review src/api/
/team-security auth
```

Each skill starts with a **Step 0: Discover Project Context** phase — agents scan your codebase first to understand the stack, conventions, and architecture before doing any work.

## How It Works

All skills follow a multi-phase parallel agent workflow:
1. **Discovery** — Scan the codebase to understand the project
2. **Analysis** — Launch specialized agents in parallel
3. **Implementation** — Apply changes sequentially
4. **Validation** — Verify results in parallel

Skills are plain Markdown files in `.claude/commands/`. Edit them to customize for your team's needs.
