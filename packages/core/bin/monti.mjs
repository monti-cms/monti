#!/usr/bin/env node
// Reads the site's env files the way Next does, loads the site's monti.config.ts (TypeScript, through jiti) and runs the command.
// `monti init` writes the config, and `monti doctor` runs without one that loads: that it is missing or broken is what it reports.
import path from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const jiti = createJiti(import.meta.url);
const cli = await jiti.import("@monti-cms/core/cli");

// `--env-file <path>` (or `--env-file=<path>`) names one more env file, read before the site's own.
let argv;
let envFrom;
try {
	const taken = cli.takeEnvFile(process.argv.slice(2));
	argv = taken.argv;
	envFrom = cli.loadEnvFiles(root, process.env, process.env.NODE_ENV ?? "development", taken.file);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

// The config by any of the names it may have: one list, which `monti init` reads too, so it never writes a second beside it.
const configName = cli.configFileOf(root);
const configFile = configName ? path.join(root, configName) : null;
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
