# Security policy

## Skills are third-party code

This catalog accepts community skills. A skill directory may include markdown, scripts, and other files. The CLI **never executes** bundled scripts during validation or installation, but an agent or a user might run those scripts later.

Treat installed skills as untrusted third-party code. Review `SKILL.md` and any `scripts/` before enabling or running them.

## What we reject

Contributions that include likely credentials or secret files fail validation. That includes `.env` files, private keys, cloud credential JSON, and common token patterns. Report any catalog skill that slipped through.

## Reporting a vulnerability

Please do not open a public issue for undisclosed vulnerabilities.

- If this GitHub repository enables private vulnerability reporting, use that.
- Otherwise email the maintainers listed on the repository with enough detail to reproduce the issue.

We will acknowledge reports and work on a fix before any public disclosure.

## Scope

In scope:

- The TypeScript CLI (path handling, copy behavior, validation bypasses)
- Secret leakage in catalog skills
- Unsafe symlink or path-traversal handling during import or install

Out of scope:

- Issues that require a user to deliberately run a malicious script after install
- GitHub, Cursor, Claude Code, or Codex platform bugs unrelated to this repository
