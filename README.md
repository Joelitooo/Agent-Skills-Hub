# Agent Skills Hub

Public catalog and cross-platform TypeScript CLI for portable [Agent Skills](https://cursor.com). Clone the repository, select skills, and install them into **Cursor**, **Claude Code**, or **Codex**. Contributions happen through a normal GitHub branch and pull request.

Skills in this catalog are **third-party code**. The CLI copies files only. It never executes bundled scripts during listing, validation, or installation.

## Requirements

- Git
- Node.js 22 or later (current LTS is recommended)

On macOS with Homebrew and no Node install yet:

```bash
brew install node
```

Confirm the toolchain:

```bash
node -v
npm -v
```

## Quick start

```bash
git clone https://github.com/Joelitooo/Agent-Skills-Hub.git
cd Agent-Skills-Hub
npm ci
npm run build
```

List catalog skills and whether they are already installed:

```bash
npm run skills -- list
npm run skills -- list --tool cursor
```

Install selected skills. Installation is additive: skills that already exist at the destination are skipped, never overwritten.

```bash
npm run skills -- install hello-world --tool cursor
npm run skills -- install --tool claude
```

If you omit skill names, the CLI offers interactive multi-select when stdin is a terminal.

Override the destination for custom setups:

```bash
npm run skills -- install hello-world --tool cursor --target-dir ~/.cursor/skills
```

## Default install locations

| Tool | Global skills directory |
| --- | --- |
| Cursor | `~/.cursor/skills/<name>` |
| Claude Code | `~/.claude/skills/<name>` |
| Codex | `~/.agents/skills/<name>` |

`~` is resolved through the operating system's home-directory API on Windows, macOS, and Linux.

## CLI commands

| Command | Purpose |
| --- | --- |
| `skills list [--tool cursor\|claude\|codex]` | Show catalog skills and install state |
| `skills install [names...] --tool <tool>` | Copy missing skills into a tool's global directory |
| `skills validate [names...]` | Validate catalog skills |
| `skills import [path]` | Copy a local skill into `skills/<name>` and start a contribution branch |
| `skills contribute --name <skill> [--pr]` | Commit on `skill/<name>` and optionally open a pull request |

After `npm run build`, `npm run skills -- <command>` runs the compiled CLI. During development you can use `npm run dev -- <command>`.

## Portable skill contract

Each catalog entry is a directory:

```text
skills/<skill-name>/
  SKILL.md          # required
  scripts/          # optional
  references/       # optional
  assets/           # optional
```

`SKILL.md` must start with YAML frontmatter that includes:

- `name`: lowercase letters, numbers, and hyphens; max 64 characters; must match the directory name
- `description`: non-empty, max 1024 characters
- `license`: a repository-compatible SPDX identifier (`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `CC0-1.0`, `Unlicense`, or `0BSD`)

Tool-specific optional frontmatter is preserved. The CLI copies the complete skill directory without rewriting `SKILL.md`.

## Contribute a skill

1. Author or copy a portable skill directory that contains `SKILL.md`.
2. From a clone of this repository:

   ```bash
   npm run skills -- import /path/to/your-skill
   ```

3. The CLI validates portability, copies the skill into `skills/<name>`, and creates a `skill/<name>` branch with a local commit when git is available.
4. Push the branch and open a pull request. If GitHub CLI is installed:

   ```bash
   npm run skills -- contribute --name your-skill --pr
   ```

Installing or using the catalog does not require GitHub authentication. Publishing a skill does, because GitHub does not allow anonymous pushes.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full policy.

## Development

```bash
npm test
npm run build
npm run validate:skills
```

CI runs those checks on Windows, macOS, and Linux.

## License

The CLI and repository are licensed under [MIT](LICENSE). Contributed skills become public under a compatible license declared in the skill. See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.
