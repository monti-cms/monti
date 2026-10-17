/**
 * Image and file insertion of the visual editor: the image dialog state (opened from the slash menu, the toolbar, paste and drop),
 * inserting the chosen image, the file picker, and uploading attachments as file cards.
 */

import { newBlockId } from "@monti-cms/core/document";
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorText } from "../api/client";
import { mediaNotConfiguredMessage } from "../api/error-message";
import { useAdminEvents } from "../events";
import type { TranslatorFor } from "../translator";
import type { EditorAllowance } from "./allowed";
import { BLOCK_ID_ATTRIBUTE } from "./block-ids";
import { FILE_NODE_NAME } from "./file-node";
import type { ImageInsertion } from "./image-insert-dialog";
import { runImageInserted } from "./image-inserted";
import type { editorMessages } from "./messages";
import { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./slash-command";
import { uploadAttachment } from "./upload-helper";

const NO_SUBSCRIBERS: readonly never[] = [];

/** The first image file in a clipboard or drop payload. */
export const imageFileFrom = (source: DataTransferItemList | FileList | null): File | null => {
	if (!source) return null;
	for (let i = 0; i < source.length; i++) {
		const entry = source[i];
		const file = entry instanceof File ? entry : entry?.kind === "file" ? entry.getAsFile() : null;
		if (file?.type.startsWith("image/")) return file;
	}
	return null;
};

/** The non-image files of a drop payload. */
export const attachmentsFrom = (list: FileList | null): File[] =>
	Array.from(list ?? []).filter((file) => !file.type.startsWith("image/"));

export function useMediaInsertion({
	editor,
	site,
	t,
	media,
	allowance,
	canEdit,
}: {
	editor: Editor | null;
	site: Site;
	t: TranslatorFor<typeof editorMessages>;
	/** Whether media storage is configured. */
	media: boolean;
	allowance: EditorAllowance;
	canEdit: boolean;
}) {
	const [imageDialog, setImageDialog] = useState<{ file: File | null } | null>(null);
	/** The `editor.imageInserted` subscribers of the plugins. Drop, paste, the slash menu and the toolbar all insert through the image dialog, so one place runs them. */
	const imageInserted = useAdminEvents().editor?.imageInserted ?? NO_SUBSCRIBERS;

	useEffect(() => {
		const open = () => setImageDialog({ file: null });
		window.addEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
		return () => window.removeEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
	}, []);

	const insertImage = useCallback(
		(image: ImageInsertion) => {
			if (!editor) return;
			// The block id is given here so the subscribers find the image again after the insert, wherever it moves.
			const blockId = newBlockId();
			editor
				.chain()
				.focus()
				.insertContent({
					type: "image",
					// A registered media item stores only `mediaId`. The renderer resolves the public URL.
					attrs: {
						[BLOCK_ID_ATTRIBUTE]: blockId,
						mediaId: image.mediaId,
						alt: image.alt,
						decorative: image.decorative || null,
						caption: image.caption,
						width: "100%",
						align: "center",
					},
				})
				.run();
			setImageDialog(null);
			runImageInserted({
				editor,
				blockId,
				subscribers: imageInserted,
				site,
				marker: t("imageNode.marker"),
				failed: t("imageNode.generateFailed"),
			});
		},
		[editor, imageInserted, site, t],
	);

	const fileInputRef = useRef<HTMLInputElement>(null);

	// Slash menu "File": open the file picker. If there is no media storage, report that uploading is not possible.
	useEffect(() => {
		const open = () => {
			if (!media) toast.error(mediaNotConfiguredMessage(site));
			else fileInputRef.current?.click();
		};
		window.addEventListener(OPEN_FILE_PICKER_EVENT, open);
		return () => window.removeEventListener(OPEN_FILE_PICKER_EVENT, open);
	}, [media, site]);

	/** Upload non-image files and insert them as file cards. If `at` is given, insert there (where it was dropped). */
	const uploadAttachments = useCallback(
		async (files: File[], at?: number) => {
			if (!editor) return;
			if (!media) {
				toast.error(mediaNotConfiguredMessage(site));
				return;
			}
			let position = at;
			for (const file of files) {
				const toastId = toast.loading(t("toolbar.uploading", { name: file.name }));
				try {
					const { mediaId } = await uploadAttachment(site, file, (percent) =>
						toast.loading(t("toolbar.uploadingPercent", { name: file.name, percent }), { id: toastId }),
					);
					const node = { type: FILE_NODE_NAME, attrs: { mediaId, label: null } };
					if (position === undefined) editor.chain().focus().insertContent(node).run();
					else {
						editor.chain().focus().insertContentAt(position, node).run();
						position = editor.state.selection.to;
					}
					toast.success(t("toolbar.uploaded", { name: file.name }), { id: toastId });
				} catch (error) {
					toast.error(t("toolbar.uploadFailed", { name: file.name }), {
						id: toastId,
						// The reason, when there is one the person can read (the title already says it failed).
						description: errorText(site, error, "") || undefined,
					});
				}
			}
		},
		[editor, media, site, t],
	);

	/** A pasted image opens the image dialog. */
	const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
		const file = imageFileFrom(event.clipboardData.items);
		if (file && canEdit && allowance.allowsBlock("image")) {
			event.preventDefault();
			setImageDialog({ file });
		}
	};

	/** A dropped image opens the image dialog; other files are inserted as file cards where they are dropped. */
	const handleDrop = (event: DragEvent<HTMLElement>) => {
		if (!canEdit || !editor) return;
		const file = imageFileFrom(event.dataTransfer.files);
		if (file && allowance.allowsBlock("image")) {
			event.preventDefault();
			setImageDialog({ file });
			return;
		}
		const attachments = attachmentsFrom(event.dataTransfer.files);
		if (attachments.length > 0 && allowance.allowsBlock("file")) {
			event.preventDefault();
			const at = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
			void uploadAttachments(attachments, at);
		}
	};

	return {
		imageDialog,
		/** Whether something fills in the image text after the insert, so the dialog can leave alt text empty. */
		fillsImageText: imageInserted.length > 0,
		openImageDialog: () => setImageDialog({ file: null }),
		closeImageDialog: () => setImageDialog(null),
		insertImage,
		fileInputRef,
		uploadAttachments,
		handlePaste,
		handleDrop,
	};
}
