import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const SETTINGS_SCHEMA_MAX_OBJECTS = 1000;

const maxObjectViolations = (
  value: unknown,
  path = "$",
): string[] => {
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      maxObjectViolations(item, `${path}[${index}]`),
    );
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, item]) => {
    const itemPath = `${path}.${key}`;
    const current =
      key === "maxObjects" &&
      typeof item === "number" &&
      item > SETTINGS_SCHEMA_MAX_OBJECTS
        ? [`${itemPath}=${item}`]
        : [];
    return [...current, ...maxObjectViolations(item, itemPath)];
  });
};

describe("App Settings schema platform limits", () => {
  it("detects a value above the Dynatrace object cap", () => {
    expect(maxObjectViolations({ maxObjects: 1001 })).toEqual([
      "$.maxObjects=1001",
    ]);
  });

  it("keeps every committed maxObjects value at or below 1000", () => {
    const schemaDirectory = join(process.cwd(), "settings", "schemas");
    const violations = readdirSync(schemaDirectory)
      .filter((file) => file.endsWith(".schema.json"))
      .flatMap((file) => {
        const schema = JSON.parse(
          readFileSync(join(schemaDirectory, file), "utf8"),
        ) as unknown;
        return maxObjectViolations(schema).map(
          (violation) => `${basename(file)}:${violation}`,
        );
      });

    expect(violations).toEqual([]);
  });
});
