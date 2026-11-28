import { spawnSync } from "node:child_process";
import { parseVercelEnvListJson } from "./lib/vercel-env-metadata.mjs";

const TARGETS = new Set(["production", "preview", "development"]);

function parseArgs(argv) {
  const result = { target: null, scope: null, project: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") result.target = argv[++index] || null;
    else if (argument === "--scope") result.scope = argv[++index] || null;
    else if (argument === "--project") result.project = argv[++index] || null;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.target && !TARGETS.has(result.target)) throw new Error("--target must be production, preview, or development.");
  if (!result.scope || !result.project) throw new Error("--scope and --project are required.");
  return result;
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const command = ["vercel@latest", "env", "ls"];
  if (args.target) command.push(args.target);
  command.push("--scope", args.scope, "--project", args.project, "--json");
  const result = spawnSync("npx", command, {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) throw new Error("Vercel environment metadata request failed.");
  process.stdout.write(`${JSON.stringify(parseVercelEnvListJson(result.stdout), null, 2)}\n`);
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Vercel environment metadata request failed.");
  process.exitCode = 1;
}
