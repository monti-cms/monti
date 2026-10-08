import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkImportBoundaryInDev, watchSchemaTypesInDev, withCms } from "../config";

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

describe("withCms: what it adds", () => {
	it("adds no stand-ins for packages that are not installed", () => {
		const config = withCms({});
		expect(config.turbopack).toBeUndefined();
		expect(config.webpack).toBeUndefined();
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

describe("withCms: the config file stays out of client bundles", () => {
	const text = (files: Record<string, string>) => {
		const dir = mkdtempSync(path.join(tmpdir(), "cms-boundary-"));
		dirs.push(dir);
		for (const [file, content] of Object.entries(files)) {
			mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
			writeFileSync(path.join(dir, file), content);
		}
		return dir;
	};
	const client = '"use client";\nimport { cms } from "../monti.config";\nexport const A = cms;\n';

	it("warns once in development when a client component imports monti.config.ts, and never stops the server", () => {
		const dir = text({ "monti.config.ts": "export const cms = {};\n", "components/a.tsx": client });
		const warnings: string[] = [];
		const message = checkImportBoundaryInDev(dir, { NODE_ENV: "development" }, (m) => warnings.push(m));
		expect(message).toContain("components/a.tsx -> monti.config.ts");
		expect(warnings).toHaveLength(1);
		// Next loads the config more than once: the second time says nothing.
		expect(checkImportBoundaryInDev(dir, { NODE_ENV: "development" }, (m) => warnings.push(m))).toBeUndefined();
		expect(warnings).toHaveLength(1);
	});

	it("says nothing for a clean app, in production, or for a folder that cannot be read", () => {
		const clean = text({
			"monti.config.ts": "export const cms = {};\n",
			"app/page.tsx": 'import { cms } from "../monti.config";\nexport default () => cms;\n',
		});
		expect(checkImportBoundaryInDev(clean, { NODE_ENV: "development" }, () => undefined)).toBeUndefined();
		const dirty = text({ "monti.config.ts": "export const cms = {};\n", "components/a.tsx": client });
		expect(checkImportBoundaryInDev(dirty, { NODE_ENV: "production" }, () => undefined)).toBeUndefined();
		expect(
			checkImportBoundaryInDev(path.join(clean, "missing"), { NODE_ENV: "development" }, () => undefined),
		).toBeUndefined();
	});
});
