import { checkbox } from "@inquirer/prompts";
import { discoverCatalog } from "../catalog/discover.js";
import { catalogDirectory, findRepoRoot, resolveUserPath } from "../paths.js";
import { discoverLocalSkills, uniqueLocalSkills } from "../contribute/discoverLocal.js";
import { importSkill, type ImportResult } from "../contribute/importSkill.js";
import { CliError } from "../types.js";

export interface ImportCommandOptions {
  paths?: string[];
  repoRoot?: string;
  homeDir?: string;
  git?: boolean;
  openPr?: boolean;
  interactive?: boolean;
}

export async function importSkills(options: ImportCommandOptions): Promise<ImportResult[]> {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const catalogDir = catalogDirectory(repoRoot);
  const sources = options.paths?.filter((value) => value.trim() !== "") ?? [];
  const resolvedSources =
    sources.length > 0
      ? sources.map((source) => resolveUserPath(source))
      : await selectLocalSources(repoRoot, options);

  const results: ImportResult[] = [];
  for (const sourceDir of resolvedSources) {
    results.push(
      importSkill({
        sourceDir,
        catalogDir,
        repoRoot,
        git: options.git,
        openPr: options.openPr,
      }),
    );
  }
  return results;
}

export function formatImportResults(results: ImportResult[]): string {
  return results
    .map((result) => {
      const header = `Imported ${result.name} -> ${result.destination}`;
      return [header, ...result.notes.map((note) => `  ${note}`)].join("\n");
    })
    .join("\n\n");
}

async function selectLocalSources(repoRoot: string, options: ImportCommandOptions): Promise<string[]> {
  if (options.interactive === false || !process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError("Pass a skill path or run in an interactive terminal to choose a local skill.");
  }

  const catalogNames = new Set(discoverCatalog(catalogDirectory(repoRoot)).map((skill) => skill.name));
  const local = uniqueLocalSkills(discoverLocalSkills({ homeDir: options.homeDir })).filter(
    (skill) => !catalogNames.has(skill.name),
  );

  if (local.length === 0) {
    throw new CliError(
      "No new local skills were found in Cursor, Claude Code, or Codex global directories. Pass a path to skills import.",
    );
  }

  return checkbox({
    message: "Select local skills to import into the catalog",
    choices: local.map((skill) => ({
      name: `${skill.name} (${skill.toolDisplayName}) — ${skill.description}`,
      value: skill.directory,
    })),
    required: true,
  });
}
