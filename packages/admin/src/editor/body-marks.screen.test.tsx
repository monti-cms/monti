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
