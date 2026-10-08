import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { addComponents } from "../add";
import { DEFAULT_REGISTRY_URL, defaultRegistrySource } from "../registry";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

const temp = () => {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-registry-source-"));
	dirs.push(dir);
	return dir;
};

const registryAt = (dir: string, marker: string) => {
	mkdirSync(dir, { recursive: true });
	writeFileSync(path.join(dir, "registry.json"), JSON.stringify({ name: marker, items: [] }));
	return dir;
};

describe("which registry `monti add` reads by default", () => {
	it("is the registry shipped inside the installed package, not a branch on GitHub", () => {
		const root = temp();
		const bundled = registryAt(path.join(root, "package-registry"), "bundled");
		const source = defaultRegistrySource({ checkout: path.join(root, "no-checkout"), bundled });
		expect(source).toEqual({ kind: "dir", dir: bundled });
	});

	it("is the repo's own build when the CLI runs from a checkout, so the sources win while developing", () => {
		const root = temp();
		const checkout = registryAt(path.join(root, "r"), "checkout");
		const bundled = registryAt(path.join(root, "package-registry"), "bundled");
		expect(defaultRegistrySource({ checkout, bundled })).toEqual({ kind: "dir", dir: checkout });
	});

	it("falls back to the published URL only when neither exists", () => {
		const root = temp();
		expect(defaultRegistrySource({ checkout: path.join(root, "a"), bundled: path.join(root, "b") })).toEqual({
			kind: "url",
			base: DEFAULT_REGISTRY_URL,
		});
	});

	it("an explicit --registry URL still wins, and is fetched", async () => {
		const host = temp();
		writeFileSync(path.join(host, "package.json"), JSON.stringify({ name: "site" }));
		const asked: string[] = [];
		const item = {
			name: "badge",
			files: [{ path: "items/badge/badge.tsx", content: "export const Badge = () => null;\n" }],
		};
		const report = await addComponents({
			cwd: host,
			names: ["badge"],
			registry: "https://registry.example.com/r",
			install: () => {},
			fetch: async (url) => {
				asked.push(url);
				return { ok: true, status: 200, text: async () => JSON.stringify(item) };
			},
		});
		expect(asked).toEqual(["https://registry.example.com/r/badge.json"]);
		expect(report.created.some((file) => file.endsWith("badge/badge.tsx"))).toBe(true);
		expect(report.registry).toBe("https://registry.example.com/r");
	});
});

describe("the registry that ships in @monti-cms/core", () => {
	it("is a copy of the built registry, made by the build, with every item", () => {
		const packageRegistry = path.join(repoRoot, "packages/core/registry");
		// Run the build step that makes the copy (it refuses when registry/r is out of date).
		execFileSync("node", [path.join(repoRoot, "scripts/copy-registry.mjs")], { stdio: "pipe" });
		const built = readdirSync(path.join(repoRoot, "registry/r")).sort();
		expect(readdirSync(packageRegistry).sort()).toEqual(built);
		for (const name of built) {
			expect(readFileSync(path.join(packageRegistry, name), "utf8")).toBe(
				readFileSync(path.join(repoRoot, "registry/r", name), "utf8"),
			);
		}
		for (const item of ["article-body", "field-row", "entry-editor", "notice-block-view"]) {
			expect(built).toContain(`${item}.json`);
		}
		expect(built).not.toContain("blog-theme.json");
	});

	it("is part of the published files of the package", () => {
		const pkg = JSON.parse(readFileSync(path.join(repoRoot, "packages/core/package.json"), "utf8")) as {
			files: string[];
			scripts: Record<string, string>;
		};
		expect(pkg.files).toContain("registry");
		expect(pkg.scripts.build).toContain("copy-registry");
	});
});
