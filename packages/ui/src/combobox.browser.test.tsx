import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "./index";

describe("Combobox", () => {
	it("a combobox that is off is off for the keyboard too: Tab passes it by, and nothing can be typed in it (T131)", async () => {
		render(
			<div style={{ width: 280 }}>
				<input aria-label="앞" />
				<Combobox items={["개발", "일상"]} value="개발" disabled>
					<ComboboxInput aria-label="카테고리" showClear />
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
				<Combobox items={["리액트", "성능"]} multiple value={["리액트"]} disabled>
					<ComboboxChips>
						<ComboboxChip>리액트</ComboboxChip>
						<ComboboxChipsInput aria-label="태그" />
					</ComboboxChips>
				</Combobox>
				<input aria-label="뒤" />
			</div>,
		);
		const field = page.getByRole("combobox", { name: "카테고리" });
		await expect.element(field).toBeDisabled();
		// The field of many values too.
		await expect.element(page.getByRole("combobox", { name: "태그" })).toBeDisabled();
		await userEvent.click(page.getByRole("textbox", { name: "앞" }));
		await userEvent.keyboard("{Tab}");
		await expect.element(page.getByRole("textbox", { name: "뒤" })).toHaveFocus();
	});

	it("a field of many values the assistant proposed is as high as any (32px at md), and each chip's words and × are the proposal's blue", async () => {
		render(
			<div style={{ width: 280 }}>
				{[false, true].map((proposal) => (
					<Combobox key={String(proposal)} items={["리액트", "성능"]} multiple value={["리액트"]}>
						<ComboboxChips size="md" proposal={proposal}>
							<ComboboxChip>리액트</ComboboxChip>
							<ComboboxChipsInput aria-label={proposal ? "제안한 태그" : "태그"} />
						</ComboboxChips>
					</Combobox>
				))}
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "제안한 태그", exact: true })).toBeVisible();
		const fieldOf = (name: string) =>
			page.getByRole("combobox", { name, exact: true }).element().closest("[data-slot=combobox-chips]") as HTMLElement;
		const plain = fieldOf("태그");
		const proposed = fieldOf("제안한 태그");
		expect(plain.getBoundingClientRect().height).toBe(32);
		expect(proposed.getBoundingClientRect().height).toBe(32);
		const color = (element: Element | null) => getComputedStyle(element as Element).color;
		const chip = proposed.querySelector("[data-slot=combobox-chip]");
		const remove = proposed.querySelector("[data-slot=combobox-chip-remove]");
		// The × is the chip's own blue, not the grey of a plain chip's.
		expect(color(remove)).toBe(color(chip));
		expect(color(chip)).not.toBe(color(plain.querySelector("[data-slot=combobox-chip]")));
		expect(color(remove)).not.toBe(color(plain.querySelector("[data-slot=combobox-chip-remove]")));
	});
});
