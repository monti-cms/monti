#!/usr/bin/env node
// Loads the site's monti.config.ts (TypeScript, through jiti) and runs the command.
import { existsSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const configFile = ["monti.config.ts", "monti.config.mjs", "monti.config.js"]
	.map((name) => path.join(root, name))
	.find((file) => existsSync(file));
if (!configFile) {
	console.error("No monti.config.ts in this folder.");
	process.exit(1);
}
const jiti = createJiti(import.meta.url);
const config = await jiti.import(configFile, { default: true });
const { main } = await jiti.import("@monti-cms/core/cli");
process.exit(await main(config, root, process.argv.slice(2)));
