import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverCatalog, findCatalogSkill } from "../src/catalog/discover.js";
import { parseSkillMarkdown } from "../src/catalog/parse.js";
import { createHubRepo, removeDir, skillMarkdown, writeFile, writeSkill } from "./helpers.js";

describe("catalog discovery and parsing", () => {
  it("parses YAML frontmatter and preserves extra fields", () => {
    const parsed = parseSkillMarkdown(
      skillMarkdown({
        name: "extra-fields",
        extraFrontmatter: "disable-model-invocation: true\nmetadata:\n  foo: bar",
      }),
    );
    expect(parsed.frontmatter["name"]).toBe("extra-fields");
    expect(parsed.frontmatter["disable-model-invocation"]).toBe(true);
    expect(parsed.body).toContain("test skill");
  });

  it("rejects files without frontmatter", () => {
    expect(() => parseSkillMarkdown("# No frontmatter\n")).toThrow(/frontmatter/);
  });

  it("discovers skills/*/SKILL.md without a central manifest", () => {
    const repo = createHubRepo(["alpha-skill", "beta-skill"]);
    writeFile(path.join(repo, "skills"), "README.md", "not a skill");
    writeFile(path.join(repo, "skills"), path.join(".hidden", "SKILL.md"), skillMarkdown({ name: "hidden" }));
    const catalog = discoverCatalog(path.join(repo, "skills"));
    expect(catalog.map((skill) => skill.name)).toEqual(["alpha-skill", "beta-skill"]);
    expect(findCatalogSkill(path.join(repo, "skills"), "beta-skill")?.name).toBe("beta-skill");
    removeDir(repo);
  });

  it("keeps unreadable frontmatter entries so validation can report them", () => {
    const repo = createHubRepo([]);
    writeSkill(path.join(repo, "skills"), "broken-skill", { name: "broken-skill" });
    writeFile(path.join(repo, "skills", "broken-skill"), "SKILL.md", "not yaml");
    const catalog = discoverCatalog(path.join(repo, "skills"));
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.name).toBe("broken-skill");
    removeDir(repo);
  });
});
