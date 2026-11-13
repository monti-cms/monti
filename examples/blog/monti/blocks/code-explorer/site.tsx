import type { Block } from "@monti-cms/core";
import type { BlockProps } from "@monti-cms/core/render";
import { Children, type ReactNode } from "react";
import { CodeExplorerView } from "./code-explorer.client";
import { buildTree, filesOf, parsePath } from "./tree";

/** The explorer's own words, in the entry's language (English when the site gives none). The site's own: change them. */
const WORDS: Record<string, { files: string; toggle: string }> = {
	en: { files: "Files", toggle: "Show or hide the file list" },
	ko: { files: "파일", toggle: "파일 목록 열기 또는 닫기" },
	ja: { files: "ファイル", toggle: "ファイル一覧を開閉" },
};
const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;

/** A child that is a file: a code block with a path in its `title`, and whether it has code. */
function fileOf(block: Block): { path: string; code: boolean } | undefined {
	if (block.type !== "codeBlock") return undefined;
	const title = block.attrs?.title;
	if (typeof title !== "string" || parsePath(title).segments.length === 0) return undefined;
	const code = (block.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
	return { path: title, code: code.trim() !== "" };
}

/**
 * A code explorer: a file tree built from the paths of its code blocks (`title`) and the code of one file at a time (`open`, the path of the file shown
 * first, or the first file with code). Every file's code block is in the page's HTML and only hidden on screen, so search engines, feeds and readers
 * without scripts see titled code blocks one after another.
 *
 * - A code block with a path and no code is in the tree only; a path ending in `/` is a folder.
 * - Children that are not code blocks with a path are drawn after the explorer, as they are. So are code blocks with code that the tree cannot hold: a
 *   path taken already (the first wins) or both a file and a folder, and a folder entry with code. One with no code holds nothing and is dropped.
 * - With no code block that has a path, the children are drawn as they are.
 */
export function CodeExplorer({ block, attrs, locale, children }: BlockProps & { children?: ReactNode }) {
	const items = Children.toArray(children);
	const files = (block.children ?? []).map(fileOf);
	const entries = files.flatMap((file, index) => (file ? [{ item: index, ...file }] : []));
	if (entries.length === 0) return <>{children}</>;
	const { nodes, rejected } = buildTree(entries);
	// A rejected block with code is kept as content; one with no code holds nothing to lose.
	const kept = new Set(rejected.flatMap((index) => (entries[index]?.code ? [entries[index]?.item] : [])));
	const selectable = filesOf(nodes).filter((file) => file.selectable);
	const panels = entries.map((entry, index) =>
		selectable.some((file) => file.index === index) ? items[entry.item] : null,
	);
	const wanted = typeof attrs.open === "string" ? parsePath(attrs.open).segments.join("/") : "";
	const initial = (selectable.find((file) => file.path === wanted) ?? selectable[0])?.index ?? null;
	const rest = items.filter((_, index) => !files[index] || kept.has(index));
	return (
		<>
			<CodeExplorerView tree={nodes} panels={panels} initial={initial} labels={wordsIn(locale)} />
			{rest}
		</>
	);
}
