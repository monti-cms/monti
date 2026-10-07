#!/usr/bin/env node
/**
 * Copies the built registry (`registry/r`, written by `pnpm registry:build`) into `packages/core/registry`, which `@monti-cms/core` ships. `monti add` reads the
 * registry from there when it runs from an installed package, so the components it copies are the ones of the version the app has installed, not whatever a
 * branch on GitHub holds today. The folder is a build output (git-ignored); run this from the `build` script of `@monti-cms/core`.
 *
 * It fails when `registry/r` is out of date, so a package is never packed with a registry that differs from the sources.
 */
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRegistry, registryDrift } from "./build-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "registry/r");
const to = path.join(root, "packages/core/registry");

const drift = registryDrift(buildRegistry(), from);
if (drift.length > 0) {
	console.error(`registry/r is out of date (${drift.join(", ")}). Run \`pnpm registry:build\` first.`);
	process.exit(1);
}
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copied ${readdirSync(to).length} registry files to packages/core/registry`);
