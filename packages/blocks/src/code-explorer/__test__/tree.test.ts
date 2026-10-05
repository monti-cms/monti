import { describe, expect, it } from "vitest";
import { ancestorsOf, buildTree, filesOf, parsePath, type TreeNode } from "../tree";

const entry = (path: string, code = true) => ({ path, code });

/** A compact view of the tree: `dir/` with its children indented in a list, files by name (`~` for a file with no code). */
const outline = (nodes: readonly TreeNode[]): unknown[] =>
	nodes.map((node) =>
		node.kind === "folder" ? { [node.name]: outline(node.children) } : node.selectable ? node.name : `~${node.name}`,
	);

describe("parsePath", () => {
	it("splits on slashes and ignores a leading ./ or /, empty and . segments and spaces around names", () => {
		expect(parsePath("src/app/page.tsx").segments).toEqual(["src", "app", "page.tsx"]);
		expect(parsePath("./src//app/./page.tsx").segments).toEqual(["src", "app", "page.tsx"]);
		expect(parsePath("/src/a.ts").segments).toEqual(["src", "a.ts"]);
		expect(parsePath("  src / a.ts ").segments).toEqual(["src", "a.ts"]);
	});

	it("treats a trailing slash as a folder and keeps odd names as they are", () => {
		expect(parsePath("src/").folder).toBe(true);
		expect(parsePath("src").folder).toBe(false);
		expect(parsePath("../x/.env").segments).toEqual(["..", "x", ".env"]);
		expect(parsePath("a\\b.ts").segments).toEqual(["a\\b.ts"]);
	});

	it("has no segments for a path with no name", () => {
		for (const path of ["", "   ", "/", "./", "//", "./."]) expect(parsePath(path).segments).toEqual([]);
	});
});

describe("buildTree", () => {
	it("keeps the author's order and puts a folder where its first file appears", () => {
		const { nodes, rejected } = buildTree([
			entry("src/b.ts"),
			entry("README.md"),
			entry("src/a.ts"),
			entry("docs/guide.md"),
			entry("src/lib/z.ts"),
		]);
		expect(outline(nodes)).toEqual([{ src: ["b.ts", "a.ts", { lib: ["z.ts"] }] }, "README.md", { docs: ["guide.md"] }]);
		expect(rejected).toEqual([]);
	});

	it("gives files their normalized path, entry index and the path of folders", () => {
		const { nodes } = buildTree([entry("./src//app/page.tsx"), entry("/x.ts")]);
		const [src, x] = nodes;
		expect(src).toMatchObject({ kind: "folder", name: "src", path: "src" });
		expect(filesOf(nodes).map((file) => [file.path, file.index])).toEqual([
			["src/app/page.tsx", 0],
			["x.ts", 1],
		]);
		expect(x).toMatchObject({ kind: "file", path: "x.ts", selectable: true });
	});

	it("marks files with no code as not selectable", () => {
		const { nodes } = buildTree([entry("a.ts"), entry("notes.md", false), entry("src/b.ts", false)]);
		expect(outline(nodes)).toEqual(["a.ts", "~notes.md", { src: ["~b.ts"] }]);
		expect(filesOf(nodes).map((file) => file.selectable)).toEqual([true, false, false]);
	});

	it("makes a folder of a path with a trailing slash, nested and where it appears, and absorbs a repeat", () => {
		const { nodes, rejected } = buildTree([
			entry("public/", false),
			entry("src/a.ts"),
			entry("src/assets/img/", false),
			entry("src/", false),
			entry("public/", false),
		]);
		expect(outline(nodes)).toEqual([{ public: [] }, { src: ["a.ts", { assets: [{ img: [] }] }] }]);
		expect(rejected).toEqual([]);
	});

	it("rejects a later entry for a path already in the tree (the first wins), even when written differently", () => {
		const { nodes, rejected } = buildTree([
			entry("a.ts"),
			entry("src/b.ts"),
			entry("./a.ts"),
			entry("src//b.ts"),
			entry("c.ts"),
		]);
		expect(outline(nodes)).toEqual(["a.ts", { src: ["b.ts"] }, "c.ts"]);
		expect(rejected).toEqual([2, 3]);
		expect(filesOf(nodes).map((file) => file.index)).toEqual([0, 1, 4]);
	});

	it("rejects a file and a folder that share a name, whichever comes first", () => {
		const fileFirst = buildTree([entry("a"), entry("a/b.ts"), entry("a/", false)]);
		expect(outline(fileFirst.nodes)).toEqual(["a"]);
		expect(fileFirst.rejected).toEqual([1, 2]);

		const folderFirst = buildTree([entry("a/b.ts"), entry("a")]);
		expect(outline(folderFirst.nodes)).toEqual([{ a: ["b.ts"] }]);
		expect(folderFirst.rejected).toEqual([1]);
	});

	it("rejects paths with no name and folder entries that hold code", () => {
		const { nodes, rejected } = buildTree([entry("/"), entry("   "), entry("dir/", true), entry("ok.ts")]);
		expect(outline(nodes)).toEqual(["ok.ts"]);
		expect(rejected).toEqual([0, 1, 2]);
	});

	it("builds an empty tree from no entries", () => {
		expect(buildTree([])).toEqual({ nodes: [], rejected: [] });
	});
});

describe("filesOf and ancestorsOf", () => {
	it("lists files depth first in display order", () => {
		const { nodes } = buildTree([entry("a/x.ts"), entry("b.ts"), entry("a/c/y.ts")]);
		expect(filesOf(nodes).map((file) => file.path)).toEqual(["a/x.ts", "a/c/y.ts", "b.ts"]);
	});

	it("lists the folders above a path, outermost first", () => {
		expect(ancestorsOf("a/b/c.ts")).toEqual(["a", "a/b"]);
		expect(ancestorsOf("c.ts")).toEqual([]);
	});
});
