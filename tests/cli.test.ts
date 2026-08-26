import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { expandCliArgv, runCli } from "../src/cli.js";
import { createHubRepo, removeDir, tempDir, writeSkill } from "./helpers.js";

const originalRoot = process.env["SKILLS_HUB_ROOT"];
const originalLifecycle = process.env["npm_lifecycle_event"];
const originalNpmList = process.env["npm_config_list"];
const originalNpmLong = process.env["npm_config_long"];

afterEach(() => {
  if (originalRoot === undefined) {
    delete process.env["SKILLS_HUB_ROOT"];
  } else {
    process.env["SKILLS_HUB_ROOT"] = originalRoot;
  }
  restoreEnv("npm_lifecycle_event", originalLifecycle);
  restoreEnv("npm_config_list", originalNpmList);
  restoreEnv("npm_config_long", originalNpmLong);
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function capture(argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(argv, {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}

describe("CLI", () => {
  it("lists catalog skills as JSON", async () => {
    const repo = createHubRepo(["cli-skill"]);
    process.env["SKILLS_HUB_ROOT"] = repo;
    const result = await capture(["list", "--json", "--tool", "cursor", "--target-dir", path.join(repo, "empty")]);
    expect(result.code).toBe(0);
    const rows = JSON.parse(result.stdout) as { name: string; installed: { cursor: boolean } }[];
    expect(rows[0]?.name).toBe("cli-skill");
    expect(rows[0]?.installed.cursor).toBe(false);
    removeDir(repo);
  });

  it("installs a named skill through the CLI", async () => {
    const repo = createHubRepo(["cli-install"]);
    const target = path.join(tempDir(), "skills");
    process.env["SKILLS_HUB_ROOT"] = repo;
    const result = await capture(["install", "cli-install", "--tool", "codex", "--target-dir", target, "--json"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('"status": "installed"');
    expect(result.stdout).toContain("third-party");
    removeDir(repo);
    removeDir(path.dirname(target));
  });

  it("validates the catalog and a path", async () => {
    const repo = createHubRepo(["ok-skill"]);
    process.env["SKILLS_HUB_ROOT"] = repo;
    const ok = await capture(["validate", "--json"]);
    expect(ok.code).toBe(0);
    const outside = writeSkill(tempDir(), "outside-skill", { license: null });
    const contribute = await capture(["validate", "--path", outside, "--mode", "contribute", "--json"]);
    expect(contribute.code).toBe(1);
    removeDir(repo);
    removeDir(path.dirname(outside));
  });

  it("imports through the CLI without git", async () => {
    const repo = createHubRepo([]);
    const source = writeSkill(tempDir(), "imported-cli", {
      description: "CLI import test skill for the public catalog.",
    });
    process.env["SKILLS_HUB_ROOT"] = repo;
    const result = await capture(["import", source, "--no-git", "--json"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("imported-cli");
    removeDir(repo);
    removeDir(path.dirname(source));
  });

  it("requires --tool for install", async () => {
    const repo = createHubRepo(["x"]);
    process.env["SKILLS_HUB_ROOT"] = repo;
    const result = await capture(["install", "x"]);
    expect(result.code).not.toBe(0);
    removeDir(repo);
  });

  it("lists catalog skills through -l and --list aliases", async () => {
    const repo = createHubRepo(["cli-skill"]);
    process.env["SKILLS_HUB_ROOT"] = repo;
    const dashed = await capture(["-l", "--json", "--tool", "cursor", "--target-dir", path.join(repo, "empty")]);
    const long = await capture(["--list", "--json", "--tool", "cursor", "--target-dir", path.join(repo, "empty")]);
    const short = await capture(["l", "--json", "--tool", "cursor", "--target-dir", path.join(repo, "empty")]);
    expect(dashed.code).toBe(0);
    expect(long.code).toBe(0);
    expect(short.code).toBe(0);
    expect(JSON.parse(dashed.stdout)[0]?.name).toBe("cli-skill");
    expect(JSON.parse(long.stdout)[0]?.name).toBe("cli-skill");
    expect(JSON.parse(short.stdout)[0]?.name).toBe("cli-skill");
    removeDir(repo);
  });

  it("requires skill names when the terminal is not interactive", async () => {
    const repo = createHubRepo(["cli-skill"]);
    process.env["SKILLS_HUB_ROOT"] = repo;
    const result = await capture(["install", "--tool", "cursor", "--target-dir", path.join(repo, "out")]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/interactive terminal/i);
    removeDir(repo);
  });
});

describe("expandCliArgv", () => {
  it("maps -l, --list, and l to list", () => {
    expect(expandCliArgv(["-l", "--json"])).toEqual(["list", "--json"]);
    expect(expandCliArgv(["--list", "--tool", "cursor"])).toEqual(["list", "--tool", "cursor"]);
    expect(expandCliArgv(["l"])).toEqual(["list"]);
  });

  it("infers list when npm swallows -l or --list", () => {
    expect(
      expandCliArgv([], { npm_lifecycle_event: "skills", npm_config_long: "true" }),
    ).toEqual(["list"]);
    expect(
      expandCliArgv(["--json"], { npm_lifecycle_event: "skills", npm_config_list: "true" }),
    ).toEqual(["list", "--json"]);
  });

  it("does not infer list for unrelated npm scripts", () => {
    expect(expandCliArgv([], { npm_lifecycle_event: "test", npm_config_long: "true" })).toEqual([]);
    expect(expandCliArgv(["install"], { npm_lifecycle_event: "skills", npm_config_long: "true" })).toEqual([
      "install",
    ]);
  });
});
