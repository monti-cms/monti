import { describe, expect, it } from "vitest";
import type { SaveStatus } from "../../entries/entry-editor-types";
import { saveCell } from "../save-cell";

describe("save cell", () => {
	it.each<SaveStatus>([
		"new",
		"dirty",
		"local-only",
		"failed",
		"conflict",
	])("WRITE-S1 %s: pressing the cell saves again", (status) => {
		expect(saveCell(status).action).toBe("save");
	});

	it("WRITE-S5 session-expired: the cell leads to signing in, not to saving", () => {
		expect(saveCell("session-expired").action).toBe("sign-in");
	});

	it.each<SaveStatus>(["saved", "saving"])("WRITE-S1 %s: there is nothing to press", (status) => {
		expect(saveCell(status).action).toBeNull();
	});
});
