import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { codeExplorerMessages } from "./messages";

const t = createActiveTranslator(codeExplorerMessages);

/**
 * Code explorer (`:::code-explorer`). A file tree with the code of the picked file, for posts that show several files of a project.
 *
 * It holds code blocks, and each code block's `title` is its path (`src/app/page.tsx`): the tree is built from the paths, never drawn by
 * hand. A code block with a path and no code is a file shown only in the tree; a path ending in `/` is a folder (an empty one, or one
 * listed for its own sake). Without any code, the block is just a file tree.
 *
 * ````md
 * :::code-explorer{open="src/app/page.tsx"}
 * ```tsx title="src/app/page.tsx"
 * export default function Page() {}
 * ```
 * ```ts title="src/lib/db.ts"
 * export const db = connect();
 * ```
 * ```text title="public/"
 * ```
 * :::
 * ````
 *
 * Every file stays an ordinary code block: line effects, folding, copy and code-ref links all work, and every file is in the page's HTML
 * (only hidden on screen), so search engines, feeds, readers without JavaScript and exports see titled code blocks one after another.
 */
export const codeExplorerBlock = defineBlock({
	name: "code-explorer",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "container", directive: "code-explorer" },
	component: "CodeExplorer",
	attributes: {
		open: {
			type: "string",
			get label() {
				return t("open.label");
			},
		},
	},
	// A code explorer without any file is allowed (an empty body is saved as `:::code-explorer` + `:::`).
	children: { min: 0 },
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["code-explorer", "file-tree", ...keywordList(t("keywords"))];
		},
		icon: "folder-tree",
		// Starts with one file, not an empty paragraph. `src/index.ts` is a path, so it is not translated.
		insert: { codeBlocks: [{ language: "ts", title: "src/index.ts" }] },
	},
});
