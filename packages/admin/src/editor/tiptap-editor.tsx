"use client";

import { emptyStoredDocument, type StoredDocument } from "@monti-cms/core/document";
import { type BodyAllowed, useSite, useTranslator } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
	type EditorInsertAction,
	type EditorSelectionAction,
	useAdminComponents,
	useSourceFormat,
} from "../admin-components";
import { commonMessages } from "../lib/common.messages";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { editorAllowance } from "./allowed";
import { ALLOWED_BYPASS_META } from "./allowed-extension";
import { deleteBlock, duplicateBlock, moveBlock } from "./block-commands";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { CodeLinkBar } from "./code-block/code-link-bar";
import { documentKey } from "./document-key";
import { startMarquee } from "./drag";
import { EditorWidthMenu, useEditorWidth } from "./editor-width";
import { buildEditorExtensions } from "./extensions";
import { ImageInsertDialog } from "./image-insert-dialog";
import { InlineBubble, useMarkExtensions } from "./inline-bubble";
import { InternalLinkPopup } from "./internal-link-popup";
import type { LinkDraft } from "./link-form";
import { editorMessages } from "./messages";
import { filterCommands } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { TableToolbar } from "./table-toolbar";
import { boxPreviewOf, storedToTiptap, tiptapToStored } from "./tiptap-content";
import { buildToolbarEntries } from "./toolbar-entries";
import { ToolbarRow } from "./toolbar-row";
import { ALIGN_TOOLS, BLOCK_STYLES, inlineTools, LIST_STYLES, scriptTools } from "./toolbar-tools";
import { useBlockHandle } from "./use-block-handle";
import { useInternalLinkMenu } from "./use-internal-link-menu";
import { useMediaInsertion } from "./use-media-insertion";
import { useSlashMenu } from "./use-slash-menu";

