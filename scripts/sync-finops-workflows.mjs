import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = await readFile(path.join(root, "finops-agent", "dynatrace-route.workflow.js"), "utf8");
const feedback = await readFile(path.join(root, "finops-agent", "dynatrace-feedback.workflow.js"), "utf8");
const output = `// Generated from finops-agent/*.workflow.js by scripts/sync-finops-workflows.mjs.
// Edit the source scripts and regenerate. Runtime values are injected only when a private draft is created.
// eslint-disable-next-line noSecrets/no-secrets
export const ROUTE_WORKFLOW_SCRIPT = ${JSON.stringify(route)};
// eslint-disable-next-line noSecrets/no-secrets
export const FEEDBACK_WORKFLOW_SCRIPT = ${JSON.stringify(feedback)};
`;
const destination = path.join(root, "ui", "app", "data", "finopsWorkflowScripts.generated.ts");
if (process.argv.includes("--check")) {
  const current = await readFile(destination, "utf8").catch(() => "");
  if (current !== output) {
    console.error("FinOps Workflow scripts are out of sync. Run npm run sync:finops-workflows.");
    process.exitCode = 1;
  }
} else {
  await writeFile(destination, output);
}
