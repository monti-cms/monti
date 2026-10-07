import { describe, expectTypeOf, it } from "vitest";
import {
	type calloutBlock,
	type collapsibleBlock,
	type mermaidBlock,
	tabBlock,
	tabsBlock,
	tooltipBlock,
} from "../../../../blocks/src/definitions";
import type { allBlocks } from "../../../../blocks/src/test/all-blocks";
import type blogConfig from "../../../test/cms.config";
import type { BlockDefinition } from "../../blocks/define";
import { defineBlock } from "../../blocks/define";
import type { CmsConfig, CollectionsConfig } from "../../config/define";
import { definePlugin } from "../../plugin/define";
import type { AttributeProps } from "../document/block-types";
import type { BlockProps, DocumentComponentsFor, MarkBlockProps } from "../document/types";

/**
 * Type tests (checked by `tsc`, run by `pnpm typecheck`): the props of a block component come from the block definition in the site config,
 * whether the block is in the config's `blocks` or in a plugin's `blocks`. They use a local config type, so they hold for any site config.
 */

const note = defineBlock({
	name: "note-box",
	label: "Note",
	syntax: { kind: "container", directive: "note-box" },
	component: "NoteBox",
	attributes: {
		tone: { type: "string", label: "Tone", options: { info: "Info", warn: "Warn" }, defaultValue: "info" },
		kicker: { type: "string", label: "Kicker" },
		pinned: { type: "boolean", label: "Pinned" },
		id: { type: "string", label: "Id", required: true },
		kind: { type: "string", label: "Kind", options: { a: "A", b: "B" } },
	},
	editor: { view: "node" },
});

const rulePlugin = definePlugin({ name: "rules", options: {}, blocks: [tabsBlock, tabBlock, tooltipBlock] });

type SiteConfig = CmsConfig<
	CollectionsConfig,
	"en",
	readonly [typeof rulePlugin],
	readonly [typeof note, typeof mermaidBlock]
>;
type Components = DocumentComponentsFor<SiteConfig>;
type Blocks = NonNullable<Components["blocks"]>;
type Marks = NonNullable<Components["marks"]>;

describe("block component types", () => {
	it("derives the attribute props from the definition", () => {
		type Props = AttributeProps<typeof note>;
		expectTypeOf<Props["tone"]>().toEqualTypeOf<"info" | "warn">();
		expectTypeOf<Props["kicker"]>().toEqualTypeOf<string | undefined>();
		expectTypeOf<Props["pinned"]>().toEqualTypeOf<boolean>();
		expectTypeOf<Props["id"]>().toEqualTypeOf<string>();
		expectTypeOf<Props["kind"]>().toEqualTypeOf<"a" | "b" | undefined>();
		expectTypeOf<AttributeProps<typeof calloutBlock>["variant"]>().toEqualTypeOf<
			"note" | "tip" | "info" | "warning" | "danger"
		>();
		expectTypeOf<AttributeProps<typeof collapsibleBlock>["defaultOpen"]>().toEqualTypeOf<boolean>();
	});

	it("keys the blocks of the config and its plugins by name, and sends text blocks to the marks", () => {
		expectTypeOf<keyof Blocks>().toEqualTypeOf<"note-box" | "mermaid" | "tabs" | "tab">();
		expectTypeOf<keyof Marks>().toEqualTypeOf<
			| "tooltip"
			| "link"
			| "bold"
			| "italic"
			| "strike"
			| "underline"
			| "superscript"
			| "subscript"
			| "code"
			| "untranslated"
		>();
	});

	it("types the props of a block component", () => {
		type NoteProps = BlockProps<typeof note>;
		expectTypeOf<NoteProps["tone"]>().toEqualTypeOf<"info" | "warn">();
		expectTypeOf<NoteProps["children"]>().not.toBeAny();
		type FenceProps = BlockProps<typeof mermaidBlock>;
		expectTypeOf<FenceProps["source"]>().toEqualTypeOf<string>();
		// A container block has no `source`.
		expectTypeOf<NoteProps>().not.toHaveProperty("source");
		expectTypeOf<MarkBlockProps<typeof tooltipBlock>["content"]>().toEqualTypeOf<string>();
	});

	it("rejects a component for a block the config does not have, and a wrong prop type", () => {
		const ok = {
			blocks: {
				"note-box": ({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) => (
					<aside data-tone={tone}>{children}</aside>
				),
			},
		} satisfies Components;
		void ok;
		// @ts-expect-error `callout` is not a block of this config
		const unknownBlock: Components = { blocks: { callout: () => null } };
		// @ts-expect-error `tone` is "info" | "warn", not any string
		const wrongProp: Components = { blocks: { "note-box": ({ tone }: { tone: "other" }) => <i>{tone}</i> } };
		void unknownBlock;
		void wrongProp;
	});

	it("reads the blocks of a plugin from its literal type (the per-block functions of the extension package)", () => {
		type Plugins = ReturnType<typeof allBlocks>;
		type FromHelper = DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", Plugins>>;
		type HelperBlocks = NonNullable<FromHelper["blocks"]>;
		expectTypeOf<"callout" extends keyof HelperBlocks ? true : false>().toEqualTypeOf<true>();
		expectTypeOf<"code-explorer" extends keyof HelperBlocks ? true : false>().toEqualTypeOf<true>();
		type CalloutProps = BlockProps<typeof calloutBlock>;
		expectTypeOf<NonNullable<HelperBlocks["callout"]>>().toEqualTypeOf<React.ComponentType<CalloutProps>>();
		type HelperMarks = NonNullable<FromHelper["marks"]>;
		expectTypeOf<"tooltip" extends keyof HelperMarks ? true : false>().toEqualTypeOf<true>();
	});

	it("is built from a real site config: the keys are the block names of that config, not any string", () => {
		type Site = NonNullable<DocumentComponentsFor<typeof blogConfig>["blocks"]>;
		expectTypeOf<string extends keyof Site ? true : false>().toEqualTypeOf<false>();
		expectTypeOf<keyof Site>().not.toBeNever();
	});

	it("falls back to no site blocks for a definition that is not a literal", () => {
		type Wide = DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", readonly never[], readonly BlockDefinition[]>>;
		expectTypeOf<keyof NonNullable<Wide["blocks"]>>().toEqualTypeOf<never>();
	});
});
