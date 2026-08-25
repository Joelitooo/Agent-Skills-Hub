import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import type { ValidationIssue, ValidationMode, ValidationResult } from "../types.js";
import { asSkillFrontmatter, parseSkillMarkdown } from "./parse.js";
import {
  isSecretFileName,
  looksLikeTextFile,
  MAX_SECRET_SCAN_BYTES,
  SECRET_CONTENT_PATTERNS,
} from "./secrets.js";

export const SKILL_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const MAX_NAME_LENGTH = 64;
export const MAX_DESCRIPTION_LENGTH = 1024;
export const MAX_SKILL_LINES = 500;

export const COMPATIBLE_LICENSES = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "CC0-1.0",
  "Unlicense",
  "0BSD",
] as const;

const KNOWN_RESOURCE_DIRS = new Set(["scripts", "references", "assets"]);

const MARKDOWN_LINK_PATTERN = /!\[[^\]]*]\(([^)]+)\)|\[[^\]]*]\(([^)]+)\)/g;
const WINDOWS_PATH_IN_LINK = /^[a-zA-Z]:[\\/]/;
const MACHINE_PATH_PATTERN = /(?:^|[\s`"'(])(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/;
const WINDOWS_SEPARATOR_IN_LINK = /\\/;

export interface WalkedEntry {
  relativePath: string;
  absolutePath: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}

export function walkSkillTree(skillDir: string): WalkedEntry[] {
  const entries: WalkedEntry[] = [];
  const stack = [skillDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let dirents;
    try {
      dirents = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to read ${current}: ${message}`);
    }

    for (const dirent of dirents) {
      if (dirent.name === ".git" || dirent.name === "node_modules") {
        continue;
      }
      const absolutePath = path.join(current, dirent.name);
      const relativePath = path.relative(skillDir, absolutePath);
      const isSymbolicLink = dirent.isSymbolicLink();
      const isDirectory = dirent.isDirectory();
      entries.push({ relativePath, absolutePath, isDirectory, isSymbolicLink });
      if (isDirectory && !isSymbolicLink) {
        stack.push(absolutePath);
      }
    }
  }

  return entries;
}

export function validateSkillName(name: string): string | undefined {
  if (!name || name.trim() === "") {
    return "Frontmatter field \"name\" is required.";
  }
  if (name.length > MAX_NAME_LENGTH) {
    return `Skill name must be at most ${MAX_NAME_LENGTH} characters.`;
  }
  if (!SKILL_NAME_PATTERN.test(name)) {
    return "Skill name must be lowercase letters, numbers, and hyphens, and may not start or end with a hyphen.";
  }
  return undefined;
}

function addIssue(
  issues: ValidationIssue[],
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  file?: string,
): void {
  issues.push({ severity, code, message, ...(file ? { file } : {}) });
}

function isSafeRelativePath(relativePath: string): boolean {
  if (relativePath === "") {
    return true;
  }
  const posix = relativePath.split(path.sep).join("/");
  if (posix.startsWith("/") || WINDOWS_PATH_IN_LINK.test(posix)) {
    return false;
  }
  const segments = posix.split("/");
  return !segments.some((segment) => segment === ".." || segment === "");
}

function resolveWithin(root: string, target: string): string | undefined {
  const resolvedRoot = realpathSync(root);
  let resolvedTarget: string;
  try {
    resolvedTarget = realpathSync(target);
  } catch {
    resolvedTarget = path.resolve(target);
  }
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === "") {
    return resolvedTarget;
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return resolvedTarget;
}

