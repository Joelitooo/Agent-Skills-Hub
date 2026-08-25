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

export function canonicalize(filePath: string): string {
  try {
    return realpathSync(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

export function relativeToRoot(root: string, target: string): string {
  const relative = path.relative(canonicalize(root), canonicalize(target));
  return relative === "" ? "." : relative;
}
