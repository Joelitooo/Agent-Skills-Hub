import path from "node:path";
import { discoverCatalog } from "../catalog/discover.js";
import { catalogDirectory, findRepoRoot } from "../paths.js";
import { applyContributionGit, type ImportResult } from "../contribute/importSkill.js";
import { contributionBranchName, currentBranch, inspectGit } from "../contribute/git.js";
import { CliError } from "../types.js";

export interface ContributeOptions {
  name?: string;
  repoRoot?: string;
  openPr?: boolean;
}

export function contributeSkill(options: ContributeOptions): ImportResult {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const catalogDir = catalogDirectory(repoRoot);
  const git = inspectGit(repoRoot);
  const name = options.name ?? inferSkillName(repoRoot, catalogDir, git.branch);

  if (!name) {
    throw new CliError("Pass --name <skill> or run this command from a skill/<name> branch.");
  }

  const skill = discoverCatalog(catalogDir).find((item) => item.name === name);
  if (!skill) {
    throw new CliError(`Skill "${name}" is not in the catalog. Import it first with skills import <path>.`);
  }

  const result: ImportResult = {
    name,
    destination: skill.directory,
    validation: { ok: true, name, description: skill.description, issues: [] },
    committed: false,
    pushed: false,
    notes: [],
  };

  return applyContributionGit(result, {
    repoRoot,
    skillName: name,
    skillPath: skill.directory,
    openPr: options.openPr === true,
  });
}

function inferSkillName(repoRoot: string, catalogDir: string, branch?: string): string | undefined {
  const current = branch ?? currentBranch(repoRoot);
  if (current?.startsWith("skill/")) {
    return current.slice("skill/".length);
  }

  const catalog = discoverCatalog(catalogDir);
  const git = inspectGit(repoRoot);
  if (!git.repoRoot) {
    return catalog.length === 1 ? catalog[0]?.name : undefined;
  }

  return undefined;
}

export function formatContributeResult(result: ImportResult): string {
  const lines = [`Contribution for ${result.name}`, `Path: ${path.normalize(result.destination)}`];
  if (result.branch) {
    lines.push(`Branch: ${result.branch}`);
  }
  lines.push(...result.notes);
  return lines.join("\n");
}

export { contributionBranchName };
