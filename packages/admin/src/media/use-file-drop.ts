import { useCallback, useEffect, useRef, useState } from "react";

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
 * While a page takes files, a file let go anywhere else on it stays out of the browser's hands: its own way is to leave the page and open the file, and whatever was being
 * written goes with it.
 */
export function useKeepFilesInPage() {
	useEffect(() => {
		const hold = (event: DragEvent) => {
			if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
		};
		window.addEventListener("dragover", hold);
		window.addEventListener("drop", hold);
		return () => {
			window.removeEventListener("dragover", hold);
			window.removeEventListener("drop", hold);
		};
	}, []);
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
	/** What is over it: tiles of the library to move in, or files from outside to send up. */
	const [over, setOver] = useState<"tiles" | "files" | null>(null);
	const depth = useRef(0);
	const takes = (event: React.DragEvent) => holdsMedia(event) || (onFiles !== undefined && holdsFiles(event));
	return {
		target: over !== null,
		/** Files from outside are over it: they would go up into it, which the hint at the bottom says. A move says nothing there. */
		files: over === "files",
		handlers: {
			onDragEnter: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.preventDefault();
				event.stopPropagation();
				depth.current += 1;
				setOver(holdsMedia(event) ? "tiles" : "files");
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
				if (depth.current === 0) setOver(null);
			},
			onDrop: (event: React.DragEvent) => {
				if (!takes(event)) return;
				event.preventDefault();
				event.stopPropagation();
				depth.current = 0;
				setOver(null);
				if (holdsMedia(event)) onMove(draggedIds(event));
				else onFiles?.([...event.dataTransfer.files]);
			},
		},
	};
}
