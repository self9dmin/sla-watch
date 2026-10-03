import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const tracked = spawnSync("git", ["ls-files", "-z"], { encoding: "buffer" });
if (tracked.status !== 0) throw new Error("Could not list tracked files.");

const rules = [
  ["github-token", /(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,})/],
  ["api-token", /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|dt0c0[12]\.[A-Za-z0-9._-]{20,}|AIza[0-9A-Za-z_-]{35}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/],
  ["literal-bearer", /\bBearer\s+[A-Za-z0-9._~-]{24,}\b/i],
  ["url-credential", /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s/]+/i],
  ["tenant-url", /\bhttps?:\/\/(?!example\.|your-environment\.)[a-z0-9-]+\.apps\.dynatrace\.com\b/i],
  ["tenant-id", /\b[a-z]{3}\d{5}\b/i],
  ["private-host", /\b[a-z0-9.-]+\.internal\b/i],
  ["local-machine-path", /\b[A-Z]:\\(?:Users|temp)\\/i],
];
const privatePath = /(?:^|\/)(?:\.dt-app|playwright-report|test-results|\.env(?!\.example$)|secrets?\.json|[^/]+\.(?:pem|p12|pfx|key))(?:\/|$)/i;
const syntheticTestHosts = /\bip-10-(?:20-10-102|0-0-[12])\.ec2\.internal\b/g;
const privateKeyBlock = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]{20,}\r?\n){2,}/;
const results = [];
for (const path of tracked.stdout.toString("utf8").split("\0").filter(Boolean)) {
  if (path === "scripts/audit-public-source.mjs" || !existsSync(path)) continue;
  if (privatePath.test(path)) results.push(`${path}: private file is tracked`);
  const data = readFileSync(path);
  if (data.includes(0) || data.length > 2_000_000) continue;
  const content = data.toString("utf8");
  if (privateKeyBlock.test(content)) results.push(`${path}: private-key-material`);
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const reviewedLine = path.startsWith("tests/") ? line.replace(syntheticTestHosts, "") : line;
    for (const [name, pattern] of rules) {
      if (pattern.test(reviewedLine)) results.push(`${path}:${index + 1}: ${name}`);
    }
  });
}
if (results.length) {
  process.stderr.write(`${results.join("\n")}\nPublic source audit failed. Review matches without copying values into logs.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Public source audit passed. No matching secrets or tenant identifiers in tracked files.\n");
}
