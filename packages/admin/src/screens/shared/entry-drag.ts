/** Data format used when dragging a list row onto a folder (posts move by drag or the bulk move menu). */
export const ENTRY_DRAG_TYPE = "application/x-cms-entries";

export type DraggedEntry = { id: string; expectedVersion: number };

/**
 * Loads drag data and shows a small label next to the cursor while dragging. Using the table row (`tr`) as the drag image as is
 * makes the browser also capture the overlapping screen areas (sidebar, header), so a big piece follows the cursor.
 */
export function writeDraggedEntries(event: React.DragEvent, entries: DraggedEntry[], label: string) {
	event.dataTransfer.setData(ENTRY_DRAG_TYPE, JSON.stringify(entries));
	event.dataTransfer.effectAllowed = "move";
	const image = document.createElement("div");
	image.textContent = label;
	image.className =
		"pointer-events-none fixed -top-96 left-0 max-w-64 truncate rounded-md border bg-cms-popover px-2.5 py-1 text-cms-popover-foreground text-xs shadow-md";
	document.body.append(image);
	event.dataTransfer.setDragImage?.(image, 12, 12);
	// The browser snapshots the image when the drag starts, so it can be removed right away.
	setTimeout(() => image.remove(), 0);
}

export function readDraggedEntries(event: React.DragEvent): DraggedEntry[] {
	try {
		const parsed = JSON.parse(event.dataTransfer.getData(ENTRY_DRAG_TYPE) || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const isEntryDrag = (event: React.DragEvent) => event.dataTransfer.types.includes(ENTRY_DRAG_TYPE);
