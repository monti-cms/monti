import { describe, expect, it } from "vitest";
import { formatShortcut } from "../shortcut";

describe("formatShortcut", () => {
	it("UI-S7 writes a Mac shortcut as glyphs in the order ⌥⇧⌘, with no separator", () => {
		expect(formatShortcut(["mod", "S"], true)).toBe("⌘S");
		expect(formatShortcut(["mod", "shift", "D"], true)).toBe("⇧⌘D");
		expect(formatShortcut(["shift", "mod", "Backspace"], true)).toBe("⇧⌘⌫");
		expect(formatShortcut(["alt", "ArrowUp"], true)).toBe("⌥↑");
		expect(formatShortcut(["mod", "Enter"], true)).toBe("⌘↵");
	});

	it("UI-S7 writes it for Windows and Linux as Ctrl+Alt+Shift and the key, joined by +", () => {
		expect(formatShortcut(["mod", "S"], false)).toBe("Ctrl+S");
		expect(formatShortcut(["mod", "shift", "D"], false)).toBe("Ctrl+Shift+D");
		expect(formatShortcut(["shift", "mod", "Backspace"], false)).toBe("Ctrl+Shift+Backspace");
		expect(formatShortcut(["alt", "ArrowDown"], false)).toBe("Alt+↓");
	});

	it("UI-S7 writes a lower-case letter as a capital", () => {
		expect(formatShortcut(["mod", "b"], false)).toBe("Ctrl+B");
	});
});
