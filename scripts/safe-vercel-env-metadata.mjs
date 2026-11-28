import { spawnSync } from "node:child_process";
import {
  assertExpectedVercelEnvMetadata,
  parseVercelEnvListJson,
} from "./lib/vercel-env-metadata.mjs";

const TARGETS = new Set(["production", "preview", "development"]);
const VERCEL_CLI_PACKAGE = "vercel@68.0.0";

function parseArgs(argv) {
  const result = { target: null, scope: null, project: null, expectedKeys: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") result.target = argv[++index] || null;
    else if (argument === "--scope") result.scope = argv[++index] || null;
    else if (argument === "--project") result.project = argv[++index] || null;
    else if (argument === "--expect-key") result.expectedKeys.push(argv[++index] || "");
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.target && !TARGETS.has(result.target)) throw new Error("--target must be production, preview, or development.");
  if (!result.scope || !result.project) throw new Error("--scope and --project are required.");
  if (result.expectedKeys.length === 0 || result.expectedKeys.some((key) => !key)) {
    throw new Error("At least one --expect-key is required.");
  }
  return result;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const command = [VERCEL_CLI_PACKAGE, "env", "ls"];
  if (args.target) command.push(args.target);
  command.push("--scope", args.scope, "--project", args.project, "--json");
  const result = spawnSync("npx", command, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) throw new Error("Vercel environment metadata request failed.");
  const records = parseVercelEnvListJson(result.stdout);
  assertExpectedVercelEnvMetadata(records, args.expectedKeys);
  process.stdout.write(`${JSON.stringify({
    scope: args.scope,
    project: args.project,
    target: args.target,
    records,
  }, null, 2)}\n`);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Vercel environment metadata request failed.");
  process.exitCode = 1;
}
