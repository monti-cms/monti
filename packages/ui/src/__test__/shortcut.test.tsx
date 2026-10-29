import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuShortcut } from "../menu-parts";
import { formatShortcut } from "../shortcut";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("formatShortcut", () => {
	it("writes a Mac shortcut as glyphs in the order ⌥⇧⌘, with no separator", () => {
		expect(formatShortcut(["mod", "S"], true)).toBe("⌘S");
		expect(formatShortcut(["mod", "shift", "D"], true)).toBe("⇧⌘D");
		expect(formatShortcut(["shift", "mod", "Backspace"], true)).toBe("⇧⌘⌫");
		expect(formatShortcut(["alt", "ArrowUp"], true)).toBe("⌥↑");
		expect(formatShortcut(["mod", "Enter"], true)).toBe("⌘↵");
	});

	it("writes it for Windows and Linux as Ctrl+Alt+Shift and the key, joined by +", () => {
		expect(formatShortcut(["mod", "S"], false)).toBe("Ctrl+S");
		expect(formatShortcut(["mod", "shift", "D"], false)).toBe("Ctrl+Shift+D");
		expect(formatShortcut(["shift", "mod", "Backspace"], false)).toBe("Ctrl+Shift+Backspace");
		expect(formatShortcut(["alt", "ArrowDown"], false)).toBe("Alt+↓");
	});

	it("writes a lower-case letter as a capital", () => {
		expect(formatShortcut(["mod", "b"], false)).toBe("Ctrl+B");
	});
});

describe("a menu row's shortcut", () => {
	it("is written for the system it runs on", () => {
		vi.stubGlobal("navigator", { ...navigator, platform: "MacIntel" });
		render(<MenuShortcut keys={["mod", "shift", "D"]} data-testid="keys" />);
		expect(screen.getByTestId("keys").textContent).toBe("⇧⌘D");
		cleanup();
		vi.stubGlobal("navigator", { ...navigator, platform: "Win32" });
		render(<MenuShortcut keys={["mod", "shift", "D"]} data-testid="keys" />);
		expect(screen.getByTestId("keys").textContent).toBe("Ctrl+Shift+D");
	});
});
