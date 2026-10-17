import { describe, expect, expectTypeOf, it } from "vitest";
import { definePlugin } from "../..";
import { defineRender, type RenderPlugin } from "../../render";
import { defineServerPlugin } from "../define";

// A receiving side of this test's own: what a plugin adds under `testSearch` is checked once a receiver declares the key.
declare module "../define" {
	interface PluginContributions {
		readonly testSearch?: { readonly fields: readonly string[] };
	}
}

const renderSide = defineRender({ blocks: { notice: () => null } });
const adminSide = { pages: { stats: () => null } };
const serverSide = defineServerPlugin({ routes: [] });

/** The loaders of a plugin's sides are typed by what their module exports, so a module of the wrong kind fails type checking. Nothing here is loaded. */
describe("the sides of a plugin", () => {
	it("takes a module of the matching kind for `admin` and `render`", async () => {
		const plugin = definePlugin({
			name: "sides",
			admin: async () => ({ default: adminSide }),
			render: async () => ({ default: renderSide }),
		});
		expectTypeOf((await plugin.render?.())?.default).toEqualTypeOf<RenderPlugin | undefined>();
		expect((await plugin.render?.())?.default).toBe(renderSide);
	});

	it("refuses a module of another kind, or one without a default export", () => {
		const check = () => [
			// @ts-expect-error a render module is not an admin module
			definePlugin({ name: "a", admin: async () => ({ default: renderSide }) }),
			// @ts-expect-error an admin module is not a render module
			definePlugin({ name: "b", render: async () => ({ default: adminSide }) }),
			// @ts-expect-error a server module is not a render module
			definePlugin({ name: "c", render: async () => ({ default: serverSide }) }),
			// @ts-expect-error the table is the default export, not a named one
			definePlugin({ name: "d", render: async () => ({ blocks: renderSide.blocks }) }),
		];
		expect(typeof check).toBe("function");
	});

	it("types `contributes` by the keys the receiving sides declare", () => {
		const plugin = definePlugin({
			name: "contributing",
			contributes: { layout: [{ tab: "Search", roles: ["seoTitle"] }], testSearch: { fields: ["title"] } },
		});
		expectTypeOf(plugin.contributes?.testSearch).toMatchTypeOf<{ readonly fields: readonly string[] } | undefined>();
		const check = () => [
			// @ts-expect-error no receiving side declares this key
			definePlugin({ name: "e", contributes: { nobodyReadsThis: true } }),
			// @ts-expect-error a placement needs its tab
			definePlugin({ name: "f", contributes: { layout: [{ roles: ["seoTitle"] }] } }),
		];
		expect(typeof check).toBe("function");
	});
});
