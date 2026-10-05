import { type Editor, Extension, mergeAttributes, Node, type Range } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const FOOTNOTE_REFERENCE_NAME = "footnoteReference";
export const FOOTNOTE_DEFINITION_NAME = "footnoteDefinition";

/** GFM matches labels case-insensitively, so numbering and lookups use this key. The stored label is never changed. */
export const footnoteKey = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();

const labelOf = (node: PmNode) => String(node.attrs.label ?? "");

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
	"mx-0.5 inline-block min-w-4 cursor-pointer select-none rounded bg-cms-accent px-1 text-center align-super",
	"font-medium text-[0.7em] text-cms-accent-foreground leading-snug",
	"after:content-[attr(data-footnote-number)]",
	"data-[footnote-missing]:bg-cms-destructive/15 data-[footnote-missing]:text-cms-destructive",
	"[&.ProseMirror-selectednode]:ring-2 [&.ProseMirror-selectednode]:ring-cms-ring",
].join(" ");

const DEFINITION_CLASS = [
	"relative my-1 min-h-6 pl-9 text-sm",
	// The number and label badge sits in the left gutter.
	"before:absolute before:top-0.5 before:left-0 before:max-w-8 before:truncate before:rounded before:bg-cms-accent",
	"before:px-1 before:text-center before:font-medium before:text-cms-accent-foreground before:text-xs before:leading-5",
	"before:content-[attr(data-footnote-badge)]",
	"data-[footnote-unused]:before:bg-cms-muted data-[footnote-unused]:before:text-cms-muted-foreground",
	"data-[footnote-duplicate]:before:bg-cms-destructive/15 data-[footnote-duplicate]:before:text-cms-destructive",
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
});

/**
 * GFM footnote definition (`[^label]: content`). A block with ordinary block content (paragraphs, lists, code…) that stays where it is in the source.
 */
export const CmsFootnoteDefinition = Node.create({
	name: FOOTNOTE_DEFINITION_NAME,
	group: "block",
	content: "block+",
	defining: true,
	addAttributes() {
		return { label: labelAttribute };
	},
	parseHTML() {
		return [{ tag: "div[data-footnote-definition]" }];
	},
	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-footnote-definition": "", class: DEFINITION_CLASS }), 0];
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
			}),
		];
	},
});

export const FOOTNOTE_EXTENSIONS = [CmsFootnoteReference, CmsFootnoteDefinition, CmsFootnoteNumbers];

/**
 * Inserts a reference at the cursor (replacing `range`, the typed slash command) with the next numeric label, appends an empty definition at the end of
 * the document and moves the cursor into it. Does nothing where an inline reference cannot go (a code block, for example).
 */
export const insertFootnote = (editor: Editor, range?: Range): boolean => {
	const { schema } = editor.state;
	const reference = schema.nodes[FOOTNOTE_REFERENCE_NAME];
	const definition = schema.nodes[FOOTNOTE_DEFINITION_NAME];
	if (!reference || !definition) return false;

	const $at = editor.state.doc.resolve(range?.from ?? editor.state.selection.from);
	if (!$at.parent.canReplaceWith($at.index(), $at.index(), reference)) return false;

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
			// Inside the new definition's first paragraph.
			tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1), 1));
			tr.scrollIntoView();
			return true;
		})
		.run();
};
