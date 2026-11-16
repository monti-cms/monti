import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../test/render";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxCreate,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "./index";

const LONG = "아주 길고 긴 카테고리 이름이 카드 하나의 폭보다 훨씬 더 길게 이어집니다";
const tip = () => document.querySelector('[data-slot="tooltip-content"]')?.textContent ?? null;

describe("menu rows", () => {
	it("[PP-39] a row whose name is wider than its card is cut with an ellipsis, and the pointer on it says the name whole", async () => {
		render(
			<div style={{ width: 160 }}>
				<Combobox items={[LONG, "짧은 이름"]} defaultOpen>
					<ComboboxInput aria-label="카테고리" />
					<ComboboxContent>
						<ComboboxList>{(item: string) => <ComboboxItem value={item}>{item}</ComboboxItem>}</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const row = page.getByRole("option", { name: LONG });
		await expect.element(row).toBeVisible();
		const words = row.element().querySelector("[data-slot=cut-words]") as HTMLElement;
		const card = row.element().closest("[data-slot=combobox-content]") as HTMLElement;
		expect(getComputedStyle(words).textOverflow).toBe("ellipsis");
		expect(words.scrollWidth).toBeGreaterThan(words.clientWidth);
		// Nothing runs out of the card.
		expect(words.getBoundingClientRect().right).toBeLessThanOrEqual(card.getBoundingClientRect().right);
		await userEvent.hover(words, { position: { x: 12, y: 8 } });
		await expect.poll(tip).toBe(LONG);
		// A name that fits says nothing more.
		const short = page.getByRole("option", { name: "짧은 이름" }).element();
		await userEvent.hover(short.querySelector("[data-slot=cut-words]") as HTMLElement);
		await expect.poll(tip).toBe(null);
	});

	it("[PP-33] the row that creates a value has its own mark and a rule above it, and is not drawn as a value of the list", async () => {
		render(
			<div style={{ width: 240 }}>
				<Combobox items={["봄", "new:가"]} defaultOpen>
					<ComboboxInput aria-label="태그" />
					<ComboboxContent>
						<ComboboxList>
							{(item: string) =>
								item.startsWith("new:") ? (
									<ComboboxCreate value={item}>새로 만들기: 가</ComboboxCreate>
								) : (
									<ComboboxItem value={item}>{item}</ComboboxItem>
								)
							}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</div>,
		);
		const create = page.getByRole("option", { name: "새로 만들기: 가" });
		await expect.element(create).toBeVisible();
		const value = page.getByRole("option", { name: "봄" }).element();
		expect(create.element().querySelector("svg")).not.toBeNull();
		expect(value.querySelector("svg")).toBeNull();
		// It stands apart from the rows above it: a gap and the rule's own line, as a menu's groups are.
		const gap = create.element().getBoundingClientRect().top - value.getBoundingClientRect().bottom;
		expect(gap).toBeGreaterThan(7);
		const rule = getComputedStyle(create.element(), "::before");
		expect(rule.height).toBe("1px");
	});
});

describe("a field of many values", () => {
	it("[PP-06] has the open button at the end of its first line, as a field of one value does, and it stays inside the field", async () => {
		render(
			<div style={{ width: 280 }}>
				<Combobox items={["봄", "여름"]} value="봄">
					<ComboboxInput aria-label="하나" size="md" />
				</Combobox>
				<Combobox items={["봄", "여름"]} multiple value={["봄"]}>
					<ComboboxChips size="md">
						<ComboboxChip>봄</ComboboxChip>
						<ComboboxChipsInput aria-label="여럿" />
					</ComboboxChips>
				</Combobox>
			</div>,
		);
		await expect.element(page.getByRole("combobox", { name: "여럿" })).toBeVisible();
		const one = page
			.getByRole("combobox", { name: "하나" })
			.element()
			.closest("[data-slot=combobox-input]") as HTMLElement;
		const many = page
			.getByRole("combobox", { name: "여럿" })
			.element()
			.closest("[data-slot=combobox-chips]") as HTMLElement;
		const opener = (box: HTMLElement) => box.querySelector("[data-slot=combobox-trigger]") as HTMLElement;
		expect(opener(one)).not.toBeNull();
		expect(opener(many)).not.toBeNull();
		const field = many.getBoundingClientRect();
		const button = opener(many).getBoundingClientRect();
		// At the right end, inside the field, and the field is as high as one of one value (the button does not make it taller).
		expect(button.right).toBeLessThanOrEqual(field.right);
		expect(field.right - button.right).toBeLessThan(12);
		expect(button.top).toBeGreaterThanOrEqual(field.top);
		expect(button.bottom).toBeLessThanOrEqual(field.bottom);
		expect(field.height).toBe(one.getBoundingClientRect().height);
		// The chevron is the same mark in both.
		expect(opener(many).querySelector("[data-slot=caret]")).not.toBeNull();
	});
});
