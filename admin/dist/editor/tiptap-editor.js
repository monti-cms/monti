"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cmsApiUrl, createTranslator, FILE_ACCEPT, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import { CellSelection } from "@tiptap/pm/tables";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Heading2, Heading3, Heading4, ImageIcon, Link2, List, ListOrdered, ListTodo, Minus, Paperclip, Pilcrow, Quote, RemoveFormatting, SquareCode, Superscript, Table2, Upload, } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, } from "react";
import { toast } from "sonner";
import { useCmsAdminComponents } from "../admin-components.js";
import { MEDIA_NOT_CONFIGURED } from "../screens/api-error-message.js";
import { useAdminFeatures } from "../screens/shared/admin-features.js";
import { Button } from "../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Toggle } from "../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.js";
import { deleteBlock, duplicateBlock, moveBlock } from "./block-commands.js";
import { BlockHandleOverlay } from "./block-handle-overlay.js";
import { CodeLinkBar } from "./code-block/code-link-bar.js";
import { CustomBlockMenu, CustomBlockMenuItems } from "./custom-block-menu.js";
import { endBlockDrag, findBlockDOM, refineBlock, resolveTargetBlock, startBlockDrag, startMarquee } from "./drag/index.js";
import { EDITOR_WIDTHS, EditorWidthMenu, useEditorWidth } from "./editor-width.js";
import { buildEditorExtensions } from "./extensions.js";
import { FILE_NODE_NAME } from "./file-node.js";
import { ImageInsertDialog } from "./image-insert-dialog.js";
import { InlineBubble, useMarkExtensions } from "./inline-bubble.js";
import { INLINE_MARK_TOOLS } from "./inline-marks.js";
import { insertInternalLink, parseInternalLinkTrigger } from "./internal-link.js";
import { InternalLinkPopup } from "./internal-link-popup.js";
import { LinkForm, linkDraftFromSelection } from "./link-form.js";
import { editorMessages } from "./messages.js";
import { filterCommands, OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT, } from "./slash-command.js";
import { SlashMenuPopup } from "./slash-menu-popup.js";
import { TableToolbar } from "./table-toolbar.js";
import { mdxToTiptap, tiptapToMdx } from "./tiptap-content.js";
import { ToolbarButton } from "./toolbar-button.js";
import { ToolbarMenuGroup, ToolbarMenuItem, ToolbarMenuSection, ToolbarRow } from "./toolbar-row.js";
import { uploadAttachment } from "./upload-helper.js";
const t = createTranslator(editorMessages);
const chain = (editor) => editor.chain().focus();
/** Block shape dropdown. The current block's shape name becomes the dropdown name. */
const BLOCK_STYLES = [
    {
        label: t("toolbar.paragraph"),
        icon: Pilcrow,
        isActive: (e) => e.isActive("paragraph"),
        run: (e) => chain(e).setParagraph().run(),
    },
    ...[2, 3, 4].map((level) => ({
        label: `H${level}`,
        title: t("toolbar.heading", { level }),
        icon: { 2: Heading2, 3: Heading3, 4: Heading4 }[level],
        isActive: (e) => e.isActive("heading", { level }),
        run: (e) => chain(e).setHeading({ level }).run(),
    })),
];
/** Superscript/subscript marks, rarely used and grouped into one dropdown. */
const SCRIPT_MARKS = ["superscript", "subscript"];
const INLINE_TOOLS = INLINE_MARK_TOOLS.filter((tool) => !SCRIPT_MARKS.includes(tool.mark));
const SCRIPT_TOOLS = INLINE_MARK_TOOLS.filter((tool) => SCRIPT_MARKS.includes(tool.mark));
/** Order in which text-style buttons are hidden (largest first). Marks not listed get 5. Bold and italic are never hidden. */
const INLINE_PRIORITY = { bold: 0, italic: 0, strike: 6, code: 4, underline: 5 };
const PINNED_INLINE_MARKS = ["bold", "italic"];
const ALIGN_TOOLS = [
    {
        label: t("toolbar.alignLeft"),
        title: t("toolbar.alignLeftTitle"),
        icon: AlignLeft,
        isActive: (e) => e.isActive({ textAlign: "left" }),
        run: (e) => chain(e).setTextAlign("left").run(),
    },
    {
        label: t("toolbar.alignCenter"),
        title: t("toolbar.alignCenterTitle"),
        icon: AlignCenter,
        isActive: (e) => e.isActive({ textAlign: "center" }),
        run: (e) => chain(e).setTextAlign("center").run(),
    },
    {
        label: t("toolbar.alignRight"),
        title: t("toolbar.alignRightTitle"),
        icon: AlignRight,
        isActive: (e) => e.isActive({ textAlign: "right" }),
        run: (e) => chain(e).setTextAlign("right").run(),
    },
    {
        label: t("toolbar.alignAuto"),
        title: t("toolbar.alignAutoTitle"),
        icon: RemoveFormatting,
        run: (e) => chain(e).unsetTextAlign().run(),
    },
];
/** List dropdown. The current block's list type becomes the dropdown name and icon. */
const LIST_STYLES = [
    {
        label: t("toolbar.bulletLabel"),
        title: t("toolbar.bullet"),
        icon: List,
        isActive: (e) => e.isActive("bulletList"),
        run: (e) => chain(e).toggleBulletList().run(),
    },
    {
        label: t("toolbar.orderedLabel"),
        title: t("toolbar.ordered"),
        icon: ListOrdered,
        isActive: (e) => e.isActive("orderedList"),
        run: (e) => chain(e).toggleOrderedList().run(),
    },
    {
        label: t("toolbar.todoLabel"),
        title: t("toolbar.todo"),
        icon: ListTodo,
        isActive: (e) => e.isActive("taskList"),
        run: (e) => chain(e).toggleTaskList().run(),
    },
];
/** Block insert buttons and the order they are hidden (largest first). Lists are 2, components are 4. */
const INSERT_TOOLS = [
    {
        priority: 6,
        tool: {
            label: t("toolbar.quoteLabel"),
            title: t("toolbar.quote"),
            icon: Quote,
            isActive: (e) => e.isActive("blockquote"),
            run: (e) => chain(e).toggleBlockquote().run(),
        },
    },
    {
        priority: 3,
        tool: {
            label: t("toolbar.codeBlock"),
            icon: SquareCode,
            isActive: (e) => e.isActive("codeBlock"),
            run: (e) => chain(e).toggleCodeBlock().run(),
        },
    },
    {
        priority: 7,
        tool: {
            label: t("toolbar.table"),
            icon: Table2,
            run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
    },
];
const DIVIDER_TOOL = {
    label: t("toolbar.divider"),
    icon: Minus,
    run: (e) => chain(e).setHorizontalRule().run(),
};
/** Toolbar slot name for a text-style extension (`mark:<block name>`). */
const markToolKey = (group, name) => `mark-${group}:${name}`;
/**
 * Toolbar order. Paragraph shape → text styles (including extension styles) → attached to text (links, extension styles) → lists and alignment → block insert.
 * Document-level tools (templates, extensions, source, MDX, width) are placed on the right (`toolbarAside`) by the edit screen. Items not listed here are appended at the end in their original order.
 * `mark-format:*` and `mark-link:*` are in the order the extensions added them.
 */
const TOOLBAR_ORDER = [
    "block-style",
    "divider-block",
    ...INLINE_TOOLS.map((tool) => tool.mark),
    "mark-format:*",
    "script",
    "divider-inline",
    "link",
    "mark-link:*",
    "divider-list",
    "list",
    "align",
    "divider-insert",
    ...INSERT_TOOLS.map(({ tool }) => tool.label),
    "divider-tool",
    "upload",
    "custom-block",
];
const orderToolbar = (entries) => {
    const rank = (key) => {
        const group = /^(mark-(?:format|link)):/.exec(key)?.[1];
        const index = TOOLBAR_ORDER.indexOf(group ? `${group}:*` : key);
        return index < 0 ? TOOLBAR_ORDER.length : index;
    };
    // Keep the original order within the same slot (Array.prototype.sort is stable).
    return [...entries].sort((a, b) => rank(a.key) - rank(b.key));
};
function ToolbarDropdown({ editor, label, items, icon: Icon, iconOnly = false, }) {
    const content = (_jsxs(_Fragment, { children: [Icon && _jsx(Icon, { "aria-hidden": true, className: "size-4" }), !iconOnly && label, _jsx(ChevronDown, { "aria-hidden": true, className: "size-3" })] }));
    return (_jsxs(DropdownMenu, { children: [iconOnly ? (_jsx(IconButton, { label: label, side: "bottom", size: "sm", className: "h-8 gap-1 px-1.5 text-xs", disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: content })) : (_jsx(DropdownMenuTrigger, { render: _jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "h-8 gap-1 px-2 text-xs", "aria-label": label, disabled: !editor.isEditable, onMouseDown: (event) => event.preventDefault() }), children: content })), _jsx(DropdownMenuContent, { align: "start", className: "min-w-36", children: items.map((item) => (_jsx(ToolbarMenuItem, { editor: editor, item: item }, item.label))) })] }));
}
async function searchLinkTargets(query) {
    const search = async (collection) => {
        const params = new URLSearchParams({ collection, pageSize: "25" });
        if (query)
            params.set("search", query);
        for (const status of ["draft", "published"])
            params.append("status", status);
        const res = await fetch(cmsApiUrl(`/v1/entries?${params.toString()}`));
        if (!res.ok)
            return [];
        const data = (await res.json());
        return data.items.map((item) => ({
            id: item.id,
            collection: item.collection,
            title: item.title || t("toolbar.untitled"),
            slug: item.slug ?? "",
            status: item.status,
        }));
    };
    // Find only collections that have a public path (ones a body link can point to).
    const results = await Promise.all(LINKABLE_COLLECTIONS.map(search));
    return results.flat().slice(0, 20);
}
/** Handle width (px) and gap from the block. BlockHandleOverlay places a 24px button at `left - 32`. */
const HANDLE_OFFSET = 32;
const HANDLE_WIDTH = 24;
/**
 * Anchor point for attaching the handle.
 * - List items attach to the left of the list (outside the bullet) so the bullet is not covered. Indented items attach to their indentation.
 * - When the handle of a block inside a bordered container (callout, fold, tabs, columns) would sit on its left border,
 *   move it to the container's outside handle position (align on the same vertical line).
 */
