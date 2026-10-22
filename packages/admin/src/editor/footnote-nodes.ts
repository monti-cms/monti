import { type Editor, Extension, mergeAttributes, Node, type Range } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, Selection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FOOTNOTE_REFERENCE_NAME = "footnoteReference";
export const FOOTNOTE_DEFINITION_NAME = "footnoteDefinition";

/** GFM matches labels case-insensitively, so numbering and lookups use this key. The stored label is never changed. */
export const footnoteKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

export const labelOf = (node: PmNode) => String(node.attrs.label ?? "");

/**
 * Display numbers: the order in which each label is first referenced in the document (what the public page shows too).
 * Keyed by `footnoteKey`. Definitions do not take part, so a definition nobody references has no number.
 */
export const footnoteNumbers = (doc: PmNode): Map<string, number> => {
	const numbers = new Map<string, number>();
	doc.descendants((node) => {
		if (node.type.name !== FOOTNOTE_REFERENCE_NAME) return;
		const key = footnoteKey(labelOf(node));
		if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
	});
	return numbers;
};

/** The next numeric label: one more than the largest number already used by a reference or a definition (labels like `note` are ignored). */
export const nextFootnoteLabel = (doc: PmNode): string => {
	let largest = 0;
	doc.descendants((node) => {
		if (node.type.name !== FOOTNOTE_REFERENCE_NAME && node.type.name !== FOOTNOTE_DEFINITION_NAME) return;
		const label = labelOf(node).trim();
		if (/^\d+$/.test(label)) largest = Math.max(largest, Number(label));
	});
	return String(largest + 1);
};

const labelAttribute = {
	default: "",
	parseHTML: (element: HTMLElement) => element.getAttribute("data-label") ?? "",
	renderHTML: (attributes: Record<string, unknown>) => ({ "data-label": String(attributes.label ?? "") }),
};

const REFERENCE_CLASS = [
	// The number comes from the `data-footnote-number` attribute that the numbering plugin sets.
	"mx-hair inline-block min-w-4 cursor-pointer select-none rounded-sm bg-monti-selected px-tight text-center align-super",
	// `em` on purpose: the number scales with the surrounding text it is a superscript of.
	"font-medium text-[0.7em] text-monti-default",
	"after:content-[attr(data-footnote-number)]",
	"data-[footnote-missing]:bg-monti-danger-muted data-[footnote-missing]:text-monti-danger",
	"[&.ProseMirror-selectednode]:ring-2 [&.ProseMirror-selectednode]:ring-monti-focus",
].join(" ");

/**
 * GFM footnote reference (`text[^label]`). A small superscript chip that is selected and deleted as a whole.
 * The number on the chip is the order of first reference (a decoration from `CmsFootnoteNumbers`); the stored label does not change.
 */
export const CmsFootnoteReference = Node.create({
	name: FOOTNOTE_REFERENCE_NAME,
	group: "inline",
	inline: true,
	atom: true,
	selectable: true,
	// The stored form has no place for formatting on a reference.
	marks: "",
	addAttributes() {
		return { label: labelAttribute };
	},
	parseHTML() {
		return [{ tag: "sup[data-footnote-ref]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["sup", mergeAttributes(HTMLAttributes, { "data-footnote-ref": "", class: REFERENCE_CLASS })];
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					handleClickOn(view, _pos, node, nodePos) {
						if (node.type.name === FOOTNOTE_REFERENCE_NAME) {
							view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
							return true;
						}
						return false;
					},
				},
			}),
		];
	},
});

/**
 * GFM footnote definition (`[^label]: content`). Hidden in the editor canvas (edited via popup),
 * but preserved in the document tree for GFM roundtrip and rendered at the document bottom on public pages.
 */
