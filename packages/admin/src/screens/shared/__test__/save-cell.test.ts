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

	it("marks what needs attention as a warning and what is broken as danger", () => {
		expect(saveCell("saved").tone).toBeUndefined();
		expect(saveCell("saving").tone).toBeUndefined();
		expect(saveCell("new").tone).toBeUndefined();
		expect(saveCell("dirty").tone).toBe("warning");
		expect(saveCell("local-only").tone).toBe("warning");
		for (const status of ["failed", "conflict", "session-expired"] as const)
			expect(saveCell(status).tone).toBe("danger");
	});
});

describe("save cell dot", () => {
	it("marks changes that are not on the server yet, and nothing else", () => {
		expect(saveCell("dirty").dot).toBe(true);
		expect(saveCell("local-only").dot).toBe(true);
		for (const status of ["saved", "saving", "new", "failed", "conflict", "session-expired"] as const)
			expect(saveCell(status).dot).toBe(false);
	});
});
