import { describe, expect, it } from "vitest";
import { afterWrite } from "./after-write";

describe("what a write elsewhere means for an open editor", () => {
	it("an editor with nothing unsaved reads the server's copy again at once, whatever was written", () => {
		expect(afterWrite({ saving: false, dirty: false, shown: 3 })).toBe("reload");
	});

	it("the editor's own save and an editor that has read nothing yet do nothing: the save reads what it wrote", () => {
		expect(afterWrite({ saving: true, dirty: false, shown: 3 })).toBe("none");
		expect(afterWrite({ saving: true, dirty: true, shown: 3, latest: 4 })).toBe("none");
		expect(afterWrite({ saving: false, dirty: true, shown: null })).toBe("none");
	});

	// 02-2: unsaved input is never written over by a write made elsewhere.
	it("02-2 over unsaved changes the record's version is looked at first, and a newer one is a notice, not a reload", () => {
		expect(afterWrite({ saving: false, dirty: true, shown: 3 })).toBe("peek");
		expect(afterWrite({ saving: false, dirty: true, shown: 3, latest: 4 })).toBe("notice");
	});

	it("over unsaved changes, a write to another record reads again (the state may have moved), and a record that could not be read waits", () => {
		expect(afterWrite({ saving: false, dirty: true, shown: 3, latest: 3 })).toBe("reload");
		expect(afterWrite({ saving: false, dirty: true, shown: 3, latest: null })).toBe("none");
	});
});
