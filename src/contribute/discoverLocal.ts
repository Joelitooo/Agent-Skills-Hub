import { existsSync } from "node:fs";
import path from "node:path";
import { adapters } from "../adapters/index.js";
import { discoverCatalog } from "../catalog/discover.js";
import { validateSkillDirectory } from "../catalog/validate.js";
import { homeDirectory } from "../paths.js";
import type { AdapterOptions, ToolId } from "../types.js";

export interface LocalSkill {
  name: string;
  description: string;
  directory: string;
  tool: ToolId;
  toolDisplayName: string;
}

export function discoverLocalSkills(options: AdapterOptions = {}): LocalSkill[] {
  const found: LocalSkill[] = [];
  const home = homeDirectory(options.homeDir);

  for (const adapter of adapters) {
    const root = adapter.skillsRoot({ ...options, homeDir: home });
    if (!existsSync(root)) {
      continue;
    }
    const catalog = discoverCatalog(root);
    for (const skill of catalog) {
      const validation = validateSkillDirectory(skill.directory, { mode: "install" });
      found.push({
        name: validation.name ?? skill.name,
        description: validation.description ?? skill.description,
        directory: skill.directory,
        tool: adapter.id,
        toolDisplayName: adapter.displayName,
      });
    }
  }

  found.sort((a, b) => a.name.localeCompare(b.name) || a.tool.localeCompare(b.tool));
  return found;
}

export function uniqueLocalSkills(skills: LocalSkill[]): LocalSkill[] {
  const seen = new Set<string>();
  const unique: LocalSkill[] = [];
  for (const skill of skills) {
    const key = path.resolve(skill.directory);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(skill);
  }
  return unique;
}
