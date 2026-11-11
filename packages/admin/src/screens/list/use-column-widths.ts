import { useState } from "react";
import { widthsAfter } from "../screens/list/format";

const KEY = "monti:media-columns";

function kept(): Record<string, number> {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
		if (typeof stored !== "object" || stored === null) return {};
		return Object.fromEntries(
			Object.entries(stored).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
		);
	} catch {
		return {};
	}
}

/**
 * The widths of the media list's columns, as `ListHead` drags them: the library has no collection for `list.savePrefs` to keep them under, so they stay in this browser (T113).
 */
export function useColumnWidths() {
	const [widths, setWidths] = useState(kept);
	const [dragged, setDragged] = useState<Record<string, number> | null>(null);
	const shown = dragged ?? widths;
	const resize = (changes: Record<string, number | null>, commit: boolean) => {
		const next = widthsAfter(shown, changes);
		if (!commit) return setDragged(next);
		setDragged(null);
		setWidths(next);
		try {
			localStorage.setItem(KEY, JSON.stringify(next));
		} catch {}
	};
	return { widths: shown, resize };
}
