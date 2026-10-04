/** Data format used when dragging a list row onto a folder (posts move by drag or the bulk move menu). */
export declare const ENTRY_DRAG_TYPE = "application/x-cms-entries";
export type DraggedEntry = {
    id: string;
    expectedVersion: number;
};
/**
 * Loads drag data and shows a small label next to the cursor while dragging. Using the table row (`tr`) as the drag image as is
 * makes the browser also capture the overlapping screen areas (sidebar, header), so a big piece follows the cursor.
 */
export declare function writeDraggedEntries(event: React.DragEvent, entries: DraggedEntry[], label: string): void;
export declare function readDraggedEntries(event: React.DragEvent): DraggedEntry[];
export declare const isEntryDrag: (event: React.DragEvent) => boolean;
