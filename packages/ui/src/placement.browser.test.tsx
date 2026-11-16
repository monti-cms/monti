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
	MemoCardPopover,
	Popover,
	PopoverContent,
	PopoverTrigger,
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
	it("a thing over words stands above the line it stands for with words around it, inside the body's box, and covers none; a panel that narrows the body keeps it inside", async () => {
		function Page() {
			const [box, setBox] = useState<HTMLElement | null>(null);
			const [panel, setPanel] = useState(0);
			return (
				<div style={{ display: "flex", width: 700 }}>
					<div ref={setBox} style={{ position: "relative", marginLeft: 100, flex: 1, minWidth: 0 }} data-testid="body">
						<p style={{ margin: 0 }}>Words above, in a line of their own.</p>
						<div style={{ height: 60 }} />
						<p data-testid="line" style={{ margin: 0 }}>
							Words the card stands for, a line long enough to run across the whole of the box.
						</p>
						<p style={{ margin: 0 }}>Words below the line.</p>
						<Anchored
							anchor={{
								spot: () => {
									const edge = box?.getBoundingClientRect();
									const line = document.querySelector("[data-testid=line]")?.getBoundingClientRect();
									return { left: (edge?.right ?? 0) - 10, top: line?.top ?? 0, width: 0, height: 20 };
								},
								context: box ?? undefined,
							}}
							place="selection-above"
							within={box}
						>
							<div data-testid="card" style={{ width: 180, height: 32 }}>
								card
							</div>
						</Anchored>
					</div>
					<div data-testid="panel" style={{ width: panel }} />
					<button type="button" onClick={() => setPanel(260)}>
						open panel
					</button>
				</div>
			);
		}
		render(<Page />);
		await expect.poll(() => document.querySelector("[data-testid=card]")).not.toBeNull();
		const body = document.querySelector("[data-testid=body]") as HTMLElement;
		const card = document.querySelector("[data-testid=card]") as HTMLElement;
		const line = document.querySelector("[data-testid=line]") as HTMLElement;
		const inside = () => {
			const edge = body.getBoundingClientRect();
			const at = card.getBoundingClientRect();
			return at.left >= edge.left - 1 && at.right <= edge.right + 1;
		};
		await expect.poll(inside).toBe(true);
		// Over the line it stands for, not on it, with the words above it left clear.
		expect(card.getBoundingClientRect().bottom).toBeLessThanOrEqual(line.getBoundingClientRect().top);
		expect(coversText(card, body)).toEqual([]);
		const before = body.getBoundingClientRect().width;
		await page.getByRole("button", { name: "open panel" }).click();
		await expect.poll(() => body.getBoundingClientRect().width).toBeLessThan(before - 100);
		await expect.poll(inside).toBe(true);
	});

	it("a card taller than the room left shrinks to scroll on its side (a popover), and so does a memo card; neither is cut by the window", async () => {
		const tall = Array.from({ length: 40 }, (_, at) => (
			<p key={at}>Line {at + 1} of a card that is longer than the window.</p>
		));
		render(
			<>
				<Popover defaultOpen>
					<PopoverTrigger
						render={<button type="button" style={{ position: "fixed", top: window.innerHeight - 300, left: 40 }} />}
					>
						Open
					</PopoverTrigger>
					<PopoverContent data-testid="popover" side="bottom">
						{tall}
					</PopoverContent>
				</Popover>
				<div
					data-testid="memo-from"
					style={{ position: "fixed", top: window.innerHeight - 300, left: 400, width: 10, height: 10 }}
				/>
				<MemoCardPopover
					open
					onOpenChange={() => undefined}
					anchor={() => document.querySelector("[data-testid=memo-from]")}
				>
					{tall}
				</MemoCardPopover>
			</>,
		);
		await expect.poll(() => document.querySelector("[data-testid=popover]")).not.toBeNull();
		const popover = document.querySelector("[data-testid=popover]") as HTMLElement;
		await expect.poll(() => popover.getAttribute("data-side")).toBe("bottom");
		await expect.poll(() => popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
		await expect.poll(() => popover.scrollHeight > popover.clientHeight).toBe(true);
		const memo = () => document.querySelector("[data-slot=memo-card]")?.closest("[data-side]") as HTMLElement | null;
		await expect.poll(() => memo()?.getAttribute("data-side")).toBe("bottom");
		await expect.poll(() => memo()?.getBoundingClientRect().bottom ?? 9999).toBeLessThanOrEqual(window.innerHeight);
		await expect.poll(() => (memo()?.scrollHeight ?? 0) > (memo()?.clientHeight ?? 0)).toBe(true);
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