function validateSymlink(skillDir: string, entry: WalkedEntry, issues: ValidationIssue[]): void {
  let target: string;
  try {
    target = readlinkSync(entry.absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addIssue(issues, "error", "unsafe-symlink", `Unable to read symlink: ${message}`, entry.relativePath);
    return;
  }

  if (path.isAbsolute(target)) {
    addIssue(
      issues,
      "error",
      "unsafe-symlink",
      `Symlink target must be a relative path inside the skill directory, not ${target}.`,
      entry.relativePath,
    );
    return;
  }

  const resolved = path.resolve(path.dirname(entry.absolutePath), target);
  if (!resolveWithin(skillDir, resolved)) {
    addIssue(
      issues,
      "error",
      "unsafe-symlink",
      `Symlink escapes the skill directory (target: ${target}).`,
      entry.relativePath,
    );
  }
}

function validateMarkdownReferences(skillDir: string, relativeFile: string, content: string, issues: ValidationIssue[]): void {
  const fileDir = path.dirname(path.join(skillDir, relativeFile));
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
    const raw = (match[1] ?? match[2] ?? "").trim();
    if (raw === "") {
      continue;
    }
    const href = raw.split(/\s+/)[0]?.replace(/^<|>$/g, "") ?? "";
    if (href === "" || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
      continue;
    }
    if (WINDOWS_SEPARATOR_IN_LINK.test(href) || WINDOWS_PATH_IN_LINK.test(href)) {
      addIssue(
        issues,
        "error",
        "windows-path",
        `Use POSIX relative paths in markdown links, not ${href}.`,
        relativeFile,
      );
      continue;
    }
    if (path.isAbsolute(href) || href.startsWith("/")) {
      addIssue(
        issues,
        "error",
        "absolute-path",
        `Markdown link must be a relative path inside the skill, not ${href}.`,
        relativeFile,
      );
      continue;
    }
    if (href.split("/").includes("..")) {
      addIssue(
        issues,
        "error",
        "path-traversal",
        `Markdown link must not contain path traversal: ${href}.`,
        relativeFile,
      );
      continue;
    }
    const target = path.resolve(fileDir, href.split("#")[0] ?? href);
    try {
      statSync(target);
      if (!resolveWithin(skillDir, target)) {
        addIssue(
          issues,
          "error",
          "path-traversal",
          `Markdown link escapes the skill directory: ${href}.`,
          relativeFile,
        );
      }
    } catch {
      addIssue(
        issues,
        "error",
        "broken-reference",
        `Markdown link points to a missing file: ${href}.`,
        relativeFile,
      );
    }
  }
}

function validateTextSecrets(relativePath: string, content: string, issues: ValidationIssue[]): void {
  for (const rule of SECRET_CONTENT_PATTERNS) {
    if (rule.pattern.test(content)) {
      addIssue(issues, "error", rule.code, rule.message, relativePath);
    }
  }
}

