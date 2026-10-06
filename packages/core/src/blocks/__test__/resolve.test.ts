import { describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../test/any-site";
import { ADDED_BLOCKS } from "../active";
import { type BlockDefinition, defineBlock } from "../define";
import { BUILTIN_BLOCKS } from "../definitions";
import { resolveBlocks } from "../resolve";

const card = defineBlock({
	name: "card",
	label: "카드",
	syntax: { kind: "container", directive: "card" },
	component: "Card",
	attributes: {},
	editor: { view: "node", insertable: true },
});

const names = (blocks: readonly { name: string }[]) => blocks.map((block) => block.name);

const diagram = defineBlock({
	name: "diagram",
	label: "다이어그램",
	syntax: { kind: "fence", lang: "diagram" },
	component: "Diagram",
	attributes: {},
	editor: { view: "node", insertable: true },
});

describe("body blocks from the site config", () => {
	it("uses only core blocks when there is no config", () => {
		expect(names(resolveBlocks(undefined))).toEqual(names(BUILTIN_BLOCKS));
		expect(names(BUILTIN_BLOCKS)).not.toContain("callout");
	});

	it("adds site blocks after plugin blocks", () => {
		const blocks = names(
			resolveBlocks({ plugins: [{ name: "diagram", blocks: [diagram] }, { name: "ai" }], blocks: [card] }),
		);
		expect(blocks.slice(-2)).toEqual(["diagram", "card"]);
		expect(blocks.slice(0, BUILTIN_BLOCKS.length)).toEqual(names(BUILTIN_BLOCKS));
	});

	it("validates the name, syntax, component, editing mode, and children of an added block", () => {
		const bad = (patch: object) => resolveBlocks({ blocks: [{ ...card, ...patch } as never] });
		expect(() => bad({ name: "Card" })).toThrow(/kebab/);
		expect(() => bad({ syntax: { kind: "math" } })).toThrow(/container, leaf, text or fence/);
		// A text mark (`text`) uses the `mark` editing mode and has no children.
		expect(() => bad({ syntax: { kind: "text", directive: "card" } })).toThrow(/text block needs editor.view "mark"/);
		expect(() => bad({ syntax: { kind: "container", directive: "other" } })).toThrow(/directive must equal/);
		expect(() => bad({ component: "card" })).toThrow(/PascalCase/);
		expect(() => bad({ name: "image", syntax: { kind: "leaf", directive: "image" } })).toThrow(/already used/);
		// The public renderer passes `children`, `node`, `blockId`, `items`, `ctx` and `source` to the component itself, so an attribute cannot take these names.
		for (const name of ["children", "node", "blockId", "items", "ctx", "source"]) {
			expect(() => bad({ attributes: { [name]: { type: "string", label: name } } })).toThrow(/reserved/);
		}
		expect(() => bad({ component: "Image" })).toThrow(/already used/);
		expect(() => bad({ editor: { view: "mark" } })).toThrow(/editor.view/);
		expect(() => bad({ children: { blocks: ["tab"] } })).toThrow(/added block with this parent/);
		expect(() => resolveBlocks({ blocks: [card, card] })).toThrow(/already used/);
	});

	it("adds text marks (`text`, `mark`), and the code line label attribute (`codeAnchor`) is one text attribute of one mark", () => {
		const note = defineBlock({
			name: "note",
			label: "메모",
			syntax: { kind: "text", directive: "note" },
			component: "Note",
			attributes: { text: { type: "string", label: "글", required: true } },
			editor: { view: "mark" },
		});
		expect(resolveBlocks({ blocks: [note] }).at(-1)).toBe(note);
		expect(() => resolveBlocks({ blocks: [{ ...note, children: { min: 0 } }] })).toThrow(/no children or parent/);
		const anchor = { ...note, attributes: { to: { type: "string" as const, label: "줄", codeAnchor: true } } };
		expect(resolveBlocks({ blocks: [anchor] }).at(-1)).toBe(anchor);
		expect(() =>
			resolveBlocks({
				blocks: [
					anchor,
					{ ...anchor, name: "note-two", component: "NoteTwo", syntax: { kind: "text", directive: "note-two" } },
				],
			}),
		).toThrow(/only one block can link code lines/);
		expect(() => resolveBlocks({ blocks: [{ ...card, attributes: { to: anchor.attributes.to } }] })).toThrow(
			/codeAnchor/,
		);
	});

	it("code fence blocks do not share languages", () => {
		expect(() =>
			resolveBlocks({ blocks: [diagram, { ...diagram, name: "diagram-two", component: "DiagramTwo" }] }),
		).toThrow(/fence lang "diagram" is already used/);
		expect(() => resolveBlocks({ blocks: [{ ...diagram, syntax: { kind: "fence", lang: "Diagram" } }] })).toThrow(
			/lower-case/,
		);
	});

	it("a child-value attribute requires that attribute on the child block", () => {
		const group = defineBlock({
			name: "group",
			label: "묶음",
			syntax: { kind: "container", directive: "group" },
			component: "Group",
			attributes: { first: { type: "string", label: "처음", childValue: "label" } },
			children: { blocks: ["item"] },
			editor: { view: "node" },
		});
		const item = defineBlock({
			name: "item",
			label: "항목",
			syntax: { kind: "container", directive: "item" },
			component: "Item",
			attributes: {},
			parent: "group",
			editor: { view: "node" },
		});
		expect(() => resolveBlocks({ blocks: [group, item] })).toThrow(/no child block has "label"/);
		const labeled = { ...item, attributes: { label: { type: "string" as const, label: "이름" } } };
		expect(names(resolveBlocks({ blocks: [group, labeled] })).slice(-2)).toEqual(["group", "item"]);
	});
});

describe("custom block publish check", () => {
	// Blocks are looked up from the current config (the reference blog setup has callout kinds and the custom `embed` block address). Skipped for configs without such blocks.
	const attributeOf = (block: BlockDefinition, pick: (attribute: BlockDefinition["attributes"][string]) => boolean) =>
		Object.entries(block.attributes).find(([, attribute]) => attribute.type === "string" && pick(attribute));
	const nonText = ADDED_BLOCKS.filter(
		(block) => (block.syntax.kind === "leaf" || block.syntax.kind === "container") && !block.parent,
	);
	/** A block with a choice-value attribute. */
	const choiceBlock = nonText.find((block) => attributeOf(block, (attribute) => Boolean(attribute.options)));
	/** A block with a required attribute (single-line block first). */
	const requiredBlock = [...nonText]
		.sort((a, b) => Number(b.syntax.kind === "leaf") - Number(a.syntax.kind === "leaf"))
		.find((block) => attributeOf(block, (attribute) => Boolean(attribute.required) && !attribute.options));

	/** Source of one block as standard JSX (takes an attribute string such as ` name="value"`). */
	const jsxBlock = (block: BlockDefinition, props: string) =>
		block.syntax.kind === "leaf"
			? `<${block.component}${props} />\n`
			: `<${block.component}${props}>\n\n본문\n\n</${block.component}>\n`;

	const issuesOf = async (mdx: string) => {
		const { prepareSnapshot } = await import("../../core/snapshot");
		const snapshot = await prepareSnapshot({
			collection: contentCollection,
			slug: "custom-blocks",
			// Fill in the publish-required metadata so only the block check is tested (a relation is an ID with only the right format).
			metadata: await requiredMetadata(
				contentCollection,
				"사용자 블록",
				async () => "00000000-0000-4000-8000-000000000000",
			),
			format: "mdx",
			body: mdx,
		});
		return snapshot.issues.map((issue) => issue.code);
	};

	it.skipIf(!choiceBlock)("blocks an attribute outside the choice values", async () => {
		if (!choiceBlock) return;
		const [name, attribute] = attributeOf(choiceBlock, (candidate) => Boolean(candidate.options)) ?? [];
		const valid = Object.keys(attribute?.options ?? {})[0];
		expect(await issuesOf(jsxBlock(choiceBlock, ` ${name}="not-an-option"`))).toContain("invalid_block_attribute");
		expect(await issuesOf(jsxBlock(choiceBlock, ` ${name}="${valid}"`))).toEqual([]);
	});

	it.skipIf(!requiredBlock)("blocks a missing required attribute", async () => {
		if (!requiredBlock) return;
		const [name] = attributeOf(requiredBlock, (attribute) => Boolean(attribute.required) && !attribute.options) ?? [];
		expect(await issuesOf(jsxBlock(requiredBlock, ""))).toContain("missing_block_attribute");
		expect(await issuesOf(jsxBlock(requiredBlock, ` ${name}="https://example.com"`))).toEqual([]);
	});
});
