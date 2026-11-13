import { expect, it } from "vitest";
import { formatShortcut } from "./shortcut";

it("the delete key is drawn as a Mac's own delete key there, ⌫, and as Delete elsewhere", () => {
	expect(formatShortcut(["Delete"], true)).toBe("⌫");
	expect(formatShortcut(["Delete"], false)).toBe("Delete");
	expect(formatShortcut(["mod", "shift", "D"], true)).toBe("⇧⌘D");
	expect(formatShortcut(["mod", "shift", "D"], false)).toBe("Ctrl+Shift+D");
});
