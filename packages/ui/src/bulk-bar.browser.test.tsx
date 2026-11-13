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
