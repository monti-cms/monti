import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { initProject } from "../init";

/**
 * Types of the generated project: `monti init` is run with every feature on, and `tsc` checks the result against the sources of this repo's packages.
 * The fixture sits in `registry/` because that folder already has `next` and `react` installed; the `@monti-cms/*` packages are linked into the fixture only.
 */
const repo = path.resolve(__dirname, "../../../../..");
const registry = path.join(repo, "registry");
const dirs: string[] = [];

afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function fixture(): string {
	const dir = mkdtempSync(path.join(registry, ".init-typecheck-"));
	dirs.push(dir);
	writeFileSync(
		path.join(dir, "package.json"),
		JSON.stringify({ name: "typecheck-blog", dependencies: { next: "16.3.8" }, devDependencies: { typescript: "^7" } }),
	);
	writeFileSync(
		path.join(dir, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ES2022",
				lib: ["dom", "dom.iterable", "esnext"],
				skipLibCheck: true,
				strict: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "bundler",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "react-jsx",
				types: ["node"],
			},
			include: ["**/*.ts", "**/*.tsx"],
			exclude: ["node_modules"],
		}),
	);
	mkdirSync(path.join(dir, "app"));
	writeFileSync(path.join(dir, "app/layout.tsx"), "export default function Layout() { return null; }\n");
	writeFileSync(
		path.join(dir, "next.config.ts"),
		'import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n',
	);
	// The packages of this repo, by name, the way a install would put them in node_modules.
	const scope = path.join(dir, "node_modules/@monti-cms");
	mkdirSync(scope, { recursive: true });
	for (const name of readdirSync(path.join(repo, "packages"))) {
		if (existsSync(path.join(repo, "packages", name, "package.json"))) {
			symlinkSync(path.join(repo, "packages", name), path.join(scope, name), "dir");
		}
	}
	return dir;
}

const host = {
	run: () => true,
	dockerAvailable: () => false,
	freePort: async (port: number) => port,
	databaseReachable: async () => false,
	generateSecret: () => "test-secret",
	install: () => undefined,
	migrate: async () => true,
};

describe("the project monti init writes", () => {
	it("type checks with every feature on", async () => {
		const dir = fixture();
		const report = await initProject({
			cwd: dir,
			host,
			env: {},
			database: "docker",
			locales: "en,ko",
			storage: "s3",
			extras: "ai,git-sync",
			blocks: "all",
			install: false,
			dockerStart: false,
		});
		expect(report.created).toContain("monti.config.ts");
		const tsc = path.join(repo, "node_modules/.bin/tsc");
		const result = spawnSync(tsc, ["--noEmit", "-p", "."], { cwd: dir, encoding: "utf8" });
		expect(result.stdout + result.stderr).toBe("");
		expect(result.status).toBe(0);

		// Guard against a check that passes because nothing resolved: `cms` is a real typed instance, so assigning it to a string fails.
		writeFileSync(
			path.join(dir, "probe.ts"),
			'import { cms } from "./monti.config";\nexport const wrong: string = cms;\n',
		);
		const probe = spawnSync(tsc, ["--noEmit", "-p", "."], { cwd: dir, encoding: "utf8" });
		expect(probe.status).not.toBe(0);
		expect(probe.stdout).toContain("probe.ts");
	}, 180_000);
});
