import { describe, expectTypeOf, it } from "vitest";
import type { calloutBlock, collapsibleBlock } from "../../../../../blocks/src/definitions";
import { defineBlock } from "../../../blocks/define";
import type { AttributeProps } from "../block-types";

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

describe("block component types", () => {
	it("SITE-D1 derives the attribute props from the definition", () => {
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
});
