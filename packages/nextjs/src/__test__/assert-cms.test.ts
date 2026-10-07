// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createRouteHandler } from "..";
import { assertCms } from "../assert-cms";

/** A Next file that got no CMS instance (a wrong import) says so and how to fix it, instead of "Cannot read properties of undefined". */
describe("a missing CMS instance", () => {
	it("is named by the file that was given nothing, with where and how to fix", () => {
		const message = (() => {
			try {
				createRouteHandler(undefined as never);
			} catch (error) {
				return (error as Error).message;
			}
			return "";
		})();
		expect(message).toContain("createRouteHandler(cms) got undefined");
		expect(message).toMatch(/Where: .*import of `cms`/);
		expect(message).toMatch(/Fix: .*monti\.config.*export const cms = defineConfig/);
		expect(message).toContain("monti doctor");
	});

	it("accepts an instance, and names the wrong type it got", () => {
		expect(() => assertCms({}, "x")).not.toThrow();
		expect(() => assertCms(Promise.resolve(), "<CmsAdminPage cms={cms}>")).not.toThrow();
		expect(() => assertCms("cms", "<CmsAdminPage cms={cms}>")).toThrow(/got string instead of the CMS instance/);
	});
});
