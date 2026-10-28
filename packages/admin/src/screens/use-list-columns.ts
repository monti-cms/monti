// The columns of a list: their order and which are on, kept in the writer's list settings, and which of them the width can hold.
import type { AdminColumnSettings } from "@monti-cms/core/site";
import { useSite } from "@monti-cms/core/site";
import { useEffect, useRef, useState } from "react";
import { columnSize, hideOrderWhenNarrow, TITLE_MIN_WIDTH } from "./entries-table-widths";
import { placeColumn, shownColumns, stepColumn } from "./list-column-order";
import { type AdminListColumn, columnsFor, knownColumnRecord } from "./list-columns";

export function useListColumns({
	collection,
	columnSettings,
	onColumnSettingsChange,
}: {
	collection: string;
	columnSettings?: AdminColumnSettings;
	onColumnSettingsChange: (settings: AdminColumnSettings) => void;
}) {
	const site = useSite();
	const { available, defaults } = columnsFor(site, collection);
	// Saved columns that no longer exist (a deleted field) are dropped; new ones go after the saved ones, the defaults first.
	const savedOrder = (columnSettings?.order ?? []).filter((column) => available.includes(column));
	const savedVisibility = knownColumnRecord(columnSettings?.visibility, available);
	const order = [...new Set([...savedOrder, ...defaults, ...available])];
	const visibility: Record<AdminListColumn, boolean> = Object.fromEntries(
		available.map((column) => [column, column === "title" || (savedVisibility?.[column] ?? defaults.includes(column))]),
	);
	// While a column's name is dragged, the order shown; nothing is saved until it is let go.
	const [preview, setPreview] = useState<AdminListColumn[] | null>(null);

	// The room the table has: the content of the box around it, so a panel beside the list leaves out columns as a narrower window does.
	const scrollRef = useRef<HTMLElement | null>(null);
	const [width, setWidth] = useState(0);
	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;
		setWidth(Math.floor(element.clientWidth));
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const shown = shownColumns({
		order: preview ?? order,
		visible: (column) => visibility[column] !== false,
		width,
		sizeOf: (column) => columnSize(site, collection, column) ?? 0,
		titleMin: TITLE_MIN_WIDTH,
		hideFirst: hideOrderWhenNarrow(site, collection, available),
	});
	const save = (next: AdminListColumn[], nextVisibility = visibility) =>
		onColumnSettingsChange({ order: next, visibility: nextVisibility });

	return {
		order,
		visibility,
		/** The columns drawn, in order (the dragged order while a name is dragged). */
		shown,
		scrollRef,
		setPreview,
		/** Puts `from` where `to` is. */
		place: (from: AdminListColumn, to: AdminListColumn) => save(placeColumn(order, from, to)),
		/** Moves a column one place among the columns drawn. */
		step: (column: AdminListColumn, direction: -1 | 1) => save(stepColumn(order, shown, column, direction)),
		/** Turns a column on or off. The title is always on. */
		toggle: (column: AdminListColumn, on: boolean) =>
			column === "title" ? undefined : save(order, { ...visibility, [column]: on }),
	};
}
