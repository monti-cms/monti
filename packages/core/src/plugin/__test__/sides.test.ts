import { describe, expect, expectTypeOf, it } from "vitest";
import { definePlugin } from "../..";
import { defineRender, type RenderPlugin } from "../../render";

const renderSide = defineRender({ blocks: { notice: () => null } });
const adminSide = { pages: { stats: () => null } };

/** The loaders of a plugin's sides are typed by what their module exports (`sides.test.types.ts` checks the wrong kinds at compile time). */
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
});
