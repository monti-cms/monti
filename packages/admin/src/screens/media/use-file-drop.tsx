"use client";

import { Upload } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { type DragEvent, useEffect, useState } from "react";
import { mediaMessages } from "./messages";

const HINT = "media-drop";

/** Whether the drag carries files from outside the page (not a tile dragged inside the library, which carries its own type). */
export const isFileDrag = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Files dragged over the library from outside. While they are over it the area draws its frame; over a folder tile only that tile is picked out, and a hint
 * at the bottom names where they would go. A drop gives the files to `onFiles` with the folder (`null` for the open folder). `folderName` names a folder
 * in the hint.
 */
export function useFileDrop({
	onFiles,
	folderName,
}: {
	onFiles: (files: File[], folderId: string | null) => void;
	folderName: (folderId: string) => string;
}) {
	const t = useTranslator(mediaMessages);
	const [dragging, setDragging] = useState(false);
	const [target, setTarget] = useState<string | null>(null);

	useEffect(() => {
		if (!dragging) {
			toast.dismiss(HINT);
			return;
		}
		toast.dropHint(
			target === null ? (
				t("drop.here")
			) : (
				<>
					{t("drop.intoBefore")}
					<b>{folderName(target)}</b>
					{t("drop.intoAfter")}
				</>
			),
			{ id: HINT, icon: <Upload aria-hidden size={16} /> },
		);
	}, [dragging, target, t, folderName]);
	useEffect(() => () => void toast.dismiss(HINT), []);

	const end = () => {
		setDragging(false);
		setTarget(null);
	};
	const over = (event: DragEvent, folderId: string | null) => {
		if (!isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		setDragging(true);
		setTarget(folderId);
	};
	const drop = (event: DragEvent, folderId: string | null) => {
		if (!isFileDrag(event)) return;
		event.preventDefault();
		event.stopPropagation();
		const files = Array.from(event.dataTransfer.files ?? []);
		end();
		if (files.length > 0) onFiles(files, folderId);
	};

	return {
		/** Files are over the open folder, and not over a folder tile in it. */
		over: dragging && target === null,
		/** The folder tile the files are over. */
		target,
		area: {
			onDragEnter: (event: DragEvent) => over(event, null),
			onDragOver: (event: DragEvent) => over(event, null),
			onDragLeave: (event: DragEvent) => {
				if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) end();
			},
			onDrop: (event: DragEvent) => drop(event, null),
		},
		/** The handlers of the tile of the folder `id`. */
		folder: (id: string) => ({
			onDragEnter: (event: DragEvent) => over(event, id),
			onDragOver: (event: DragEvent) => over(event, id),
			onDragLeave: (event: DragEvent) => {
				if (!isFileDrag(event)) return;
				event.stopPropagation();
				if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)))
					setTarget(null);
			},
			onDrop: (event: DragEvent) => drop(event, id),
		}),
	};
}
