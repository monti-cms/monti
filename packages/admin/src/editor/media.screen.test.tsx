import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pointerPath, typeKorean } from "../../../../testing/input";
import * as media from "../screens/entry/media.stories";

const { Draft, WithImage, NoStorage, LibraryWindow } = composeStories(media);

const body = () => page.getByRole("textbox", { name: "본문" });
const paragraph = (text: string) => body().getByText(text);
const slashRow = (name: RegExp) => page.getByRole("option", { name });

async function caretAfter(text: string) {
	const line = paragraph(text);
	await userEvent.click(line);
	await userEvent.keyboard("{End}");
}

async function slash(word = "") {
	await userEvent.keyboard(`/${word}`);
}

/** Pictures pasted into the focused text, as the browser hands them over (a real ⌘V is L5's). */
async function paste(...files: File[]) {
	const clipboardData = new DataTransfer();
	for (const file of files) clipboardData.items.add(file);
	const target = body().element();
	target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
}

const canvasFile = async (name: string) => {
	const canvas = new OffscreenCanvas(64, 48);
	const context = canvas.getContext("2d");
	if (context) {
		context.fillStyle = "#335577";
		context.fillRect(0, 0, 64, 48);
	}
	return new File([await canvas.convertToBlob({ type: "image/png" })], name, { type: "image/png" });
};

describe("from the library", () => {
	it("09-3 [flow 6·29] [line-start] '/ 이미지' on an empty line opens the library's images, and the pick goes in", async () => {
		await Draft.run();
		await userEvent.click(body());
		await userEvent.keyboard("{Control>}{End}{/Control}{Meta>}{ArrowDown}{/Meta}{Enter}");
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("heading", { name: "라이브러리" })).toBeVisible();
		await expect.element(dialog.getByText("모든 이미지")).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: "넣기" })).not.toBeInTheDocument();
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await userEvent.click(dialog.getByRole("button", { name: "넣기" }));
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
	});

	it("09-3 searching drops what was picked: what goes in is always a file in sight", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await expect.element(dialog.getByRole("button", { name: "넣기" })).toBeVisible();
		await userEvent.fill(dialog.getByRole("textbox", { name: "파일 이름 검색" }), "없는 파일");
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).not.toBeInTheDocument();
		await expect.element(dialog.getByRole("button", { name: "넣기" })).not.toBeInTheDocument();
	});

	it("09-3 [mid-sentence] '/' between words: the file goes next to the sentence, which stays whole", async () => {
		await Draft.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await userEvent.click(dialog.getByRole("button", { name: "넣기" }));
		await expect.element(paragraph("글의 첫 문단")).toBeVisible();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
	});

	it("09-3 [flow 6·37, 6·38] [korean] '/ 파일' finds through composing, shows files only, and the file block says its type and size", async () => {
		await Draft.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await userEvent.keyboard("{End}/");
		await typeKorean("파일");
		await expect.element(slashRow(/파일/)).toBeVisible();
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByText("모든 파일")).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).not.toBeInTheDocument();
		await userEvent.click(dialog.getByRole("button", { name: /notes-scan/ }));
		await userEvent.click(dialog.getByRole("button", { name: "넣기" }));
		await expect.element(body().getByRole("group").filter({ hasText: "PDF" })).toHaveTextContent("2.1 MB");
	});

	it("[esc-closes] Esc closes the window with nothing put in, the caret back in the text", async () => {
		await Draft.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await userEvent.keyboard("{End}");
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).not.toBeInTheDocument();
		await expect.element(body()).toHaveFocus();
	});

	it("[many] the library's window searches by name", async () => {
		await Draft.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await userEvent.keyboard("{End}");
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await userEvent.fill(dialog.getByRole("textbox", { name: "파일 이름 검색" }), "desk");
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /seoul-night/ })).not.toBeInTheDocument();
	});

	it("09-1 with no storage the '/' menu has no image or file row", async () => {
		await NoStorage.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await userEvent.keyboard("{End}");
		await slash();
		await expect.element(slashRow(/^제목/).first()).toBeVisible();
		await expect.element(slashRow(/^이미지/)).not.toBeInTheDocument();
		await expect.element(slashRow(/^파일/)).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
	});
});

