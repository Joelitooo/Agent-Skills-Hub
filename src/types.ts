export type ToolId = "cursor" | "claude" | "codex";

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  [key: string]: unknown;
}

export interface CatalogSkill {
  name: string;
  description: string;
  directory: string;
  skillFile: string;
  frontmatter: SkillFrontmatter;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string;
}

export interface ValidationResult {
  ok: boolean;
  name?: string;
  description?: string;
  issues: ValidationIssue[];
}

export type ValidationMode = "install" | "contribute";

export interface AdapterOptions {
  homeDir?: string;
  targetDir?: string;
}

export type InstallStatus = "installed" | "skipped" | "failed";

export interface SkillInstallResult {
  name: string;
  status: InstallStatus;
  destination: string;
  reason?: string;
}

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export const TOOL_IDS: readonly ToolId[] = ["cursor", "claude", "codex"];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}
