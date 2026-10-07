import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "..";
import { findBoundaryViolations, formatBoundaryViolations, importsOf } from "../import-boundary";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

/** An app folder with these files (and an alias `@/*` -> `./*`). */
function app(files: Record<string, string>): string {
	const dir = mkdtempSync(path.join(tmpdir(), "monti-boundary-"));
	dirs.push(dir);
	const all: Record<string, string> = {
		"tsconfig.json": '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }\n',
		"monti.config.ts":
			'import { defineConfig } from "@monti-cms/core/server";\nexport const cms = defineConfig({} as never);\n',
		...files,
	};
	for (const [file, content] of Object.entries(all)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
}

describe("import boundary: the config file stays out of client bundles", () => {
	it("finds nothing in an app whose server files import the config and whose client files do not", () => {
		const dir = app({
			"app/admin/page.tsx": 'import { cms } from "../../monti.config";\nexport default () => cms;\n',
			"app/api/route.ts": 'import { cms } from "@/monti.config";\nexport const GET = () => cms;\n',
			"components/button.tsx":
				'"use client";\nimport { useState } from "react";\nexport const B = () => useState(0);\n',
		});
		expect(findBoundaryViolations(dir)).toEqual([]);
		expect(formatBoundaryViolations([])).toBe("");
	});

	it("finds a client component that imports the config, by a relative path or the tsconfig alias", () => {
		const dir = app({
			"components/a.tsx": '"use client";\nimport { cms } from "../monti.config";\nexport const A = () => cms;\n',
			"components/b.tsx": "'use client'\nimport { cms } from '@/monti.config'\nexport const B = () => cms\n",
		});
		const violations = findBoundaryViolations(dir);
		expect(violations.map((violation) => violation.chain)).toEqual(
			expect.arrayContaining([
				["components/a.tsx", "monti.config.ts"],
				["components/b.tsx", "monti.config.ts"],
			]),
		);
		expect(violations.every((violation) => violation.reaches === "config")).toBe(true);
	});

	it("follows the imports of a client component, and reports the chain", () => {
		const dir = app({
			"components/widget.tsx": '"use client";\nimport { read } from "@/lib/read";\nexport const W = () => read();\n',
			"lib/read.ts": 'export * from "./cms";\n',
			"lib/cms.ts": 'import { cms } from "../monti.config";\nexport const read = () => cms;\n',
			// A server component importing the same helper is fine.
			"app/page.tsx": 'import { read } from "@/lib/read";\nexport default () => read();\n',
		});
		const violations = findBoundaryViolations(dir);
		expect(violations).toEqual([
			{
				client: "components/widget.tsx",
				chain: ["components/widget.tsx", "lib/read.ts", "lib/cms.ts", "monti.config.ts"],
				reaches: "config",
			},
		]);
		const text = formatBoundaryViolations(violations);
		expect(text).toContain("components/widget.tsx -> lib/read.ts -> lib/cms.ts -> monti.config.ts");
		expect(text).toContain("server-only");
	});

	it("also counts a dynamic import, and a client file that imports a server-only package", () => {
		const dir = app({
			"components/lazy.tsx": '"use client";\nexport const load = () => import("../monti.config");\n',
			"components/auth.tsx": '"use client";\nimport { auth } from "@monti-cms/auth";\nexport const A = auth;\n',
			"components/server-entry.tsx":
				'"use client";\nimport { postgres } from "@monti-cms/core/server";\nexport const P = postgres;\n',
			// The client-safe entry of the core package is fine.
			"components/ok.tsx":
				'"use client";\nimport { useSite } from "@monti-cms/core/client";\nexport const S = useSite;\n',
		});
		const violations = findBoundaryViolations(dir);
		expect(violations.map((violation) => violation.client).sort()).toEqual([
			"components/auth.tsx",
			"components/lazy.tsx",
			"components/server-entry.tsx",
		]);
		expect(violations.find((violation) => violation.client === "components/auth.tsx")?.reaches).toBe("@monti-cms/auth");
	});

	it("ignores type-only imports (the compiler erases them), comments, and files that are not client files", () => {
		const dir = app({
			"components/types.tsx":
				'"use client";\nimport type { cms } from "../monti.config";\nimport { type Cms } from "@monti-cms/core/server";\nexport type T = typeof cms | Cms;\n',
			"components/comment.tsx":
				'"use client";\n// import { cms } from "../monti.config";\n/* import "../monti.config"; */\nexport const C = 1;\n',
			// The directive has to come first: a `"use client"` after code is not one.
			"components/late.tsx": 'import { cms } from "../monti.config";\n"use client";\nexport const L = cms;\n',
			"lib/server.ts": 'import { cms } from "../monti.config";\nexport const s = cms;\n',
		});
		expect(findBoundaryViolations(dir)).toEqual([]);
	});

	it("reads the imports a file makes at run time", () => {
		expect(
			importsOf(
				[
					'import a from "a";',
					'import type { T } from "types-only";',
					'import { type U, type V } from "also-types";',
					'import { type W, x } from "mixed";',
					'import "side-effect";',
					'export * from "re-export";',
					'export type { Y } from "type-export";',
					'const lazy = () => import("lazy");',
				].join("\n"),
			),
		).toEqual(["a", "mixed", "side-effect", "re-export", "lazy"]);
	});

	it("is the config/boundary check of `monti doctor`: exit 0 when clean, 1 with the chains when not", async () => {
		const out: string[] = [];
		const io = (cwd: string) => ({ cwd, log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) });
		const only = ["doctor", "--only", "config/boundary"];
		expect(await runCli(only, io(app({ "app/page.tsx": "export default () => null;\n" })))).toBe(0);
		const bad = app({
			"components/a.tsx": '"use client";\nimport { cms } from "../monti.config";\nexport const A = cms;\n',
		});
		expect(await runCli(only, io(bad))).toBe(1);
		expect(out.at(-1)).toContain("FAIL");
		expect(out.at(-1)).toContain("components/a.tsx -> monti.config.ts");
		expect(out.at(-1)).toContain("fix:");
	});

	it("holds for the blog example: no client component reaches monti.config.ts, and it does import the config from its server files", () => {
		const blog = path.resolve(__dirname, "../../../../../examples/blog");
		expect(formatBoundaryViolations(findBoundaryViolations(blog))).toBe("");
	});
});
