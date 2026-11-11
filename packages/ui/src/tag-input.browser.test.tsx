import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { scrollsSideways } from "../../../testing/input";
import { render } from "../test/render";
import { Box, TagInput } from "./index";

const MANY = Array.from({ length: 40 }, (_, at) => `선택지-${at + 1}`);

describe("TagInput", () => {
	it("[many] forty values in a narrow column: the chips go on to more lines inside the field, and nothing scrolls sideways", async () => {
		render(
			<Box width="sheet">
				<TagInput items={MANY} onChange={() => {}} removeLabel={(item) => `${item} 빼기`} aria-label="선택지" />
			</Box>,
		);
		const last = page.getByRole("button", { name: "선택지-40 빼기" });
		await expect.element(last).toBeVisible();
		const field = document.querySelector("[data-slot=tag-input]") as HTMLElement;
		const box = field.getBoundingClientRect();
		const chip = last.element().getBoundingClientRect();
		expect(chip.right).toBeLessThanOrEqual(box.right + 1);
		expect(chip.bottom).toBeLessThanOrEqual(box.bottom + 1);
		expect(box.right).toBeLessThanOrEqual(field.parentElement?.getBoundingClientRect().right ?? 0);
		expect(scrollsSideways(field)).toEqual([]);
	});
});
