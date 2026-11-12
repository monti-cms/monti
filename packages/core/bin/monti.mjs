#!/usr/bin/env node
// Reads the site's env files the way Next does, loads the site's monti.config.ts (TypeScript, through jiti) and runs the command.
// `monti init` writes the config, and `monti doctor` runs without one that loads: that it is missing or broken is what it reports.
import { existsSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const jiti = createJiti(import.meta.url);
const cli = await jiti.import("@monti-cms/core/cli");

// `--env-file <path>` names one more env file, read before the site's own.
const argv = process.argv.slice(2);
const at = argv.indexOf("--env-file");
const envFile = at >= 0 ? argv[at + 1] : undefined;
if (at >= 0) argv.splice(at, 2);
let envFrom;
try {
	envFrom = cli.loadEnvFiles(root, process.env, process.env.NODE_ENV ?? "development", envFile);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

const configFile =
	["monti.config.ts", "monti.config.mjs", "monti.config.js"]
		.map((name) => path.join(root, name))
		.find((file) => existsSync(file)) ?? null;
const loadConfig = () => jiti.import(configFile, { default: true });

const [command, ...rest] = argv;
if (command === "init")
	process.exit(
		await cli.init({
			cwd: root,
			argv: rest,
			env: process.env,
			// The config init writes; an older one keeps its own name.
			loadConfig: () => jiti.import(configFile ?? path.join(root, "monti.config.ts"), { default: true }),
		}),
	);
if (command === "doctor")
	process.exit(await cli.doctor({ cwd: root, argv: rest, env: process.env, envFrom, configFile, loadConfig }));
if (!configFile) {
	console.error("No monti.config.ts in this folder.");
	process.exit(1);
}
process.exit(await cli.main(await loadConfig(), root, argv));
