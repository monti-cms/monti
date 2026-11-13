import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, middleOf } from "../../../../testing/input";
import * as media from "../screens/entry/media.stories";

const { ManyInBody, OnlyWholeBlocks } = composeStories(media);

const body = () => page.getByRole("textbox", { name: "본문" });
const FIRST = "글의 첫 문단이에요.";
const paragraph = () => body().getByText(FIRST);
const picked = () => body().element().querySelector(".ProseMirror-selectednode");
const tools = () => body().element().querySelector("[role=toolbar]");
/** The pictures and files a range takes in, top to bottom: each by what it is. */
const covered = () =>
	[...body().element().querySelectorAll("[data-covered]")].map((block) =>
		block.matches("[data-block=file]") || block.querySelector("[data-block=file]") ? "file" : "picture",
	);
const blocks = () => body().element().querySelectorAll("[data-block=image], [data-block=file]").length;

describe("T193 a body that begins with a picture", () => {
	it("opens with nothing picked: no line around the picture and no tools, until it is pressed", async () => {
		await OnlyWholeBlocks.run();
		const first = body().getByRole("img", { name: "아침 책상" });
		await expect.element(first).toBeVisible();
		// The editor has made its first selection by the time the gap before the first block is marked: the place a body with no text opens at.
		await userEvent.keyboard("{Tab}");
		await expect.poll(() => body().element().querySelector(".ProseMirror-gapcursor")).not.toBeNull();
		expect(picked()).toBeNull();
		expect(tools()).toBeNull();
		await userEvent.click(first);
		await expect.poll(() => picked()?.contains(first.element())).toBe(true);
		await expect.poll(tools).not.toBeNull();
	});
});

describe("T194 a body whose text is followed only by pictures and files", () => {
	const caretAtEnd = async () => {
		await ManyInBody.run();
		await expect.element(body().getByRole("img", { name: "화면에 뜬 코드" })).toBeVisible();
		await userEvent.click(paragraph());
		await userEvent.keyboard("{End}");
	};

	it("Shift+↓ from the text's last line takes them in one by one, Shift+↑ gives them back, and Backspace takes out what is covered", async () => {
		await caretAtEnd();
		expect(covered()).toEqual([]);
		await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
		await expect.poll(covered).toEqual(["picture"]);
		await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
		await expect.poll(covered).toEqual(["picture", "file", "picture"]);
		// At the body's end there is no further to go, and the range stays.
		await userEvent.keyboard("{Shift>}{ArrowDown}{/Shift}");
		expect(covered()).toEqual(["picture", "file", "picture"]);
		// None of them is picked as a block: no tools are up.
		expect(picked()).toBeNull();
		expect(tools()).toBeNull();
		await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");
		await expect.poll(covered).toEqual(["picture", "file"]);
		await userEvent.keyboard("{Backspace}");
		await expect.poll(blocks).toBe(1);
		await expect.element(paragraph()).toBeVisible();
		await expect.element(body().getByRole("img", { name: "화면에 뜬 코드" })).toBeVisible();
	});

	it("Shift+→ at the text's end takes the picture after it, and Shift+← gives it back and goes on into the text", async () => {
		await caretAtEnd();
		await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
		await expect.poll(covered).toEqual(["picture"]);
		await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
		await expect.poll(covered).toEqual([]);
		await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
		await expect.poll(() => getSelection()?.toString()).toBe(".");
	});

	it("a drag that starts in the text and goes down over the pictures and the file takes each one it comes over, and they stay taken when the mouse is let go", async () => {
		await ManyInBody.run();
		await expect.element(body().getByRole("img", { name: "화면에 뜬 코드" })).toBeVisible();
		paragraph().element().scrollIntoView({ block: "start" });
		const words = paragraph().element().getBoundingClientRect();
		// As far down as the window shows: the mouse cannot go where the page is not drawn (a short window shows fewer of the three).
		const all = [...body().element().querySelectorAll<HTMLElement>("[data-block=image], [data-block=file]")];
		const kinds = ["picture", "file", "picture"];
		const reached = all.filter((block) => middleOf(block).y < window.innerHeight - 4);
		expect(reached.length).toBeGreaterThan(0);
		// Through each on the way, as a hand goes.
		await dragPath([{ x: words.left + 40, y: words.top + words.height / 2 }, ...reached.map(middleOf)], { steps: 12 });
		await expect.poll(covered).toEqual(kinds.slice(0, reached.length));
		// After the browser has said its own selection again.
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(covered()).toEqual(kinds.slice(0, reached.length));
		expect(picked()).toBeNull();
		// Part of the paragraph and what the drag took: Backspace takes them out, and the words before the drag's start stay.
		await userEvent.keyboard("{Backspace}");
		await expect.poll(blocks).toBe(all.length - reached.length);
		const left = body().element().querySelector("p")?.textContent ?? "";
		expect(left.length).toBeGreaterThan(0);
		expect(FIRST.startsWith(left)).toBe(true);
		expect(left).not.toBe(FIRST);
	});
});
