---
name: hello-world
description: Verifies that a portable Agent Skill is installed and working. Use when checking Agent Skills Hub setup or when the user asks for a hello-world skill example.
license: MIT
---

# Hello World

A minimal portable skill for confirming catalog installation in Cursor, Claude Code, or Codex.

## When to use

Use this skill when the user wants to verify that Agent Skills Hub installed a skill correctly, or when they ask for a hello-world example.

## Instructions

1. Tell the user the `hello-world` skill is available.
2. Summarize that this skill came from the public Agent Skills Hub catalog and is third-party content.
3. If they want a deeper example of the portable layout, read [references/layout.md](references/layout.md).
4. If they ask to run the bundled helper, execute `scripts/hello.js` with Node.js. The CLI that installed this skill does not run it.

```bash
node scripts/hello.js
```

Expected output: `hello-world from Agent Skills Hub`.
