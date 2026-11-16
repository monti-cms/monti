import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { coversText } from "../../../testing/input";
import { render } from "../test/render";
import { dock } from "./bottom-dock";
import {
	Anchored,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./index";

const ROWS = Array.from({ length: 40 }, (_, at) => `Row ${at + 1}`);

/** A menu opened from a button `top` / `right` px from the window's corner (`bottom` for one from its foot). */
function menuFrom(place: { top?: number; bottom?: number; left?: number; right?: number }) {
	return (
		<DropdownMenu defaultOpen>
			<DropdownMenuTrigger
				render={<button type="button" style={{ position: "fixed", ...place }} />}
				data-testid="opener"
			>
				Open
			</DropdownMenuTrigger>
			<DropdownMenuContent side="bottom" align="start">
				{ROWS.map((row) => (
					<DropdownMenuItem key={row}>{row}</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const menu = () => page.getByRole("menu").element() as HTMLElement;

describe("where a floating thing stands (overlay.md, the place rule)", () => {
	it("a thing over words stays inside the body's box, its edge flush with it, and covers none of the words", async () => {
		function Body() {
			const [box, setBox] = useState<HTMLElement | null>(null);
			return (
				<div ref={setBox} style={{ position: "relative", marginLeft: 200, width: 300, height: 200 }} data-testid="body">
					<p style={{ margin: 0, paddingTop: 80 }}>
						Some words in a line of the body, long enough to wrap on a narrow box.
					</p>
					<Anchored
						anchor={{
							spot: () => ({ left: 490, top: (box?.getBoundingClientRect().top ?? 0) + 80, width: 0, height: 20 }),
						}}
						place="selection-above"
						within={box}
					>
						<div data-testid="card" style={{ width: 180, height: 32 }}>
							card
						</div>
					</Anchored>
				</div>
			);
		}
		render(<Body />);
		await expect.poll(() => document.querySelector("[data-testid=card]")).not.toBeNull();
		const body = document.querySelector("[data-testid=body]") as HTMLElement;
		const card = document.querySelector("[data-testid=card]") as HTMLElement;
		const edge = body.getBoundingClientRect();
		await expect.poll(() => card.getBoundingClientRect().right).toBeLessThanOrEqual(edge.right + 1);
		expect(card.getBoundingClientRect().left).toBeGreaterThanOrEqual(edge.left - 1);
		expect(coversText(card, body)).toEqual([]);
	});

	it("a menu with room for its minimum shrinks to scroll on its side, and flips only when there is less than that", async () => {
		render(menuFrom({ top: window.innerHeight - 260, left: 40 }));
		await expect.poll(() => document.querySelector("[role=menu]")).not.toBeNull();
		const opener = document.querySelector("[data-testid=opener]") as HTMLElement;
		// About 230px below the button: more than the 160px least, so it stays below and is cut short to scroll.
		await expect.poll(() => menu().getAttribute("data-side")).toBe("bottom");
		expect(menu().getBoundingClientRect().top).toBeGreaterThanOrEqual(opener.getBoundingClientRect().bottom);
		await expect.poll(() => menu().getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
		await expect.poll(() => menu().scrollHeight > menu().clientHeight).toBe(true);
	});

	it("a menu with less than its minimum below the button opens above it", async () => {
		render(menuFrom({ bottom: 40, left: 40 }));
		await expect.poll(() => document.querySelector("[role=menu]")).not.toBeNull();
		await expect.poll(() => menu().getAttribute("data-side")).toBe("top");
		await expect.poll(() => menu().getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
	});

	it("a second level meets the window's edge: it opens on the other side of its row, wholly in the window", async () => {
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger render={<button type="button" style={{ position: "fixed", top: 40, right: 0 }} />}>
					Open
				</DropdownMenuTrigger>
				<DropdownMenuContent side="bottom" align="end">
					<DropdownMenuSub defaultOpen>
						<DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
						<DropdownMenuSubContent data-testid="sub">
							<DropdownMenuItem>Inside</DropdownMenuItem>
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		await expect.poll(() => document.querySelector("[data-testid=sub]")).not.toBeNull();
		const sub = document.querySelector("[data-testid=sub]") as HTMLElement;
		await expect.poll(() => sub.getAttribute("data-side")).toBe("left");
		expect(sub.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
	});

	describe("with the review bar docked at the window's foot", () => {
		let undock = () => {};
		afterEach(() => undock());

		it("a menu never covers the bar: it stops above it, or opens on the other side", async () => {
			const bar = document.createElement("div");
			const held = document.createElement("div");
			held.style.cssText = "position:fixed;left:0;right:0;bottom:12px;height:40px";
			bar.append(held);
			document.body.append(bar);
			const off = dock(bar);
			undock = () => {
				off();
				bar.remove();
			};
			render(menuFrom({ top: window.innerHeight - 300, left: 40 }));
			await expect.poll(() => document.querySelector("[role=menu]")).not.toBeNull();
			const top = held.getBoundingClientRect().top;
			await expect
				.poll(() => menu().getBoundingClientRect().bottom <= top || menu().getAttribute("data-side") === "top")
				.toBe(true);
			await expect.poll(() => menu().getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
		});
	});
});
