import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../src/contribute/process.js";

export function tempDir(prefix = "skills-hub-"): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export function writeFile(root: string, relativePath: string, content: string): string {
  const fullPath = path.join(root, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

export function skillMarkdown(
  options: {
    name?: string;
    description?: string;
    license?: string | null;
    extraFrontmatter?: string;
    body?: string;
  } = {},
): string {
  const name = options.name ?? "sample-skill";
  const description = options.description ?? "A sample portable skill used in automated tests.";
  const licenseLine = options.license === null ? "" : `license: ${options.license ?? "MIT"}\n`;
  const extra = options.extraFrontmatter ? `${options.extraFrontmatter}\n` : "";
  const body = options.body ?? `# ${name}\n\nThis is a test skill.\n`;
  return `---\nname: ${name}\ndescription: ${description}\n${licenseLine}${extra}---\n\n${body}`;
}

export function writeSkill(
  root: string,
  name: string,
  options: Parameters<typeof skillMarkdown>[0] = {},
): string {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "SKILL.md"), skillMarkdown({ ...options, name: options.name ?? name }), "utf8");
  return dir;
}

export function createHubRepo(skillNames: string[] = ["sample-skill"]): string {
  const root = tempDir("skills-hub-repo-");
  writeFile(
    root,
    "package.json",
    JSON.stringify({ name: "agent-skills-hub", version: "0.0.0", type: "module" }, null, 2),
  );
  mkdirSync(path.join(root, "skills"), { recursive: true });
  for (const name of skillNames) {
    writeSkill(path.join(root, "skills"), name);
  }
  return root;
}

export function initGitRepo(root: string): void {
  const identity = [
    "-c",
    "user.name=Test User",
    "-c",
    "user.email=test@example.com",
    "-c",
    "commit.gpgsign=false",
  ];
  expectStatus(runCommand("git", ["init"], root));
  expectStatus(runCommand("git", ["config", "user.name", "Test User"], root));
  expectStatus(runCommand("git", ["config", "user.email", "test@example.com"], root));
  expectStatus(runCommand("git", ["add", "."], root));
  expectStatus(runCommand("git", [...identity, "commit", "-m", "Initial commit"], root));
}

function expectStatus(result: { status: number | null; stderr: string; error?: string }): void {
  if (result.status !== 0) {
    throw new Error(result.error ?? (result.stderr || "git command failed"));
  }
}

export function makeExecutable(filePath: string): void {
  if (process.platform === "win32") {
    return;
  }
  chmodSync(filePath, 0o755);
}
