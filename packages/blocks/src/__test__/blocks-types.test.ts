import type { CmsConfig, CollectionsConfig } from "@monti-cms/core";
import type { DocumentComponentsFor } from "@monti-cms/core/render";
import { describe, expect, expectTypeOf, it } from "vitest";
import { blocks } from "../blocks";

/** The names of the blocks and marks a config with these plugins types components for. */
type Names<Plugins extends ReturnType<typeof blocks>> = {
	blocks: keyof NonNullable<DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", Plugins>>["blocks"]>;
	marks: Exclude<
		keyof NonNullable<DocumentComponentsFor<CmsConfig<CollectionsConfig, "en", Plugins>>["marks"]>,
		"link" | "bold" | "italic" | "strike" | "underline" | "superscript" | "subscript" | "code" | "untranslated"
	>;
};

describe("blocks() keeps the blocks it installs in its type", () => {
	it("types only the extensions that `only` picks", () => {
		const some = blocks({ only: ["chart", "tooltip"] });
		expectTypeOf<Names<typeof some>["blocks"]>().toEqualTypeOf<"chart">();
		expectTypeOf<Names<typeof some>["marks"]>().toEqualTypeOf<"tooltip">();
		expect(some.map((plugin) => plugin.name)).toEqual(["chart", "tooltip"]);
	});

	it("leaves out what `omit` and a `false` option remove", () => {
		const rest = blocks({ omit: ["tabs", "columns", "codeExplorer", "mermaid", "chart"], color: false });
		expectTypeOf<Names<typeof rest>["blocks"]>().toEqualTypeOf<"callout" | "collapsible">();
		expectTypeOf<Names<typeof rest>["marks"]>().toEqualTypeOf<"tooltip" | "code-ref">();
		expect(rest.map((plugin) => plugin.name)).toEqual(["callout", "collapsible", "tooltip", "code-ref"]);
	});

	it("types every extension without options, and a color palette keeps the color mark", () => {
		const all = blocks();
		expectTypeOf<Names<typeof all>["blocks"]>().toEqualTypeOf<
			"callout" | "collapsible" | "tabs" | "tab" | "columns" | "column" | "code-explorer" | "mermaid" | "chart"
		>();
		const colored = blocks({ only: ["color"], color: { palette: [] } });
		expectTypeOf<Names<typeof colored>["marks"]>().toEqualTypeOf<"color">();
	});
});
