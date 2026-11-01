import { expectTypeOf } from "vitest";
import { definePlugin } from "../..";
import { defineRender } from "../../render";
import { defineServerPlugin } from "../define";

/**
 * PLUG-S4 at compile time: the loaders of a plugin's sides are typed by what their module exports, so a module of the wrong kind fails type checking.
 * `tsc` reads this file and Vitest never runs it, so a broken type fails the type check instead of a test that passes without running. The name ends in
 * `.test.types.ts`: the build leaves it out like a test, and Vitest does not collect it.
 */

// A receiving side of this file's own: what a plugin adds under `testSearch` is checked once a receiver declares the key.
declare module "../define" {
	interface PluginContributions {
		readonly testSearch?: { readonly fields: readonly string[] };
	}
}

const renderSide = defineRender({ blocks: { notice: () => null } });
const adminSide = { pages: { stats: () => null } };
const serverSide = defineServerPlugin({ routes: [] });

// A module of another kind, or one without a default export, is refused.
// @ts-expect-error a render module is not an admin module
definePlugin({ name: "a", admin: async () => ({ default: renderSide }) });
// @ts-expect-error an admin module is not a render module
definePlugin({ name: "b", render: async () => ({ default: adminSide }) });
// @ts-expect-error a server module is not a render module
definePlugin({ name: "c", render: async () => ({ default: serverSide }) });
// @ts-expect-error the table is the default export, not a named one
definePlugin({ name: "d", render: async () => ({ blocks: renderSide.blocks }) });

// `contributes` is typed by the keys the receiving sides declare.
const contributing = definePlugin({
	name: "contributing",
	contributes: { layout: [{ tab: "Search", roles: ["seoTitle"] }], testSearch: { fields: ["title"] } },
});
expectTypeOf(contributing.contributes?.testSearch).toMatchTypeOf<{ readonly fields: readonly string[] } | undefined>();
// @ts-expect-error no receiving side declares this key
definePlugin({ name: "e", contributes: { nobodyReadsThis: true } });
// @ts-expect-error a placement needs its tab
definePlugin({ name: "f", contributes: { layout: [{ roles: ["seoTitle"] }] } });
