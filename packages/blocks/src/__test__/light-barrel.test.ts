import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as barrel from "../index";

const SRC = path.resolve(import.meta.dirname, "..");

const resolveFile = (from: string, request: string): string | undefined => {
	const base = path.resolve(path.dirname(from), request);
	return [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")].find(existsSync);
};

/** Every file the entry reaches by relative imports (static and dynamic), and every package it names. */
function reach(entry: string): { files: Set<string>; packages: Set<string> } {
	const files = new Set<string>();
	const packages = new Set<string>();
	const visit = (file: string) => {
		if (files.has(file)) return;
		files.add(file);
		// Comments show example imports; only the code counts.
		const text = readFileSync(file, "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");
		for (const match of text.matchAll(/(?:from|import\s*\()\s*["']([^"']+)["']/g)) {
			const request = match[1] ?? "";
			if (request.startsWith(".")) {
				const next = resolveFile(file, request);
				if (next) visit(next);
			} else packages.add(request);
		}
	};
	visit(entry);
	return { files, packages };
}

describe("the barrel of @monti-cms/blocks stays light", () => {
	const { files, packages } = reach(path.join(SRC, "index.ts"));

	it("does not export the two heavy blocks, so they cannot be reached without asking for them", () => {
		expect(Object.keys(barrel)).not.toContain("chart");
		expect(Object.keys(barrel)).not.toContain("mermaid");
		expect(Object.keys(barrel)).toEqual(expect.arrayContaining(["callout", "tabs", "collapsible", "tooltip", "color"]));
	});

	it("reaches no code of the chart or the mermaid block", () => {
		const heavy = [...files].filter((file) => /\/(chart|mermaid)\//.test(file));
		expect(heavy).toEqual([]);
	});

	it("names no heavy library, directly or through the blocks it exports", () => {
		const names = [...packages].filter(
			(name) => /^(recharts|mermaid|d3)(\/|$)/.test(name) || /blocks\/(chart|mermaid)/.test(name),
		);
		expect(names).toEqual([]);
	});

	it("the heavy blocks have their own entry points", () => {
		const exports = JSON.parse(readFileSync(path.join(SRC, "../package.json"), "utf8")).exports as Record<
			string,
			string
		>;
		expect(exports["./chart"]).toBe("./src/chart/index.ts");
		expect(exports["./mermaid"]).toBe("./src/mermaid/index.ts");
	});
});

describe("the heavy blocks are plugins from their own entry points", () => {
	it("chart() and mermaid() need their library, which doctor checks", async () => {
		const { chart } = await import("../chart");
		const { mermaid } = await import("../mermaid");
		expect(chart().requires).toEqual(["recharts"]);
		expect(mermaid().requires).toEqual(["mermaid"]);
	});
});
