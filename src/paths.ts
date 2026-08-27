import { existsSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PACKAGE_NAME = "agent-skills-hub";

export function homeDirectory(override?: string): string {
  if (override && override.trim() !== "") {
    return path.resolve(override);
  }
  const home = os.homedir();
  if (!home) {
    throw new Error("Unable to resolve the user home directory.");
  }
  return home;
}

export function resolveUserPath(input: string, cwd = process.cwd()): string {
  if (input === "~") {
    return homeDirectory();
  }
  if (input.startsWith(`~${path.sep}`) || input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(homeDirectory(), input.slice(2));
  }
  return path.resolve(cwd, input);
}

export function findRepoRoot(startDir = process.cwd()): string {
  const envRoot = process.env["SKILLS_HUB_ROOT"];
  if (envRoot) {
    return path.resolve(envRoot);
  }

  let dir = path.resolve(startDir);
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    const skillsDir = path.join(dir, "skills");
    if (existsSync(pkgPath) && existsSync(skillsDir)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string };
        if (pkg.name === PACKAGE_NAME) {
          return dir;
        }
      } catch {
        // Keep walking if package.json is unreadable.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Could not find the Agent Skills Hub repository root. Clone the repository and run this command from inside it.",
      );
    }
    dir = parent;
  }
}

export function catalogDirectory(repoRoot = findRepoRoot()): string {
  return path.join(repoRoot, "skills");
}

function stripWindowsExtendedPrefix(filePath: string): string {
  if (filePath.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${filePath.slice("\\\\?\\UNC\\".length)}`;
  }
  if (filePath.startsWith("\\\\?\\")) {
    return filePath.slice("\\\\?\\".length);
  }
  return filePath;
}

export function canonicalize(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    // Native realpath expands Windows 8.3 names (RUNNER~1) to the long path Git reports.
    return stripWindowsExtendedPrefix(realpathSync.native(resolved));
  } catch {
    try {
      return stripWindowsExtendedPrefix(realpathSync(resolved));
    } catch {
      return resolved;
    }
  }
}

export function relativeToRoot(root: string, target: string): string {
  const relative = path.relative(canonicalize(root), canonicalize(target));
  return relative === "" ? "." : relative;
}

export function gitRelativePath(root: string, target: string): string {
  return relativeToRoot(root, target).split(path.sep).join("/");
}
