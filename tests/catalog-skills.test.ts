import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { discoverCatalog } from "../src/catalog/discover.js";
import { validateSkillDirectory } from "../src/catalog/validate.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("real catalog skills", () => {
  it("validates every committed catalog skill for contribution", () => {
    const catalog = discoverCatalog(path.join(repoRoot, "skills"));
    expect(catalog.length).toBeGreaterThan(0);
    for (const skill of catalog) {
      const result = validateSkillDirectory(skill.directory, { mode: "contribute", expectedName: skill.name });
      const errors = result.issues.filter((issue) => issue.severity === "error");
      expect(errors, `${skill.name}: ${errors.map((issue) => issue.message).join("; ")}`).toEqual([]);
    }
  });
});