describe("pasting", () => {
	it("09-3 [flow 6·05] a pasted picture goes in at once with no window, its caption there from the start and kept when it lands", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(await canvasFile("pasted.png"));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		const caption = body().getByRole("textbox", { name: "캡션" });
		await expect.element(caption).toBeVisible();
		await userEvent.fill(caption, "붙여 넣은 그림");
		await expect.element(body().getByRole("progressbar")).not.toBeInTheDocument();
		await expect.element(caption).toHaveValue("붙여 넣은 그림");
	});

	it("09-3 [write-on] writing on after a pasted picture: the words go after it, and the picture stays", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(await canvasFile("pasted.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		await userEvent.keyboard("이어 쓴 글");
		await expect.element(paragraph("이어 쓴 글")).toBeVisible();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		const blocks = [...body().element().children].map((block) => block.textContent ?? "");
		const image = [...body().element().children].findIndex((block) => block.querySelector("[data-slot='image'], img"));
		expect(blocks.findIndex((text) => text.includes("이어 쓴 글"))).toBeGreaterThan(image);
	});

	it("09-3 [write-on] a picture pasted at the very end leaves a line to write on", async () => {
		await Draft.run();
		await userEvent.click(body());
		await userEvent.keyboard("{Control>}{End}{/Control}{Meta>}{ArrowDown}{/Meta}");
		await paste(await canvasFile("last.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		await userEvent.keyboard("마지막 줄");
		await expect.element(paragraph("마지막 줄")).toBeVisible();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
	});

	it("09-3 [several-at-once] two pictures pasted at once both go in", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(await canvasFile("one.png"), await canvasFile("two.png"));
		await expect.poll(() => body().getByRole("textbox", { name: "캡션" }).elements().length).toBe(2);
	});

	it("09-3 a picture pasted while another is selected goes after it", async () => {
		await WithImage.run();
		const first = body().getByRole("img").first();
		await userEvent.click(first);
		await expect.element(body().getByRole("toolbar")).toBeVisible();
		await paste(await canvasFile("second.png"));
		await expect.poll(() => body().getByRole("textbox", { name: "캡션" }).elements().length).toBe(2);
	});

	it("09-3 [in-block] a picture pasted in a list item goes right after that item, and the list goes on after it", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await userEvent.keyboard("{Enter}- 첫째{Enter}둘째{Enter}셋째");
		await caretAfter("첫째");
		await paste(await canvasFile("in-list.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		const lists = body().getByRole("list").elements();
		expect(lists.map((list) => list.textContent)).toEqual(["첫째", "둘째셋째"]);
	});

	it("09-3 [in-block] [write-on] in a list's last item the picture goes after the list, and the words after it stay out of the list", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await userEvent.keyboard("{Enter}- 첫째{Enter}둘째");
		await caretAfter("둘째");
		await paste(await canvasFile("after-list.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		await userEvent.keyboard("목록 밖의 글");
		await expect.element(paragraph("목록 밖의 글")).toBeVisible();
		const lists = body().getByRole("list").elements();
		expect(lists.map((list) => list.textContent)).toEqual(["첫째둘째"]);
	});

	it("09-3 [in-block] an empty list item gives its place to the picture", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await userEvent.keyboard("{Enter}- 첫째{Enter}");
		await paste(await canvasFile("empty-item.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		const lists = body().getByRole("list").elements();
		expect(lists.map((list) => list.textContent)).toEqual(["첫째"]);
	});

	it("09-3 [in-block] in a numbered list the count goes on after the picture", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await userEvent.keyboard("{Enter}1. 하나{Enter}둘{Enter}셋");
		await caretAfter("하나");
		await paste(await canvasFile("in-steps.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		const lists = body().getByRole("list").elements();
		expect(lists.map((list) => list.textContent)).toEqual(["하나", "둘셋"]);
		expect(lists[1]?.getAttribute("start")).toBe("2");
	});

	it("09-1 a file that will not go up says why in its place, and can be taken out", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], "broken.png", {
				type: "image/png",
			}),
		);
		await expect.element(body().getByText("읽을 수 없는 그림")).toBeVisible();
		await userEvent.click(body().getByRole("button", { name: "빼기" }));
		await expect.element(body().getByText("broken.png")).not.toBeInTheDocument();
	});

	it("09-4 a pasted picture is in the library, used by the entry once saved", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(await canvasFile("pasted-saved.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect.element(page.getByRole("button", { name: /할 일/ })).toHaveTextContent("1");
	});
});

describe("an image in the text", () => {
	const image = () => body().getByRole("img", { name: "아침 책상" });
	const bar = () => body().getByRole("toolbar");

	it("09-1 [flow 6·06] [reach] picking it shows its tools, and the pointer can get to them from the picture", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await expect.element(bar()).toBeVisible();
		const from = image().element().getBoundingClientRect();
		const to = bar().getByRole("button", { name: "가운데 정렬" }).element().getBoundingClientRect();
		await pointerPath([
			{ x: from.left + 40, y: from.top + 40 },
			{ x: to.left + to.width / 2, y: to.top + to.height / 2 },
		]);
		await expect.element(bar()).toBeVisible();
		await userEvent.click(bar().getByRole("button", { name: "오른쪽 정렬" }));
		await expect.element(bar().getByRole("button", { name: "오른쪽 정렬" })).toHaveAttribute("aria-pressed", "true");
	});

	it("[leave] picking something else takes its tools away", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await expect.element(bar()).toBeVisible();
		await userEvent.click(paragraph("글의 첫 문단"));
		await expect.element(bar()).not.toBeInTheDocument();
	});

	it("09-1 [flow 1·12] the settings card takes alt text, says when it is missing, and a decorative picture needs none", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "설정" }));
		const alt = page.getByRole("textbox", { name: "대체 텍스트" });
		await userEvent.clear(alt);
		await expect.element(page.getByText("이 그림이 말하는 것을 쓰거나 장식 이미지로 두세요.")).toBeVisible();
		await userEvent.click(page.getByRole("switch", { name: "장식 이미지" }));
		await expect.element(page.getByText("이 그림이 말하는 것을 쓰거나 장식 이미지로 두세요.")).not.toBeInTheDocument();
	});

	it("09-1 [flow 1·12] the alt text counts as it is written, up to 80", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "설정" }));
		await expect.element(page.getByText("5 / 80")).toBeVisible();
	});

	it("[korean] alt text in the settings card is composed whole, too", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "설정" }));
		const alt = page.getByRole("textbox", { name: "대체 텍스트" });
		await userEvent.clear(alt);
		await typeKorean("책상 위 커피");
		await expect.element(alt).toHaveValue("책상 위 커피");
	});

	it("[korean] the caption is typed in place, composed whole, and stays in the text around it", async () => {
		await WithImage.run();
		const caption = body().getByRole("textbox", { name: "캡션" });
		await userEvent.click(caption);
		await typeKorean("아침의 책상");
		await expect.element(caption).toHaveValue("아침의 책상");
		await expect.element(paragraph("글의 첫 문단")).toBeVisible();
	});

	it("09-1 [dragging] [dropped] a corner dragged changes the width, and stays where it was let go", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const corner = body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" });
		const before = image().element().getBoundingClientRect();
		const box = corner.element().getBoundingClientRect();
		const at = { clientX: box.left + 4, clientY: box.top + 4 };
		corner.element().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, ...at }));
		window.dispatchEvent(new PointerEvent("pointermove", { clientX: at.clientX - 120, clientY: at.clientY }));
		await expect.poll(() => image().element().getBoundingClientRect().width).toBeLessThan(before.width - 100);
		window.dispatchEvent(new PointerEvent("pointerup", { clientX: at.clientX - 120, clientY: at.clientY }));
		await expect
			.poll(() => Math.round(image().element().getBoundingClientRect().width))
			.toBe(Math.round(before.width - 120));
	});

	it("[esc-cancels] Esc while dragging a corner puts it back", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const corner = body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" });
		const before = image().element().getBoundingClientRect().width;
		const box = corner.element().getBoundingClientRect();
		corner
			.element()
			.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: box.left, clientY: box.top }));
		window.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left - 150, clientY: box.top }));
		await expect.poll(() => image().element().getBoundingClientRect().width).toBeLessThan(before - 100);
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		await expect.poll(() => image().element().getBoundingClientRect().width).toBe(before);
	});

	it("[keys-move] a focused corner resizes with the arrows", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const before = image().element().getBoundingClientRect().width;
		body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" }).element().focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => Math.round(image().element().getBoundingClientRect().width)).toBe(Math.round(before - 16));
	});

	it("[keys-move] the crop is made and moved with the keyboard alone", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "자르기와 회전" }));
		await userEvent.click(page.getByRole("button", { name: "자를 곳 잡기" }));
		const box = page.getByRole("button", { name: "자를 곳: 화살표로 옮기기" });
		box.element().focus();
		await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
		const corner = page.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard("{Shift>}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}");
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		await expect.element(page.getByRole("heading", { name: "자르기와 회전" })).not.toBeInTheDocument();
		// 80% wide of a 3:2 picture, 65% high.
		await expect
			.poll(() => {
				const frame = image().element().parentElement?.getBoundingClientRect();
				return frame ? Math.round((frame.width / frame.height) * 100) : 0;
			})
			.toBe(Math.round(((2400 * 0.8) / (1600 * 0.65)) * 100));
	});

	it("09-1 a crop dragged past the picture stays inside it, and the entry still saves", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "자르기와 회전" }));
		const sheet = page.getByRole("dialog");
		await userEvent.click(sheet.getByRole("button", { name: "자를 곳 잡기" }));
		const corner = sheet.getByRole("button", { name: "오른쪽 아래 모서리" }).element();
		const box = corner.getBoundingClientRect();
		corner.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: box.left, clientY: box.top }));
		window.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + 2000, clientY: box.top + 2000 }));
		window.dispatchEvent(new PointerEvent("pointerup", { clientX: box.left + 2000, clientY: box.top + 2000 }));
		await userEvent.click(sheet.getByRole("button", { name: "적용" }));
		await expect.element(sheet).not.toBeInTheDocument();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect.element(page.getByRole("button", { name: "저장 전 변경사항" })).not.toBeInTheDocument();
	});

	it("09-1 when the crop sheet closes the keys are the text's again, even from the caption: ⌘Z takes the turn back at once", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const caption = body().getByRole("textbox", { name: "캡션" });
		await userEvent.click(caption);
		await userEvent.keyboard("캡션");
		await userEvent.click(bar().getByRole("button", { name: "자르기와 회전" }));
		await userEvent.click(page.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		const upright = () => {
			const { width, height } = image().element().getBoundingClientRect();
			return width < height;
		};
		await expect.poll(upright).toBe(true);
		await expect.element(body()).toHaveFocus();
		await userEvent.keyboard(navigator.userAgent.includes("Mac") ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}");
		await expect.poll(upright).toBe(false);
	});

	it("09-1 the crop sheet turns and crops, and the body shows what is kept", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "자르기와 회전" }));
		await expect.element(page.getByRole("heading", { name: "자르기와 회전" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		await expect.element(page.getByRole("heading", { name: "자르기와 회전" })).not.toBeInTheDocument();
		await expect
			.poll(() => {
				const { width, height } = image().element().getBoundingClientRect();
				return width < height;
			})
			.toBe(true);
	});
});
