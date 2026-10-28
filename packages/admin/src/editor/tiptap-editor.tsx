"use client";

import { emptyStoredDocument, type StoredDocument } from "@monti-cms/core/document";
import { type BodyAllowed, useSite, useTranslator } from "@monti-cms/core/site";
import { Stack } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
	type EditorInsertAction,
	type EditorSelectionAction,
	useAdminComponents,
	useSourceFormat,
} from "../admin-components";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { editorAllowance } from "./allowed";
import { ALLOWED_BYPASS_META } from "./allowed-extension";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { CodeLinkBar } from "./code-block/code-link-bar";
import { documentKey } from "./document-key";
import { startMarquee } from "./drag";
import { EditorWidthMenu, useEditorWidth } from "./editor-width";
import { buildEditorExtensions } from "./extensions";
import { MediaPickerDialog } from "./image-insert-dialog";
import { InlineBubble, useMarkExtensions } from "./inline-bubble";
import { InternalLinkPopup } from "./internal-link-popup";
import { editorMessages } from "./messages";
import { filterCommands } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { useSlashTemplates } from "./slash-templates";
import { TableToolbar } from "./table-toolbar";
import { boxPreviewOf, storedToTiptap, tiptapToStored } from "./tiptap-content";
import { useBlockHandle } from "./use-block-handle";
import { useInternalLinkMenu } from "./use-internal-link-menu";
import { useMediaInsertion } from "./use-media-insertion";
import { useSlashMenu } from "./use-slash-menu";

interface CmsEditorProps {
	/** The body. The editor shows it; a change that did not come from the editor itself replaces what it shows (the blocks keep the ids the document gives them). */
	doc: StoredDocument;
	/** The body as the editor holds it after every change, as a stored document with the editor's block ids. */
	onChange: (doc: StoredDocument) => void;
	/** Title input for the document being edited. Placed above the body. */
	titleField?: ReactNode;
	/** Document-wide tools (view switches, a button that writes a draft), a row of buttons at the top right of the body next to the width menu. There is no toolbar. */
	tools?: ReactNode;
	/** The "/" menu lists the body templates, and a chosen one goes in at the cursor. Off where a template is being written. */
	templates?: boolean;
	/** When given, shown in place of the body (source editing, etc.) and visual editing is paused. The title stays as it is. */
	sourceView?: ReactNode;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	/** False when the state is not editable, such as the trash. */
	editable?: boolean;
	/** Extra actions in the block menu (e.g. "Translate" on a translation). Shown only when usable on that block. */
	blockActions?: readonly BlockAction[];
	/** Called when the editor is created or destroyed (for document-wide actions from outside). */
	onEditor?: (editor: Editor | null) => void;
	/** Actions to add to the end of the format card (plugins). */
	selectionActions?: readonly EditorSelectionAction[];
	/** Insert actions to add to the slash menu (plugins). */
	insertActions?: readonly EditorInsertAction[];
	/**
	 * The blocks, marks and heading levels the body allows (`body` of the collection in the schema). The editor offers and accepts only these (menus, the format card,
	 * input rules, paste); a body that already holds something else still opens and saves unchanged. Without it, everything is allowed.
	 */
	allowed?: BodyAllowed;
}

/** Action beside the block handle. `pos` is the position of the block the handle points to. */
export interface BlockAction {
	id: string;
	label: string;
	icon: ReactNode;
	isAvailable: (editor: Editor, pos: number) => boolean;
	run: (editor: Editor, pos: number) => void;
	/** Whether the action is in progress on that block. */
	isBusy?: (pos: number) => boolean;
}

