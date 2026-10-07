import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The store is a port (`core/store/ports.ts`) and Postgres is one adapter of it, so nothing outside `adapters/postgres` may reach into it.
 * The exceptions are the public entry points that hand the adapter out (`server/index.ts` exports the `postgres()` factory) and the test helper entry
 * point (`testing.ts`, which builds a real store for tests). A new reach into the adapter has to be a deliberate edit of this list.
 */
const CORE_SRC = path.resolve(__dirname, "../../..");
const ADAPTER = path.join(CORE_SRC, "adapters", "postgres");
const ALLOWED = new Set([path.join(CORE_SRC, "server", "index.ts"), path.join(CORE_SRC, "testing.ts")]);

const SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
		return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
	});
}

/** The specifiers in `source` (a file at `file`) that point into the Postgres adapter. */
function adapterImports(file: string, source: string): string[] {
	return [...source.matchAll(SPECIFIER)]
		.map((match) => match[1] as string)
		.filter((specifier) => {
			if (!specifier.startsWith(".")) return false;
			const target = path.resolve(path.dirname(file), specifier);
			return target === ADAPTER || target.startsWith(ADAPTER + path.sep);
		});
}

/** Files (relative to the core package) that import something inside the Postgres adapter from outside of it. */
function reachesIntoAdapter(root: string): string[] {
	return sourceFiles(root)
		.filter((file) => !file.startsWith(ADAPTER + path.sep) && !ALLOWED.has(file))
		.flatMap((file) =>
			adapterImports(file, readFileSync(file, "utf8")).map(
				(specifier) => `${path.relative(path.dirname(CORE_SRC), file)} -> ${specifier}`,
			),
		);
}

const isTestFile = (file: string) => /(__test__|\.test\.)/.test(file);

/** Non-test source files outside the Postgres adapter that import the module `name` (the `pg` driver, or Kysely on top of it), whole or by subpath. */
function importsModule(root: string, name: string): string[] {
	const pattern = new RegExp(`(?:from|import)\\s*\\(?\\s*["']${name}(?:/[^"']*)?["']`);
	return sourceFiles(root)
		.filter((file) => !file.startsWith(ADAPTER + path.sep) && !isTestFile(file))
		.filter((file) => pattern.test(readFileSync(file, "utf8")))
		.map((file) => path.relative(path.dirname(CORE_SRC), file));
}

describe("store import boundary", () => {
	it("nothing in the core package outside adapters/postgres imports from the Postgres adapter", () => {
		expect(reachesIntoAdapter(CORE_SRC)).toEqual([]);
	});

	it("the core package's own test helpers do not import it either", () => {
		expect(reachesIntoAdapter(path.resolve(CORE_SRC, "..", "test"))).toEqual([]);
	});

	it("the Postgres driver and its types stay in the adapter: the plugin API, the root entry and the services do not see `pg`", () => {
		expect(importsModule(CORE_SRC, "pg")).toEqual([]);
	});

	it("Kysely stays in the adapter too: it is a server-only dependency of the Postgres store, and the browser entries, the plugin API and the services never import it", () => {
		expect(importsModule(CORE_SRC, "kysely")).toEqual([]);
	});

	it("recognizes how a module is imported, whole or by subpath, and does not take a longer name for it", () => {
		const root = mkdtempSync(path.join(tmpdir(), "boundary-"));
		try {
			writeFileSync(path.join(root, "a.ts"), 'import { sql } from "kysely";\n');
			writeFileSync(path.join(root, "b.ts"), 'const x = await import("kysely/helpers/postgres");\n');
			writeFileSync(path.join(root, "c.ts"), 'import { y } from "kysely-extras";\nimport { z } from "pg-format";\n');
			expect(importsModule(root, "kysely").map((file) => path.basename(file))).toEqual(["a.ts", "b.ts"]);
			expect(importsModule(root, "pg")).toEqual([]);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("recognizes static, type-only, re-export and dynamic imports of the adapter, and ignores others", () => {
		const file = path.join(CORE_SRC, "cms", "create-cms.ts");
		const source = [
			'import { createContentStore } from "../adapters/postgres/content-store";',
			'import type { Entry } from "../adapters/postgres/store/types";',
			'export * from "../adapters/postgres";',
			'const lazy = await import("../adapters/postgres/store/schema");',
			'import { CmsError } from "../core/store";',
			'import { Pool } from "pg";',
			'import { x } from "../media/store";',
		].join("\n");
		expect(adapterImports(file, source)).toEqual([
			"../adapters/postgres/content-store",
			"../adapters/postgres/store/types",
			"../adapters/postgres",
			"../adapters/postgres/store/schema",
		]);
	});
});
