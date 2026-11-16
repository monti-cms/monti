import { useState } from "react";
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
	it("a combobox that is off (`disabled`, a form that is busy) is off for the keyboard too: Tab passes it by, and nothing can be typed in it (T131)", async () => {
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

	it("[AT-29] a read-only combobox is a value to read: full ink, the keyboard stops on it, and neither the keyboard nor the pointer changes it or opens its list", async () => {
		const changed: unknown[] = [];
		render(
			<div style={{ width: 280 }}>
				<input aria-label="앞" />
				<Combobox items={["개발", "일상"]} value="개발" readOnly onValueChange={(next) => changed.push(next)}>
					<ComboboxInput aria-label="카테고리" showClear />
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
				<Combobox
					items={["리액트", "성능"]}
					multiple
					value={["리액트"]}
					readOnly
					onValueChange={(next) => changed.push(next)}
				>
					<ComboboxChips>
						<ComboboxChip>리액트</ComboboxChip>
						<ComboboxChipsInput aria-label="태그" />
					</ComboboxChips>
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const one = page.getByRole("combobox", { name: "카테고리" });
		const many = page.getByRole("combobox", { name: "태그" });
		await expect.element(one).toHaveAttribute("readonly");
		await expect.element(many).toHaveAttribute("readonly");
		// Not off: in full ink, and the keyboard reaches both to read them.
		const oneField = one.element().closest("[data-slot=combobox-input]") as HTMLElement;
		const manyField = many.element().closest("[data-slot=combobox-chips]") as HTMLElement;
		expect(getComputedStyle(oneField).opacity).toBe("1");
		expect(getComputedStyle(manyField).opacity).toBe("1");
		await userEvent.click(page.getByRole("textbox", { name: "앞" }));
		await userEvent.keyboard("{Tab}");
		await expect.element(one).toHaveFocus();
		// Nothing that changes the value is drawn: no caret to open, no clear, no × on a chip.
		const shown = (slot: string, within: HTMLElement) =>
			[...within.querySelectorAll<HTMLElement>(`[data-slot=${slot}]`)].filter(
				(each) => getComputedStyle(each).display !== "none",
			);
		expect(shown("combobox-trigger", oneField)).toHaveLength(0);
		expect(shown("combobox-clear", oneField)).toHaveLength(0);
		expect(shown("combobox-chip-remove", manyField)).toHaveLength(0);
		// The keyboard: typing, the arrows and Backspace leave the value and open no list.
		await userEvent.keyboard("x{ArrowDown}{Enter}{Backspace}");
		await expect.element(one).toHaveValue("개발");
		await userEvent.keyboard("{Tab}");
		await expect.element(many).toHaveFocus();
		await userEvent.keyboard("x{ArrowDown}{Enter}{Backspace}{Backspace}");
		await expect.element(page.getByText("리액트")).toBeVisible();
		// The pointer: a press on either opens nothing.
		await userEvent.click(one);
		await userEvent.click(many);
		expect(document.querySelector("[role=listbox]")).toBeNull();
		expect(changed).toEqual([]);
	});

	it("[AT-29] a read-only field of many says its values with its input: the keyboard stops on the input, which is described by the chips' words", async () => {
		render(
			<div style={{ width: 280 }}>
				{[true, false].map((readOnly) => (
					<Combobox
						key={String(readOnly)}
						items={["리액트", "성능"]}
						multiple
						value={["리액트", "성능"]}
						readOnly={readOnly}
					>
						<ComboboxChips>
							<ComboboxChip>리액트</ComboboxChip>
							<ComboboxChip>성능</ComboboxChip>
							<ComboboxChipsInput aria-label={readOnly ? "읽는 태그" : "태그"} />
						</ComboboxChips>
					</Combobox>
				))}
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "읽는 태그" })).toHaveAccessibleDescription("리액트 성능");
		// A field that can be changed walks its chips with the arrows: its input is not described by them.
		await expect.element(page.getByRole("combobox", { name: "태그", exact: true })).toHaveAccessibleDescription("");
	});

	it("[AT-29] a combobox that becomes read-only stops opening, and one that stops being read-only opens again", async () => {
		function Field({ multiple }: { multiple: boolean }) {
			const [readOnly, setReadOnly] = useState(!multiple);
			const name = multiple ? "여럿" : "하나";
			const list = (
				<ComboboxContent>
					<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
				</ComboboxContent>
			);
			return (
				<>
					<button type="button" onClick={() => setReadOnly(!readOnly)}>
						{name} 바꾸기
					</button>
					{multiple ? (
						<Combobox items={["리액트", "성능"]} multiple defaultValue={["리액트"]} readOnly={readOnly}>
							<ComboboxChips>
								<ComboboxChip>리액트</ComboboxChip>
								<ComboboxChipsInput aria-label={name} />
							</ComboboxChips>
							{list}
						</Combobox>
					) : (
						<Combobox items={["리액트", "성능"]} defaultValue="리액트" readOnly={readOnly}>
							<ComboboxInput aria-label={name} />
							{list}
						</Combobox>
					)}
				</>
			);
		}
		render(
			<div style={{ width: 280 }}>
				<Field multiple={false} />
				<Field multiple />
			</div>,
		);
		const options = () => page.getByRole("option").elements().length;
		// First drawn read-only, then not: the list opens, to the pointer and to the keyboard.
		const one = page.getByRole("combobox", { name: "하나" });
		await userEvent.click(one);
		expect(options()).toBe(0);
		await userEvent.click(page.getByRole("button", { name: "하나 바꾸기" }));
		await expect.element(one).not.toHaveAttribute("readonly");
		await userEvent.click(one);
		await expect.poll(options).toBeGreaterThan(0);
		await userEvent.keyboard("{Escape}");
		await expect.poll(options).toBe(0);
		// First drawn open to change, then read-only: neither a press nor the arrow opens it.
		const many = page.getByRole("combobox", { name: "여럿" });
		await userEvent.click(page.getByRole("button", { name: "여럿 바꾸기" }));
		await expect.element(many).toHaveAttribute("readonly");
		await userEvent.click(many);
		await userEvent.keyboard("{ArrowDown}");
		expect(options()).toBe(0);
	});

	it("[AT-29] a field of many values that is off looks off like a field of one: dimmed once, with or without a × on its chips", async () => {
		render(
			<div style={{ width: 280 }}>
				<Combobox items={["개발", "일상"]} value="개발" disabled>
					<ComboboxInput aria-label="하나" />
				</Combobox>
				{[true, false].map((remove) => (
					<Combobox key={String(remove)} items={["리액트", "성능"]} multiple value={["리액트"]} disabled>
						<ComboboxChips>
							<ComboboxChip showRemove={remove}>리액트</ComboboxChip>
							<ComboboxChipsInput aria-label={remove ? "지울 수 있는 여럿" : "여럿"} />
						</ComboboxChips>
					</Combobox>
				))}
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "여럿", exact: true })).toBeDisabled();
		const one = page
			.getByRole("combobox", { name: "하나" })
			.element()
			.closest("[data-slot=combobox-input]") as HTMLElement;
		expect(getComputedStyle(one).opacity).toBe("0.45");
		for (const name of ["지울 수 있는 여럿", "여럿"]) {
			const field = page
				.getByRole("combobox", { name, exact: true })
				.element()
				.closest("[data-slot=combobox-chips]") as HTMLElement;
			expect(getComputedStyle(field).opacity).toBe("0.45");
			expect(getComputedStyle(field.querySelector("[data-slot=combobox-chip]") as HTMLElement).opacity).toBe("1");
		}
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
		// Under the pointer too: a plain chip's × turns ink there, a proposed one's stays blue.
		const blue = color(chip);
		await userEvent.hover(remove as Element);
		expect(color(remove)).toBe(blue);
	});
});
