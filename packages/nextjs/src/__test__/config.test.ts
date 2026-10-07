import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingOptionalPeers, watchSchemaTypesInDev, withCms } from "../config";

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
	it("passes Next basePath to the server and browser bundles as an environment variable", () => {
		expect(withCms({ basePath: "/blog" }).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
		expect(withCms({ basePath: "/blog/" }).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
	});

	it("empty value without basePath, and the app's other env is left alone", () => {
		const config = withCms({ env: { KEEP: "1" } });
		expect(config.env).toEqual({ KEEP: "1", NEXT_PUBLIC_CMS_BASE_PATH: "" });
	});
});

describe("withCms: types of the schema file in development", () => {
	const schema = (defaultLocale: string) => ({
		collections: {
			post: {
				label: "Post",
				kind: "document",
				fields: { title: { kind: "text", label: "Title" }, slug: { kind: "slug", label: "Slug" } },
			},
		},
		locales: [
			{ code: "en", name: "English" },
			{ code: "ko", name: "Korean" },
		],
		defaultLocale,
	});
	const types = (dir: string) => readFileSync(path.join(dir, "monti-env.d.ts"), "utf8");
	const until = async (check: () => boolean) => {
		for (let attempt = 0; attempt < 100 && !check(); attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
		expect(check()).toBe(true);
	};

	it("writes the types at start and again when the schema file changes, then stops", async () => {
		const dir = app({ "monti.schema.json": schema("en") });
		const messages: string[] = [];
		const stop = watchSchemaTypesInDev(dir, { NODE_ENV: "development" }, (message) => messages.push(message));
		expect(stop).toBeTypeOf("function");
		try {
			expect(types(dir)).toContain('readonly defaultLocale: "en";');
			// The file system's change notifications can miss a change made the moment the watch starts.
			await new Promise((resolve) => setTimeout(resolve, 300));
			writeFileSync(path.join(dir, "monti.schema.json"), JSON.stringify(schema("ko")));
			await until(() => types(dir).includes('readonly defaultLocale: "ko";'));
			writeFileSync(path.join(dir, "monti.schema.json"), "{ half written");
			await until(() => messages.some((message) => message.includes("is not valid JSON")));
			expect(types(dir)).toContain('readonly defaultLocale: "ko";');
		} finally {
			stop?.();
		}
	});

	it("watches a site once, even when Next loads the config again", () => {
		const dir = app({ "monti.schema.json": schema("en") });
		const first = watchSchemaTypesInDev(dir, { NODE_ENV: "development" }, () => undefined);
		const second = watchSchemaTypesInDev(dir, { NODE_ENV: "development" }, () => undefined);
		try {
			expect(first).toBeTypeOf("function");
			expect(second).toBeUndefined();
		} finally {
			first?.();
		}
		// Once stopped, it can be watched again.
		const again = watchSchemaTypesInDev(dir, { NODE_ENV: "development" }, () => undefined);
		expect(again).toBeTypeOf("function");
		again?.();
	});

	it("does nothing in a production build, and for a site without a schema file", () => {
		const dir = app({ "monti.schema.json": schema("en") });
		expect(watchSchemaTypesInDev(dir, { NODE_ENV: "production" })).toBeUndefined();
		expect(() => types(dir)).toThrow();
		expect(watchSchemaTypesInDev(app({ "package.json": {} }), { NODE_ENV: "development" })).toBeUndefined();
	});
});
