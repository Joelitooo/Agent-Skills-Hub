import { adapters, getAdapter } from "../adapters/index.js";
import { discoverCatalog } from "../catalog/discover.js";
import { catalogDirectory, findRepoRoot } from "../paths.js";
import type { AdapterOptions, ToolId } from "../types.js";
import { CliError, isToolId } from "../types.js";

export interface ListOptions {
  tool?: string;
  targetDir?: string;
  homeDir?: string;
  json?: boolean;
  repoRoot?: string;
}

export interface SkillListRow {
  name: string;
  description: string;
  installed: Partial<Record<ToolId, boolean>>;
}

export function listSkills(options: ListOptions = {}): SkillListRow[] {
  const repoRoot = options.repoRoot ?? findRepoRoot();
  const catalog = discoverCatalog(catalogDirectory(repoRoot));
  const tools = resolveTools(options.tool);
  const adapterOptions: AdapterOptions = {
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    ...(options.targetDir ? { targetDir: options.targetDir } : {}),
  };

  if (options.targetDir && tools.length !== 1) {
    throw new CliError("--target-dir requires --tool so the override applies to a single adapter.");
  }

  return catalog.map((skill) => {
    const installed: Partial<Record<ToolId, boolean>> = {};
    for (const tool of tools) {
      installed[tool] = getAdapter(tool).isInstalled(skill.name, adapterOptions);
    }
    return {
      name: skill.name,
      description: skill.description,
      installed,
    };
  });
}

export function formatSkillTable(rows: SkillListRow[], tools: ToolId[]): string {
  if (rows.length === 0) {
    return "No skills found in the catalog.";
  }

  const headers = ["Skill", ...tools.map((tool) => titleTool(tool)), "Description"];
  const table = [
    headers,
    ...rows.map((row) => [
      row.name,
      ...tools.map((tool) => (row.installed[tool] ? "yes" : "no")),
      truncate(row.description, 72),
    ]),
  ];
  const widths = headers.map((_, index) => Math.max(...table.map((line) => (line[index] ?? "").length)));
  return table
    .map((line, rowIndex) => {
      const formatted = line
        .map((cell, index) => (index === line.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
        .join("  ");
      if (rowIndex === 0) {
        const rule = widths.map((width, index) => "-".repeat(index === widths.length - 1 ? Math.min(width, 12) : width)).join("  ");
        return `${formatted}\n${rule}`;
      }
      return formatted;
    })
    .join("\n");
}

export function resolveTools(tool?: string): ToolId[] {
  if (!tool) {
    return adapters.map((adapter) => adapter.id);
  }
  if (!isToolId(tool)) {
    throw new CliError(`Unknown tool "${tool}". Use cursor, claude, or codex.`);
  }
  return [tool];
}

function titleTool(tool: ToolId): string {
  return getAdapter(tool).displayName;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}