interface CmsEditorProps {
	/** The body. The editor shows it; a change that did not come from the editor itself replaces what it shows (the blocks keep the ids the document gives them). */
	doc: StoredDocument;
	/** The body as the editor holds it after every change, as a stored document with the editor's block ids. */
	onChange: (doc: StoredDocument) => void;
	/** Title input for the document being edited. Placed below the formatting tools, above the body. */
	titleField?: ReactNode;
	/** Document action menu placed at the end of the formatting tools. */
	toolbarEnd?: ReactNode;
	/** Right end of the toolbar, apart from the formatting tools (view switch, etc.). */
	toolbarAside?: ReactNode;
	/** When given, shown in place of the body (source editing, etc.) and visual editing is paused. The toolbar and title stay as they are. */
	sourceView?: ReactNode;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	/** False when the state is not editable, such as the trash. */
	editable?: boolean;
	/** Extra actions beside the block handle (e.g. "Translate" on a translation). Shown only when usable on that block. */
	blockActions?: readonly BlockAction[];
	/** Called when the editor is created or destroyed (for document-wide actions from outside). */
	onEditor?: (editor: Editor | null) => void;
	/** Actions to add to the selection menu (plugins). */
	selectionActions?: readonly EditorSelectionAction[];
	/** Insert actions to add to the slash menu (plugins). */
	insertActions?: readonly EditorInsertAction[];
	/**
	 * The blocks, marks and heading levels the body allows (`body` of the collection in the schema). The editor offers and accepts only these (toolbar, menus,
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
	toolbarEnd,
	toolbarAside,
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
	const tc = useTranslator(commonMessages);
	// What the body's allowed list lets a writer add. A body that already holds more still opens and saves as it is.
	const allowance = useMemo(() => editorAllowance(site, allowed), [site, allowed]);
	const isSourceMode = sourceView != null && sourceView !== false;
	// Text-style extensions (block extension `:tooltip`, etc.). Provide shapes, formatting tools, and slash menu items.
	const { marks: markSpecs = {} } = useAdminComponents();
	const allMarkExtensions = useMarkExtensions().filter(({ name }) => allowance.allowsEditorMark(name));
	// While source is being edited, the visual editor is paused. Toolbar tools are locked too.
	const canEdit = editable && !isSourceMode;
	const { media } = useAdminFeatures();
	// A body opened in source mode may be unparsable. The visual editor starts as an empty document and is filled when returning.
	const sourceFormat = useSourceFormat();
	const boxPreview = useMemo(() => boxPreviewOf(sourceFormat), [sourceFormat]);
	const [initialContent] = useState(() =>
		storedToTiptap(site, isSourceMode ? emptyStoredDocument() : doc, { boxPreview }),
	);
	const isInternalUpdateRef = useRef(false);
	// Width of the element at the right end of the toolbar. Leave this much space on both sides so the tool group stays centered.
	const asideRef = useRef<HTMLDivElement>(null);
	const [asideWidth, setAsideWidth] = useState(72);
	useEffect(() => {
		const element = asideRef.current;
		if (!element) return;
		const measure = () => setAsideWidth(Math.ceil(element.getBoundingClientRect().width));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});
	const isComposingRef = useRef(false);
	const editorRef = useRef<Editor | null>(null);
	const { steps: widthSteps, step: widthStep, choose: chooseWidth } = useEditorWidth();

	const slashMenu = useSlashMenu({ site, allowance, insertActions, markExtensions: allMarkExtensions, editorRef });
	const linkMenu = useInternalLinkMenu({ site, t, editorRef });
	const { slash, slashRangeRef, extraCommands, inlineCommands, closeSlash } = slashMenu;
	const { link, linkItems, isLinkLoading, linkError, closeLink, chooseLink } = linkMenu;

	const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);

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
					"prose cms-dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-cms-foreground text-base leading-relaxed selection:bg-cms-primary/20 " +
					// Table column resize handle (prosemirror-tables columnResizing)
					"[&_.tableWrapper]:overflow-x-auto [&_td]:relative [&_th]:relative [&.resize-cursor]:cursor-col-resize [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-px [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:-bottom-px [&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-cms-primary " +
					// Same look as the column-split boundary: a thin line + a small handle above the first row.
					"[&_tr:first-child_.column-resize-handle]:after:absolute [&_tr:first-child_.column-resize-handle]:after:top-0.5 [&_tr:first-child_.column-resize-handle]:after:left-1/2 [&_tr:first-child_.column-resize-handle]:after:h-3 [&_tr:first-child_.column-resize-handle]:after:w-6 [&_tr:first-child_.column-resize-handle]:after:-translate-x-1/2 [&_tr:first-child_.column-resize-handle]:after:rounded-full [&_tr:first-child_.column-resize-handle]:after:border [&_tr:first-child_.column-resize-handle]:after:bg-cms-popover [&_tr:first-child_.column-resize-handle]:after:shadow-sm " +
					// Block selection (marquee): lay a box with margin (-inset-1) after the line and hide the text selection highlight. List items cover the bullet too.
					// To avoid confusion with text selection (primary purple), show "a block is selected" with a different color (sky) and border.
					"[&_.cms-block-selected]:relative [&_.cms-block-selected]:isolate [&_.cms-block-selected]:before:pointer-events-none [&_.cms-block-selected]:before:absolute [&_.cms-block-selected]:before:-inset-1 [&_.cms-block-selected]:before:-z-10 [&_.cms-block-selected]:before:rounded-md [&_.cms-block-selected]:before:bg-sky-500/10 [&_.cms-block-selected]:before:ring-1 [&_.cms-block-selected]:before:ring-sky-500/35 cms-dark:[&_.cms-block-selected]:before:bg-sky-400/15 cms-dark:[&_.cms-block-selected]:before:ring-sky-400/40 [&_li.cms-block-selected]:before:-left-7 [&.cms-block-range]:selection:bg-transparent " +
					// Dragging across cells to select several (CellSelection) paints the selected cells. The range to merge is visible.
					"[&_.selectedCell]:bg-cms-primary/15 [&_.selectedCell]:outline-1 [&_.selectedCell]:-outline-offset-1 [&_.selectedCell]:outline-cms-primary/60",
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

	// Only text-style extensions in this editor schema (blocks the site uses) render tools.
	const markExtensions = allMarkExtensions.filter(({ name }) => !editor || editor.schema.marks[name]);
	const markNames = markExtensions.map(({ name }) => name);

	// When the selection or applied formatting changes, update dropdown names and active indicators (table tools are subscribed separately by TableToolbar).
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return "";
			const selection = current.state.selection;
			const active = [
				...BLOCK_STYLES(t),
				...inlineTools(site),
				...scriptTools(site),
				...ALIGN_TOOLS(t),
				...LIST_STYLES(t),
			]
				.map((item) => (item.isActive?.(current) ? "1" : "0"))
				.join("");
			const marks = ["link", ...markNames].map((mark) => (current.isActive(mark) ? "1" : "0")).join("");
			return `${active}${marks}:${current.isActive("table") ? "table" : ""}:${selection.from}:${selection.to}:${selection instanceof CellSelection}`;
		},
	});

	// The names of the current block and list come from every kind, also the ones the list no longer offers: a body keeps what it holds.
	const blockStyle = editor
		? (BLOCK_STYLES(t).find((item) => item.isActive?.(editor))?.label ?? t("toolbar.paragraph"))
		: t("toolbar.paragraph");
	const activeList = editor ? LIST_STYLES(t).find((item) => item.isActive?.(editor)) : undefined;
	const activeAlign = editor ? ALIGN_TOOLS(t).find((item) => item.isActive?.(editor)) : undefined;

	const { handleSpot, setHandleSpot, handleMouseMove, handleDragStart, handleDragEnd } = useBlockHandle(editor);
	const {
		imageDialog,
		openImageDialog,
		closeImageDialog,
		insertImage,
		fileInputRef,
		uploadAttachments,
		handlePaste,
		handleDrop,
	} = useMediaInsertion({ editor, site, t, media, allowance, canEdit });
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

	const withBlock = (pos: number, action: (current: Editor, pos: number) => boolean) => () => {
		if (!editor) return;
		editor.commands.focus();
		action(editor, pos);
	};

	if (!editor) return null;

	const toolbarEntries = buildToolbarEntries({
		editor,
		site,
		t,
		tc,
		allowance,
		canEdit,
		markExtensions,
		blockStyle,
		activeList,
		activeAlign,
		linkDraft,
		setLinkDraft,
		openImageDialog,
		openFilePicker: () => fileInputRef.current?.click(),
	});

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and block hover state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-cms-background"
			data-cms-editor-shell
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
			<div
				role="toolbar"
				aria-label={t("toolbar.format")}
				className="sticky top-0 z-10 w-full shrink-0 overflow-x-auto border-b bg-cms-background/95 backdrop-blur"
			>
				{/* The tool group is centered in the toolbar. Leave the same space on both sides as the width of the right-end element,
				        and if still narrow (e.g. when the translation source column is open), keep one line and fold less-used tools into "More". */}
				<div className="relative flex min-h-12 items-center py-2" style={{ paddingInline: asideWidth + 24 }}>
					<ToolbarRow editor={editor} entries={toolbarEntries} end={toolbarEnd} />
					<div ref={asideRef} className="absolute inset-y-0 right-4 flex items-center gap-1">
						{toolbarAside}
						<EditorWidthMenu steps={widthSteps} value={widthStep} onChange={chooseWidth} />
					</div>
				</div>
				{!isSourceMode && <CodeLinkBar editor={editor} />}
			</div>

			{titleField && (
				<div className="mx-auto w-full max-w-(--editor-width) border-cms-border/60 border-b px-4 pt-12 pb-5">
					{titleField}
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={site.api.FILE_ACCEPT}
				hidden
				aria-hidden
				tabIndex={-1}
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = "";
					void uploadAttachments(files);
				}}
			/>

			<ImageInsertDialog
				open={imageDialog !== null}
				initialFile={imageDialog?.file ?? null}
				onClose={() => closeImageDialog()}
				onInsert={insertImage}
			/>

			{isSourceMode && (
				<div className="mx-auto flex w-full max-w-(--editor-width) flex-1 flex-col px-4 pt-6 pb-[35vh]">
					{sourceView}
				</div>
			)}

			{/* Even in source mode the visual editor is hidden rather than torn down. On return, the source is re-read and filled in. */}
			{/* biome-ignore lint/a11y: canvas click focuses the rich text editor */}
			<div
				hidden={isSourceMode}
				// Leave bottom margin (35% of screen height) so the last line does not stick to the bottom of the screen.
				className="mx-auto flex min-h-full w-full max-w-(--editor-width) flex-1 cursor-text flex-col px-4 pt-6 pb-[35vh]"
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
					coords={slash.coords}
					selectedIndex={slash.index}
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
					coords={handleSpot}
					onMoveUp={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, -1))}
					onMoveDown={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, 1))}
					onDuplicate={withBlock(handleSpot.pos, duplicateBlock)}
					onDelete={() => {
						withBlock(handleSpot.pos, deleteBlock)();
						setHandleSpot(null);
					}}
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
