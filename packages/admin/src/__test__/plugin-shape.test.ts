import type { AdminPluginShape } from "@monti-cms/core";
import { describe, expectTypeOf, it } from "vitest";
import type { AdminPlugin } from "../plugins";

/** The core types a plugin's `admin` loader by a shape of its own (the core does not depend on the admin). The admin's declaration has to fit it. */
describe("the admin side of a plugin", () => {
	it("fits the shape the core gives `admin`", () => {
		expectTypeOf<AdminPlugin>().toMatchTypeOf<AdminPluginShape>();
	});
});
