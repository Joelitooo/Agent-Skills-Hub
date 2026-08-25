import { existsSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateSkillDirectory } from "../src/catalog/validate.js";
import { removeDir, skillMarkdown, tempDir, writeFile, writeSkill } from "./helpers.js";

describe("skill validation", () => {
  it("accepts a portable skill with optional resources", () => {
    const dir = writeSkill(tempDir(), "valid-skill");
    writeFile(dir, "scripts/ok.js", "console.log('ok');\n");
    writeFile(dir, "references/notes.md", "# Notes\n");
    writeFile(dir, "assets/icon.txt", "icon\n");
    writeFile(
      dir,
      "SKILL.md",
      skillMarkdown({
        name: "valid-skill",
        extraFrontmatter: "disable-model-invocation: true",
        body: "# Valid\n\nSee [notes](references/notes.md).\n",
      }),
    );
    const result = validateSkillDirectory(dir, { mode: "contribute" });
    expect(result.ok).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    removeDir(path.dirname(dir));
  });

  it("requires name and description", () => {
    const dir = writeSkill(tempDir(), "bad-name", { name: "Invalid Name", description: "" });
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["invalid-name", "missing-description"]),
    );
    removeDir(path.dirname(dir));
  });

  it("requires the directory name to match frontmatter name", () => {
    const dir = writeSkill(tempDir(), "folder-name", { name: "other-name" });
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "name-mismatch")).toBe(true);
    removeDir(path.dirname(dir));
  });

  it("requires a compatible license for contributions", () => {
    const dir = writeSkill(tempDir(), "no-license", { license: null });
    const install = validateSkillDirectory(dir, { mode: "install" });
    const contribute = validateSkillDirectory(dir, { mode: "contribute" });
    expect(install.ok).toBe(true);
    expect(contribute.ok).toBe(false);
    expect(contribute.issues.some((issue) => issue.code === "missing-license")).toBe(true);
    removeDir(path.dirname(dir));
  });

  it("rejects likely credential files", () => {
    const dir = writeSkill(tempDir(), "leaky-skill");
    writeFile(dir, ".env", "SECRET=1\n");
    const result = validateSkillDirectory(dir, { mode: "contribute" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "secret-file")).toBe(true);
    removeDir(path.dirname(dir));
  });

  it("rejects private key material in text files", () => {
    const dir = writeSkill(tempDir(), "key-skill");
    writeFile(dir, "scripts/key.txt", "-----BEGIN RSA PRIVATE KEY-----\nMIIE\n");
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "secret-private-key")).toBe(true);
    removeDir(path.dirname(dir));
  });

  it("rejects broken, absolute, traversal, and Windows-style markdown links", () => {
    const dir = writeSkill(tempDir(), "link-skill", {
      body: [
        "# Links",
        "",
        "- [missing](references/nope.md)",
        "- [abs](/etc/passwd)",
        "- [escape](../outside.md)",
        "- [windows](scripts\\run.js)",
        "",
      ].join("\n"),
    });
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual(
      expect.arrayContaining(["broken-reference", "absolute-path", "path-traversal", "windows-path"]),
    );
    removeDir(path.dirname(dir));
  });

  it("rejects symlinks that escape the skill directory", () => {
    const parent = tempDir();
    const dir = writeSkill(parent, "link-escape");
    const outside = path.join(parent, "secret.txt");
    writeFileSync(outside, "nope\n");
    try {
      symlinkSync(outside, path.join(dir, "outside-link"));
    } catch {
      removeDir(parent);
      return;
    }
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "unsafe-symlink")).toBe(true);
    removeDir(parent);
  });

  it("rejects absolute symlink targets", () => {
    const parent = tempDir();
    const dir = writeSkill(parent, "abs-link");
    try {
      symlinkSync(os.tmpdir(), path.join(dir, "tmp-link"));
    } catch {
      removeDir(parent);
      return;
    }
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "unsafe-symlink")).toBe(true);
    removeDir(parent);
  });

  it("does not execute bundled scripts while validating", () => {
    const dir = writeSkill(tempDir(), "script-skill");
    const marker = path.join(os.tmpdir(), `skills-hub-should-not-run-${Date.now()}`);
    writeFile(
      dir,
      "scripts/side-effect.js",
      `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran');\n`,
    );
    const result = validateSkillDirectory(dir);
    expect(result.ok).toBe(true);
    expect(existsSync(marker)).toBe(false);
    removeDir(path.dirname(dir));
  });
});
