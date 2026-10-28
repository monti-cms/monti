import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
const pointer = (type: "pointerDown" | "pointerMove" | "pointerUp", clientX: number) => {
	const event = createEvent[type](handle());
	// jsdom builds a plain event when it has no PointerEvent: carry the fields over.
	Object.defineProperty(event, "clientX", { value: clientX });
	Object.defineProperty(event, "button", { value: 0 });
	Object.defineProperty(event, "pointerId", { value: 1 });
	fireEvent(handle(), event);
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

describe("resize handle", () => {
	it("is a vertical separator that exposes its value and limits", () => {
		render(<Pane />);
		expect(handle().getAttribute("aria-orientation")).toBe("vertical");
		expect(handle().getAttribute("aria-label")).toBe("Resize test");
		expect(width()).toBe(256);
		expect(handle().getAttribute("aria-valuemin")).toBe("200");
		expect(handle().getAttribute("aria-valuemax")).toBe("400");
	});

	it("follows the pointer and stays within the limits", () => {
		render(<Pane />);
		pointer("pointerDown", 100);
		pointer("pointerMove", 150);
		expect(width()).toBe(306);
		pointer("pointerMove", 5000);
		expect(width()).toBe(400);
		pointer("pointerMove", -5000);
		expect(width()).toBe(200);
		pointer("pointerUp", 150);
		expect(width()).toBe(306);
	});

	it("widens toward the open side of a start edge", () => {
		render(<Pane edge="start" />);
		pointer("pointerDown", 100);
		pointer("pointerMove", 60);
		expect(width()).toBe(296);
		fireEvent.keyDown(handle(), { key: "ArrowLeft" });
		expect(width()).toBe(312);
	});

	it("resizes with the arrow keys, bigger steps with Shift, and the limits with Home and End", () => {
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

	it("goes back to the default on double-click and forgets the remembered width", () => {
		const first = render(<Pane />);
		fireEvent.keyDown(handle(), { key: "ArrowRight", shiftKey: true });
		expect(width()).toBe(320);
		fireEvent.doubleClick(handle());
		expect(width()).toBe(256);
		first.unmount();
		render(<Pane />);
		expect(width()).toBe(256);
	});

	it("remembers the width per key", () => {
		const first = render(<Pane />);
		fireEvent.keyDown(handle(), { key: "ArrowRight", shiftKey: true });
		first.unmount();

		const second = render(<Pane />);
		expect(width()).toBe(320);
		second.unmount();
		render(<Pane storageKey="other" />);
		expect(width()).toBe(256);
	});

	it("does not remember a width that is only being dragged", () => {
		const first = render(<Pane />);
		pointer("pointerDown", 100);
		pointer("pointerMove", 150);
		first.unmount();
		render(<Pane />);
		expect(width()).toBe(256);
	});

	it("keeps a remembered width inside the limits", () => {
		window.localStorage.setItem("monti-ui:width:test", "900");
		render(<Pane />);
		expect(width()).toBe(400);
	});

	it("works without storage", () => {
		const original = Storage.prototype.getItem;
		const originalSet = Storage.prototype.setItem;
		Storage.prototype.getItem = () => {
			throw new Error("blocked");
		};
		Storage.prototype.setItem = () => {
			throw new Error("blocked");
		};
		try {
			render(<Pane />);
			expect(width()).toBe(256);
			fireEvent.keyDown(handle(), { key: "ArrowRight" });
			expect(width()).toBe(272);
		} finally {
			Storage.prototype.getItem = original;
			Storage.prototype.setItem = originalSet;
		}
	});
});
