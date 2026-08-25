import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CatalogSkill, SkillFrontmatter } from "../types.js";
import { asSkillFrontmatter, parseSkillMarkdown } from "./parse.js";

export function discoverCatalog(catalogDir: string): CatalogSkill[] {
  if (!existsSync(catalogDir)) {
    return [];
  }

  const entries = readdirSync(catalogDir, { withFileTypes: true });
  const skills: CatalogSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const directory = path.join(catalogDir, entry.name);
    const skillFile = path.join(directory, "SKILL.md");
    if (!existsSync(skillFile) || !statSync(skillFile).isFile()) {
      continue;
    }

    let frontmatter: SkillFrontmatter = { name: entry.name, description: "" };
    try {
      const parsed = parseSkillMarkdown(readFileSync(skillFile, "utf8"), skillFile);
      frontmatter = asSkillFrontmatter(parsed.frontmatter);
    } catch {
      // Keep the directory so validate can report frontmatter errors.
    }
    skills.push({
      name: frontmatter.name || entry.name,
      description: frontmatter.description,
      directory,
      skillFile,
      frontmatter,
    });
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

export function findCatalogSkill(catalogDir: string, name: string): CatalogSkill | undefined {
  return discoverCatalog(catalogDir).find((skill) => skill.name === name || path.basename(skill.directory) === name);
}
