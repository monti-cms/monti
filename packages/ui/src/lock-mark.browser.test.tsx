import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import { ChangeDot } from "./change-dot";
import { LockMark } from "./lock-mark";

it("the lock says why when pointed at: its name in a tooltip, the one a screen reader hears; the change dot has none", async () => {
	render(
		<p>
			공개 주소 <LockMark label="운영 사이트에서는 잠김" /> 미리보기 주소 <ChangeDot label="변경" />
		</p>,
	);
	const lock = page.getByRole("img", { name: "운영 사이트에서는 잠김" });
	await expect.element(lock).toBeVisible();
	// The mark itself, where the screens and their tests find it, and no stop of the Tab key.
	expect(lock.element().matches("svg[data-slot=lock-mark]")).toBe(true);
	expect((lock.element() as SVGElement).tabIndex).toBe(-1);
	const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;
	expect(tip()).toBe(null);
	await userEvent.hover(lock);
	// A longer wait than the default second: slow on CI's first open, as the table's tooltips are.
	await expect.poll(tip, { timeout: 5000 }).toBe("운영 사이트에서는 잠김");

	const dot = page.getByRole("img", { name: "변경" });
	await userEvent.hover(dot);
	await expect.poll(tip, { timeout: 5000 }).toBe(null);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(tip()).toBe(null);
});

it("a lock without words has no tooltip: nothing shows when it is pointed at", async () => {
	render(
		<p>
			식별자 <LockMark label="" />
		</p>,
	);
	const found = () => document.querySelector("[data-slot=lock-mark]");
	await expect.poll(found).not.toBeNull();
	await userEvent.hover(page.elementLocator(found() as Element));
	await new Promise((resolve) => setTimeout(resolve, 600));
	expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
});