export function CmsEditor({
	doc,
	onChange,
	titleField,
	tools,
	templates = false,
	sourceView,
	onCompositionStart,
	onCompositionEnd,
	editable = true,
	blockActions,
	onEditor,
	selectionActions,
	insertActions,
	allowed,
}: CmsEditorProps) {
	const site = useSite();
	const t = useTranslator(editorMessages);
	// What the body's allowed list lets a writer add. A body that already holds more still opens and saves as it is.
	const allowance = useMemo(() => editorAllowance(site, allowed), [site, allowed]);
	const isSourceMode = sourceView != null && sourceView !== false;
	// Text-style extensions (block extension `:tooltip`, etc.). Provide shapes, formats for the format card, and slash menu items.
	const { marks: markSpecs = {} } = useAdminComponents();
	const allMarkExtensions = useMarkExtensions().filter(({ name }) => allowance.allowsEditorMark(name));
	// While source is being edited, the visual editor is paused.
	const canEdit = editable && !isSourceMode;
	const { media } = useAdminFeatures();
	// A body opened in source mode may be unparsable. The visual editor starts as an empty document and is filled when returning.
	const sourceFormat = useSourceFormat();
	const boxPreview = useMemo(() => boxPreviewOf(sourceFormat), [sourceFormat]);
	const [initialContent] = useState(() =>
		storedToTiptap(site, isSourceMode ? emptyStoredDocument() : doc, { boxPreview }),
	);
	const isInternalUpdateRef = useRef(false);
	const isComposingRef = useRef(false);
	const editorRef = useRef<Editor | null>(null);
	const { steps: widthSteps, step: widthStep, choose: chooseWidth } = useEditorWidth();

	const slashTemplates = useSlashTemplates({
		enabled: templates && site.ADMIN_TEMPLATES,
		site,
		allowance,
		boxPreview,
	});
	const slashMenu = useSlashMenu({
		site,
		allowance,
		insertActions,
		templateItems: slashTemplates.items,
		markExtensions: allMarkExtensions,
		editorRef,
	});
	const linkMenu = useInternalLinkMenu({ site, t, editorRef });
	const { slash, slashRangeRef, extraCommands, inlineCommands, closeSlash } = slashMenu;
	const { link, linkItems, isLinkLoading, linkError, closeLink, chooseLink } = linkMenu;

	// The template list is asked for the first time the menu opens.
	const slashOpen = slash !== null;
	const { ask: askTemplates } = slashTemplates;
	useEffect(() => {
		if (slashOpen) askTemplates();
	}, [slashOpen, askTemplates]);

	const syncTriggerPopup = (current: Editor) => {
		if (isComposingRef.current) return;
		const { from } = current.state.selection;
		const textBefore = current.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");
		if (linkMenu.syncLink(current, textBefore, from)) {
			closeSlash();
			return;
		}
		slashMenu.syncSlash(current, textBefore, from);
	};

	const editor = useEditor({
		immediatelyRender: false,
		editable: canEdit,
		extensions: buildEditorExtensions(site, markSpecs, allowance),
		content: initialContent,
		editorProps: {
			attributes: {
				"aria-label": t("toolbar.editorLabel"),
				class:
					"prose monti-dark:prose-invert max-w-none min-h-full flex-1 p-monti-24 focus:outline-none text-monti-default text-monti-reading selection:bg-monti-selected " +
					// Table column resize handle (prosemirror-tables columnResizing)
					"[&_.tableWrapper]:overflow-x-auto [&_td]:relative [&_th]:relative [&.resize-cursor]:cursor-col-resize [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-px [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:-bottom-px [&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-monti-emphasis " +
					// Same look as the column-split boundary: a thin line + a small handle above the first row.
					"[&_tr:first-child_.column-resize-handle]:after:absolute [&_tr:first-child_.column-resize-handle]:after:top-0.5 [&_tr:first-child_.column-resize-handle]:after:left-1/2 [&_tr:first-child_.column-resize-handle]:after:h-3 [&_tr:first-child_.column-resize-handle]:after:w-6 [&_tr:first-child_.column-resize-handle]:after:-translate-x-1/2 [&_tr:first-child_.column-resize-handle]:after:rounded-monti-sm [&_tr:first-child_.column-resize-handle]:after:border [&_tr:first-child_.column-resize-handle]:after:bg-monti-page " +
					// Block selection (marquee): lay a box with margin (-inset-1) after the line and hide the text selection highlight. List items cover the bullet too.
					// To avoid confusion with text selection (primary purple), show "a block is selected" with a different color (sky) and border.
					"[&_.monti-block-selected]:relative [&_.monti-block-selected]:isolate [&_.monti-block-selected]:before:pointer-events-none [&_.monti-block-selected]:before:absolute [&_.monti-block-selected]:before:-inset-1 [&_.monti-block-selected]:before:-z-10 [&_.monti-block-selected]:before:rounded-monti-md [&_.monti-block-selected]:before:bg-monti-selected [&_.monti-block-selected]:before:ring-1 [&_.monti-block-selected]:before:ring-monti-contrast/20 [&_li.monti-block-selected]:before:-left-7 [&.monti-block-range]:selection:bg-transparent " +
					// The empty line the cursor is on says how to add a block (`empty-hint.ts`).
					"[&[contenteditable=false]_.monti-empty-line]:before:hidden [&_.monti-empty-line]:before:pointer-events-none [&_.monti-empty-line]:before:float-left [&_.monti-empty-line]:before:h-0 [&_.monti-empty-line]:before:text-monti-faint [&_.monti-empty-line]:before:content-[attr(data-placeholder)] " +
					// The block whose handle menu is open has the block ground (`block-menu-mark.ts`), laid out like the block selection above.
					"[&_.monti-menu-open]:relative [&_.monti-menu-open]:isolate [&_.monti-menu-open]:before:pointer-events-none [&_.monti-menu-open]:before:absolute [&_.monti-menu-open]:before:-inset-x-2 [&_.monti-menu-open]:before:-inset-y-0.5 [&_.monti-menu-open]:before:-z-10 [&_.monti-menu-open]:before:rounded-monti-md [&_.monti-menu-open]:before:bg-monti-block [&_li.monti-menu-open]:before:-left-7 " +
					// Dragging across cells to select several (CellSelection) paints the selected cells. The range to merge is visible.
					"[&_.selectedCell]:bg-monti-selected [&_.selectedCell]:outline-1 [&_.selectedCell]:-outline-offset-1 [&_.selectedCell]:outline-monti-contrast",
			},
			handleKeyDown: (view, event) => {
				// Do not handle menu navigation or confirmation during Korean IME composition.
				if (view.composing || event.isComposing || event.keyCode === 229) return false;
				return linkMenu.handleKey(event) ?? slashMenu.handleKey(event) ?? false;
			},
		},
		onUpdate: ({ editor: current }) => {
			if (isInternalUpdateRef.current) return;
			const json = current.getJSON();
			onChange(tiptapToStored(site, json));
			syncTriggerPopup(current);
		},
		onSelectionUpdate: ({ editor: current }) => syncTriggerPopup(current),
	});

	const { handleSpot, setHandleSpot, handleMouseMove, handleDragStart, handleDragEnd } = useBlockHandle(editor);
	const { pickerProps, handlePaste, handleDrop } = useMediaInsertion({
		editor,
		site,
		t,
		media,
		allowance,
		canEdit,
	});
	useEffect(() => {
		editorRef.current = editor;
		if (!editor || isSourceMode) return;
		// Node views are re-rendered by React, so do not change it directly inside the effect (flushSync warning). E.g. when returning from source mode.
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || editor.isDestroyed) return;
			// Bodies are compared by what they say (`documentKey`): comparing Tiptap JSON objects breaks due to key order, and block ids are not content.
			if (documentKey(site, tiptapToStored(site, editor.getJSON())) === documentKey(site, doc)) return;
			// Blocks keep the ids the document gives them.
			const next = storedToTiptap(site, doc, { boxPreview });
			isInternalUpdateRef.current = true;
			// What is stored is shown as it is: the allowed list limits what a writer adds, never what a body already holds.
			editor.chain().setMeta(ALLOWED_BYPASS_META, true).setContent(next, { emitUpdate: false }).run();
			isInternalUpdateRef.current = false;
		});
		return () => {
			cancelled = true;
		};
	}, [doc, editor, isSourceMode, boxPreview, site]);

	// Toolbar tools read editor.isEditable while rendering. After changing the lock, render once more to sync tool state.
	const [, rerender] = useReducer((count: number) => count + 1, 0);
	useEffect(() => {
		if (!editor || editor.isEditable === canEdit) return;
		// Do not emit an update event. Otherwise, when switching to source mode, the paused visual document overwrites the body.
		editor.setEditable(canEdit, false);
		// Emit a transaction that does not change the document so node views (code block header tools, block tool row) re-render following the lock.
		// Emitting it directly inside the effect causes a flushSync warning while node views render, so defer it.
		queueMicrotask(() => {
			if (!editor.isDestroyed)
				editor.view.dispatch(editor.state.tr.setMeta("cmsEditable", canEdit).setMeta("addToHistory", false));
		});
		rerender();
	}, [canEdit, editor]);

	const onEditorRef = useRef(onEditor);
	onEditorRef.current = onEditor;
	useEffect(() => {
		onEditorRef.current?.(editor);
		return () => onEditorRef.current?.(null);
	}, [editor]);

	if (!editor) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and block hover state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-monti-page"
			data-monti-editor-shell
			// Title, body, and source use the same width (`--editor-width`).
			style={{ "--editor-width": widthStep.width } as CSSProperties}
			onCompositionStart={(event) => {
				// Composition in an input inside a popover (portal) reaches here through the React tree but is not body input.
				// If that input disappeared during composition, the end signal never came and saving was blocked.
				if (!event.currentTarget.contains(event.target as Node)) return;
				isComposingRef.current = true;
				onCompositionStart?.();
			}}
			onCompositionEnd={() => {
				isComposingRef.current = false;
				syncTriggerPopup(editor);
				onCompositionEnd?.();
			}}
			onMouseMove={handleMouseMove}
			onMouseDown={(event) => {
				// Pressing and dragging in the empty margin outside the body selects blocks with a marquee. The editor's inner margin
				// is handled by the block selection plugin. Interactive elements such as formatting tools, title input, buttons, and portals (popovers) are excluded.
				const target = event.target as HTMLElement;
				if (!canEdit || !event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
				if (target.closest('input, textarea, button, select, a, [role="toolbar"], [contenteditable="true"]')) return;
				startMarquee(editor.view, event.nativeEvent);
			}}
		>
			{!isSourceMode && (
				<Stack position="sticky" width="full" shrink={false} gap={0}>
					<CodeLinkBar editor={editor} />
				</Stack>
			)}

			<div className="mx-auto flex w-full max-w-(--editor-width) justify-end gap-monti-4 px-monti-16 pt-monti-8">
				{tools}
				<EditorWidthMenu steps={widthSteps} value={widthStep} onChange={chooseWidth} />
			</div>

			{titleField && (
				<div className="mx-auto w-full max-w-(--editor-width) px-monti-16 pt-monti-48 pb-monti-8">{titleField}</div>
			)}

			<MediaPickerDialog {...pickerProps} />

			{isSourceMode && (
				<div className="mx-auto flex w-full max-w-(--editor-width) flex-1 flex-col px-monti-16 pt-monti-24 pb-[35vh]">
					{sourceView}
				</div>
			)}

			{/* Even in source mode the visual editor is hidden rather than torn down. On return, the source is re-read and filled in. */}
			{/* biome-ignore lint/a11y: canvas click focuses the rich text editor */}
			<div
				hidden={isSourceMode}
				// Leave bottom margin (35% of screen height) so the last line does not stick to the bottom of the screen.
				className="mx-auto flex min-h-full w-full max-w-(--editor-width) flex-1 cursor-text flex-col px-monti-16 pt-monti-24 pb-[35vh]"
				onClick={(event) => {
					// Move to the end only when the empty canvas outside the body is clicked. Clicks on NodeView buttons and popovers (portals)
					// also bubble up here through the React tree, so leave the body DOM and anything outside the canvas (portals) alone.
					const target = event.target as Node;
					if (!event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
					if (!editor.isFocused) editor.chain().focus("end").run();
				}}
				onPaste={handlePaste}
				onDrop={handleDrop}
				onDragOver={(event) => event.preventDefault()}
			>
				<EditorContent
					editor={editor}
					className="flex min-h-full flex-1 flex-col [&>.ProseMirror]:min-h-[calc(100vh-240px)] [&>.ProseMirror]:flex-1"
				/>
			</div>

			{slash && !isSourceMode && (
				<SlashMenuPopup
					items={filterCommands(site, slash.query, extraCommands, inlineCommands, allowance)}
					query={slash.query}
					caret={slash.caret}
					selectedIndex={slash.index}
					onHighlight={slashMenu.highlight}
					onSelect={(command) => {
						if (slashRangeRef.current) command.action(editor, slashRangeRef.current);
						closeSlash();
					}}
					onClose={() => {
						closeSlash();
						editor.chain().focus().run();
					}}
				/>
			)}

			{link && !isSourceMode && (
				<InternalLinkPopup
					items={linkItems}
					isLoading={isLinkLoading}
					error={linkError}
					coords={link.coords}
					selectedIndex={link.index}
					onSelect={chooseLink}
					onClose={() => {
						closeLink();
						editor.chain().focus().run();
					}}
				/>
			)}

			{!isSourceMode && (
				<>
					<TableToolbar editor={editor} />
					<InlineBubble editor={editor} actions={selectionActions} />
				</>
			)}

			{handleSpot && canEdit && (
				<BlockHandleOverlay
					editor={editor}
					spot={handleSpot}
					onDeleted={() => setHandleSpot(null)}
					onDragStart={(event) => handleDragStart(handleSpot.pos, event)}
					onDragEnd={handleDragEnd}
					actions={(blockActions ?? [])
						.filter((action) => action.isAvailable(editor, handleSpot.pos))
						.map((action) => ({
							id: action.id,
							label: action.label,
							icon: action.icon,
							busy: action.isBusy?.(handleSpot.pos) ?? false,
							onClick: () => action.run(editor, handleSpot.pos),
						}))}
				/>
			)}
		</div>
	);
}
