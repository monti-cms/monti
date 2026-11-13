import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { add } from "./command";

/** The blocks package of this repo: what a site has installed. */
const FROM = path.resolve(__dirname, "../../../../blocks");

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A Next site with Monti, as `monti init` leaves it: a config, an admin page with its API, a root layout and a page that draws a body. */
function site(): string {
	const root = mkdtempSync(path.join(tmpdir(), "monti-add-"));
	made.push(root);
	const file = (name: string, text: string) => {
		mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
		writeFileSync(path.join(root, name), text);
	};
	file("package.json", '{ "name": "blog", "private": true }\n');
	file("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
	file(
		"monti.config.ts",
		'import { defineConfig } from "@monti-cms/core";\nimport schema from "./monti.schema";\n\nexport default defineConfig({\n\tschema,\n\tdatabase: process.env.DATABASE_URL,\n});\n',
	);
	file(
		"app/layout.tsx",
		'import "./site.css";\n\nexport default function Layout({ children }: { children: React.ReactNode }) {\n\treturn <html lang="ko"><body>{children}</body></html>;\n}\n',
	);
	file(
		"app/admin/page.tsx",
		'import { AdminPage } from "@monti-cms/next/admin";\n\nexport default function Admin() {\n\treturn <AdminPage siteName="블로그" />;\n}\n',
	);
	file(
		"app/admin/api/[...path]/route.ts",
		'import { adminRoute } from "@monti-cms/next";\nexport const { GET, POST } = adminRoute();\n',
	);
	file(
		"site/post.tsx",
		'import { renderDocument } from "@monti-cms/core/render";\nimport { createElement as h } from "react";\n\nexport const Post = ({ doc }: { doc: never }) => renderDocument(doc, { createElement: h, media: {} });\n',
	);
	return root;
}

const run = async (cwd: string, ...argv: string[]) => {
	const out: string[] = [];
	const err: string[] = [];
	const code = await add({
		cwd,
		argv,
		from: FROM,
		out: (line) => out.push(line),
		err: (line) => err.push(line),
		ask: null,
	});
	return { code, out, err };
};
const read = (root: string, name: string) => readFileSync(path.join(root, name), "utf8");

describe("monti add (doc 18)", () => {
	it("18-1 copies each block's folder into monti/blocks, lists it, and wires the config, the admin page and renderDocument", async () => {
		const root = site();
		const { code, out } = await run(root, "callout", "math", "color");
		expect(code).toBe(0);
		expect(readdirSync(path.join(root, "monti/blocks")).sort()).toEqual(
			["admin.ts", "callout", "color", "index.ts", "math"].sort(),
		);
		// One folder holds the whole block: its definition, its site drawing, its editor view, its words and its look.
		expect(readdirSync(path.join(root, "monti/blocks/callout")).sort()).toEqual([
			"editor.tsx",
			"index.ts",
			"site.tsx",
			"style.ts",
			"words.ts",
		]);
		// A package's tests are not the site's.
		expect(existsSync(path.join(root, "monti/blocks/blocks.test.tsx"))).toBe(false);

		const index = read(root, "monti/blocks/index.ts");
		expect(index).toContain('import { callout } from "./callout";');
		expect(index).toContain('import { color } from "./color";');
		expect(index).toMatch(/export const blocks: AnyBlockDefinition\[\] = \[\n\tcallout,\n\tmath,\n\];/);
		expect(index).toMatch(/export const marks: MarkDefinition\[\] = \[\n\tcolor,\n\];/);

		const config = read(root, "monti.config.ts");
		expect(config).toContain('import schema from "./monti.schema";\nimport { blocks, marks } from "./monti/blocks";');
		expect(config).toContain("defineConfig({\n\tblocks,\n\tmarks,\n\tschema,");
		const page = read(root, "app/admin/page.tsx");
		expect(page).toContain('import { adminBlocks, adminMarks } from "../../monti/blocks/admin";');
		expect(page).toContain('<AdminPage blocks={adminBlocks} marks={adminMarks} siteName="블로그" />');
		// Each block loads its own look: no stylesheet goes into the layouts.
		expect(read(root, "app/layout.tsx")).not.toContain("monti/blocks");
		const post = read(root, "site/post.tsx");
		expect(post).toContain('import { blocks, marks } from "../monti/blocks/index";');
		expect(post).toContain("renderDocument(doc, { blocks, marks, createElement: h, media: {} })");

		expect(out).toContain("Added callout: monti/blocks/callout/");
		expect(out).toContain("math needs katex: pnpm add katex");
	});

	it("18-1 a folder already there is never written over, and the site is wired once", async () => {
		const root = site();
		await run(root, "callout");
		const changed = path.join(root, "monti/blocks/callout/site.tsx");
		writeFileSync(changed, "// the site's own callout\n");
		const before = [
			"monti.config.ts",
			"app/admin/page.tsx",
			"app/layout.tsx",
			"site/post.tsx",
			"monti/blocks/index.ts",
		].map((name) => read(root, name));
		const { code, out } = await run(root, "callout", "tabs");
		expect(code).toBe(0);
		expect(readFileSync(changed, "utf8")).toBe("// the site's own callout\n");
		expect(out).toContain(
			"callout is already in monti/blocks/callout: it is the site's own now. Remove the folder to add it again.",
		);
		expect(out.filter((line) => line.startsWith("Wired"))).toEqual([]);
		expect(
			["monti.config.ts", "app/admin/page.tsx", "app/layout.tsx", "site/post.tsx"].map((name) => read(root, name)),
		).toEqual(before.slice(0, 4));
		// Tabs come with their tab.
		expect(read(root, "monti/blocks/index.ts")).toMatch(/\tcallout,\n\ttabs,\n\ttab,\n\];/);
	});

	it("18-1 without the blocks package, or with a name it does not have, it says so and writes nothing", async () => {
		const root = site();
		const out: string[] = [];
		const err: string[] = [];
		expect(
			await add({
				cwd: root,
				argv: ["callout"],
				out: (line) => out.push(line),
				err: (line) => err.push(line),
				ask: null,
			}),
		).toBe(1);
		expect(err).toEqual([
			"Blocks come from @monti-cms/blocks: install it from the same release, then run monti add again.",
		]);
		const unknown = await run(root, "callout", "carousel");
		expect(unknown.code).toBe(1);
		expect(unknown.err).toEqual(["There is no carousel. monti add with no name lists what there is."]);
		expect(existsSync(path.join(root, "monti"))).toBe(false);
	});

	it("18-1 with no name it lists what there is; at a terminal it asks which", async () => {
		const root = site();
		const listed = await run(root);
		expect(listed.code).toBe(0);
		expect(listed.out[0]).toBe("Blocks and marks to add:");
		expect(listed.out).toContain("  callout        A box for a note, a tip or a warning");
		expect(listed.out.at(-1)).toBe("Add them by name: monti add callout math");
		expect(existsSync(path.join(root, "monti"))).toBe(false);

		const asked: string[] = [];
		const code = await add({
			cwd: root,
			argv: [],
			from: FROM,
			out: () => {},
			ask: async ({ message, check }) => {
				asked.push(message, check?.("callout, carousel") ?? "fine");
				return "chart";
			},
		});
		expect(code).toBe(0);
		expect(asked).toEqual(["Which? (names with commas, or none)", "There is no carousel."]);
		expect(existsSync(path.join(root, "monti/blocks/chart/index.ts"))).toBe(true);
	});

	it("18-1 a file it cannot change surely is left alone, and the line is said for a person to add", async () => {
		const root = site();
		writeFileSync(
			path.join(root, "site/post.tsx"),
			'import { renderDocument } from "@monti-cms/core/render";\nconst blocks = [];\nexport const Post = ({ doc }: { doc: never }) => renderDocument(doc, { createElement: () => null, blocks });\n',
		);
		writeFileSync(
			path.join(root, "site/other.tsx"),
			'import { renderDocument } from "@monti-cms/core/render";\nconst marks = 1;\nexport const P = (doc: never) => renderDocument(doc, { createElement: () => null });\n',
		);
		const { out } = await run(root, "callout");
		expect(read(root, "site/post.tsx")).not.toContain("monti/blocks");
		expect(out).toContain(
			"Left for you: site/other.tsx: renderDocument(…, { blocks, marks, … }), from ../monti/blocks/index",
		);
	});

	it("18-4 a block is removed by deleting its folder and its line in the list: nothing else of it is left", async () => {
		const root = site();
		await run(root, "callout", "color");
		const files = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory() ? files(path.join(dir, entry.name)).map((name) => `${entry.name}/${name}`) : [entry.name],
			);
		const names = ["monti.config.ts", "app/admin/page.tsx", "app/layout.tsx", "site/post.tsx"];
		const before = {
			index: read(root, "monti/blocks/index.ts"),
			site: names.map((name) => read(root, name)),
			files: files(root),
		};

		await run(root, "tabs");
		const index = read(root, "monti/blocks/index.ts");
		expect(index).toContain('import { tabs, tab } from "./tabs";');
		rmSync(path.join(root, "monti/blocks/tabs"), { recursive: true });
		writeFileSync(
			path.join(root, "monti/blocks/index.ts"),
			index.replace('import { tabs, tab } from "./tabs";\n', "").replace("\ttabs,\n\ttab,\n", ""),
		);
		expect(read(root, "monti/blocks/index.ts")).toBe(before.index);
		expect(names.map((name) => read(root, name))).toEqual(before.site);
		expect(files(root)).toEqual(before.files);
	});

	it("18-2 the example app's blocks are the package's folders as monti add copies them", () => {
		const example = path.resolve(__dirname, "../../../../../examples/blog/monti/blocks");
		const tree = (dir: string): string[] =>
			readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
				entry.isDirectory()
					? tree(path.join(dir, entry.name)).map((name) => `${entry.name}/${name}`)
					: /\.test\./.test(entry.name)
						? []
						: [entry.name],
			);
		for (const name of readdirSync(example, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
			const own = path.join(example, name.name);
			const theirs = path.join(FROM, "blocks", name.name);
			expect(tree(own)).toEqual(tree(theirs));
			for (const file of tree(own)) expect(read(own, file), file).toBe(read(theirs, file));
		}
	});

	it("18-1 a list on one line, with no comma after its last name, still reads after a name is added to it", async () => {
		const root = site();
		await run(root, "callout", "tooltip");
		const index = path.join(root, "monti/blocks/index.ts");
		writeFileSync(
			index,
			readFileSync(index, "utf8").replace(
				/marks: MarkDefinition\[\] = \[[\s\S]*?\];/,
				"marks: MarkDefinition[] = [tooltip];",
			),
		);
		await run(root, "color");
		expect(read(root, "monti/blocks/index.ts")).toContain("marks: MarkDefinition[] = [tooltip,\n\tcolor,\n];");
	});
});
