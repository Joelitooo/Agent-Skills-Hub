import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const SKIP_NAMES = new Set([".git", "node_modules"]);

export function destinationExists(destination: string): boolean {
  return existsSync(destination);
}

export function copySkillDirectory(sourceDir: string, destinationDir: string): void {
  if (existsSync(destinationDir)) {
    throw new Error(`Refusing to overwrite existing path: ${destinationDir}`);
  }

  mkdirSync(path.dirname(destinationDir), { recursive: true });
  cpSync(sourceDir, destinationDir, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
    preserveTimestamps: true,
    filter: (src) => !SKIP_NAMES.has(path.basename(src)),
  });
}

export function isExecutable(filePath: string): boolean {
  try {
    const mode = statSync(filePath).mode;
    return (mode & 0o111) !== 0;
  } catch {
    return false;
  }
}
