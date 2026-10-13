import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditMessages } from "../../../core/test/messages-audit";

describe("message dictionaries", () => {
	it("keep one naming convention, the same keys in English and Korean, and no key that nothing refers to", async () => {
		const audit = await auditMessages(path.resolve(__dirname, ".."));
		expect(audit).toEqual({ misnamed: [], mismatched: [], unreferenced: [] });
	});
});
