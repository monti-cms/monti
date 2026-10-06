import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hard rule of `@monti-cms/admin/hooks`: hooks return state and results only. A file in the hooks graph may not import `next/*`, `sonner`,
 * `lucide-react`, `ui/*` or a confirm dialog, so a site can use the hooks without the default UI, and the hooks work outside Next.js.
 * The graph is every file under `src/hooks/` plus every file they import (relatively, transitively), which covers the files `public.ts`
 * re-exports.
 */

const SRC = path.resolve(import.meta.dirname, "../..");

const FORBIDDEN_PACKAGES = [/^next(\/|$)/, /^next-(auth|themes)(\/|$)/, /^sonner(\/|$)/, /^lucide-react(\/|$)/];
/** Forbidden source folders and files, relative to `src` and without the extension. */
const FORBIDDEN_SOURCES = [/^ui(\/|$)/, /^screens\/shared\/confirm-dialog(\/|$)/, /^next(\/|$)/];

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function importsOf(source: string): string[] {
	const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
	const specifiers = new Set<string>();
	const patterns = [
		/\b(?:import|export)\s+(?:type\s+)?[^"';]*?\sfrom\s*["']([^"']+)["']/g,
		/\bimport\s*["']([^"']+)["']/g,
		/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
		/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
	];
	for (const pattern of patterns) for (const match of code.matchAll(pattern)) specifiers.add(match[1] as string);
	return [...specifiers];
}

function resolveRelative(from: string, specifier: string): string | null {
	const base = path.resolve(path.dirname(from), specifier);
	for (const ext of ["", ...EXTENSIONS]) {
		const candidate = base + ext;
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

function filesUnder(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "__test__" ? [] : filesUnder(full);
		return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
	});
}

/**
 * Hooks do not navigate or touch the address bar: no `router`, no `window.open`, no `window.history`, no `location` change or reload.
 * (`next/navigation` is already forbidden above; this catches the same thing done through `window`.)
 */
const NAVIGATION =
	/\bwindow\.(?:open|history|location)\b|\blocation\.(?:reload|assign|replace|href\s*=)|\bhistory\.(?:push|replace)State\b/;

/** Lists the files of the graph whose code (comments left out) navigates. */
function findNavigation(files: string[], srcRoot: string): string[] {
	return files.filter((file) => {
		const code = readFileSync(path.join(srcRoot, file), "utf8")
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/(^|[^:])\/\/.*$/gm, "$1");
		return NAVIGATION.test(code);
	});
}

/** Walks the import graph from `roots` and lists every forbidden import as `file -> specifier`. */
function findViolations(roots: string[], srcRoot: string): { violations: string[]; visited: string[] } {
	const visited = new Set<string>();
	const violations: string[] = [];
	const queue = [...roots];
	while (queue.length > 0) {
		const file = queue.pop() as string;
		if (visited.has(file)) continue;
		visited.add(file);
		for (const specifier of importsOf(readFileSync(file, "utf8"))) {
			const label = `${path.relative(srcRoot, file)} -> ${specifier}`;
			if (specifier.startsWith(".")) {
				const target = resolveRelative(file, specifier);
				if (!target) continue;
				const inSrc = path
					.relative(srcRoot, target)
					.replace(/\.tsx?$/, "")
					.replace(/\/index$/, "");
				if (FORBIDDEN_SOURCES.some((pattern) => pattern.test(inSrc))) violations.push(label);
				else queue.push(target);
			} else if (FORBIDDEN_PACKAGES.some((pattern) => pattern.test(specifier))) violations.push(label);
		}
	}
	return { violations, visited: [...visited].map((file) => path.relative(srcRoot, file)) };
}

describe("hooks import graph", () => {
	it("imports no next/*, sonner, lucide-react, ui/* or confirm dialog, transitively", () => {
		const roots = filesUnder(path.join(SRC, "hooks"));
		expect(roots.map((file) => path.relative(SRC, file))).toContain("hooks/public.ts");
		const { violations, visited } = findViolations(roots, SRC);
		// The graph reaches the hooks that `public.ts` re-exports: the slot hook, the field hook, the block editor and the entry editor.
		expect(visited).toContain("slots/use-slot-actions.ts");
		expect(visited).toContain("editor/blocks/use-block-editor.tsx");
		expect(visited).toContain("screens/entries/use-field.tsx");
		expect(visited).toContain("screens/entries/use-entry-editor.tsx");
		expect(visited).toContain("screens/entries/entry-editor-store.ts");
		expect(violations).toEqual([]);
	});

	it("no file in the graph navigates: no window.open, window.history, window.location or reload", () => {
		const { visited } = findViolations(filesUnder(path.join(SRC, "hooks")), SRC);
		expect(findNavigation(visited, SRC)).toEqual([]);
	});

	it("the navigation scan catches each way of leaving the page", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "hooks-nav-"));
		const cases = [
			"window.location.reload();",
			"window.history.replaceState({}, '', '/x');",
			"window.open(href);",
			"location.reload();",
			"history.pushState({}, '', '/x');",
		];
		const files = cases.map((code, index) => {
			const name = `case-${index}.ts`;
			writeFileSync(path.join(dir, name), `export const run = () => { ${code} };\n`);
			return name;
		});
		writeFileSync(
			path.join(dir, "clean.ts"),
			"// window.location.reload() is only a comment here\nexport const ok = 1;\n",
		);
		expect(findNavigation([...files, "clean.ts"], dir)).toEqual(files);
	});

	it("the scan itself catches forbidden imports, direct and through a re-export chain", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "hooks-graph-"));
		const write = (name: string, code: string) => {
			const file = path.join(dir, name);
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, code);
			return file;
		};
		const entry = write(
			"hooks/public.ts",
			[
				'export { a } from "../lib/a";',
				'import { toast } from "sonner";',
				'import { useRouter } from "next/navigation";',
				'import type { Icon } from "lucide-react";',
				'// import { ignored } from "next/image";',
				"",
			].join("\n"),
		);
		write("lib/a.ts", 'export { Button } from "../ui/button";\nexport const a = 1;\n');
		write("ui/button.tsx", "export const Button = 1;\n");
		const second = write("hooks/other.ts", 'import("../screens/shared/confirm-dialog");\n');
		write("screens/shared/confirm-dialog.tsx", "export {};\n");

		const { violations } = findViolations([entry, second], dir);
		expect(violations.sort()).toEqual(
			[
				"hooks/other.ts -> ../screens/shared/confirm-dialog",
				"hooks/public.ts -> lucide-react",
				"hooks/public.ts -> next/navigation",
				"hooks/public.ts -> sonner",
				"lib/a.ts -> ../ui/button",
			].sort(),
		);
	});
});
