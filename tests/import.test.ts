import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverLocalSkills } from "../src/contribute/discoverLocal.js";
import { importSkill } from "../src/contribute/importSkill.js";
import { contributionBranchName, currentBranch } from "../src/contribute/git.js";
import { CliError } from "../src/types.js";
import { createHubRepo, initGitRepo, removeDir, tempDir, writeFile, writeSkill } from "./helpers.js";

describe("import and contribution", () => {
  it("copies a validated local skill into the catalog", () => {
    const repo = createHubRepo([]);
    const source = writeSkill(tempDir(), "new-skill", {
      description: "Imports a new portable skill into the catalog during tests.",
    });
    const result = importSkill({
      sourceDir: source,
      catalogDir: path.join(repo, "skills"),
      repoRoot: repo,
      git: false,
    });
    expect(result.name).toBe("new-skill");
    expect(existsSync(path.join(repo, "skills", "new-skill", "SKILL.md"))).toBe(true);
    removeDir(repo);
    removeDir(path.dirname(source));
  });

  it("rejects duplicate catalog names", () => {
    const repo = createHubRepo(["new-skill"]);
    const source = writeSkill(tempDir(), "new-skill");
    expect(() =>
      importSkill({
        sourceDir: source,
        catalogDir: path.join(repo, "skills"),
        repoRoot: repo,
        git: false,
      }),
    ).toThrow(CliError);
    removeDir(repo);
    removeDir(path.dirname(source));
  });

  it("creates a skill/<name> branch and commit when git is available", () => {
    const repo = createHubRepo(["seed-skill"]);
    initGitRepo(repo);
    const source = writeSkill(tempDir(), "branched-skill", {
      description: "Checks that import creates a contribution branch.",
    });
    const result = importSkill({
      sourceDir: source,
      catalogDir: path.join(repo, "skills"),
      repoRoot: repo,
      git: true,
    });
    expect(result.committed, result.notes.join("\n")).toBe(true);
    expect(result.branch).toBe(contributionBranchName("branched-skill"));
    expect(currentBranch(repo)).toBe("skill/branched-skill");
    expect(readFileSync(path.join(repo, "skills", "branched-skill", "SKILL.md"), "utf8")).toContain("branched-skill");
    removeDir(repo);
    removeDir(path.dirname(source));
  });

  it("discovers skills from tool global directories", () => {
    const home = path.join(tempDir(), "home");
    writeSkill(path.join(home, ".cursor", "skills"), "cursor-local");
    writeSkill(path.join(home, ".claude", "skills"), "claude-local");
    writeSkill(path.join(home, ".agents", "skills"), "codex-local");
    const found = discoverLocalSkills({ homeDir: home });
    expect(found.map((skill) => `${skill.tool}:${skill.name}`).sort()).toEqual([
      "claude:claude-local",
      "codex:codex-local",
      "cursor:cursor-local",
    ]);
    removeDir(path.dirname(home));
  });
});
