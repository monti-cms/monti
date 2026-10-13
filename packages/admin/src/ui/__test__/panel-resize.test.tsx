import { cleanup, createEvent, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWithSite as render } from "../../screens/__test__/site-wrapper";
import { PanelResizeHandle, usePanelResize } from "../panel-resize";

const CONFIG = { name: "test-panel", defaultWidth: 448, minWidth: 352 };

function Panel({ name = CONFIG.name }: { name?: string }) {
	const resize = usePanelResize({ ...CONFIG, name });
	return (
		<aside data-testid="panel" style={resize.style} className="relative">
			<PanelResizeHandle resize={resize} />
		</aside>
	);
}

const handle = () => screen.getByRole("separator");
const width = () => Number(handle().getAttribute("aria-valuenow"));
const setViewport = (value: number) => {
	Object.defineProperty(window, "innerWidth", { configurable: true, value });
	window.dispatchEvent(new Event("resize"));
};
const pointer = (type: "pointerDown" | "pointerMove" | "pointerUp", clientX: number) => {
	const event = createEvent[type](handle());
	// jsdom builds a plain event when it has no PointerEvent: carry the fields over.
	Object.defineProperty(event, "clientX", { value: clientX });
	Object.defineProperty(event, "button", { value: 0 });
	Object.defineProperty(event, "pointerId", { value: 1 });
	fireEvent(handle(), event);
};

beforeEach(() => {
	window.localStorage.clear();
	setViewport(1280);
});
afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

describe("panel resize", () => {
	it("starts at the default width and exposes the limits to assistive tech", () => {
		render(<Panel />);
		expect(handle().getAttribute("aria-orientation")).toBe("vertical");
		expect(width()).toBe(448);
		expect(handle().getAttribute("aria-valuemin")).toBe("352");
		// 70% of the viewport.
		expect(handle().getAttribute("aria-valuemax")).toBe("896");
		expect(screen.getByTestId("panel").style.getPropertyValue("--panel-width")).toBe("448px");
	});

	it("widens when the left edge is dragged left, and stays within the limits", () => {
		render(<Panel />);
		pointer("pointerDown", 800);
		pointer("pointerMove", 700);
		expect(width()).toBe(548);
		pointer("pointerMove", -5000);
		expect(width()).toBe(896);
		pointer("pointerMove", 5000);
		expect(width()).toBe(352);
		pointer("pointerUp", 700);
		expect(width()).toBe(548);
	});

	it("resizes with the arrow keys, bigger steps with Shift, and the limits with Home and End", () => {
		render(<Panel />);
		fireEvent.keyDown(handle(), { key: "ArrowLeft" });
		expect(width()).toBe(464);
		fireEvent.keyDown(handle(), { key: "ArrowRight", shiftKey: true });
		expect(width()).toBe(400);
		fireEvent.keyDown(handle(), { key: "Home" });
		expect(width()).toBe(352);
		fireEvent.keyDown(handle(), { key: "ArrowRight" });
		expect(width()).toBe(352);
		fireEvent.keyDown(handle(), { key: "End" });
		expect(width()).toBe(896);
	});

	it("goes back to the default width on double-click", () => {
		render(<Panel />);
		fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
		expect(width()).toBe(512);
		fireEvent.doubleClick(handle());
		expect(width()).toBe(448);
	});

	it("remembers the width per panel kind", () => {
		const first = render(<Panel />);
		fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
		first.unmount();

		const second = render(<Panel />);
		expect(width()).toBe(512);
		second.unmount();
		render(<Panel name="other-panel" />);
		expect(width()).toBe(448);
	});

	it("forgets the remembered width after a reset", () => {
		const first = render(<Panel />);
		fireEvent.keyDown(handle(), { key: "ArrowLeft", shiftKey: true });
		fireEvent.doubleClick(handle());
		first.unmount();
		render(<Panel />);
		expect(width()).toBe(448);
	});

	it("falls back to the default width when storage is unavailable", () => {
		const original = Storage.prototype.getItem;
		Storage.prototype.getItem = () => {
			throw new Error("blocked");
		};
		try {
			render(<Panel />);
			expect(width()).toBe(448);
		} finally {
			Storage.prototype.getItem = original;
		}
	});

	it("keeps a remembered width inside the limits of a smaller window", () => {
		const first = render(<Panel />);
		fireEvent.keyDown(handle(), { key: "End" });
		first.unmount();
		setViewport(800);
		render(<Panel />);
		expect(width()).toBe(560);
	});

	it("has no handle on a narrow screen, where the panel keeps its full width", () => {
		setViewport(500);
		render(<Panel />);
		expect(screen.queryByRole("separator")).toBeNull();
	});
});
