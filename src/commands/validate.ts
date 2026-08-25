import { discoverCatalog } from "../catalog/discover.js";
import { formatValidationIssues, validateSkillDirectory } from "../catalog/validate.js";
import { catalogDirectory, findRepoRoot, resolveUserPath } from "../paths.js";
import { CliError } from "../types.js";
import type { ValidationMode, ValidationResult } from "../types.js";

export interface ValidateCommandOptions {
  names?: string[];
  path?: string;
  mode?: ValidationMode;
  repoRoot?: string;
}

export interface ValidateCommandReport {
  results: { label: string; result: ValidationResult }[];
  ok: boolean;
}

export function validateSkills(options: ValidateCommandOptions = {}): ValidateCommandReport {
  const mode = options.mode ?? "install";

  if (options.path) {
    const target = resolveUserPath(options.path);
    const result = validateSkillDirectory(target, { mode });
    return {
      results: [{ label: result.name ?? target, result }],
      ok: result.ok,
    };
  }

  const repoRoot = options.repoRoot ?? findRepoRoot();
  const catalog = discoverCatalog(catalogDirectory(repoRoot));
  const requested = options.names?.filter((name) => name.trim() !== "") ?? [];
  const selected =
    requested.length === 0
      ? catalog
      : requested.map((name) => {
          const match = catalog.find((skill) => skill.name === name);
          if (!match) {
            throw new CliError(`Skill "${name}" was not found in the catalog.`);
          }
          return match;
        });

  if (selected.length === 0) {
    throw new CliError("No skills found to validate.");
  }

  const results = selected.map((skill) => ({
    label: skill.name,
    result: validateSkillDirectory(skill.directory, { mode, expectedName: skill.name }),
  }));

  return {
    results,
    ok: results.every((item) => item.result.ok),
  };
}

export function formatValidateReport(report: ValidateCommandReport): string {
  return report.results
    .map((item) => formatValidationIssues(item.result, item.label))
    .join("\n");
}