export const CmsFootnoteDefinition = Node.create({
	name: FOOTNOTE_DEFINITION_NAME,
	group: "block",
	content: "block+",
	defining: true,
	selectable: false,
	addAttributes() {
		return { label: labelAttribute };
	},
	parseHTML() {
		return [{ tag: "div[data-footnote-definition]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"div",
			mergeAttributes(HTMLAttributes, {
				"data-footnote-definition": "",
				class: "hidden",
				style: "display: none;",
				"aria-hidden": "true",
			}),
			0,
		];
	},
});

const numbersKey = new PluginKey<DecorationSet>("cmsFootnoteNumbers");

const buildDecorations = (doc: PmNode): DecorationSet => {
	const numbers = footnoteNumbers(doc);
	const defined = new Set<string>();
	const decorations: Decoration[] = [];
	// Definitions come first so a reference can be flagged when none exists.
	doc.descendants((node) => {
		if (node.type.name === FOOTNOTE_DEFINITION_NAME) defined.add(footnoteKey(labelOf(node)));
	});
	const seen = new Set<string>();
	doc.descendants((node, pos) => {
		if (node.type.name === FOOTNOTE_REFERENCE_NAME) {
			const key = footnoteKey(labelOf(node));
			decorations.push(
				Decoration.node(pos, pos + node.nodeSize, {
					"data-footnote-number": String(numbers.get(key) ?? ""),
					...(defined.has(key) ? {} : { "data-footnote-missing": "" }),
				}),
			);
		} else if (node.type.name === FOOTNOTE_DEFINITION_NAME) {
			const label = labelOf(node);
			const key = footnoteKey(label);
			const number = numbers.get(key);
			const attrs: Record<string, string> = {
				// A number alone when the label is the same; otherwise the label follows it. A definition nobody cites shows its label.
				"data-footnote-badge": number === undefined ? label : String(number) === label ? label : `${number} · ${label}`,
			};
			if (number === undefined) attrs["data-footnote-unused"] = "";
			if (seen.has(key)) attrs["data-footnote-duplicate"] = "";
			seen.add(key);
			decorations.push(Decoration.node(pos, pos + node.nodeSize, attrs));
		}
		return true;
	});
	return DecorationSet.create(doc, decorations);
};

/** Shows each footnote's number and flags problems (a reference without a definition, an unused or duplicate definition) as the document changes. */
export const CmsFootnoteNumbers = Extension.create({
	name: "cmsFootnoteNumbers",
	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: numbersKey,
				state: {
					init: (_config, state) => buildDecorations(state.doc),
					apply: (tr, value) => (tr.docChanged ? buildDecorations(tr.doc) : value),
				},
				props: {
					decorations: (state) => numbersKey.getState(state),
				},
				appendTransaction(transactions, _oldState, newState) {
					if (!transactions.some((tr) => tr.selectionSet)) return null;
					const { $from } = newState.selection;
					let insideDef = false;
					for (let d = $from.depth; d > 0; d--) {
						if ($from.node(d).type.name === FOOTNOTE_DEFINITION_NAME) {
							insideDef = true;
							break;
						}
					}
					if (!insideDef) return null;
					let firstDefPos: number | null = null;
					newState.doc.descendants((node, pos) => {
						if (node.type.name === FOOTNOTE_DEFINITION_NAME) {
							if (firstDefPos === null) firstDefPos = pos;
							return false;
						}
					});
					if (firstDefPos !== null && firstDefPos > 0) {
						const $target = newState.doc.resolve(Math.max(0, firstDefPos - 1));
						const sel = Selection.near($target, -1);
						return newState.tr.setSelection(sel);
					}
					return null;
				},
			}),
		];
	},
});

export const FOOTNOTE_EXTENSIONS = [CmsFootnoteReference, CmsFootnoteDefinition, CmsFootnoteNumbers];

/** Whether an inline footnote reference can go at `range.from` (default: the selection start). False in a code block, for example. */
export const canInsertFootnote = (editor: Editor, range?: Range): boolean => {
	const { schema } = editor.state;
	const reference = schema.nodes[FOOTNOTE_REFERENCE_NAME];
	if (!reference || !schema.nodes[FOOTNOTE_DEFINITION_NAME]) return false;
	const $at = editor.state.doc.resolve(range?.from ?? editor.state.selection.from);
	return $at.parent.canReplaceWith($at.index(), $at.index(), reference);
};

/**
 * Inserts a reference at the cursor (replacing `range`, the typed slash command) with the next numeric label, appends an empty definition at the end of
 * the document and selects the newly inserted reference node so the inline editing popup opens at the cursor.
 */
export const insertFootnote = (editor: Editor, range?: Range): boolean => {
	if (!canInsertFootnote(editor, range)) return false;
	const definition = editor.state.schema.nodes[FOOTNOTE_DEFINITION_NAME];
	if (!definition) return false;

	const label = nextFootnoteLabel(editor.state.doc);
	const chain = editor.chain().focus();
	if (range) chain.deleteRange(range);
	return chain
		.insertContent({ type: FOOTNOTE_REFERENCE_NAME, attrs: { label } })
		.command(({ tr }) => {
			const created = definition.createAndFill({ label });
			if (!created) return false;
			// At the end of the document, but before the empty paragraph the editor keeps after the last block, so definitions stay together.
			const last = tr.doc.lastChild;
			const at =
				last?.type.name === "paragraph" && last.content.size === 0 && tr.doc.childCount > 1
					? tr.doc.content.size - last.nodeSize
					: tr.doc.content.size;
			tr.insert(at, created);
			// Select the newly inserted footnote reference so the inline bubble immediately appears right at the cursor.
			const refPos = tr.selection.from - 1;
			if (refPos >= 0 && tr.doc.nodeAt(refPos)?.type.name === FOOTNOTE_REFERENCE_NAME) {
				tr.setSelection(NodeSelection.create(tr.doc, refPos));
			}
			tr.scrollIntoView();
			return true;
		})
		.run();
};