export function validateSkillDirectory(
  skillDir: string,
  options: { mode?: ValidationMode; expectedName?: string } = {},
): ValidationResult {
  const mode = options.mode ?? "install";
  const issues: ValidationIssue[] = [];
  const skillFile = path.join(skillDir, "SKILL.md");

  let content: string;
  try {
    content = readFileSync(skillFile, "utf8");
  } catch {
    addIssue(issues, "error", "missing-skill-md", "Each skill must contain a SKILL.md file.");
    return { ok: false, issues };
  }

  let parsed;
  try {
    parsed = parseSkillMarkdown(content, "SKILL.md");
  } catch (error) {
    addIssue(
      issues,
      "error",
      "malformed-frontmatter",
      error instanceof Error ? error.message : String(error),
      "SKILL.md",
    );
    return { ok: false, issues };
  }

  const frontmatter = asSkillFrontmatter(parsed.frontmatter);
  const nameError = validateSkillName(frontmatter.name);
  if (nameError) {
    addIssue(issues, "error", "invalid-name", nameError, "SKILL.md");
  }

  if (!frontmatter.description || frontmatter.description.trim() === "") {
    addIssue(issues, "error", "missing-description", "Frontmatter field \"description\" is required.", "SKILL.md");
  } else if (frontmatter.description.length > MAX_DESCRIPTION_LENGTH) {
    addIssue(
      issues,
      "error",
      "description-too-long",
      `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`,
      "SKILL.md",
    );
  }

  const directoryName = path.basename(path.resolve(skillDir));
  if (frontmatter.name && directoryName !== frontmatter.name) {
    addIssue(
      issues,
      "error",
      "name-mismatch",
      `Directory name "${directoryName}" must match frontmatter name "${frontmatter.name}".`,
    );
  }
  if (options.expectedName && frontmatter.name && options.expectedName !== frontmatter.name) {
    addIssue(
      issues,
      "error",
      "name-mismatch",
      `Expected skill name "${options.expectedName}" but SKILL.md declares "${frontmatter.name}".`,
    );
  }

  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > MAX_SKILL_LINES) {
    addIssue(
      issues,
      "warning",
      "skill-too-long",
      `SKILL.md has ${lineCount} lines; keep the main file under ${MAX_SKILL_LINES} lines and move detail into references/.`,
      "SKILL.md",
    );
  }

  if (MACHINE_PATH_PATTERN.test(parsed.body)) {
    addIssue(
      issues,
      "warning",
      "machine-specific-path",
      "SKILL.md appears to contain a machine-specific absolute path. Use portable relative paths instead.",
      "SKILL.md",
    );
  }

  const license = frontmatter.license?.trim();
  const hasLicenseFile = ["LICENSE", "LICENSE.md", "LICENSE.txt"].some((fileName) => {
    try {
      return statSync(path.join(skillDir, fileName)).isFile();
    } catch {
      return false;
    }
  });

  if (mode === "contribute") {
    if (!license && !hasLicenseFile) {
      addIssue(
        issues,
        "error",
        "missing-license",
        `Contributions must declare a compatible license in frontmatter (one of ${COMPATIBLE_LICENSES.join(", ")}) or include a LICENSE file.`,
        "SKILL.md",
      );
    } else if (license && !COMPATIBLE_LICENSES.includes(license as (typeof COMPATIBLE_LICENSES)[number])) {
      addIssue(
        issues,
        "error",
        "incompatible-license",
        `License "${license}" is not compatible with this repository. Use one of: ${COMPATIBLE_LICENSES.join(", ")}.`,
        "SKILL.md",
      );
    }
  } else if (license && !COMPATIBLE_LICENSES.includes(license as (typeof COMPATIBLE_LICENSES)[number])) {
    addIssue(
      issues,
      "warning",
      "unrecognized-license",
      `License "${license}" is not in the known-compatible set (${COMPATIBLE_LICENSES.join(", ")}).`,
      "SKILL.md",
    );
  }

  let entries: WalkedEntry[] = [];
  try {
    entries = walkSkillTree(skillDir);
  } catch (error) {
    addIssue(issues, "error", "unreadable-tree", error instanceof Error ? error.message : String(error));
  }

  for (const entry of entries) {
    if (!isSafeRelativePath(entry.relativePath)) {
      addIssue(
        issues,
        "error",
        "path-traversal",
        `Skill files must use safe relative paths; found "${entry.relativePath}".`,
        entry.relativePath,
      );
      continue;
    }

    if (entry.isSymbolicLink) {
      validateSymlink(skillDir, entry, issues);
      continue;
    }

    if (entry.isDirectory) {
      const topLevel = entry.relativePath.split(/[\\/]/)[0];
      if (topLevel && !KNOWN_RESOURCE_DIRS.has(topLevel) && !entry.relativePath.includes(path.sep) && !entry.relativePath.includes("/")) {
        addIssue(
          issues,
          "warning",
          "unexpected-directory",
          `Optional resource directories are scripts/, references/, and assets/. Found extra directory "${topLevel}".`,
          entry.relativePath,
        );
      }
      continue;
    }

    if (isSecretFileName(entry.relativePath)) {
      addIssue(
        issues,
        "error",
        "secret-file",
        `Refusing to include likely credential file "${path.basename(entry.relativePath)}".`,
        entry.relativePath,
      );
      continue;
    }

    if (!looksLikeTextFile(entry.relativePath)) {
      continue;
    }

    let fileContent: string;
    try {
      const stat = lstatSync(entry.absolutePath);
      if (stat.size > MAX_SECRET_SCAN_BYTES) {
        continue;
      }
      fileContent = readFileSync(entry.absolutePath, "utf8");
    } catch {
      continue;
    }

    validateTextSecrets(entry.relativePath, fileContent, issues);
    if (/\.md$/i.test(entry.relativePath)) {
      validateMarkdownReferences(skillDir, entry.relativePath, fileContent, issues);
    }
  }

  const ok = !issues.some((issue) => issue.severity === "error");
  return {
    ok,
    name: frontmatter.name || undefined,
    description: frontmatter.description || undefined,
    issues,
  };
}

export function formatValidationIssues(result: ValidationResult, skillLabel?: string): string {
  const label = skillLabel ?? result.name ?? "skill";
  if (result.issues.length === 0) {
    return `${label}: valid`;
  }
  return result.issues
    .map((issue) => {
      const where = issue.file ? `${issue.file}: ` : "";
      return `${label}: ${issue.severity} ${issue.code}: ${where}${issue.message}`;
    })
    .join("\n");
}