const handleAnchor = (block, rect) => {
    const isListItem = block.tagName === "LI" || block.getAttribute("data-type") === "taskItem";
    const list = isListItem ? block.parentElement : null;
    let left = list ? list.getBoundingClientRect().left : rect.left;
    const framed = block.parentElement?.closest("[data-cms-framed]");
    if (framed) {
        const edge = framed.getBoundingClientRect().left;
        const handleLeft = left - HANDLE_OFFSET;
        if (handleLeft <= edge + 1 && handleLeft + HANDLE_WIDTH >= edge - 1)
            left = edge;
    }
    return { top: rect.top, left };
};
const sameSpot = (a, b) => !!a && a.top === b.top && a.left === b.left && a.pos === b.pos;
export function CmsEditor({ content, onChange, titleField, toolbarEnd, toolbarAside, sourceView, onCompositionStart, onCompositionEnd, editable = true, blockActions, onEditor, selectionActions, insertActions, }) {
    const isSourceMode = sourceView != null && sourceView !== false;
    // Text-style extensions (block extension `:tooltip`, etc.). Provide shapes, formatting tools, and slash menu items.
    const { marks: markSpecs = {} } = useCmsAdminComponents();
    const allMarkExtensions = useMarkExtensions();
    // While source is being edited, the visual editor is paused. Toolbar tools are locked too.
    const canEdit = editable && !isSourceMode;
    const { media } = useAdminFeatures();
    // A body opened in source mode may be unparsable. The visual editor starts as an empty document and is filled when returning.
    const [initialContent] = useState(() => mdxToTiptap(isSourceMode ? "" : content));
    const isInternalUpdateRef = useRef(false);
    // Width of the element at the right end of the toolbar. Leave this much space on both sides so the tool group stays centered.
    const asideRef = useRef(null);
    const [asideWidth, setAsideWidth] = useState(72);
    useEffect(() => {
        const element = asideRef.current;
        if (!element)
            return;
        const measure = () => setAsideWidth(Math.ceil(element.getBoundingClientRect().width));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    });
    const isComposingRef = useRef(false);
    const editorRef = useRef(null);
    const [width, setWidth] = useEditorWidth();
    const [slash, setSlash] = useState(null);
    const slashRangeRef = useRef(null);
    // Slash menu items added by extensions (plugins). Also kept in a ref so the key handler reads the latest value.
    const extraCommands = useMemo(() => (insertActions ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        keywords: [...item.keywords],
        ...(item.icon ? { icon: item.icon } : {}),
        action: (current, range) => item.run(current, range),
    })), [insertActions]);
    const extraCommandsRef = useRef(extraCommands);
    extraCommandsRef.current = extraCommands;
    // Slash menu items of text-style extensions (after the default text format items).
    const inlineCommands = allMarkExtensions.flatMap(({ extension }) => (extension.insertActions ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        keywords: [...item.keywords],
        ...(item.icon ? { icon: item.icon } : {}),
        action: (current, range) => item.run(current, range),
    })));
    const inlineCommandsRef = useRef(inlineCommands);
    inlineCommandsRef.current = inlineCommands;
    const slashRef = useRef(slash);
    slashRef.current = slash;
    const [link, setLink] = useState(null);
    const [linkItems, setLinkItems] = useState([]);
    const [isLinkLoading, setIsLinkLoading] = useState(false);
    const linkRangeRef = useRef(null);
    const linkRef = useRef(link);
    linkRef.current = link;
    const linkItemsRef = useRef(linkItems);
    linkItemsRef.current = linkItems;
    const [handleSpot, setHandleSpot] = useState(null);
    const activeBlockRectRef = useRef(null);
    const activeBlockPosRef = useRef(null);
    const activeBlockElRef = useRef(null);
    const [imageDialog, setImageDialog] = useState(null);
    const [linkDraft, setLinkDraft] = useState(null);
    const syncTriggerPopup = (current) => {
        if (isComposingRef.current)
            return;
        const { from } = current.state.selection;
        const textBefore = current.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");
        const linkMatch = parseInternalLinkTrigger(textBefore);
        if (linkMatch.active) {
            linkRangeRef.current = { from: from - linkMatch.query.length - 2, to: from };
            setLink({ query: linkMatch.query, index: 0, coords: current.view.coordsAtPos(from) });
            setSlash(null);
            return;
        }
        setLink(null);
        // Open the `/` menu only at the start of an empty paragraph. A path inside a sentence (`a/b`) is not mistaken for a command.
        const slashMatch = textBefore.match(/(?:^|\n)\/([^\s/]*)$/);
        if (!slashMatch || current.isActive("codeBlock")) {
            setSlash(null);
            return;
        }
        const query = slashMatch[1] ?? "";
        slashRangeRef.current = { from: from - query.length - 1, to: from };
        setSlash({ query, index: 0, coords: current.view.coordsAtPos(from) });
    };
    const chooseLink = (item) => {
        const current = editorRef.current;
        if (!current || !linkRangeRef.current)
            return;
        insertInternalLink(current, linkRangeRef.current, item);
        setLink(null);
    };
    const editor = useEditor({
        immediatelyRender: false,
        editable: canEdit,
        extensions: buildEditorExtensions(markSpecs),
        content: initialContent,
        editorProps: {
            attributes: {
                "aria-label": t("toolbar.editorLabel"),
                class: "prose cms-dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-cms-foreground text-base leading-relaxed selection:bg-cms-primary/20 " +
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
                if (view.composing || event.isComposing || event.keyCode === 229)
                    return false;
                const openLink = linkRef.current;
                if (openLink) {
                    const items = linkItemsRef.current;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const step = event.key === "ArrowDown" ? 1 : -1;
                        setLink({ ...openLink, index: items.length ? (openLink.index + step + items.length) % items.length : 0 });
                        return true;
                    }
                    if (event.key === "Enter") {
                        const selected = items[openLink.index];
                        if (!selected) {
                            setLink(null);
                            return false;
                        }
                        event.preventDefault();
                        chooseLink(selected);
                        return true;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setLink(null);
                        return true;
                    }
                }
                const openSlash = slashRef.current;
                if (openSlash) {
                    const filtered = filterCommands(openSlash.query, extraCommandsRef.current, inlineCommandsRef.current);
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const step = event.key === "ArrowDown" ? 1 : -1;
                        const size = Math.max(1, filtered.length);
                        setSlash({ ...openSlash, index: (openSlash.index + step + size) % size });
                        return true;
                    }
                    if (event.key === "Enter") {
                        const command = filtered[openSlash.index];
                        if (!command || !slashRangeRef.current || !editorRef.current) {
                            setSlash(null);
                            return false;
                        }
                        event.preventDefault();
                        command.action(editorRef.current, slashRangeRef.current);
                        setSlash(null);
                        return true;
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setSlash(null);
                        return true;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor: current }) => {
            if (isInternalUpdateRef.current)
                return;
            onChange(tiptapToMdx(current.getJSON()));
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
            if (!current)
                return "";
            const selection = current.state.selection;
            const active = [...BLOCK_STYLES, ...INLINE_TOOLS, ...SCRIPT_TOOLS, ...ALIGN_TOOLS, ...LIST_STYLES]
                .map((item) => (item.isActive?.(current) ? "1" : "0"))
                .join("");
            const marks = ["link", ...markNames].map((mark) => (current.isActive(mark) ? "1" : "0")).join("");
            return `${active}${marks}:${current.isActive("table") ? "table" : ""}:${selection.from}:${selection.to}:${selection instanceof CellSelection}`;
        },
    });
    const blockStyle = editor
        ? (BLOCK_STYLES.find((item) => item.isActive?.(editor))?.label ?? t("toolbar.paragraph"))
        : t("toolbar.paragraph");
    const activeList = editor ? LIST_STYLES.find((item) => item.isActive?.(editor)) : undefined;
    const activeAlign = editor ? ALIGN_TOOLS.find((item) => item.isActive?.(editor)) : undefined;
    useEffect(() => {
        editorRef.current = editor;
        if (!editor || isSourceMode)
            return;
        // Node views are re-rendered by React, so do not change it directly inside the effect (flushSync warning). E.g. when returning from source mode.
        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled || editor.isDestroyed)
                return;
            // The comparison basis is the stored string (MDX) — comparing Tiptap JSON objects breaks due to key order.
            if (tiptapToMdx(editor.getJSON()) === content)
                return;
            isInternalUpdateRef.current = true;
            editor.commands.setContent(mdxToTiptap(content), { emitUpdate: false });
            isInternalUpdateRef.current = false;
        });
        return () => {
            cancelled = true;
        };
    }, [content, editor, isSourceMode]);
    // Toolbar tools read editor.isEditable while rendering. After changing the lock, render once more to sync tool state.
    const [, rerender] = useReducer((count) => count + 1, 0);
    useEffect(() => {
        if (!editor || editor.isEditable === canEdit)
            return;
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
    const linkQuery = link?.query;
    useEffect(() => {
        if (linkQuery === undefined)
            return;
        let cancelled = false;
        setIsLinkLoading(true);
        const timer = setTimeout(() => {
            searchLinkTargets(linkQuery)
                .then((items) => {
                if (!cancelled)
                    setLinkItems(items);
            })
                .catch(() => {
                if (!cancelled)
                    setLinkItems([]);
            })
                .finally(() => {
                if (!cancelled)
                    setIsLinkLoading(false);
            });
        }, 200);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [linkQuery]);
    useEffect(() => {
        const open = () => setImageDialog({ file: null });
        window.addEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
        return () => window.removeEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
    }, []);
    const insertImage = useCallback((image) => {
        editor
            ?.chain()
            .focus()
            .insertContent({
            type: "image",
            // A registered media item stores only `mediaId`. The renderer resolves the public URL.
            attrs: {
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
    }, [editor]);
    const imageFileFrom = (source) => {
        if (!source)
            return null;
        for (let i = 0; i < source.length; i++) {
            const entry = source[i];
            const file = entry instanceof File ? entry : entry?.kind === "file" ? entry.getAsFile() : null;
            if (file?.type.startsWith("image/"))
                return file;
        }
        return null;
    };
    const fileInputRef = useRef(null);
    // Slash menu "파일": open the file picker. If there is no media storage, report that uploading is not possible.
    useEffect(() => {
        const open = () => {
            if (!media)
                toast.error(MEDIA_NOT_CONFIGURED);
            else
                fileInputRef.current?.click();
        };
        window.addEventListener(OPEN_FILE_PICKER_EVENT, open);
        return () => window.removeEventListener(OPEN_FILE_PICKER_EVENT, open);
    }, [media]);
    /** Upload non-image files and insert them as file cards. If `at` is given, insert there (where it was dropped). */
    const uploadAttachments = useCallback(async (files, at) => {
        if (!editor)
            return;
        if (!media) {
            toast.error(MEDIA_NOT_CONFIGURED);
            return;
        }
        let position = at;
        for (const file of files) {
            const toastId = toast.loading(t("toolbar.uploading", { name: file.name }));
            try {
                const { mediaId } = await uploadAttachment(file, (percent) => toast.loading(t("toolbar.uploadingPercent", { name: file.name, percent }), { id: toastId }));
                const node = { type: FILE_NODE_NAME, attrs: { mediaId, label: null } };
                if (position === undefined)
                    editor.chain().focus().insertContent(node).run();
                else {
                    editor.chain().focus().insertContentAt(position, node).run();
                    position = editor.state.selection.to;
                }
                toast.success(t("toolbar.uploaded", { name: file.name }), { id: toastId });
            }
            catch (error) {
                toast.error(t("toolbar.uploadFailed", { name: file.name }), {
                    id: toastId,
                    description: error instanceof Error ? error.message : undefined,
                });
            }
        }
    }, [editor, media]);
    const attachmentsFrom = (list) => Array.from(list ?? []).filter((file) => !file.type.startsWith("image/"));
    const handleMouseMove = useCallback((event) => {
        if (!editor)
            return;
        const root = editor.view.dom;
        // Do not change the target on the way from a block to the left handle (left margin of the block, list indentation).
        // Otherwise the target switches to the whole list while moving from a list item to the handle.
        const active = activeBlockRectRef.current;
        if (active && event.clientX < active.left && event.clientY >= active.top && event.clientY <= active.bottom)
            return;
        const found = findBlockDOM(root, event.target);
        if (!found)
            return;
        const block = refineBlock(found, event.clientX, event.clientY);
        try {
            const resolved = resolveTargetBlock(editor.view, block);
            if (!resolved)
                return;
            activeBlockPosRef.current = resolved.pos;
            activeBlockRectRef.current = resolved.rect;
            activeBlockElRef.current = block;
            const spot = { ...handleAnchor(block, resolved.rect), pos: resolved.pos };
            // Do not change state at the same position. If the editor re-renders on every mouse move (useEditor
            // resets options), node views update and things like table column resize dragging get shaky.
            setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
        }
        catch {
            // Ignore if the DOM is just being replaced.
        }
    }, [editor]);
    // The handle floats at a fixed screen position. On scroll it follows the block, and hides if the block is gone.
    // Otherwise a stale handle remains next to a wrong block after scrolling, so it looks like the same item has two handles.
    const hasHandle = handleSpot !== null;
    useEffect(() => {
        if (!hasHandle || !editor)
            return;
        const follow = () => {
            const element = activeBlockElRef.current;
            const pos = activeBlockPosRef.current;
            if (!element?.isConnected || pos === null) {
                setHandleSpot(null);
                return;
            }
            const rect = element.getBoundingClientRect();
            activeBlockRectRef.current = rect;
            const spot = { ...handleAnchor(element, rect), pos };
            setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
        };
        window.addEventListener("scroll", follow, true);
        window.addEventListener("resize", follow);
        return () => {
            window.removeEventListener("scroll", follow, true);
            window.removeEventListener("resize", follow);
        };
    }, [hasHandle, editor]);
    const handleDragStart = useCallback((pos, event) => {
        if (!editor)
            return;
        startBlockDrag(editor.view, pos, event);
    }, [editor]);
    const handleDragEnd = useCallback(() => {
        if (!editor)
            return;
        endBlockDrag(editor.view);
    }, [editor]);
    const onEditorRef = useRef(onEditor);
    onEditorRef.current = onEditor;
    useEffect(() => {
        onEditorRef.current?.(editor);
        return () => onEditorRef.current?.(null);
    }, [editor]);
    const withBlock = (pos, action) => () => {
        if (!editor)
            return;
        editor.commands.focus();
        action(editor, pos);
    };
    if (!editor)
        return null;
    const buttonSlot = (item, key, priority, fixed = false) => ({
        key,
        priority,
        fixed,
        render: () => _jsx(ToolbarButton, { editor: editor, item: item }),
        menu: () => _jsx(ToolbarMenuItem, { editor: editor, item: item }),
    });
    const dropdownSlot = (key, priority, label, items, icon, menuLabel = label) => ({
        key,
        priority,
        render: () => _jsx(ToolbarDropdown, { editor: editor, label: label, items: items, icon: icon, iconOnly: true }),
        menu: () => _jsx(ToolbarMenuGroup, { editor: editor, label: menuLabel, items: items }),
    });
    const UploadMenuItems = () => (_jsxs(_Fragment, { children: [_jsxs(DropdownMenuItem, { disabled: !canEdit, onClick: () => setImageDialog({ file: null }), children: [_jsx(ImageIcon, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "flex-1", children: t("toolbar.image") })] }), _jsxs(DropdownMenuItem, { disabled: !canEdit, onClick: () => fileInputRef.current?.click(), children: [_jsx(Paperclip, { "aria-hidden": true, className: "size-4" }), _jsx("span", { className: "flex-1", children: t("toolbar.file") })] })] }));
    // Order to hide when narrow: larger priority first. fixed is never hidden (popover tools lose their anchor inside the menu).
    // The placement order is decided by `TOOLBAR_ORDER` below.
    const unordered = [
        {
            key: "block-style",
            priority: 0,
            fixed: true,
            render: () => _jsx(ToolbarDropdown, { editor: editor, label: blockStyle, items: BLOCK_STYLES }),
        },
        dropdownSlot("align", 9, t("toolbar.align"), ALIGN_TOOLS, activeAlign?.icon ?? AlignLeft),
        { key: "divider-block", divider: true },
        ...INLINE_TOOLS.map((tool) => buttonSlot(tool, tool.mark, INLINE_PRIORITY[tool.mark] ?? 5, PINNED_INLINE_MARKS.includes(tool.mark))),
        // Formatting tools of text-style extensions (block extension text color, tooltip, etc.).
        ...markExtensions.flatMap(({ name, extension }) => {
            const tool = extension.toolbar;
            if (!tool)
                return [];
            const { Button, MenuItems } = tool;
            return [
                {
                    key: markToolKey(tool.group, name),
                    priority: tool.priority ?? 0,
                    fixed: tool.priority === undefined || !MenuItems,
                    render: () => _jsx(Button, { editor: editor }),
                    ...(MenuItems ? { menu: () => _jsx(MenuItems, { editor: editor }) } : {}),
                },
            ];
        }),
        dropdownSlot("script", 8, t("toolbar.script"), SCRIPT_TOOLS, Superscript),
        { key: "divider-inline", divider: true },
        { key: "divider-list", divider: true },
        { key: "divider-insert", divider: true },
        dropdownSlot("list", 2, activeList?.title ?? t("toolbar.list"), LIST_STYLES, activeList?.icon ?? List, t("toolbar.list")),
        ...INSERT_TOOLS.map(({ tool, priority }) => buttonSlot(tool, tool.label, priority)),
        {
            key: "custom-block",
            priority: 4,
            render: () => _jsx(CustomBlockMenu, { editor: editor }),
            menu: () => (_jsx(ToolbarMenuSection, { label: t("toolbar.components"), children: _jsx(CustomBlockMenuItems, { editor: editor }) })),
        },
        {
            key: "upload",
            // Hide later than underline (5). With the same priority, right-hand tools hide first.
            priority: 4,
            render: () => (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("toolbar.upload"), side: "bottom", disabled: !canEdit, onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx(Upload, { className: "size-4", "aria-hidden": true }) }), _jsx(DropdownMenuContent, { align: "start", className: "w-40", children: _jsx(UploadMenuItems, {}) })] })),
            menu: () => _jsx(UploadMenuItems, {}),
        },
        {
            key: "link",
            priority: 0,
            fixed: true,
            render: () => (_jsxs(Popover, { open: linkDraft !== null, onOpenChange: (open) => setLinkDraft(open ? linkDraftFromSelection(editor) : null), children: [_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx(PopoverTrigger, { render: _jsx(Toggle, { size: "sm", pressed: editor.isActive("link"), disabled: !canEdit, "aria-label": t("toolbar.link"), onMouseDown: (event) => event.preventDefault(), className: "size-8 p-0" }), children: _jsx(Link2, { "aria-hidden": true, className: "size-4" }) }) }), _jsx(TooltipContent, { side: "bottom", children: t("toolbar.link") })] }), _jsx(PopoverContent, { align: "start", className: "w-80", children: linkDraft && _jsx(LinkForm, { editor: editor, draft: linkDraft, onDone: () => setLinkDraft(null) }) })] })),
        },
        buttonSlot(DIVIDER_TOOL, "divider-tool", 8),
    ];
    const toolbarEntries = orderToolbar(unordered);
    return (_jsxs("div", { className: "relative flex min-h-full w-full flex-1 flex-col bg-cms-background", "data-cms-editor-shell": true, 
        // Title, body, and source use the same width (`--editor-width`).
        style: { "--editor-width": EDITOR_WIDTHS[width] }, onCompositionStart: (event) => {
            // Composition in an input inside a popover (portal) reaches here through the React tree but is not body input.
            // If that input disappeared during composition, the end signal never came and saving was blocked.
            if (!event.currentTarget.contains(event.target))
                return;
            isComposingRef.current = true;
            onCompositionStart?.();
        }, onCompositionEnd: () => {
            isComposingRef.current = false;
            syncTriggerPopup(editor);
            onCompositionEnd?.();
        }, onMouseMove: handleMouseMove, onMouseDown: (event) => {
            // Pressing and dragging in the empty margin outside the body selects blocks with a marquee. The editor's inner margin
            // is handled by the block selection plugin. Interactive elements such as formatting tools, title input, buttons, and portals (popovers) are excluded.
            const target = event.target;
            if (!canEdit || !event.currentTarget.contains(target) || editor.view.dom.contains(target))
                return;
            if (target.closest('input, textarea, button, select, a, [role="toolbar"], [contenteditable="true"]'))
                return;
            startMarquee(editor.view, event.nativeEvent);
        }, children: [_jsxs("div", { role: "toolbar", "aria-label": t("toolbar.format"), className: "sticky top-0 z-10 w-full shrink-0 overflow-x-auto border-b bg-cms-background/95 backdrop-blur", children: [_jsxs("div", { className: "relative flex min-h-12 items-center py-2", style: { paddingInline: asideWidth + 24 }, children: [_jsx(ToolbarRow, { editor: editor, entries: toolbarEntries, end: toolbarEnd }), _jsxs("div", { ref: asideRef, className: "absolute inset-y-0 right-4 flex items-center gap-1", children: [toolbarAside, _jsx(EditorWidthMenu, { value: width, onChange: setWidth })] })] }), !isSourceMode && _jsx(CodeLinkBar, { editor: editor })] }), titleField && (_jsx("div", { className: "mx-auto w-full max-w-(--editor-width) border-cms-border/60 border-b px-4 pt-12 pb-5", children: titleField })), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: FILE_ACCEPT, hidden: true, "aria-hidden": true, tabIndex: -1, onChange: (event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void uploadAttachments(files);
                } }), _jsx(ImageInsertDialog, { open: imageDialog !== null, initialFile: imageDialog?.file ?? null, onClose: () => setImageDialog(null), onInsert: insertImage }), isSourceMode && (_jsx("div", { className: "mx-auto flex w-full max-w-(--editor-width) flex-1 flex-col px-4 pt-6 pb-[35vh]", children: sourceView })), _jsx("div", { hidden: isSourceMode, 
                // Leave bottom margin (35% of screen height) so the last line does not stick to the bottom of the screen.
                className: "mx-auto flex min-h-full w-full max-w-(--editor-width) flex-1 cursor-text flex-col px-4 pt-6 pb-[35vh]", onClick: (event) => {
                    // Move to the end only when the empty canvas outside the body is clicked. Clicks on NodeView buttons and popovers (portals)
                    // also bubble up here through the React tree, so leave the body DOM and anything outside the canvas (portals) alone.
                    const target = event.target;
                    if (!event.currentTarget.contains(target) || editor.view.dom.contains(target))
                        return;
                    if (!editor.isFocused)
                        editor.chain().focus("end").run();
                }, onPaste: (event) => {
                    const file = imageFileFrom(event.clipboardData.items);
                    if (file && canEdit) {
                        event.preventDefault();
                        setImageDialog({ file });
                    }
                }, onDrop: (event) => {
                    if (!canEdit)
                        return;
                    const file = imageFileFrom(event.dataTransfer.files);
                    if (file) {
                        event.preventDefault();
                        setImageDialog({ file });
                        return;
                    }
                    // Non-image files are inserted as file cards where they are dropped.
                    const attachments = attachmentsFrom(event.dataTransfer.files);
                    if (attachments.length > 0) {
                        event.preventDefault();
                        const at = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
                        void uploadAttachments(attachments, at);
                    }
                }, onDragOver: (event) => event.preventDefault(), children: _jsx(EditorContent, { editor: editor, className: "flex min-h-full flex-1 flex-col [&>.ProseMirror]:min-h-[calc(100vh-240px)] [&>.ProseMirror]:flex-1" }) }), slash && !isSourceMode && (_jsx(SlashMenuPopup, { items: filterCommands(slash.query, extraCommands, inlineCommands), coords: slash.coords, selectedIndex: slash.index, onSelect: (command) => {
                    if (slashRangeRef.current)
                        command.action(editor, slashRangeRef.current);
                    setSlash(null);
                }, onClose: () => {
                    setSlash(null);
                    editor.chain().focus().run();
                } })), link && !isSourceMode && (_jsx(InternalLinkPopup, { items: linkItems, isLoading: isLinkLoading, coords: link.coords, selectedIndex: link.index, onSelect: chooseLink, onClose: () => {
                    setLink(null);
                    editor.chain().focus().run();
                } })), !isSourceMode && (_jsxs(_Fragment, { children: [_jsx(TableToolbar, { editor: editor }), _jsx(InlineBubble, { editor: editor, actions: selectionActions })] })), handleSpot && canEdit && (_jsx(BlockHandleOverlay, { coords: handleSpot, onMoveUp: withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, -1)), onMoveDown: withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, 1)), onDuplicate: withBlock(handleSpot.pos, duplicateBlock), onDelete: () => {
                    withBlock(handleSpot.pos, deleteBlock)();
                    setHandleSpot(null);
                }, onDragStart: (event) => handleDragStart(handleSpot.pos, event), onDragEnd: handleDragEnd, actions: (blockActions ?? [])
                    .filter((action) => action.isAvailable(editor, handleSpot.pos))
                    .map((action) => ({
                    id: action.id,
                    label: action.label,
                    icon: action.icon,
                    busy: action.isBusy?.(handleSpot.pos) ?? false,
                    onClick: () => action.run(editor, handleSpot.pos),
                })) }))] }));
}
