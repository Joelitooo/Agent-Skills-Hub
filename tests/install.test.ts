import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { installSkills } from "../src/commands/install.js";
import { listSkills } from "../src/commands/list.js";
import { createHubRepo, removeDir, tempDir, writeFile, writeSkill } from "./helpers.js";

const originalRoot = process.env["SKILLS_HUB_ROOT"];

afterEach(() => {
  if (originalRoot === undefined) {
    delete process.env["SKILLS_HUB_ROOT"];
  } else {
    process.env["SKILLS_HUB_ROOT"] = originalRoot;
  }
});

describe("install and list", () => {
  it("lists installation state for a selected tool", async () => {
    const repo = createHubRepo(["one-skill", "two-skill"]);
    const target = path.join(tempDir(), "cursor-skills");
    process.env["SKILLS_HUB_ROOT"] = repo;
    await installSkills({
      names: ["one-skill"],
      tool: "cursor",
      targetDir: target,
      repoRoot: repo,
      interactive: false,
    });
    const rows = listSkills({ tool: "cursor", targetDir: target, repoRoot: repo });
    expect(rows.find((row) => row.name === "one-skill")?.installed.cursor).toBe(true);
    expect(rows.find((row) => row.name === "two-skill")?.installed.cursor).toBe(false);
    removeDir(repo);
    removeDir(path.dirname(target));
  });

  it("installs into Claude and Codex adapters", async () => {
    const repo = createHubRepo(["shared-skill"]);
    const parent = tempDir();
    const claudeDir = path.join(parent, "claude");
    const codexDir = path.join(parent, "codex");
    await installSkills({
      names: ["shared-skill"],
      tool: "claude",
      targetDir: claudeDir,
      repoRoot: repo,
    });
    await installSkills({
      names: ["shared-skill"],
      tool: "codex",
      targetDir: codexDir,
      repoRoot: repo,
    });
    expect(existsSync(path.join(claudeDir, "shared-skill", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(codexDir, "shared-skill", "SKILL.md"))).toBe(true);
    removeDir(repo);
    removeDir(parent);
  });

  it("fails unknown names without writing a destination", async () => {
    const repo = createHubRepo(["only-skill"]);
    const target = path.join(tempDir(), "skills");
    const report = await installSkills({
      names: ["missing-skill"],
      tool: "cursor",
      targetDir: target,
      repoRoot: repo,
    });
    expect(report.results[0]?.status).toBe("failed");
    expect(existsSync(path.join(target, "missing-skill"))).toBe(false);
    removeDir(repo);
    removeDir(path.dirname(target));
  });

  it("refuses to install a catalog skill that fails validation", async () => {
    const repo = createHubRepo([]);
    writeSkill(path.join(repo, "skills"), "bad-skill", { name: "bad-skill", description: "" });
    const target = path.join(tempDir(), "skills");
    const report = await installSkills({
      names: ["bad-skill"],
      tool: "cursor",
      targetDir: target,
      repoRoot: repo,
    });
    expect(report.results[0]?.status).toBe("failed");
    expect(existsSync(path.join(target, "bad-skill"))).toBe(false);
    removeDir(repo);
    removeDir(path.dirname(target));
  });

  it("copies optional resource directories when installing", async () => {
    const repo = createHubRepo([]);
    const skill = writeSkill(path.join(repo, "skills"), "rich-skill");
    writeFile(skill, "scripts/hello.js", "console.log('hi');\n");
    writeFile(skill, "references/notes.md", "# Notes\n");
    const target = path.join(tempDir(), "skills");
    const report = await installSkills({
      names: ["rich-skill"],
      tool: "cursor",
      targetDir: target,
      repoRoot: repo,
    });
    expect(report.results[0]?.status).toBe("installed");
    expect(existsSync(path.join(target, "rich-skill", "scripts", "hello.js"))).toBe(true);
    expect(existsSync(path.join(target, "rich-skill", "references", "notes.md"))).toBe(true);
    expect(report.notice).toMatch(/third-party/i);
    removeDir(repo);
    removeDir(path.dirname(target));
  });
});
