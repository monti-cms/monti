import { FolderTree } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { CodeExplorer } from "./site";
import { buildTree, parsePath } from "./tree";
import { words } from "./words";

/**
 * A code explorer (`:::codeExplorer{open="src/app.ts"}` holding ```` ```ts title="src/app.ts" ````): a file tree with the code of the picked file, for
 * a post that shows several files of a project (doc 18). Every file stays an ordinary code block of doc 17: its language, its line effects, its copy
 * button. The tree is built from the paths, never drawn by hand.
 */
export const codeExplorer = defineBlock({
	type: "codeExplorer",
	label: words.codeExplorer,
	description:
		'Several files of a project as a file tree and the code of the picked file. Its children are codeBlock blocks whose `title` is the file\'s path ("src/app.ts"); a path ending in "/" with no code is a folder. `open` is the path of the file shown first (the first file when left out).',
	menu: "insert",
	attrs: z.object({ open: z.string().optional() }),
	fields: { open: { label: words.first } },
	holds: "blocks",
	children: ["codeBlock"],
	check: (block) => {
		const entries = (block.children ?? []).map((child) => ({
			path: typeof child.attrs?.title === "string" ? child.attrs.title : "",
			code: (child.content ?? []).length > 0,
		}));
		const unnamed = entries.some((entry) => parsePath(entry.path).segments.length === 0);
		const { rejected } = buildTree(entries.filter((entry) => parsePath(entry.path).segments.length > 0));
		return [
			...(unnamed ? [{ level: "warn" as const, message: words.aFileWithNo }] : []),
			...(rejected.length > 0 ? [{ level: "warn" as const, message: words.filesWithTheSame }] : []),
		];
	},
	Site: CodeExplorer,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: FolderTree,
	starter: () => ({ children: [{ type: "codeBlock", attrs: { language: "ts", title: "src/index.ts" } }] }),
});
