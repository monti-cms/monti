import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkImportBoundaryInDev, withCms } from "../config";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

describe("withCms: what it adds", () => {
	it("SITE-N1 adds no stand-ins for packages that are not installed", () => {
		const config = withCms({});
		expect(config.turbopack).toBeUndefined();
		expect(config.webpack).toBeUndefined();
	});
});

describe("withCms: basePath", () => {
	it("SITE-N1 passes Next basePath to the server and browser bundles as an environment variable", () => {
		expect(withCms({ basePath: "/blog" }).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
		expect(withCms({ basePath: "/blog/" }).env?.NEXT_PUBLIC_CMS_BASE_PATH).toBe("/blog");
	});

	it("SITE-N1 empty value without basePath, and the app's other env is left alone", () => {
		const config = withCms({ env: { KEEP: "1" } });
		expect(config.env).toEqual({ KEEP: "1", NEXT_PUBLIC_CMS_BASE_PATH: "" });
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

	it("SITE-N1 warns once in development when a client component imports monti.config.ts, and never stops the server", () => {
		const dir = text({ "monti.config.ts": "export const cms = {};\n", "components/a.tsx": client });
		const warnings: string[] = [];
		const message = checkImportBoundaryInDev(dir, { NODE_ENV: "development" }, (m) => warnings.push(m));
		expect(message).toContain("components/a.tsx -> monti.config.ts");
		expect(warnings).toHaveLength(1);
		// Next loads the config more than once: the second time says nothing.
		expect(checkImportBoundaryInDev(dir, { NODE_ENV: "development" }, (m) => warnings.push(m))).toBeUndefined();
		expect(warnings).toHaveLength(1);
	});

	it("SITE-N1 says nothing for a clean app, in production, or for a folder that cannot be read", () => {
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
