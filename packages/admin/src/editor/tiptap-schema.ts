import { createTranslator } from "@monti-cms/core/client";
import { Node } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Table, TableCell, TableHeader, TableRow, TableView } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import type { EditorView } from "@tiptap/pm/view";
import { CmsCodeBlock } from "./code-block";
import { CodeFoldMark } from "./code-block/code-fold-mark";
import { CodeTooltipMark } from "./code-block/code-tooltip-mark";
import { editorMessages } from "./messages";
import { CmsUntranslatedMark } from "./untranslated-mark";

const t = createTranslator(editorMessages);

/**
 * A read-only box that preserves CMS blocks not in the Tiptap schema (math, chart, callout, tabs, mermaid, merged tables, etc.).
 *
 * `attrs.source` holds the stored string (MDX) of that subtree. On save, the box is parsed
 * again and spliced back in, so the content never changes (nodes are never silently deleted).
 * As an `atom`, the inside of the box is not editable; it can only be selected and deleted as a whole.
 */
export const CmsOpaqueBlock = Node.create({
	name: "cmsOpaqueBlock",
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,
	addAttributes() {
		return {
			source: { default: "" },
			label: { default: t("opaqueBlock.label") },
		};
	},
	parseHTML() {
		return [
			{
				tag: "div[data-cms-opaque]",
				getAttrs: (element) => ({
					source: element.getAttribute("data-source") ?? "",
					label: element.getAttribute("data-label") ?? t("opaqueBlock.label"),
				}),
			},
		];
	},
	renderHTML({ node }) {
		const source = String(node.attrs.source ?? "");
		const label = String(node.attrs.label ?? t("opaqueBlock.label"));
		return [
			"div",
			{
				"data-cms-opaque": "",
				"data-source": source,
				"data-label": label,
				class:
					"my-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 cms-dark:border-neutral-700 cms-dark:bg-neutral-900",
			},
			[
				"div",
				{ class: "text-xs font-medium text-neutral-500 cms-dark:text-neutral-400" },
				t("opaqueBlock.editInSource", { label }),
			],
			["pre", { class: "mt-2 overflow-x-auto whitespace-pre-wrap text-xs" }, source],
		];
	},
});

/**
 * Inline and alignment extensions for the new representation contract.
 *
 * Write commands are enabled — the editor saves through the `toDocument`/`serialize` path,
 * so the read/write switch is atomic.
 *
 * `alignments` does not include `justify`. The public renderer supports only `left`, `center`, and `right` with fixed classes.
 * Tiptap internally uses inline `style` (extension default) but the stored format is `:::text-align{align=...}`.
 */
export const CmsTextAlign = TextAlign.configure({
	types: ["heading", "paragraph"],
	alignments: ["left", "center", "right"],
	defaultAlignment: null,
});

export const CmsSuperscript = Superscript;
export const CmsSubscript = Subscript;

/**
 * Carries the `meta` of the code fence info string (` ```ts title="..." `) and annotations (underline, tooltip).
 * StarterKit's code block has only `language`, so `meta` would silently disappear,
 * so this extension is used with StarterKit's turned off (`codeBlock: false`).
 */
export { CmsCodeBlock };

/**
 * A table NodeView that does not revert to the stored width while a column width is being dragged.
 * The default TableView re-applies the stored column width on every re-render (`update`). The dragged width exists only in the DOM,
 * so if the editor re-renders mid-drag (e.g. when React re-render resets options), it flickers back and forth with the stored value.
 * On release, prosemirror-tables writes the width into the document, and later re-renders apply it as usual.
 */
class CmsTableView extends TableView {
	private readonly editorView?: EditorView;

	constructor(node: PmNode, cellMinWidth: number, view?: EditorView, HTMLAttributes?: Record<string, unknown>) {
		super(node, cellMinWidth, view, HTMLAttributes);
		this.editorView = view;
	}

	update(node: PmNode): boolean {
		if (node.type !== this.node.type) return false;
		if (this.editorView && columnResizingPluginKey.getState(this.editorView.state)?.dragging) {
			this.node = node;
			return true;
		}
		const updated = super.update(node);
		this.clearStaleColumnWidths(node);
		return updated;
	}

	/**
	 * Clears the stale `width` left on the `<col>` of a column with no width. Tiptap's column update only puts `min-width`
	 * on a column with no width and leaves `width` as is. So even after "fill width" it still looks like the old width, and once dragging starts,
	 * prosemirror-tables clears the old widths all at once and the table jumps.
	 */
	private clearStaleColumnWidths(node: PmNode) {
		const row = node.firstChild;
		if (!row) return;
		const widths: Array<number | undefined> = [];
		row.forEach((cell) => {
			const { colspan, colwidth } = cell.attrs as { colspan: number; colwidth: number[] | null };
			for (let index = 0; index < colspan; index += 1) widths.push(colwidth?.[index] || undefined);
		});
		Array.from(this.colgroup.children).forEach((col, index) => {
			if (!widths[index] && col instanceof HTMLElement && col.style.width) col.style.width = "";
		});
	}
}

/**
 * Table (basic table with row/column add/delete, cell merging, column widths).
 * A table with adjusted column widths is stored as a `::::table{widths="..."}` directive.
 * Dragging within `handleWidth` (px) on either side of a column boundary adjusts the width. The default 5px was hard to grab, so it is widened.
 */
export const CmsTable = Table.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			// Carries GFM column alignment (`:-:` etc.). Not used on screen, only on save.
			align: { default: null, rendered: false },
		};
	},
	addProseMirrorPlugins() {
		return [
			...(this.parent?.() ?? []),
			// While a column width is being dragged, block transactions that only change the selection. prosemirror-tables' width-resize mousedown does
			// not report it as handled, so cell selection (tableEditing) also starts. If the drag moves to another cell (especially a row above or below),
			// the cell selection changes, and each time the table re-renders with the stored width and flickers back and forth with the dragged width.
			new Plugin({
				key: new PluginKey("cmsTableResizeSelectionGuard"),
				filterTransaction: (tr, state) =>
					tr.docChanged || !tr.selectionSet || !columnResizingPluginKey.getState(state)?.dragging,
			}),
		];
	},
}).configure({ resizable: true, allowTableNodeSelection: true, handleWidth: 10, View: CmsTableView });

/** `- [ ]` and `- [x]` checklists. */
export const CmsTaskItem = TaskItem.configure({ nested: true });

export const CMS_SCHEMA_EXTENSIONS = [
	CmsTable,
	TableRow,
	TableHeader,
	TableCell,
	TaskList,
	CmsTaskItem,
	CmsTextAlign,
	CmsSuperscript,
	CmsSubscript,
	CmsUntranslatedMark,
	CmsOpaqueBlock,
	CodeFoldMark,
	CodeTooltipMark,
	CmsCodeBlock,
];
