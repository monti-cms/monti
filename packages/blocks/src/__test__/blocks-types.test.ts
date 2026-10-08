import type { CmsConfig, CmsPlugin, CollectionsConfig } from "@monti-cms/core";
import type { DocumentComponentsFor } from "@monti-cms/core/render";
import { describe, expect, expectTypeOf, it } from "vitest";
import { chart } from "../chart";
import { callout, codeRef, collapsible, color, tooltip } from "../index";
import { allBlocks } from "../test/all-blocks";

/** The names of the blocks and marks a config with these plugins types components for. */
type NamesOf<Plugins extends readonly CmsPlugin[]> = {
	blocks: keyof NonNullable<DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", Plugins>>["blocks"]>;
	marks: Exclude<
		keyof NonNullable<DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", Plugins>>["marks"]>,
		"link" | "bold" | "italic" | "strike" | "underline" | "superscript" | "subscript" | "code" | "untranslated"
	>;
};

describe("each block function keeps the blocks it installs in its type", () => {
	it("types only the blocks that are listed", () => {
		const some = [chart(), tooltip()] as const;
		expectTypeOf<NamesOf<typeof some>["blocks"]>().toEqualTypeOf<"chart">();
		expectTypeOf<NamesOf<typeof some>["marks"]>().toEqualTypeOf<"tooltip">();
		expect(some.map((plugin) => plugin.name)).toEqual(["chart", "tooltip"]);
	});

	it("types the blocks and marks of the ones listed, whatever the others are", () => {
		const rest = [callout(), collapsible(), tooltip(), codeRef()] as const;
		expectTypeOf<NamesOf<typeof rest>["blocks"]>().toEqualTypeOf<"callout" | "collapsible">();
		expectTypeOf<NamesOf<typeof rest>["marks"]>().toEqualTypeOf<"tooltip" | "code-ref">();
	});

	it("types every block when all are listed, and a color palette keeps the color mark", () => {
		const all = allBlocks();
		expectTypeOf<NamesOf<typeof all>["blocks"]>().toEqualTypeOf<
			"callout" | "collapsible" | "tabs" | "tab" | "columns" | "column" | "code-explorer" | "mermaid" | "chart"
		>();
		const colored = [color({ palette: [] })] as const;
		expectTypeOf<NamesOf<typeof colored>["marks"]>().toEqualTypeOf<"color">();
	});
});
