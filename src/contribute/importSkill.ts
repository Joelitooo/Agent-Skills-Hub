import { existsSync } from "node:fs";
import path from "node:path";
import { copySkillDirectory } from "../adapters/copy.js";
import { discoverCatalog } from "../catalog/discover.js";
import { validateSkillDirectory } from "../catalog/validate.js";
import { relativeToRoot } from "../paths.js";
import { CliError } from "../types.js";
import type { ValidationResult } from "../types.js";
import {
  branchExists,
  commit,
  contributionBranchName,
  createBranch,
  createPullRequest,
  currentBranch,
  githubCliAvailable,
  hasStagedChanges,
  inspectGit,
  pushBranch,
  stagePaths,
  switchBranch,
} from "./git.js";

export interface ImportOptions {
  sourceDir: string;
  catalogDir: string;
  repoRoot: string;
  git?: boolean;
  openPr?: boolean;
}

export interface ImportResult {
  name: string;
  destination: string;
  validation: ValidationResult;
  branch?: string;
  committed: boolean;
  pushed: boolean;
  pullRequestUrl?: string;
  notes: string[];
}

export function importSkill(options: ImportOptions): ImportResult {
  const sourceDir = path.resolve(options.sourceDir);
  if (!existsSync(sourceDir)) {
    throw new CliError(`Skill path does not exist: ${sourceDir}`);
  }

  const validation = validateSkillDirectory(sourceDir, { mode: "contribute" });
  if (!validation.ok || !validation.name) {
    throw new CliError(formatImportFailure(sourceDir, validation));
  }

  const name = validation.name;
  const existing = discoverCatalog(options.catalogDir).find(
    (skill) => skill.name === name || path.basename(skill.directory) === name,
  );
  if (existing) {
    throw new CliError(`A skill named "${name}" already exists in the catalog at ${existing.directory}.`);
  }

  const destination = path.join(options.catalogDir, name);
  copySkillDirectory(sourceDir, destination);

  const notes: string[] = [
    `Imported ${name} into ${destination}.`,
    "Contributed skills become public. Do not include secrets, private customer data, or proprietary files.",
  ];
  const result: ImportResult = {
    name,
    destination,
    validation,
    committed: false,
    pushed: false,
    notes,
  };

  if (options.git === false) {
    notes.push("Skipped git. Create a branch, commit the skill, push, and open a pull request.");
    return result;
  }

  return applyContributionGit(result, {
    repoRoot: options.repoRoot,
    skillName: name,
    skillPath: destination,
    openPr: options.openPr === true,
  });
}

export function applyContributionGit(
  result: ImportResult,
  options: { repoRoot: string; skillName: string; skillPath: string; openPr: boolean },
): ImportResult {
  const git = inspectGit(options.repoRoot);
  if (!git.available || !git.repoRoot) {
    result.notes.push("Git is not available in this directory. Commit and push the skill manually.");
    return result;
  }

  const branch = contributionBranchName(options.skillName);
  const repoRoot = git.repoRoot;
  const current = currentBranch(repoRoot);

  if (current !== branch) {
    if (branchExists(repoRoot, branch)) {
      const switched = switchBranch(repoRoot, branch);
      if (switched.status !== 0) {
        result.notes.push(
          `Could not switch to existing branch ${branch}: ${switched.stderr || switched.error || "unknown git error"}.`,
        );
        return result;
      }
    } else {
      const created = createBranch(repoRoot, branch);
      if (created.status !== 0) {
        result.notes.push(
          `Could not create branch ${branch}: ${created.stderr || created.error || "unknown git error"}.`,
        );
        return result;
      }
    }
  }

  result.branch = branch;
  const relativeSkill = relativeToRoot(repoRoot, options.skillPath);
  const staged = stagePaths(repoRoot, [relativeSkill]);
  if (staged.status !== 0) {
    result.notes.push(`Could not stage ${relativeSkill}: ${staged.stderr || staged.error || "unknown git error"}.`);
    return result;
  }

  if (hasStagedChanges(repoRoot)) {
    const committed = commit(repoRoot, `Add ${options.skillName} skill to the catalog.`);
    if (committed.status !== 0) {
      result.notes.push(
        `Could not commit: ${committed.stderr || committed.error || "unknown git error"}. Configure git user.name and user.email, then commit locally.`,
      );
      return result;
    }
    result.committed = true;
    result.notes.push(`Created branch ${branch} and committed ${relativeSkill}.`);
  } else {
    result.notes.push(`Branch ${branch} is ready; no new staged changes to commit.`);
  }

  if (!options.openPr) {
    result.notes.push(
      `Next: git push -u origin ${branch}`,
      "Then open a pull request. If GitHub CLI is installed, run: skills contribute --pr --name " + options.skillName,
    );
    return result;
  }

  return openContributionPr(result, repoRoot, branch, options.skillName);
}

export function openContributionPr(
  result: ImportResult,
  repoRoot: string,
  branch: string,
  skillName: string,
): ImportResult {
  const git = inspectGit(repoRoot);
  if (!git.hasOrigin) {
    result.notes.push("No origin remote is configured. Add one, push the branch, and open a pull request.");
    return result;
  }

  const pushed = pushBranch(repoRoot, branch);
  if (pushed.status !== 0) {
    result.notes.push(`Could not push ${branch}: ${pushed.stderr || pushed.error || "unknown git error"}.`);
    return result;
  }
  result.pushed = true;

  if (!githubCliAvailable(repoRoot)) {
    result.notes.push(
      `Pushed ${branch}. Install GitHub CLI (gh) or open a pull request from the GitHub UI.`,
    );
    return result;
  }

  const pr = createPullRequest(repoRoot, {
    title: `Add ${skillName} skill`,
    body: [
      `## Summary`,
      `- Adds the \`${skillName}\` portable Agent Skill to the public catalog.`,
      "",
      "## Test plan",
      "- [ ] `npm test`",
      "- [ ] `npm run build && npm run validate:skills`",
      `- [ ] Review \`skills/${skillName}/SKILL.md\` for portability and third-party safety`,
    ].join("\n"),
    branch,
  });

  if (pr.status !== 0) {
    result.notes.push(`Pushed ${branch}, but could not open a pull request: ${pr.stderr || pr.error}.`);
    return result;
  }

  result.pullRequestUrl = pr.stdout.split(/\s+/).find((token) => token.startsWith("http")) ?? pr.stdout;
  result.notes.push(`Opened pull request: ${result.pullRequestUrl}`);
  return result;
}

function formatImportFailure(sourceDir: string, validation: ValidationResult): string {
  const details = validation.issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => `  - ${issue.code}: ${issue.file ? `${issue.file}: ` : ""}${issue.message}`)
    .join("\n");
  return `Cannot import skill from ${sourceDir}:\n${details}`;
}
