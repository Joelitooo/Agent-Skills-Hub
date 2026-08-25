---
name: portable-skill-authoring
description: Authors portable Agent Skills that can be published to Agent Skills Hub. Use when creating, reviewing, or importing a SKILL.md for Cursor, Claude Code, and Codex.
license: MIT
---

# Portable Skill Authoring

Write skills that install unchanged into Cursor, Claude Code, and Codex.

## Required shape

```text
skill-name/
  SKILL.md
  scripts/          # optional
  references/       # optional
  assets/           # optional
```

`SKILL.md` frontmatter must include `name`, `description`, and a compatible `license`. The directory name must match `name`.

## Authoring rules

- Keep `SKILL.md` under 500 lines. Put long material in `references/` and link it with POSIX relative paths.
- Write `description` in the third person, with both what the skill does and when to apply it.
- Preserve extra frontmatter used by a single tool; do not translate `SKILL.md` for each installer.
- Never include secrets, `.env` files, private keys, or absolute machine paths.
- Never use `..` in bundled paths or markdown links.

## Publishing

From a clone of Agent Skills Hub:

```bash
npm run skills -- import /path/to/skill-name
```

Then push the `skill/skill-name` branch and open a pull request. Full policy: [references/contribution.md](references/contribution.md).
