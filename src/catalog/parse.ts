import grayMatter from "gray-matter";
import type { SkillFrontmatter } from "../types.js";
import { CliError } from "../types.js";

export interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseSkillMarkdown(content: string, fileLabel = "SKILL.md"): ParsedSkillMarkdown {
  const trimmed = content.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) {
    throw new CliError(`${fileLabel} must start with YAML frontmatter delimited by ---.`);
  }

  let parsed: ReturnType<typeof grayMatter>;
  try {
    parsed = grayMatter(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`${fileLabel} frontmatter is malformed: ${message}`);
  }

  if (parsed.data === null || typeof parsed.data !== "object" || Array.isArray(parsed.data) || Object.keys(parsed.data).length === 0) {
    throw new CliError(`${fileLabel} is missing YAML frontmatter.`);
  }

  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
}

export function asSkillFrontmatter(data: Record<string, unknown>): SkillFrontmatter {
  const name = data["name"];
  const description = data["description"];
  const license = data["license"];

  return {
    ...data,
    name: typeof name === "string" ? name : "",
    description: typeof description === "string" ? description : "",
    ...(typeof license === "string" ? { license } : {}),
  };
}
