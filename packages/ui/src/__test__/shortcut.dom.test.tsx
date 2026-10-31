import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuShortcut } from "../menu-parts";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("a menu row's shortcut", () => {
	it("UI-S7 is written for the system it runs on", () => {
		vi.stubGlobal("navigator", { ...navigator, platform: "MacIntel" });
		render(<MenuShortcut keys={["mod", "shift", "D"]} />);
		expect(screen.getByText("⇧⌘D")).toBeInTheDocument();
		cleanup();
		vi.stubGlobal("navigator", { ...navigator, platform: "Win32" });
		render(<MenuShortcut keys={["mod", "shift", "D"]} />);
		expect(screen.getByText("Ctrl+Shift+D")).toBeInTheDocument();
	});
});
