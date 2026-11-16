import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "../test/render";
import { BulkBar } from "./bulk-bar";

it("letting go of the picked rows is a quiet text button at the bar's end, not a pill (components/list.md, bulk bar)", async () => {
	render(
		<BulkBar
			label="2개 선택"
			selectAll={{ state: "some", onChange: () => {}, label: "모두 선택" }}
			clearLabel="선택 해제"
			onClear={() => {}}
		/>,
	);
	const clear = page.getByRole("button", { name: "선택 해제" });
	await expect.element(clear).toBeVisible();
	const element = clear.element() as HTMLElement;
	expect(element.dataset.slot).not.toBe("button");
	const style = getComputedStyle(element);
	expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
	expect(style.paddingLeft).toBe("0px");
});

it("Esc lets go of the pick, unless the focus is in a field, a menu or a dialog", async () => {
	let cleared = 0;
	render(
		<>
			<BulkBar label="2개 선택" clearLabel="선택 해제" onClear={() => cleared++} />
			<input aria-label="찾기" />
			<div role="dialog" aria-label="창">
				<button type="button">안</button>
			</div>
		</>,
	);
	const press = (target: Element) =>
		target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
	await expect.element(page.getByRole("button", { name: "선택 해제" })).toBeVisible();
	press(document.body);
	expect(cleared).toBe(1);
	press(page.getByRole("textbox", { name: "찾기" }).element());
	press(page.getByRole("button", { name: "안" }).element());
	expect(cleared).toBe(1);
	press(page.getByRole("button", { name: "선택 해제" }).element());
	expect(cleared).toBe(2);
});
