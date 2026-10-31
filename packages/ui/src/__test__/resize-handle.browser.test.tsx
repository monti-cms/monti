import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ResizeHandle, useResizableWidth } from "../resize-handle";

const LIMITS = { defaultWidth: 256, min: 200, max: 400 };

/**
 * A pane with its handle on one edge. The page has none of the ui styles, so the pane and the handle get their places inline. The ruler under them
 * spans the viewport: a drag ends on it, at the x it is given.
 */
function Pane({ edge = "end" }: { edge?: "start" | "end" }) {
	const resize = useResizableWidth({ storageKey: "test", ...LIMITS });
	return (
		<>
			<div
				style={{
					position: "absolute",
					top: 0,
					[edge === "end" ? "left" : "right"]: 0,
					width: resize.width,
					height: 40,
				}}
			>
				<ResizeHandle
					value={resize.width}
					min={resize.min}
					max={resize.max}
					onChange={resize.setWidth}
					onReset={resize.reset}
					label="Resize test"
					edge={edge}
					style={{ position: "absolute", top: 0, bottom: 0, width: 8, [edge === "end" ? "right" : "left"]: 0 }}
				/>
			</div>
			<div style={{ position: "absolute", top: 60, left: 0, width: "100%", height: 20 }}>ruler</div>
		</>
	);
}

const handle = () => screen.getByRole("separator");
const width = () => Number(handle().getAttribute("aria-valuenow"));
/** Drags the handle from its middle by `dx` px, along the ruler, and lets go. */
const drag = async (dx: number) => {
	const box = handle().getBoundingClientRect();
	await act(() =>
		userEvent.dragAndDrop(handle(), screen.getByText("ruler"), {
			targetPosition: { x: Math.max(1, box.left + box.width / 2 + dx), y: 10 },
		}),
	);
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

describe("resize handle", () => {
	it("UI-S8 follows the pointer and stays within the limits", async () => {
		render(<Pane />);
		await drag(50);
		expect(width()).toBe(306);
		await drag(5000);
		expect(width()).toBe(400);
		await drag(-5000);
		expect(width()).toBe(200);
	});

	it("UI-S8 widens toward the open side of a start edge", async () => {
		render(<Pane edge="start" />);
		await drag(-40);
		expect(width()).toBe(296);
	});
});
