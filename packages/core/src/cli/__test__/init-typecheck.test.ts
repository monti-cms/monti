import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { initProject } from "../init";

/**
 * Types of the generated project: `monti init` is run with every feature on, and `tsc` checks the result against the sources of this repo's packages.
 * The fixture sits in the system's temp folder, not in the repo: a folder of symlinks that lead back into the repo would loop the file watchers of the dev
 * servers (Vite, Storybook). `next`, `react` and the other packages `packages/nextjs/` has installed are linked into it, and so are the `@monti-cms/*` packages.
 */
const repo = path.resolve(__dirname, "../../../../..");
const installed = path.join(repo, "packages/nextjs/node_modules");
const dirs: string[] = [];

afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function fixture(): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-init-typecheck-"));
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
	const modules = path.join(dir, "node_modules");
	mkdirSync(modules, { recursive: true });
	for (const name of readdirSync(installed)) {
		if (name.startsWith(".") || name === "@monti-cms") continue;
		symlinkSync(path.join(installed, name), path.join(modules, name), "dir");
	}
	const scope = path.join(modules, "@monti-cms");
	mkdirSync(scope, { recursive: true });
	for (const name of readdirSync(path.join(repo, "packages"))) {
		if (existsSync(path.join(repo, "packages", name, "package.json"))) {
			symlinkSync(path.join(repo, "packages", name), path.join(scope, name), "dir");
		}
	}
	return dir;
}

const host = {
	install: () => undefined,
};

describe("the project monti init writes", () => {
	it.each(["password", "github"] as const)("type checks with every feature on and the %s login", async (login) => {
		const dir = fixture();
		const report = await initProject({
			cwd: dir,
			host,
			locales: "en,ko",
			storage: "s3",
			extras: "ai,git-sync",
			blocks: "all",
			login,
			install: false,
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
