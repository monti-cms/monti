import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingOptionalPeers, withCms } from "../config";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

const app = (files: Record<string, object>) => {
	const dir = mkdtempSync(path.join(tmpdir(), "cms-with-"));
	dirs.push(dir);
	for (const [file, json] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), JSON.stringify(json));
	}
	return dir;
};

describe("withCms: optional dependencies that are not installed", () => {
	it("picks only the optional peers of CMS packages that cannot be found", () => {
		const dir = app({
			"package.json": { dependencies: { "@monti-cms/blocks": "x", "other-lib": "x" } },
			"node_modules/@monti-cms/blocks/package.json": {
				cmsPlugin: true,
				peerDependenciesMeta: { mermaid: { optional: true }, recharts: { optional: true }, react: {} },
			},
			"node_modules/recharts/package.json": {},
			// Optional dependencies of libraries that are not CMS packages are left alone.
			"node_modules/other-lib/package.json": { peerDependenciesMeta: { nodemailer: { optional: true } } },
		});
		expect(missingOptionalPeers(dir)).toEqual(["mermaid"]);
	});

	it("plugin packages are found by the `cmsPlugin` marker, not by name", () => {
		const dir = app({
			"package.json": {
				dependencies: { "acme-cms-chart": "x", "@monti-cms/core-lookalike": "x", "@monti-cms/admin": "x" },
			},
			"node_modules/acme-cms-chart/package.json": {
				cmsPlugin: true,
				peerDependenciesMeta: { d3: { optional: true } },
			},
			// A similar name without the marker is not a plugin.
			"node_modules/@monti-cms/core-lookalike/package.json": {
				peerDependenciesMeta: { nodemailer: { optional: true } },
			},
			// Core and admin packages are checked even without the marker.
			"node_modules/@monti-cms/admin/package.json": { peerDependenciesMeta: { sonner: { optional: true } } },
		});
		expect(missingOptionalPeers(dir)).toEqual(["d3", "sonner"]);
	});

	it("empty list if package.json is missing or there are no CMS packages", () => {
		expect(missingOptionalPeers(app({}))).toEqual([]);
		expect(missingOptionalPeers(app({ "package.json": { dependencies: { "@monti-cms/core": "x" } } }))).toEqual([]);
	});

	it("anything installed outside the Turbopack root counts as missing", () => {
		const outer = app({ "node_modules/mermaid/package.json": {} });
		const root = path.join(outer, "site");
		mkdirSync(path.join(root, "node_modules/@monti-cms/blocks"), { recursive: true });
		writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { "@monti-cms/blocks": "x" } }));
		writeFileSync(
			path.join(root, "node_modules/@monti-cms/blocks/package.json"),
			JSON.stringify({ cmsPlugin: true, peerDependenciesMeta: { mermaid: { optional: true } } }),
		);
		expect(missingOptionalPeers(root)).toEqual([]);
		expect(missingOptionalPeers(root, realpathSync(root))).toEqual(["mermaid"]);
	});
});

describe("withCms: basePath", () => {
	const options = { config: "./cms.config.ts", server: "./cms.server.ts" };

	it("passes Next basePath to the server and browser bundles as an environment variable", () => {
		expect(withCms({ basePath: "/blog" }, options).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
		expect(withCms({ basePath: "/blog/" }, options).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
	});

	it("empty value without basePath, and the app's other env is left alone", () => {
		const config = withCms({ env: { KEEP: "1" } }, options);
		expect(config.env).toEqual({ KEEP: "1", NEXT_PUBLIC_CMS_BASE_PATH: "" });
	});
});
