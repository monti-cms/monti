import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { typeKorean } from "../../../../testing/input";
import * as entry from "../screens/entry/entry.stories";

const { Draft, NewEntry } = composeStories(entry);

const body = () => page.getByRole("textbox", { name: "본문" });
const menu = () => page.getByRole("listbox", { name: "블록" });

/** Whether the highlighted row is wholly inside the part of the menu that shows. */
function highlightInView() {
	const row = menu().getByRole("option", { selected: true }).element().getBoundingClientRect();
	const list = menu().element().getBoundingClientRect();
	return row.top >= list.top - 1 && row.bottom <= list.bottom + 1;
}

/** Presses where a word ends, as a person puts the caret after it. */
async function caretAfter(words: string) {
	const line = body().getByText(words, { exact: false }).element();
	const text = [...line.childNodes].find((node) => node.textContent?.includes(words));
	if (!text) throw new Error(`no text "${words}"`);
	const range = document.createRange();
	const end = (text.textContent ?? "").indexOf(words) + words.length;
	range.setStart(text, end - 1);
	range.setEnd(text, end);
	const glyph = range.getBoundingClientRect();
	const box = line.getBoundingClientRect();
	await userEvent.click(line, {
		position: { x: glyph.right - box.left - 1, y: glyph.top + glyph.height / 2 - box.top },
	});
}

describe("the '/' menu", () => {
	it("[keys-to-end] the arrow keys typed in the text take the highlight to the last row, which stays in view, and Enter puts it in", async () => {
		await NewEntry.run();
		await userEvent.click(body());
		await userEvent.keyboard("/");
		const rows = await menu().getByRole("option").all();
		expect(rows.length).toBeGreaterThan(10);
		for (let at = 1; at < rows.length; at++) {
			await userEvent.keyboard("{ArrowDown}");
			await expect
				.element(menu().getByRole("option", { selected: true }))
				.toHaveTextContent(rows[at]?.element().textContent ?? "");
			await expect.poll(highlightInView, { message: `row ${at + 1} of ${rows.length} is out of sight` }).toBe(true);
		}
		// The last row is the last template: "튜토리얼".
		await userEvent.keyboard("{Enter}");
		await expect.element(body().getByRole("heading", { name: "준비물" })).toBeVisible();
		await expect.element(menu()).not.toBeInTheDocument();
	});

	it("[mid-sentence] [korean] '/' typed after a word in a sentence opens the menu, and '각주' typed in Korean puts a footnote right there", async () => {
		await Draft.run();
		await caretAfter("지금 상태만");
		await userEvent.keyboard("/");
		await expect.element(menu()).toBeVisible();
		await typeKorean("각주");
		await expect.element(menu().getByRole("option", { selected: true })).toHaveTextContent("각주");
		await userEvent.keyboard("{Enter}");
		await expect.element(menu()).not.toBeInTheDocument();
		const line = body().getByText("목록에는 제목과 주소", { exact: false }).element();
		await expect
			.poll(() => line.textContent)
			.toBe("목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.");
		// The footnote itself is there too, one of it, not only its number.
		expect(body().element().querySelectorAll("[data-footnote]")).toHaveLength(1);
		// The number sits after "지금 상태만", not at the start or the end of the line.
		const ref = line.querySelector("[data-footnote-ref]");
		expect(ref?.previousSibling?.textContent?.endsWith("지금 상태만")).toBe(true);
	});
});
