# Contributing to Agent Skills Hub

This repository is a **public community catalog**. Anyone can clone it and install skills. Adding a skill uses the normal GitHub workflow: branch, commit, push, and pull request.

By contributing, you agree that your skill will be public and licensed under a license compatible with this repository's MIT license.

## Portable skills

A skill is a directory with a required `SKILL.md` file and optional `scripts/`, `references/`, and `assets/` directories.

```markdown
---
name: your-skill-name
description: What the skill does and when an agent should use it.
license: MIT
---

# Your Skill Name

Instructions for the agent.
```

Rules:

- `name` must match the directory name, use lowercase letters, numbers, and hyphens, and be at most 64 characters.
- `description` is required and at most 1024 characters. Write it in the third person and include both what the skill does and when to use it.
- Declare `license` in frontmatter or include a `LICENSE` file. Compatible SPDX identifiers: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `CC0-1.0`, `Unlicense`, `0BSD`.
- Keep `SKILL.md` under 500 lines. Move detail into `references/`.
- Use POSIX relative paths in markdown links (`references/guide.md`), never Windows separators or absolute filesystem paths.
- Do not include secrets, credentials, private keys, `.env` files, or personal machine paths.
- Do not use symlinks that point outside the skill directory.
- Do not execute bundled scripts as part of contribution; CI and the CLI only read and copy files.

Optional tool-specific frontmatter is allowed and is preserved as-is.

## Import flow

From a clone of this repository, after `npm ci` and `npm run build`:

```bash
npm run skills -- import /path/to/your-skill
```

If you omit the path, the CLI can discover skills already installed in Cursor (`~/.cursor/skills`), Claude Code (`~/.claude/skills`), or Codex (`~/.agents/skills`) and let you select one.

The command:

1. Validates the skill for contribution.
2. Rejects duplicate catalog names.
3. Copies the directory to `skills/<name>`.
4. Creates a `skill/<name>` branch and commits when git is available.

Then push and open a pull request:

```bash
git push -u origin skill/your-skill-name
```

Or, if GitHub CLI is installed:

```bash
npm run skills -- contribute --name your-skill-name --pr
```

Use `--no-git` on import if you want to copy the files without creating a branch.

## Review and CI

Pull requests run tests and validate every catalog skill on Windows, macOS, and Linux. Maintainers review community content before merge. Installation identifies skills as third-party code; reviewers should treat bundled scripts as untrusted.

## Local checks

```bash
npm test
npm run build
npm run skills -- validate --mode contribute
```
