import { parseMeta } from "@monti-cms/admin/blocks";
import type { Node as PmNode } from "@tiptap/pm/model";

/** One code block of a code explorer as the editor sees it: its position among the children and its path (the `title` meta). */
export interface EditorFile {
	/** Child index inside the container (also counts children that are not code blocks). */
	readonly index: number;
	/** Path from the code block's `title`. Empty if the block has no title. */
	readonly path: string;
	/** A path ending in `/` is a folder entry. */
	readonly folder: boolean;
}

/** The code blocks of a code explorer node, in document order. Other children (a paragraph below the explorer's files) are not files. */
export function filesOf(node: PmNode): EditorFile[] {
	const files: EditorFile[] = [];
	node.forEach((child, _offset, index) => {
		if (child.type.name !== "codeBlock") return;
		const path = parseMeta(typeof child.attrs.meta === "string" ? child.attrs.meta : "").title.trim();
		files.push({ index, path, folder: path.endsWith("/") });
	});
	return files;
}

/** A path starting with `stem` and ending with `suffix` that is not in `taken` yet: `src/new-file.ts`, `src/new-file-2.ts`, `src/new-file-3.ts`… */
export function uniquePath(taken: readonly string[], stem: string, suffix: string): string {
	let path = `${stem}${suffix}`;
	for (let number = 2; taken.includes(path); number += 1) path = `${stem}-${number}${suffix}`;
	return path;
}
