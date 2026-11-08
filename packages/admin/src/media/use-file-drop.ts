import { useCallback, useRef, useState } from "react";

/** What dragging a tile carries: the ids of the files it moves. */
export const MEDIA_DRAG = "application/x-monti-media";

const holdsFiles = (event: React.DragEvent) => event.dataTransfer.types.includes("Files");
const holdsMedia = (event: React.DragEvent) => event.dataTransfer.types.includes(MEDIA_DRAG);

/** The files a drag of tiles carries, read back where it lands. A page's own format, but what comes off a drag is text, so it is checked. */
export function draggedIds(event: React.DragEvent): string[] {
	try {
		const ids: unknown = JSON.parse(event.dataTransfer.getData(MEDIA_DRAG));
		return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

/**
 * Whether files from outside are over a place, and what happens when they land (`DropArea`, a folder tile). A drag enters and leaves every child on its way, so it counts
 * them. Other things being dragged (a tile, text) are not its business.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
	const [over, setOver] = useState(false);
	const depth = useRef(0);
	const handlers = {
		onDragEnter: useCallback((event: React.DragEvent) => {
			if (!holdsFiles(event)) return;
			event.preventDefault();
			depth.current += 1;
			setOver(true);
		}, []),
		onDragOver: useCallback((event: React.DragEvent) => {
			if (!holdsFiles(event)) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		}, []),
		onDragLeave: useCallback((event: React.DragEvent) => {
			if (!holdsFiles(event)) return;
			depth.current = Math.max(0, depth.current - 1);
			if (depth.current === 0) setOver(false);
		}, []),
		onDrop: useCallback(
			(event: React.DragEvent) => {
				if (!holdsFiles(event)) return;
				event.preventDefault();
				depth.current = 0;
				setOver(false);
				onFiles([...event.dataTransfer.files]);
			},
			[onFiles],
		),
	};
	return { over, handlers };
}

/** A folder as a place to drop: files from outside go up into it, tiles of the library move into it. `event.stopPropagation` keeps the area around it out of it. */
export function useFolderDrop({
	onFiles,
	onMove,
}: {
	onFiles?: (files: File[]) => void;
	onMove: (ids: string[]) => void;
}) {
	const [target, setTarget] = useState(false);
	const depth = useRef(0);
	const takes = (event: React.DragEvent) => holdsMedia(event) || (onFiles !== undefined && holdsFiles(event));
	return {
		target,
		handlers: {
			onDragEnter: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.preventDefault();
				event.stopPropagation();
				depth.current += 1;
				setTarget(true);
			},
			onDragOver: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = holdsMedia(event) ? "move" : "copy";
			},
			onDragLeave: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.stopPropagation();
				depth.current = Math.max(0, depth.current - 1);
				if (depth.current === 0) setTarget(false);
			},
			onDrop: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.preventDefault();
				event.stopPropagation();
				depth.current = 0;
				setTarget(false);
				if (holdsMedia(event)) onMove(draggedIds(event));
				else onFiles?.([...event.dataTransfer.files]);
			},
		},
	};
}
