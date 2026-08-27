import path from "node:path";
import { canonicalize } from "../paths.js";
import { commandExists, runCommand, type CommandResult } from "./process.js";

export interface GitStatus {
  available: boolean;
  repoRoot?: string;
  branch?: string;
  hasOrigin?: boolean;
  dirty?: boolean;
}

function git(args: string[], cwd: string): CommandResult {
  return runCommand("git", args, cwd);
}

export function inspectGit(cwd: string): GitStatus {
  if (!commandExists("git", cwd)) {
    return { available: false };
  }
  const root = git(["rev-parse", "--show-toplevel"], cwd);
  if (root.status !== 0) {
    return { available: true };
  }
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root.stdout);
  const origin = git(["remote", "get-url", "origin"], root.stdout);
  const dirty = git(["status", "--porcelain"], root.stdout);
  return {
    available: true,
    repoRoot: canonicalize(root.stdout),
    branch: branch.stdout || undefined,
    hasOrigin: origin.status === 0 && origin.stdout !== "",
    dirty: dirty.stdout !== "",
  };
}

export function currentBranch(repoRoot: string): string | undefined {
  const result = git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  return result.status === 0 ? result.stdout : undefined;
}

export function branchExists(repoRoot: string, name: string): boolean {
  const result = git(["show-ref", "--verify", "--quiet", `refs/heads/${name}`], repoRoot);
  return result.status === 0;
}

export function createBranch(repoRoot: string, name: string): CommandResult {
  return git(["switch", "-c", name], repoRoot);
}

export function switchBranch(repoRoot: string, name: string): CommandResult {
  return git(["switch", name], repoRoot);
}

export function stagePaths(repoRoot: string, paths: string[]): CommandResult {
  const gitPaths = paths.map((value) => value.split(path.sep).join("/"));
  return git(["add", "--", ...gitPaths], repoRoot);
}

export function commit(repoRoot: string, message: string): CommandResult {
  return git(["-c", "commit.gpgsign=false", "commit", "-m", message], repoRoot);
}

export function hasStagedChanges(repoRoot: string): boolean {
  const result = git(["diff", "--cached", "--quiet"], repoRoot);
  return result.status === 1;
}

export function pushBranch(repoRoot: string, branch: string): CommandResult {
  return git(["push", "-u", "origin", branch], repoRoot);
}

export function githubCliAvailable(cwd: string): boolean {
  return commandExists("gh", cwd);
}

export function createPullRequest(
  repoRoot: string,
  options: { title: string; body: string; branch: string },
): CommandResult {
  return runCommand(
    "gh",
    ["pr", "create", "--title", options.title, "--body", options.body, "--head", options.branch],
    repoRoot,
  );
}

export function contributionBranchName(skillName: string): string {
  return `skill/${skillName}`;
}
