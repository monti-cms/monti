import { parseMeta } from "@monti-cms/admin/blocks";
import type { BlockChild } from "@monti-cms/admin/hooks";

/** One code block of a code explorer as the editor sees it: its position among the children and its path (the `title` meta). */
export interface EditorFile {
	/** Child index inside the container (also counts children that are not code blocks). */
	readonly index: number;
	/** Path from the code block's `title`. Empty if the block has no title. */
	readonly path: string;
	/** A path ending in `/` is a folder entry. */
	readonly folder: boolean;
}

/** The code blocks among the children of a code explorer, in document order. Other children (a paragraph below the explorer's files) are not files. */
export function filesOf(children: readonly Pick<BlockChild, "index" | "name" | "values">[]): EditorFile[] {
	return children.flatMap((child) => {
		if (child.name !== "codeBlock") return [];
		const path = parseMeta(typeof child.values.meta === "string" ? child.values.meta : "").title.trim();
		return [{ index: child.index, path, folder: path.endsWith("/") }];
	});
}

/** A path starting with `stem` and ending with `suffix` that is not in `taken` yet: `src/new-file.ts`, `src/new-file-2.ts`, `src/new-file-3.ts`… */
export function uniquePath(taken: readonly string[], stem: string, suffix: string): string {
	let path = `${stem}${suffix}`;
	for (let number = 2; taken.includes(path); number += 1) path = `${stem}-${number}${suffix}`;
	return path;
}
