import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, middleOf } from "../../../../testing/input";
import * as media from "../screens/entry/media.stories";

const { ManyInBody, OnlyWholeBlocks, WithImage } = composeStories(media);

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
		// Long enough for a selection given at the start to have been drawn.
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(picked()).toBeNull();
		expect(tools()).toBeNull();
		await userEvent.click(first);
		await expect.poll(() => picked()?.contains(first.element())).toBe(true);
		await expect.poll(tools).not.toBeNull();
	});

	it("a picture after the first paragraph is not picked either when the entry opens", async () => {
		await WithImage.run();
		await expect.element(paragraph()).toBeVisible();
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(picked()).toBeNull();
		expect(tools()).toBeNull();
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

	it("a drag that starts in the text and ends on the last picture takes every picture and file between, and they stay taken when the mouse is let go", async () => {
		await ManyInBody.run();
		const last = body().getByRole("img", { name: "화면에 뜬 코드" });
		await expect.element(last).toBeVisible();
		const words = paragraph().element().getBoundingClientRect();
		const file = body().element().querySelector("[data-block=file]") as HTMLElement;
		// Through the file on the way, as a hand goes.
		await dragPath(
			[{ x: words.left + 40, y: words.top + words.height / 2 }, middleOf(file), middleOf(last.element())],
			{
				steps: 12,
			},
		);
		await expect.poll(covered).toEqual(["picture", "file", "picture"]);
		// After the browser has said its own selection again.
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(covered()).toEqual(["picture", "file", "picture"]);
		expect(picked()).toBeNull();
		// Part of the paragraph and all three: Backspace takes them out, and the words before the drag's start stay.
		await userEvent.keyboard("{Backspace}");
		await expect.poll(blocks).toBe(0);
		const left = body().element().querySelector("p")?.textContent ?? "";
		expect(left.length).toBeGreaterThan(0);
		expect(FIRST.startsWith(left)).toBe(true);
		expect(left).not.toBe(FIRST);
	});
});
