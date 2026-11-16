import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pickWords } from "../../../../testing/input";
import { scene } from "../../test/scene";
import * as entry from "../screens/entry/entry.stories";

const Checklist = scene({ loaders: entry.site("checklist") }, entry.default);
const Footnotes = scene({ loaders: entry.site("footnotes") }, entry.default);
const OwnFormat = scene({ loaders: entry.site("ownFormat") }, entry.default);

const body = () => page.getByRole("textbox", { name: "본문" });
const box = (item: string) =>
	body().getByRole("listitem").filter({ hasText: item }).getByRole("checkbox", { name: "완료" });

describe("what is pressed in the text answers the pointer", () => {
	it("a checklist's ticked item has the ✓ in its box, pressing the box ticks and unticks it, and it answers the pointer as a checkbox does", async () => {
		await Checklist.run();
		await expect.element(box("초안 쓰기")).toHaveAttribute("aria-checked", "true");
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "false");
		// The ✓ is drawn in the ticked box only (choice.md: a ticked checkbox has its ✓).
		const mark = (item: string) => getComputedStyle(box(item).element().querySelector("svg") as Element).visibility;
		expect(mark("초안 쓰기")).toBe("visible");
		expect(mark("발행하기")).toBe("hidden");
		// A ticked item keeps its ink: no doc strikes it through or greys it.
		const ticked = body().getByRole("listitem").filter({ hasText: "초안 쓰기" }).element();
		expect(getComputedStyle(ticked).textDecorationLine).toBe("none");

		const open = box("발행하기");
		expect(getComputedStyle(open.element()).cursor).toBe("pointer");
		await userEvent.hover(open);
		// The drawn box answers; what takes the press is 24px around it (HIT_AREA).
		const drawn = open.element().querySelector("[data-check-box]") as Element;
		await expect.poll(() => getComputedStyle(drawn).boxShadow).not.toBe("none");
		expect(getComputedStyle(open.element(), "::after").height).toBe("24px");
		await userEvent.click(open);
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "true");
		await userEvent.click(box("발행하기"));
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "false");
	});

	it("a right click on a checklist's box changes nothing; a press beside the box puts the caret before the item's words, and typed words go there", async () => {
		await Checklist.run();
		await userEvent.click(box("발행하기"), { button: "right" });
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "false");
		await userEvent.keyboard("{Escape}");
		const item = body().getByRole("listitem").filter({ hasText: "발행하기" });
		// In the gap between the box (14px) and the words (24px in).
		await userEvent.click(item, { position: { x: 19, y: 15 } });
		await userEvent.keyboard("곧 ");
		await expect.element(item).toHaveTextContent("곧 발행하기");
		// The box still stands first in the item, and still ticks.
		expect(item.element().firstElementChild?.hasAttribute("data-check")).toBe(true);
		await userEvent.click(box("곧 발행하기"));
		await expect.element(box("곧 발행하기")).toHaveAttribute("aria-checked", "true");
	});

	it("a checklist's boxes are stops of the keyboard: Tab from the text reaches them in order, Space ticks and unticks one, and the focus stays on it", async () => {
		await Checklist.run();
		await userEvent.click(body().getByText("내보내기 전에 할 일."));
		await userEvent.keyboard("{Tab}");
		await expect.element(box("초안 쓰기")).toHaveFocus();
		await userEvent.keyboard("{Tab}");
		await expect.element(box("발행하기")).toHaveFocus();
		await userEvent.keyboard(" ");
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "true");
		await expect.element(box("발행하기")).toHaveFocus();
		// The item's words did not take the space.
		await expect.element(body().getByRole("listitem").filter({ hasText: "발행하기" })).toHaveTextContent(/^발행하기$/);
		await userEvent.keyboard(" ");
		await expect.element(box("발행하기")).toHaveAttribute("aria-checked", "false");
		// The box draws the keyboard's line, as a checkbox does.
		expect(
			getComputedStyle(box("발행하기").element().querySelector("[data-check-box]") as Element).outlineStyle,
		).not.toBe("none");
	});

	it("a footnote's number in the text turns ink and underlined under the pointer", async () => {
		await Footnotes.run();
		await expect.poll(() => body().element().querySelector("[data-footnote-ref]")).not.toBeNull();
		const ref = body().element().querySelector("[data-footnote-ref]") as HTMLElement;
		expect(getComputedStyle(ref).textDecorationLine).toBe("none");
		await userEvent.hover(ref);
		await expect.poll(() => getComputedStyle(ref).textDecorationLine).toBe("underline");
	});

	it("the format card over picked words stands inside the text's box", async () => {
		await OwnFormat.run();
		await expect.element(body()).toBeVisible();
		await pickWords(body().element(), "나머지는 필요할 때 꺼내 본다.");
		const card = page.getByRole("toolbar", { name: "서식" });
		await expect.element(card).toBeVisible();
		const edge = body().element().getBoundingClientRect();
		const at = card.element().getBoundingClientRect();
		expect(at.left).toBeGreaterThanOrEqual(edge.left - 1);
		expect(at.right).toBeLessThanOrEqual(edge.right + 1);
	});

	it("on a wrapped paragraph the format card stands next to the picked words, on the second line and on a middle line, inside the body", async () => {
		await OwnFormat.run();
		await expect.element(body()).toBeVisible();
		const editor = (
			body().element() as unknown as {
				editor: {
					commands: {
						setContent: (html: string) => void;
						setTextSelection: (range: { from: number; to: number }) => void;
						focus: () => void;
					};
					view: { coordsAtPos: (pos: number) => { top: number; bottom: number; left: number } };
				};
			}
		).editor;
		const long = Array.from({ length: 70 }, (_, at) => `낱말${at + 1}`).join(" ");
		editor.commands.setContent(`<p>${long}</p><p>다음 문단</p>`);
		await expect.poll(() => body().element().querySelector("p")?.textContent).toBe(long);
		// Where each line of the paragraph begins, by position: the first position whose top is below the last line's.
		const starts: number[] = [1];
		let top = editor.view.coordsAtPos(1).top;
		for (let pos = 2; pos <= long.length; pos++) {
			const at = editor.view.coordsAtPos(pos).top;
			if (at > top + 5) {
				starts.push(pos);
				top = at;
			}
		}
		expect(starts.length).toBeGreaterThan(3);
		for (const line of [1, 2]) {
			const from = (starts[line] ?? 1) + 1;
			editor.commands.setTextSelection({ from, to: from + 4 });
			editor.commands.focus();
			const card = page.getByRole("toolbar", { name: "서식" });
			await expect.element(card).toBeVisible();
			// Next to the picked words, not at the paragraph's top: just above their line (it may cover the line above them), or just below it.
			const words = editor.view.coordsAtPos(from);
			await expect
				.poll(() => {
					const at = card.element().getBoundingClientRect();
					return Math.min(Math.abs(words.top - at.bottom), Math.abs(at.top - words.bottom));
				})
				.toBeLessThan(24);
			// The card's first button over the words' start (when the body's edge does not hold it back).
			expect(Math.abs(card.element().getBoundingClientRect().left - words.left)).toBeLessThan(3);
			const edge = body().element().getBoundingClientRect();
			expect(card.element().getBoundingClientRect().left).toBeGreaterThanOrEqual(edge.left - 1);
			expect(card.element().getBoundingClientRect().right).toBeLessThanOrEqual(edge.right + 1);
		}
	});

	it("where the words are the card stands above them (over the title's room if need be), not below them", async () => {
		await OwnFormat.run();
		await expect.element(body()).toBeVisible();
		await pickWords(body().element(), "나머지는 필요할 때 꺼내 본다.");
		const card = page.getByRole("toolbar", { name: "서식" });
		await expect.element(card).toBeVisible();
		const picked = () => window.getSelection()?.getRangeAt(0).getClientRects()[0]?.top ?? 0;
		await expect.poll(() => card.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(picked() + 1);
	});

	it("a site's own text format is a row of the format bar's ⋯, starting with an icon as every menu row does", async () => {
		await OwnFormat.run();
		await expect.element(body()).toBeVisible();
		await pickWords(body().element(), "나머지는 필요할 때 꺼내 본다.");
		await userEvent.click(page.getByRole("toolbar", { name: "서식" }).getByRole("button", { name: "다른 서식" }));
		const row = page.getByRole("option", { name: "형광펜" });
		await expect.element(row).toBeVisible();
		expect(row.element().querySelector("svg")).not.toBeNull();
		// Pressed, the format goes on the picked words.
		await userEvent.click(row);
		await expect.poll(() => body().element().querySelector(`span[data-monti-mark="highlight"]`)).not.toBeNull();
	});
});
