import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface PackageJson {
  name: string;
  version: string;
  description: string;
}

export function loadPackageJson(): PackageJson {
  const pkgUrl = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8")) as PackageJson;
}

export function packageRoot(): string {
  return path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
}
