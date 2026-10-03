import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ADVISORY = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const EXCEPTION_EXPIRES_AT = "2026-11-01T00:00:00Z";
const EXPECTED_PACKAGES = new Set([
  "braces",
  "micromatch",
  "@dynatrace/devkit",
  "@dynatrace/strato-components",
  "@dynatrace/strato-components-preview",
]);
const VULNERABLE_RUNTIME_PACKAGES = /(^|\/)node_modules\/(braces|micromatch|@dynatrace\/devkit)(\/|$)/;

function fail(reason) {
  process.stderr.write(`Production dependency audit failed: ${reason}\n`);
  process.exitCode = 1;
}

const windows = process.platform === "win32";
const audit = spawnSync(windows ? "cmd.exe" : "npm",
  windows ? ["/d", "/s", "/c", "npm audit --omit=dev --json"] : ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 120_000,
  });
if (audit.error || ![0, 1].includes(audit.status)) {
  fail(`npm audit could not complete (${audit.error?.message ?? audit.status}).`);
} else {
  let report;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    fail("npm audit did not return valid JSON.");
  }
  if (report?.error) {
    fail(`npm audit reported ${report.error.code ?? "an endpoint error"}.`);
  } else if (report && audit.status === 0 && Object.keys(report.vulnerabilities ?? {}).length === 0) {
    process.stdout.write("Production dependency audit passed with no advisories.\n");
  } else if (report) {
    const vulnerabilities = report.vulnerabilities ?? {};
    const names = Object.keys(vulnerabilities);
    const exactKnownTree = names.length === EXPECTED_PACKAGES.size &&
      names.every((name) => EXPECTED_PACKAGES.has(name)) &&
      names.every((name) => vulnerabilities[name].severity === "high" &&
        vulnerabilities[name].fixAvailable === false &&
        vulnerabilities[name].via.every((via) => typeof via === "string"
          ? EXPECTED_PACKAGES.has(via) : via.url === ADVISORY)) &&
      vulnerabilities.braces.via.some((via) => typeof via === "object" && via.url === ADVISORY);
    if (!exactKnownTree) {
      fail("the advisory set differs from the reviewed Dynatrace devkit dependency tree.");
    } else if (Date.now() >= Date.parse(EXCEPTION_EXPIRES_AT)) {
      fail(`the ${ADVISORY} exception expired on ${EXCEPTION_EXPIRES_AT}.`);
    } else {
      try {
        for (const file of ["dist/ui.metafile.json", "dist/function.metafile.json"]) {
          const meta = JSON.parse(readFileSync(file, "utf8"));
          const bundled = Object.keys(meta.inputs ?? {}).some((path) =>
            VULNERABLE_RUNTIME_PACKAGES.test(path.replaceAll("\\", "/")));
          const external = Object.values(meta.outputs ?? {}).some((output) =>
            (output.imports ?? []).some((item) =>
              /^(braces|micromatch|@dynatrace\/devkit)(\/|$)/.test(item.path)));
          if (bundled || external) throw new Error(`${file} contains an affected package.`);
        }
        process.stdout.write(`Temporary gated exception for ${ADVISORY} until ${EXCEPTION_EXPIRES_AT}. ` +
          "The affected packages are absent from the generated app bundles. All other advisories still fail.\n");
      } catch (error) {
        fail(error.message);
      }
    }
  }
}
