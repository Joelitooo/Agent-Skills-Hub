import { checkbox } from "@inquirer/prompts";
import { getAdapter } from "../adapters/index.js";
import { discoverCatalog, findCatalogSkill } from "../catalog/discover.js";
import { formatValidationIssues, validateSkillDirectory } from "../catalog/validate.js";
import { catalogDirectory, findRepoRoot } from "../paths.js";
import type { AdapterOptions, SkillInstallResult, ToolId } from "../types.js";
import { CliError, isToolId } from "../types.js";

export const THIRD_PARTY_NOTICE =
  "Skills are third-party code. This CLI copies files only; it never executes bundled scripts during install or validation.";

export interface InstallOptions {
  names?: string[];
  tool: string;
  targetDir?: string;
  homeDir?: string;
  repoRoot?: string;
  interactive?: boolean;
}

export interface InstallReport {
  tool: ToolId;
  results: SkillInstallResult[];
  notice: string;
}

export async function installSkills(options: InstallOptions): Promise<InstallReport> {
  if (!isToolId(options.tool)) {
    throw new CliError(`Unknown tool "${options.tool}". Use cursor, claude, or codex.`);
  }

  const repoRoot = options.repoRoot ?? findRepoRoot();
  const catalogDir = catalogDirectory(repoRoot);
  const catalog = discoverCatalog(catalogDir);
  if (catalog.length === 0) {
    throw new CliError("The catalog does not contain any skills.");
  }

  const adapter = getAdapter(options.tool);
  const adapterOptions: AdapterOptions = {
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    ...(options.targetDir ? { targetDir: options.targetDir } : {}),
  };

  const names = options.names?.filter((name) => name.trim() !== "") ?? [];
  const selected = names.length > 0 ? names : await selectSkillsInteractively(catalog, adapter.id, adapterOptions, options.interactive);

  const results: SkillInstallResult[] = [];
  for (const name of selected) {
    const skill = findCatalogSkill(catalogDir, name);
    if (!skill) {
      results.push({
        name,
        status: "failed",
        destination: adapter.destination(name, adapterOptions),
        reason: "not found in catalog",
      });
      continue;
    }

    const validation = validateSkillDirectory(skill.directory, { mode: "install", expectedName: skill.name });
    if (!validation.ok) {
      results.push({
        name: skill.name,
        status: "failed",
        destination: adapter.destination(skill.name, adapterOptions),
        reason: formatValidationIssues(validation, skill.name),
      });
      continue;
    }

    try {
      results.push(adapter.install(skill.directory, skill.name, adapterOptions));
    } catch (error) {
      results.push({
        name: skill.name,
        status: "failed",
        destination: adapter.destination(skill.name, adapterOptions),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    tool: options.tool,
    results,
    notice: THIRD_PARTY_NOTICE,
  };
}

export function formatInstallReport(report: InstallReport): string {
  const lines = [report.notice, ""];
  for (const result of report.results) {
    if (result.status === "installed") {
      lines.push(`installed  ${result.name} -> ${result.destination}`);
    } else if (result.status === "skipped") {
      lines.push(`skipped    ${result.name} (${result.reason ?? "already exists"})`);
    } else {
      lines.push(`failed     ${result.name}: ${result.reason ?? "unknown error"}`);
    }
  }
  const installed = report.results.filter((result) => result.status === "installed").length;
  const skipped = report.results.filter((result) => result.status === "skipped").length;
  const failed = report.results.filter((result) => result.status === "failed").length;
  lines.push("");
  lines.push(`${installed} installed, ${skipped} skipped, ${failed} failed.`);
  return lines.join("\n");
}

async function selectSkillsInteractively(
  catalog: { name: string; description: string; directory: string }[],
  tool: ToolId,
  adapterOptions: AdapterOptions,
  interactive = true,
): Promise<string[]> {
  if (!interactive || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError("Pass skill names or run in an interactive terminal to choose skills.");
  }

  const adapter = getAdapter(tool);
  const choices = catalog.map((skill) => {
    const installed = adapter.isInstalled(skill.name, adapterOptions);
    return {
      name: `${skill.name} — ${skill.description}`,
      value: skill.name,
      disabled: installed ? "already installed" : false,
    };
  });

  if (choices.every((choice) => choice.disabled)) {
    throw new CliError(`All catalog skills are already installed for ${adapter.displayName}.`);
  }

  const selected = await checkbox({
    message: `Select skills to install for ${adapter.displayName}`,
    choices,
    required: true,
  });
  return selected;
}
