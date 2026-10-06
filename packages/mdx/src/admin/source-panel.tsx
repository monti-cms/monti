"use client";

import { type BrowserFormat, type SourcePanelProps, useFormat } from "@monti-cms/admin";
import { useLinkPaths } from "@monti-cms/admin/hooks";
import { createTranslator } from "@monti-cms/core/client";
import {
	assignBlockIds,
	entryLinkIds,
	forEachBlock,
	isUnparsedDocument,
	mapLinkAttrs,
	type StoredDocument,
	unparsedDocument,
} from "@monti-cms/core/document";
import { useEffect, useMemo, useRef, useState } from "react";
import { mdxBrowserFormat } from "./format";
import { MdxSourceEditor } from "./mdx-source-editor";
import { mdxSourceMessages } from "./messages";

const t = createTranslator(mdxSourceMessages);

/** Id of the element a screen puts the findings about the text in. The panel's input refers to it as its description. */
export const SOURCE_ERROR_ID = "cms-source-error";

/** The 1-based line of the text where a top-level block of `doc` starts, or `null` when no block has this id (the text is that of `doc`). */
export function lineOfBlock(
	doc: StoredDocument,
	blockId: string,
	format: BrowserFormat = mdxBrowserFormat,
): number | null {
	if (isUnparsedDocument(doc)) return 1;
	const index = doc.content.findIndex((top) => {
		let found = false;
		forEachBlock([top], (block) => {
			if (block.id === blockId) found = true;
		});
		return found;
	});
	if (index < 0) return null;
	if (index === 0) return 1;
	// Blocks are written one after another with a blank line between them.
	const before = format.export({ ...doc, content: doc.content.slice(0, index) });
	return before.split("\n").length + 1;
}

/** The offset in `text` of the start of a 1-based line. */
const offsetOfLine = (text: string, line: number): number => {
	let offset = 0;
	for (const row of text.split("\n").slice(0, line - 1)) offset += row.length + 1;
	return Math.min(offset, text.length);
};

/**
 * The MDX source panel: edits the body as MDX text and hands the document back (`SourcePanelProps`). It parses in the browser, so a mistake is found as it is
 * typed. A text that does not read becomes a document holding it as it is (one `unparsed` node), so a draft keeps it and no keystroke is lost.
 */
export function MdxSourcePanel({ doc, onChange, focusBlock, readOnly, onComposing }: SourcePanelProps) {
	// The format the admin registered (with the site's syntax extensions); without one the panel reads standard MDX.
	const format = useFormat("mdx") ?? mdxBrowserFormat;
	// A link to an entry is written with the entry's address, so a writer sees and types real addresses. The entries are looked up (the way the link bubble does), and the
	// text is written again when their addresses arrive, unless it was edited meanwhile. A link that cannot be resolved keeps its id (`entry:<id>`).
	const ids = useMemo(() => entryLinkIds(doc.content), [doc]);
	const pathOf = useLinkPaths(ids);
	const resolved = ids.map((id) => pathOf(id) ?? "").join("|");
	const write = (value: StoredDocument) => format.export(value, { link: pathOf });
	const [text, setText] = useState(() => write(doc));
	const written = useRef(text);
	const [failed, setFailed] = useState(() => isUnparsedDocument(doc));
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// The document the panel last handed back or reported on. A `doc` that is something else came from outside (a template, the visual editor): its text
	// replaces the one shown, and what is found about it is reported (the same document, so nothing counts as an edit).
	const known = useRef<StoredDocument | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: only a new document is looked at; `onChange` is the latest one
	useEffect(() => {
		if (doc === known.current) return;
		known.current = doc;
		const source = write(doc);
		written.current = source;
		setText(source);
		const unreadable = isUnparsedDocument(doc);
		setFailed(unreadable);
		const read = unreadable ? format.import(source) : null;
		onChange(doc, read && !read.ok ? read.issues : []);
	}, [doc]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when addresses arrive
	useEffect(() => {
		const current = known.current ?? doc;
		if (isUnparsedDocument(current) || text !== written.current) return;
		const source = write(current);
		if (source === text) return;
		written.current = source;
		setText(source);
	}, [resolved]);

	const change = (next: string) => {
		setText(next);
		const read = format.import(next);
		if (read.ok) {
			// A link typed with the address of an entry the body already links to is that link (the server turns other paths into ids on save).
			const entryOf = new Map(ids.flatMap((id) => (pathOf(id) ? [[pathOf(id) as string, id] as const] : [])));
			const linked = mapLinkAttrs(read.doc.content, (attrs) => {
				const id = typeof attrs.href === "string" ? entryOf.get(attrs.href) : undefined;
				return id ? { entryId: id } : undefined;
			}) as StoredDocument["content"];
			// The blocks of the text keep the ids of the blocks they pair with.
			const merged = { ...read.doc, content: assignBlockIds(linked, [doc.content]) };
			known.current = merged;
			setFailed(false);
			onChange(merged, read.warnings);
			return;
		}
		const kept = unparsedDocument(next, doc, format.name);
		known.current = kept;
		setFailed(true);
		onChange(kept, read.issues);
	};

	// Brings the caret to a block when asked.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when a block is asked for, with the text and document of that moment
	useEffect(() => {
		if (!focusBlock) return;
		const textarea = textareaRef.current;
		const line = lineOfBlock(known.current ?? doc, focusBlock, format);
		if (!textarea || line === null) return;
		const offset = offsetOfLine(textarea.value, line);
		textarea.focus();
		textarea.setSelectionRange(offset, offset);
	}, [focusBlock]);

	return (
		<MdxSourceEditor
			ref={textareaRef}
			id="cms-mdx-source"
			aria-label={t("body")}
			aria-invalid={failed || undefined}
			aria-describedby={SOURCE_ERROR_ID}
			value={text}
			readOnly={readOnly}
			onChange={(event) => change(event.target.value)}
			onCompositionStart={() => onComposing?.(true)}
			onCompositionEnd={() => onComposing?.(false)}
			placeholder={t("placeholder")}
			className="min-h-[calc(100vh-240px)] w-full flex-1 px-4"
		/>
	);
}

export const MDX_SOURCE_LABEL = t("toggle");
