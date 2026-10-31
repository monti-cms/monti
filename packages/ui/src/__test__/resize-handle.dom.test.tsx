import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResizeHandle, useResizableWidth } from "../resize-handle";

const LIMITS = { defaultWidth: 256, min: 200, max: 400 };

function Pane({ storageKey = "test", edge }: { storageKey?: string; edge?: "start" | "end" }) {
	const resize = useResizableWidth({ storageKey, ...LIMITS });
	return (
		<div style={{ width: resize.width }}>
			<ResizeHandle
				value={resize.width}
				min={resize.min}
				max={resize.max}
				onChange={resize.setWidth}
				onReset={resize.reset}
				label="Resize test"
				edge={edge}
			/>
		</div>
	);
}

const handle = () => screen.getByRole("separator");
const width = () => Number(handle().getAttribute("aria-valuenow"));

beforeEach(() => window.localStorage.clear());
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe("resize handle", () => {
	it("UI-A5 is a vertical separator that exposes its value and limits", () => {
		render(<Pane />);
		expect(handle().getAttribute("aria-orientation")).toBe("vertical");
		expect(handle().getAttribute("aria-label")).toBe("Resize test");
		expect(width()).toBe(256);
		expect(handle().getAttribute("aria-valuemin")).toBe("200");
		expect(handle().getAttribute("aria-valuemax")).toBe("400");
	});

	it("UI-K7 widens toward the open side of a start edge", () => {
		render(<Pane edge="start" />);
		fireEvent.keyDown(handle(), { key: "ArrowLeft" });
		expect(width()).toBe(272);
		fireEvent.keyDown(handle(), { key: "ArrowRight" });
		expect(width()).toBe(256);
	});

	it("UI-K7 resizes with the arrow keys, bigger steps with Shift, and the limits with Home and End", () => {
		render(<Pane />);
		fireEvent.keyDown(handle(), { key: "ArrowRight" });
		expect(width()).toBe(272);
		fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
		expect(width()).toBe(208);
		fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
		expect(width()).toBe(200);
		fireEvent.keyDown(handle(), { key: "End" });
		expect(width()).toBe(400);
		fireEvent.keyDown(handle(), { key: "ArrowRight", shiftKey: true });
		expect(width()).toBe(400);
		fireEvent.keyDown(handle(), { key: "Home" });
		expect(width()).toBe(200);
	});

	it("ADMIN-S1 keeps a remembered width inside the limits", () => {
		window.localStorage.setItem("monti-ui:width:test", "900");
		render(<Pane />);
		expect(width()).toBe(400);
	});

	it("ADMIN-S1 works without storage", () => {
		const blocked = () => {
			throw new Error("blocked");
		};
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
		render(<Pane />);
		expect(width()).toBe(256);
		fireEvent.keyDown(handle(), { key: "ArrowRight" });
		expect(width()).toBe(272);
	});
});
