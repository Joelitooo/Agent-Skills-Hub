import { existsSync } from "node:fs";
import path from "node:path";
import { homeDirectory, resolveUserPath } from "../paths.js";
import type { AdapterOptions, SkillInstallResult, ToolId } from "../types.js";
import { copySkillDirectory, destinationExists } from "./copy.js";

export interface ToolAdapter {
  readonly id: ToolId;
  readonly displayName: string;
  readonly defaultRelativeSkillsDir: readonly string[];
  readonly detectMarkers: readonly string[][];
  detect(options?: AdapterOptions): boolean;
  skillsRoot(options?: AdapterOptions): string;
  destination(skillName: string, options?: AdapterOptions): string;
  isInstalled(skillName: string, options?: AdapterOptions): boolean;
  install(sourceDir: string, skillName: string, options?: AdapterOptions): SkillInstallResult;
}

function createAdapter(
  id: ToolId,
  displayName: string,
  defaultRelativeSkillsDir: readonly string[],
  detectMarkers: readonly string[][],
): ToolAdapter {
  const skillsRoot = (options: AdapterOptions = {}): string => {
    if (options.targetDir) {
      return resolveUserPath(options.targetDir);
    }
    return path.join(homeDirectory(options.homeDir), ...defaultRelativeSkillsDir);
  };

  const destination = (skillName: string, options: AdapterOptions = {}): string => {
    return path.join(skillsRoot(options), skillName);
  };

  const detect = (options: AdapterOptions = {}): boolean => {
    const home = homeDirectory(options.homeDir);
    return detectMarkers.some((segments) => existsSync(path.join(home, ...segments)));
  };

  const isInstalled = (skillName: string, options: AdapterOptions = {}): boolean => {
    return destinationExists(destination(skillName, options));
  };

  const install = (sourceDir: string, skillName: string, options: AdapterOptions = {}): SkillInstallResult => {
    const dest = destination(skillName, options);
    if (isInstalled(skillName, options)) {
      return {
        name: skillName,
        status: "skipped",
        destination: dest,
        reason: "already installed",
      };
    }
    copySkillDirectory(sourceDir, dest);
    return {
      name: skillName,
      status: "installed",
      destination: dest,
    };
  };

  return {
    id,
    displayName,
    defaultRelativeSkillsDir,
    detectMarkers,
    detect,
    skillsRoot,
    destination,
    isInstalled,
    install,
  };
}

export const cursorAdapter = createAdapter("cursor", "Cursor", [".cursor", "skills"], [[".cursor"]]);
export const claudeAdapter = createAdapter("claude", "Claude Code", [".claude", "skills"], [[".claude"]]);
export const codexAdapter = createAdapter("codex", "Codex", [".agents", "skills"], [[".codex"], [".agents"]]);

export const adapters: readonly ToolAdapter[] = [cursorAdapter, claudeAdapter, codexAdapter];

export function getAdapter(tool: ToolId): ToolAdapter {
  const adapter = adapters.find((item) => item.id === tool);
  if (!adapter) {
    throw new Error(`Unknown tool: ${tool}`);
  }
  return adapter;
}
