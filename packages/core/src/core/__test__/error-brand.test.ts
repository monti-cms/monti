import { describe, expect, it } from "vitest";
import { handleApiError } from "../../http/v1/error-handler";
import { SetupError } from "../problem";
import { CmsError } from "../store/errors";

/**
 * An error made by another copy of the package (the bundled one and the installed one in a Next app): same class name and brand, different prototype
 * object. Built by hand, the way a second module instance would build it.
 */
function fromOtherCopy(name: string, fields: Record<string, unknown>): Error {
	const prototype = Object.create(Error.prototype, { [Symbol.for(`monti.error.${name}`)]: { value: true } });
	return Object.assign(Object.create(prototype) as Error, { name, message: "from the other copy", ...fields });
}

describe("error classes across copies of the package", () => {
	it("ADMIN-E1 recognizes a CmsError from another copy, so the API answers with its code and not a 500", async () => {
		const foreign = fromOtherCopy("CmsError", { code: "not_found" });
		expect(foreign instanceof CmsError).toBe(true);
		const res = handleApiError(foreign);
		expect(res.status).toBe(404);
		expect((await res.json()).error.code).toBe("not_found");
	});

	it("ADMIN-E1 recognizes a SetupError from another copy as a setup problem", () => {
		const foreign = fromOtherCopy("SetupError", { kind: "migrations_pending", code: "migrations_pending" });
		expect(foreign instanceof SetupError).toBe(true);
		expect(handleApiError(foreign).status).toBe(503);
	});

	it("ADMIN-E2 does not mistake other errors for its own", () => {
		expect(new Error("x") instanceof CmsError).toBe(false);
		expect((null as unknown) instanceof CmsError).toBe(false);
		expect({ code: "not_found" } instanceof CmsError).toBe(false);
	});
});
