import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRepoRoot, homeDirectory, relativeToRoot, resolveUserPath } from "../src/paths.js";
import { createHubRepo, removeDir } from "./helpers.js";

const originalEnv = process.env["SKILLS_HUB_ROOT"];

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env["SKILLS_HUB_ROOT"];
  } else {
    process.env["SKILLS_HUB_ROOT"] = originalEnv;
  }
});

describe("paths", () => {
  it("resolves the home directory through the OS API", () => {
    expect(homeDirectory()).toBe(os.homedir());
  });

  it("resolves ~ through the home directory, not string concatenation", () => {
    expect(resolveUserPath("~")).toBe(os.homedir());
    expect(resolveUserPath(`~${path.sep}skills`)).toBe(path.join(os.homedir(), "skills"));
  });

  it("resolves relative and absolute paths", () => {
    const cwd = os.tmpdir();
    expect(resolveUserPath("skills", cwd)).toBe(path.resolve(cwd, "skills"));
    expect(resolveUserPath(path.resolve(cwd, "abs"), cwd)).toBe(path.resolve(cwd, "abs"));
  });

  it("finds a hub repo from SKILLS_HUB_ROOT", () => {
    const repo = createHubRepo();
    process.env["SKILLS_HUB_ROOT"] = repo;
    expect(findRepoRoot("/tmp")).toBe(path.resolve(repo));
    removeDir(repo);
  });

  it("walks parents to find package.json named agent-skills-hub plus skills/", () => {
    const repo = createHubRepo();
    delete process.env["SKILLS_HUB_ROOT"];
    const nested = path.join(repo, "src", "commands");
    expect(findRepoRoot(nested)).toBe(path.resolve(repo));
    removeDir(repo);
  });

  it("computes repo-relative paths after resolving symlinks", () => {
    const repo = createHubRepo(["rel-skill"]);
    const skillDir = path.join(repo, "skills", "rel-skill");
    expect(relativeToRoot(repo, skillDir).split(path.sep)).toEqual(["skills", "rel-skill"]);
    removeDir(repo);
  });
});
