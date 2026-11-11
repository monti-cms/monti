import { useState } from "react";
import { widthsAfter } from "./format";

function kept(key: string): Record<string, number> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
		if (typeof stored !== "object" || stored === null) return {};
		return Object.fromEntries(
			Object.entries(stored).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
		);
	} catch {
		return {};
	}
}

/**
 * The widths of a table's columns, as `ListHead` drags them, for a table that has no collection for `list.savePrefs` to keep them under (the media list, the trash,
 * a collection's items): they stay in this browser, under the table's `name`.
 */
export function useColumnWidths(name: string) {
	const key = `monti:${name}-columns`;
	const [widths, setWidths] = useState(() => kept(key));
	const [dragged, setDragged] = useState<Record<string, number> | null>(null);
	const shown = dragged ?? widths;
	const resize = (changes: Record<string, number | null>, commit: boolean) => {
		const next = widthsAfter(shown, changes);
		if (!commit) return setDragged(next);
		setDragged(null);
		setWidths(next);
		try {
			localStorage.setItem(key, JSON.stringify(next));
		} catch {}
	};
	return { widths: shown, resize };
}
