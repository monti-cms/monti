/**
 * State of the `/` slash menu: when it opens (start of an empty paragraph), the commands it offers (defaults plus plugin and
 * text-style extension actions) and its keyboard handling.
 */

import type { Site } from "@monti-cms/core/site";
import type { Editor, Range } from "@tiptap/core";
import { type MutableRefObject, useMemo, useRef, useState } from "react";
import type { EditorInsertAction } from "../admin-components";
import type { EditorAllowance } from "./allowed";
import type { useMarkExtensions } from "./inline-bubble";
import type { Coords } from "./screen-coords";
import { filterCommands, type SlashCommandItem } from "./slash-command";

type SlashState = { query: string; index: number; coords: Coords };

export function useSlashMenu({
	site,
	allowance,
	insertActions,
	markExtensions,
	editorRef,
}: {
	site: Site;
	allowance: EditorAllowance;
	insertActions: readonly EditorInsertAction[] | undefined;
	/** Text-style extensions allowed in the body; their insert actions follow the default text format items. */
	markExtensions: ReturnType<typeof useMarkExtensions>;
	editorRef: MutableRefObject<Editor | null>;
}) {
	const [slash, setSlash] = useState<SlashState | null>(null);
	const slashRangeRef = useRef<Range | null>(null);
	// Slash menu items added by extensions (plugins). Also kept in a ref so the key handler reads the latest value.
	const extraCommands = useMemo<SlashCommandItem[]>(
		() =>
			(insertActions ?? []).map((item) => ({
				id: item.id,
				title: item.title,
				description: item.description,
				keywords: [...item.keywords],
				...(item.icon ? { icon: item.icon } : {}),
				action: (current, range) => item.run(current, range),
			})),
		[insertActions],
	);
	const extraCommandsRef = useRef(extraCommands);
	extraCommandsRef.current = extraCommands;
	// Slash menu items of text-style extensions (after the default text format items).
	const inlineCommands: SlashCommandItem[] = markExtensions.flatMap(({ extension }) =>
		(extension.insertActions ?? []).map((item) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			keywords: [...item.keywords],
			...(item.icon ? { icon: item.icon } : {}),
			action: (current: Editor, range: Range) => item.run(current, range),
		})),
	);
	const inlineCommandsRef = useRef(inlineCommands);
	inlineCommandsRef.current = inlineCommands;
	const slashRef = useRef(slash);
	slashRef.current = slash;

	/** Opens the menu when the text before the cursor is a `/command` at the start of a line; closes it otherwise. */
	const syncSlash = (current: Editor, textBefore: string, from: number) => {
		// Open the `/` menu only at the start of an empty paragraph. A path inside a sentence (`a/b`) is not mistaken for a command.
		const slashMatch = textBefore.match(/(?:^|\n)\/([^\s/]*)$/);
		if (!slashMatch || current.isActive("codeBlock")) {
			setSlash(null);
			return;
		}
		const query = slashMatch[1] ?? "";
		slashRangeRef.current = { from: from - query.length - 1, to: from };
		setSlash({ query, index: 0, coords: current.view.coordsAtPos(from) });
	};

	/** Keyboard handling while the menu is open. Returns the handled result, or `undefined` when the key is not for the menu. */
	const handleKey = (event: KeyboardEvent): boolean | undefined => {
		const openSlash = slashRef.current;
		if (!openSlash) return undefined;
		const filtered = filterCommands(
			site,
			openSlash.query,
			extraCommandsRef.current,
			inlineCommandsRef.current,
			allowance,
		);
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			const size = Math.max(1, filtered.length);
			setSlash({ ...openSlash, index: (openSlash.index + step + size) % size });
			return true;
		}
		if (event.key === "Enter") {
			const command = filtered[openSlash.index];
			if (!command || !slashRangeRef.current || !editorRef.current) {
				setSlash(null);
				return false;
			}
			event.preventDefault();
			command.action(editorRef.current, slashRangeRef.current);
			setSlash(null);
			return true;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setSlash(null);
			return true;
		}
		return undefined;
	};

	return {
		slash,
		slashRangeRef,
		extraCommands,
		inlineCommands,
		closeSlash: () => setSlash(null),
		syncSlash,
		handleKey,
	};
}
