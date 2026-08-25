import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claudeAdapter, codexAdapter, cursorAdapter, getAdapter } from "../src/adapters/index.js";
import { copySkillDirectory, isExecutable } from "../src/adapters/copy.js";
import { makeExecutable, removeDir, tempDir, writeFile, writeSkill } from "./helpers.js";

describe("tool adapters", () => {
  it("resolves Cursor, Claude Code, and Codex destinations from the OS home directory", () => {
    const home = path.join(tempDir(), "home");
    mkdirSync(home, { recursive: true });
    expect(cursorAdapter.destination("demo", { homeDir: home })).toBe(
      path.join(home, ".cursor", "skills", "demo"),
    );
    expect(claudeAdapter.destination("demo", { homeDir: home })).toBe(
      path.join(home, ".claude", "skills", "demo"),
    );
    expect(codexAdapter.destination("demo", { homeDir: home })).toBe(
      path.join(home, ".agents", "skills", "demo"),
    );
    removeDir(path.dirname(home));
  });

  it("honors --target-dir overrides", () => {
    const target = path.join(tempDir(), "custom-skills");
    expect(getAdapter("cursor").destination("demo", { targetDir: target })).toBe(path.join(target, "demo"));
    removeDir(path.dirname(target));
  });

  it("detects tools from their config directories", () => {
    const home = path.join(tempDir(), "home");
    mkdirSync(path.join(home, ".cursor"), { recursive: true });
    mkdirSync(path.join(home, ".claude"), { recursive: true });
    mkdirSync(path.join(home, ".codex"), { recursive: true });
    expect(cursorAdapter.detect({ homeDir: home })).toBe(true);
    expect(claudeAdapter.detect({ homeDir: home })).toBe(true);
    expect(codexAdapter.detect({ homeDir: home })).toBe(true);
    expect(cursorAdapter.detect({ homeDir: path.join(home, "missing") })).toBe(false);
    removeDir(path.dirname(home));
  });

  it("installs additively and skips existing destinations without deleting them", () => {
    const parent = tempDir();
    const source = writeSkill(parent, "keep-skill");
    writeFile(source, "scripts/hello.js", "console.log('hi');\n");
    const targetRoot = path.join(parent, "dest");
    const first = cursorAdapter.install(source, "keep-skill", { targetDir: targetRoot });
    expect(first.status).toBe("installed");

    const extra = path.join(targetRoot, "keep-skill", "user-notes.txt");
    writeFileSync(extra, "leave me\n");
    const second = cursorAdapter.install(source, "keep-skill", { targetDir: targetRoot });
    expect(second.status).toBe("skipped");
    expect(readFileSync(extra, "utf8")).toBe("leave me\n");
    expect(existsSync(path.join(targetRoot, "keep-skill", "SKILL.md"))).toBe(true);
    removeDir(parent);
  });

  it("preserves executable permissions where the platform supports them", () => {
    if (process.platform === "win32") {
      return;
    }
    const parent = tempDir();
    const source = writeSkill(parent, "exec-skill");
    const script = writeFile(source, "scripts/run.sh", "#!/bin/sh\necho hi\n");
    makeExecutable(script);
    expect(isExecutable(script)).toBe(true);
    const destRoot = path.join(parent, "installed");
    copySkillDirectory(source, path.join(destRoot, "exec-skill"));
    expect(isExecutable(path.join(destRoot, "exec-skill", "scripts", "run.sh"))).toBe(true);
    chmodSync(path.join(destRoot, "exec-skill", "scripts", "run.sh"), 0o644);
    removeDir(parent);
  });
});
