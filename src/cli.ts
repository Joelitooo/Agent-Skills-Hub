import { Command } from "commander";
import { adapters } from "./adapters/index.js";
import { contributeSkill, formatContributeResult } from "./commands/contribute.js";
import { formatImportResults, importSkills } from "./commands/import.js";
import { formatInstallReport, installSkills } from "./commands/install.js";
import { formatSkillTable, listSkills, resolveTools } from "./commands/list.js";
import { formatValidateReport, validateSkills } from "./commands/validate.js";
import { loadPackageJson } from "./packageInfo.js";
import { CliError } from "./types.js";

export interface CliIo {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
}

const defaultIo: CliIo = {
  stdout: (message) => {
    process.stdout.write(`${message}\n`);
  },
  stderr: (message) => {
    process.stderr.write(`${message}\n`);
  },
};

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  const pkg = loadPackageJson();
  const program = new Command();

  program
    .name("skills")
    .description(pkg.description ?? "Agent Skills Hub CLI")
    .version(pkg.version)
    .showHelpAfterError()
    .exitOverride();

  program.configureOutput({
    writeOut: (str) => io.stdout(str.replace(/\n$/, "")),
    writeErr: (str) => io.stderr(str.replace(/\n$/, "")),
  });

  program
    .command("list")
    .description("List catalog skills and whether they are installed for a tool")
    .option("-t, --tool <tool>", "cursor, claude, or codex (defaults to all)")
    .option("--target-dir <dir>", "Override the tool's global skills directory")
    .option("--json", "Print machine-readable JSON", false)
    .action((options: { tool?: string; targetDir?: string; json?: boolean }) => {
      const rows = listSkills({
        tool: options.tool,
        targetDir: options.targetDir,
        json: options.json,
      });
      if (options.json) {
        io.stdout(JSON.stringify(rows, null, 2));
        return;
      }
      io.stdout(formatSkillTable(rows, resolveTools(options.tool)));
    });

  program
    .command("install")
    .description("Install selected catalog skills into Cursor, Claude Code, or Codex")
    .argument("[names...]", "Skill names to install; omit to choose interactively")
    .requiredOption("-t, --tool <tool>", `Target tool: ${adapters.map((adapter) => adapter.id).join(", ")}`)
    .option("--target-dir <dir>", "Override the tool's global skills directory")
    .option("--json", "Print machine-readable JSON", false)
    .action(async (names: string[], options: { tool: string; targetDir?: string; json?: boolean }) => {
      const report = await installSkills({
        names,
        tool: options.tool,
        targetDir: options.targetDir,
      });
      if (options.json) {
        io.stdout(JSON.stringify(report, null, 2));
      } else {
        io.stdout(formatInstallReport(report));
      }
      if (report.results.some((result) => result.status === "failed")) {
        throw new CliError("One or more skills failed to install.", 1);
      }
    });

  program
    .command("import")
    .description("Copy a local skill into the catalog and optionally start a contribution branch")
    .argument("[path]", "Path to a skill directory containing SKILL.md")
    .option("--no-git", "Copy the skill without creating a git branch or commit")
    .option("--pr", "Push the contribution branch and open a pull request with GitHub CLI", false)
    .option("--json", "Print machine-readable JSON", false)
    .action(async (skillPath: string | undefined, options: { git?: boolean; pr?: boolean; json?: boolean }) => {
      const results = await importSkills({
        paths: skillPath ? [skillPath] : [],
        git: options.git,
        openPr: options.pr,
      });
      if (options.json) {
        io.stdout(JSON.stringify(results, null, 2));
        return;
      }
      io.stdout(formatImportResults(results));
    });

  program
    .command("contribute")
    .description("Create a skill/<name> branch, commit, and optionally open a pull request")
    .option("-n, --name <skill>", "Catalog skill name")
    .option("--pr", "Push and open a pull request with GitHub CLI if available", false)
    .option("--json", "Print machine-readable JSON", false)
    .action((options: { name?: string; pr?: boolean; json?: boolean }) => {
      const result = contributeSkill({
        name: options.name,
        openPr: options.pr,
      });
      if (options.json) {
        io.stdout(JSON.stringify(result, null, 2));
        return;
      }
      io.stdout(formatContributeResult(result));
    });

  program
    .command("validate")
    .description("Validate catalog skills or a local skill directory")
    .argument("[names...]", "Catalog skill names; omit to validate the entire catalog")
    .option("--path <dir>", "Validate a skill directory outside the catalog")
    .option("--mode <mode>", "install or contribute", "install")
    .option("--json", "Print machine-readable JSON", false)
    .action((names: string[], options: { path?: string; mode?: string; json?: boolean }) => {
      if (options.mode !== "install" && options.mode !== "contribute") {
        throw new CliError('--mode must be "install" or "contribute".');
      }
      const report = validateSkills({
        names,
        path: options.path,
        mode: options.mode,
      });
      if (options.json) {
        io.stdout(JSON.stringify(report, null, 2));
      } else {
        io.stdout(formatValidateReport(report));
        io.stdout(report.ok ? "All checked skills are valid." : "Validation failed.");
      }
      if (!report.ok) {
        throw new CliError("Skill validation failed.", 1);
      }
    });

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      io.stderr(error.message);
      return error.exitCode;
    }
    if (isCommanderError(error)) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }
      if (error.code === "commander.help") {
        return 0;
      }
      io.stderr(error.message);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(message);
    return 1;
  }
}

function isCommanderError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}
