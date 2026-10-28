import { newBlockId } from "@monti-cms/core/document";
import { type Site, useTranslator } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { type ClipboardEvent, type DragEvent, useCallback, useEffect, useState } from "react";
import { errorText } from "../api/client";
import { mediaNotConfiguredMessage } from "../api/error-message";
import type { TranslatorFor } from "../translator";
import type { EditorAllowance } from "./allowed";
import { BLOCK_ID_ATTRIBUTE, findBlock } from "./block-ids";
import { OPEN_MEDIA_PICKER_EVENT } from "./block-inserts";
import { FILE_NODE_NAME } from "./file-node";
import type { PickedMedia, PickerKind } from "./image-insert-dialog";
import { beginImageUpload, endImageUpload, setImageUploadPercent, uploadEditorImage } from "./image-upload";
import { editorMediaMessages } from "./media.messages";
import type { editorMessages } from "./messages";
import { uploadAttachment } from "./upload-helper";

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

/**
 * Images and files of the visual editor. A pasted or dropped image goes in at the cursor at once as an image that is going up, and becomes the real
 * image when the upload ends (no window in between). "/ Image" and "/ File" open the library picker; what is picked goes in at the cursor. A dropped file
 * that is not an image goes up with a notice and then becomes a file block.
 */
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
	const tm = useTranslator(editorMediaMessages);
	const [picker, setPicker] = useState<{ open: boolean; kind: PickerKind }>({ open: false, kind: "image" });
	useEffect(() => {
		const open = (event: Event) => {
			const kind = (event as CustomEvent<{ kind?: PickerKind }>).detail?.kind === "file" ? "file" : "image";
			setPicker({ open: true, kind });
		};
		window.addEventListener(OPEN_MEDIA_PICKER_EVENT, open);
		return () => window.removeEventListener(OPEN_MEDIA_PICKER_EVENT, open);
	}, []);

	/** A picked library image goes in at the cursor, with the library's default text. */
	const insertImage = useCallback(
		(image: PickedMedia) => {
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
						mediaId: image.id,
						alt: image.defaultAlt,
						caption: image.defaultCaption,
						width: "100%",
						align: "center",
					},
				})
				.run();
		},
		[editor],
	);

	const insertFile = useCallback(
		(mediaId: string, at?: number) => {
			if (!editor) return;
			const node = { type: FILE_NODE_NAME, attrs: { mediaId, label: null } };
			if (at === undefined) editor.chain().focus().insertContent(node).run();
			else editor.chain().focus().insertContentAt(at, node).run();
		},
		[editor],
	);

	/**
	 * Puts the file in at the cursor (or at `at`) as an image that is going up, uploads it, and then makes it the real image. If the upload fails the
	 * image goes away again and the reason is shown.
	 */
	const uploadImage = useCallback(
		async (file: File, options: { at?: number; folderId?: string | null } = {}) => {
			if (!editor) return;
			if (!media) {
				toast.error(mediaNotConfiguredMessage(site));
				return;
			}
			const blockId = newBlockId();
			const uploadId = newBlockId();
			const attrs = { [BLOCK_ID_ATTRIBUTE]: blockId, uploadId, alt: "", caption: "", width: "100%", align: "center" };
			beginImageUpload(uploadId, file);
			const chain = editor.chain().focus();
			if (options.at === undefined) chain.insertContent({ type: "image", attrs }).run();
			else chain.insertContentAt(options.at, { type: "image", attrs }).run();
			/** Changes the image in place, outside the undo history: undoing the insert takes the whole image away. */
			const settle = (change: (pos: number, node: PmNode) => void) => {
				if (editor.isDestroyed) return;
				const pos = findBlock(editor.state.doc, blockId);
				const node = pos === undefined ? null : editor.state.doc.nodeAt(pos);
				if (pos === undefined || !node) return;
				change(pos, node);
			};
			try {
				const uploaded = await uploadEditorImage(site, file, (percent) => setImageUploadPercent(uploadId, percent), {
					folderId: options.folderId ?? null,
				});
				settle((pos, node) => {
					editor.view.dispatch(
						editor.state.tr
							.setNodeMarkup(pos, undefined, {
								...node.attrs,
								uploadId: null,
								mediaId: uploaded.mediaId,
								alt: uploaded.defaultAlt,
								caption: uploaded.defaultCaption,
							})
							.setMeta("addToHistory", false),
					);
				});
			} catch (error) {
				settle((pos, node) => {
					editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize).setMeta("addToHistory", false));
				});
				toast.error([tm("imageNode.uploadFailed"), errorText(site, error, "")].filter(Boolean).join("\n"));
			} finally {
				endImageUpload(uploadId);
			}
		},
		[editor, media, site, tm],
	);

	/** Uploads non-image files and inserts them as file blocks. If `at` is given, inserts there (where they were dropped). */
	const uploadAttachments = useCallback(
		async (files: File[], at?: number) => {
			if (!editor) return;
			if (!media) {
				toast.error(mediaNotConfiguredMessage(site));
				return;
			}
			let position = at;
			for (const file of files) {
				const toastId = toast(t("toolbar.uploading", { name: file.name }), { duration: Number.POSITIVE_INFINITY });
				try {
					const { mediaId } = await uploadAttachment(site, file, (percent) =>
						toast(t("toolbar.uploadingPercent", { name: file.name, percent }), {
							id: toastId,
							duration: Number.POSITIVE_INFINITY,
						}),
					);
					insertFile(mediaId, position);
					if (position !== undefined) position = editor.state.selection.to;
					toast(t("toolbar.uploaded", { name: file.name }), { id: toastId });
				} catch (error) {
					// The reason, when there is one the person can read (the title already says it failed).
					const reason = errorText(site, error, "");
					toast.error([t("toolbar.uploadFailed", { name: file.name }), reason].filter(Boolean).join("\n"), {
						id: toastId,
					});
				}
			}
		},
		[editor, insertFile, media, site, t],
	);

	/** What the picker's "Upload" chose: images go in as a pasted image does, other files as file blocks. */
	const uploadFromPicker = useCallback(
		(files: File[], folderId: string | null) => {
			const images = files.filter((file) => file.type.startsWith("image/"));
			const others = files.filter((file) => !file.type.startsWith("image/"));
			for (const image of images) void uploadImage(image, { folderId });
			if (others.length > 0) void uploadAttachments(others);
		},
		[uploadImage, uploadAttachments],
	);

	const pickMedia = useCallback(
		(item: PickedMedia) => (picker.kind === "file" ? insertFile(item.id) : insertImage(item)),
		[picker.kind, insertFile, insertImage],
	);

	/** A pasted image goes in at the cursor. */
	const handlePaste = (event: ClipboardEvent<HTMLElement>) => {
		const file = imageFileFrom(event.clipboardData.items);
		if (file && canEdit && allowance.allowsBlock("image")) {
			event.preventDefault();
			void uploadImage(file);
		}
	};

	/** A dropped image goes in where it is dropped; other files go up and are inserted as file blocks there. */
	const handleDrop = (event: DragEvent<HTMLElement>) => {
		if (!canEdit || !editor) return;
		const at = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
		const file = imageFileFrom(event.dataTransfer.files);
		if (file && allowance.allowsBlock("image")) {
			event.preventDefault();
			void uploadImage(file, { at });
			return;
		}
		const attachments = attachmentsFrom(event.dataTransfer.files);
		if (attachments.length > 0 && allowance.allowsBlock("file")) {
			event.preventDefault();
			void uploadAttachments(attachments, at);
		}
	};

	return {
		/** The props of the picker dialog. */
		pickerProps: {
			open: picker.open,
			kind: picker.kind,
			onClose: () => setPicker((current) => ({ ...current, open: false })),
			onPick: pickMedia,
			onUpload: uploadFromPicker,
		},
		openImagePicker: () => setPicker({ open: true, kind: "image" }),
		openFilePicker: () => setPicker({ open: true, kind: "file" }),
		handlePaste,
		handleDrop,
	};
}
