import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * What loading an entry point of the admin pulls in, seen by really loading it (`fixtures/load-entry.mjs`: Vite for the admin's sources, Node for the
 * packages), not by reading imports out of the source text.
 */

const ADMIN = path.resolve(import.meta.dirname, "../..");
const ROOT = path.resolve(ADMIN, "../..");
const LOADER = path.join(import.meta.dirname, "fixtures/load-entry.mjs");

interface Load {
	readonly failure?: string;
	readonly exports: readonly string[];
	readonly reactServer: boolean;
	readonly clientModules: number;
	/** Repo-relative path → whether it was only referred to (a client module under `--rsc`) and what its code imports. */
	readonly loaded: Readonly<Record<string, { readonly client: boolean; readonly imports: readonly string[] }>>;
}

const load = (entry: string, options: { rsc?: boolean } = {}): Load =>
	JSON.parse(
		execFileSync(
			process.execPath,
			[...(options.rsc ? ["--conditions=react-server"] : []), LOADER, entry, ...(options.rsc ? ["--rsc"] : [])],
			{ cwd: ADMIN, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
		),
	) as Load;

describe("@monti-cms/admin root in a server component", () => {
	/**
	 * A plugin's admin module imports `@monti-cms/admin` (for `defineAdminPlugin`), and the admin loads that module on the server, inside a server component.
	 * There React has no `createContext` and no client hooks, and a `"use client"` module is only referred to. A server module the root reaches that calls
	 * one of them while loading breaks every admin page.
	 */
	it("ADMIN-H4 loads under the react-server condition, with its client modules only referred to", () => {
		const result = load("src/index.ts", { rsc: true });
		expect(result.failure).toBeUndefined();
		expect(result.exports).toContain("defineAdminPlugin");
		// The load ran with React's server build and met client modules on the way, so it tested what it says.
		expect(result.reactServer).toBe(true);
		expect(result.clientModules).toBeGreaterThan(0);
	});
});

describe("the editor hooks (`hooks/public.ts`)", () => {
	/**
	 * Hooks return state and results only, so a site can use them without the default UI and in any framework: what they load includes no part of the
	 * admin's own UI (`ui/`, the confirm dialog), its router or host layout, and their modules import no framework, theme or icon package.
	 */
	let result: Load;
	let adminModules: [string, Load["loaded"][string]][];
	beforeAll(() => {
		result = load("src/hooks/public.ts");
		adminModules = Object.entries(result.loaded).filter(([file]) => file.startsWith("packages/admin/src/"));
	});
	const FORBIDDEN_MODULES =
		/^packages\/admin\/src\/(?:ui|router|host)\/|^packages\/admin\/src\/screens\/shared\/confirm-dialog\./;
	const FORBIDDEN_PACKAGES = /^(?:next|next-auth|next-themes|@carbon\/icons-react)(?:\/|$)/;

	it("load no default UI, router or host layout, and import no framework, theme or icons", () => {
		expect(result.failure).toBeUndefined();
		// The load reaches the hooks `public.ts` re-exports: the slot hook, the block editor, the field hook and the entry editor.
		expect(adminModules.map(([file]) => file)).toEqual(
			expect.arrayContaining([
				"packages/admin/src/slots/use-slot-actions.ts",
				"packages/admin/src/editor/blocks/use-block-editor.tsx",
				"packages/admin/src/screens/entries/use-field.tsx",
				"packages/admin/src/screens/entries/use-entry-editor.tsx",
			]),
		);
		expect(adminModules.map(([file]) => file).filter((file) => FORBIDDEN_MODULES.test(file))).toEqual([]);
		expect(
			adminModules.flatMap(([file, { imports }]) =>
				imports.filter((source) => FORBIDDEN_PACKAGES.test(source)).map((source) => `${file} -> ${source}`),
			),
		).toEqual([]);
	});

	it("never navigate: no module they load opens a window or touches the address bar", () => {
		// Found with Biome's GritQL search, so a comment or a string that mentions `window.open` is not a match.
		const pattern =
			"or { `window.open`, `window.history`, `window.location`, `location.reload`, `location.assign`, `location.replace`, `location.href = $_`, `history.pushState`, `history.replaceState` }";
		const output = execFileSync(
			path.join(ROOT, "node_modules/.bin/biome"),
			["search", "--colors=off", pattern, ...adminModules.map(([file]) => file)],
			{ cwd: ROOT, encoding: "utf8" },
		);
		expect(output).toMatch(new RegExp(`Searched ${adminModules.length} files`));
		expect([...output.matchAll(/^(\S+:\d+:\d+) search/gm)].map((match) => match[1])).toEqual([]);
	});
});
