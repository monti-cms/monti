import { toast } from "@monti-cms/ui";
import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { type Locator, page, userEvent } from "vitest/browser";
import { pointerPath, typeKorean } from "../../../../testing/input";
import type { StorySite } from "../../.storybook/pglite-site";
import * as media from "../screens/entry/media.stories";

const { Draft, WithImage, SmallImage, SizedImages, NoStorage, LibraryWindow, FileInBody } = composeStories(media);

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

/** The window's path over the files, and the folders it shows over them. */
const pathOf = (dialog: Locator) => dialog.getByRole("navigation", { name: "경로" });
const folderCards = (dialog: Locator) => [...dialog.element().querySelectorAll("button[data-slot=folder-tile]")];
/** A folder's card, once the open place shows it. */
async function folderCard(dialog: Locator, name: string) {
	const find = () => folderCards(dialog).find((card) => card.textContent === name) as HTMLElement | undefined;
	await expect.poll(() => find()).toBeDefined();
	return page.elementLocator(find() as HTMLElement);
}
const openAssets = async (dialog: Locator) => userEvent.click(await folderCard(dialog, "Blog Assets"));

describe("from the library", () => {
	it("09-3 [flow 6·29] [line-start] '/ 이미지' on an empty line opens the library's images, and the pick goes in", async () => {
		await Draft.run();
		await userEvent.click(body());
		await userEvent.keyboard("{Control>}{End}{/Control}{Meta>}{ArrowDown}{/Meta}{Enter}");
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("heading", { name: "라이브러리" })).toBeVisible();
		await expect.element(pathOf(dialog)).toHaveTextContent("미디어");
		await expect.element(dialog.getByRole("button", { name: "넣기" })).not.toBeInTheDocument();
		await openAssets(dialog);
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await userEvent.click(dialog.getByRole("button", { name: "넣기" }));
		await expect.element(dialog).not.toBeInTheDocument();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
	});

	it("09-3 the window keeps its height from folder to folder", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();
		// The laid-out height: the window scales as it opens.
		const height = () => (dialog.element() as HTMLElement).offsetHeight;
		const all = height();
		await openAssets(dialog);
		await userEvent.click(await folderCard(dialog, "diagrams"));
		await expect.element(dialog.getByText("여기에는 파일이 없습니다.")).toBeVisible();
		expect(height()).toBe(all);
	});

	it("09-3 T117 the window is a file browser: the top shows its folders and the files in no folder, a folder its folders and its own files", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).not.toBeInTheDocument();
		expect(folderCards(dialog).map((card) => card.textContent)).toEqual(["Blog Assets", "Wallpapers"]);

		const card = (name: string) => folderCards(dialog).find((each) => each.textContent === name) as HTMLElement;
		await userEvent.click(card("Blog Assets"));
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).not.toBeInTheDocument();
		await expect.element(dialog.getByRole("button", { name: /cafe-window/ })).not.toBeInTheDocument();
		// An image's place shows images: the PDF beside them is not one.
		await expect.element(dialog.getByRole("button", { name: /notes-scan/ })).not.toBeInTheDocument();
		expect(folderCards(dialog).map((each) => each.textContent)).toEqual(["covers", "diagrams"]);

		await userEvent.click(card("covers"));
		await expect.element(dialog.getByRole("button", { name: /cafe-window/ })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).not.toBeInTheDocument();
		await expect.element(pathOf(dialog)).toHaveTextContent("미디어/Blog Assets/covers");
	});

	it("09-3 the path over the tiles is the way up: each step of it goes there; at the top it is the top's name alone", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		const path = pathOf(dialog);
		await expect.element(path).toHaveTextContent("미디어");
		expect(path.getByRole("button").elements()).toEqual([]);
		const card = (name: string) => folderCards(dialog).find((each) => each.textContent === name) as HTMLElement;
		await userEvent.click(card("Blog Assets"));
		await userEvent.click(card("covers"));
		await expect.element(path).toHaveTextContent("미디어/Blog Assets/covers");
		await userEvent.click(path.getByRole("button", { name: "Blog Assets" }));
		expect(folderCards(dialog).map((each) => each.textContent)).toEqual(["covers", "diagrams"]);
		await expect.element(path).toHaveTextContent("미디어/Blog Assets");
		await userEvent.click(path.getByRole("button", { name: "미디어" }));
		await expect.poll(() => path.getByRole("button").elements().length).toBe(0);
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();
	});

	it("09-3 T117 a search looks as the library's does: through the folder's subfolders, saying where each file is, and through all of them on request", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		const search = dialog.getByRole("searchbox", { name: "파일 이름 검색" });
		const chip = dialog.getByRole("button", { name: /찾을 곳$/ });
		await expect.element(chip).not.toBeInTheDocument();
		await openAssets(dialog);
		// In a folder the search box's chip says where a search looks: this folder first.
		await expect.element(chip).toHaveAccessibleName("Blog Assets, 찾을 곳");

		await userEvent.fill(search, "cafe");
		await expect.element(dialog.getByRole("button", { name: /cafe-window/ })).toHaveTextContent("covers ·");
		expect(folderCards(dialog)).toEqual([]);

		await userEvent.fill(search, "top-level");
		await expect.element(dialog.getByText("맞는 파일이 없습니다.")).toBeVisible();
		await userEvent.click(chip);
		await userEvent.click(page.getByRole("menuitemradio", { name: "모든 폴더" }));
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();

		// The × empties the box: back to the folder as it was, its own files and folders, the chip back on this folder.
		await userEvent.click(dialog.getByRole("button", { name: "지우기" }));
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).toBeVisible();
		await expect.element(chip).toHaveAccessibleName("Blog Assets, 찾을 곳");
		expect(folderCards(dialog).map((each) => each.textContent)).toEqual(["covers", "diagrams"]);
	});

	it("09-3 T117 [keys-move] Enter on a folder's card goes in, and the keyboard goes on from the new place's first card", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();
		(folderCards(dialog)[0] as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).toBeVisible();
		await expect.element(await folderCard(dialog, "covers")).toHaveFocus();
		// A folder of files only: the keyboard waits for them, and goes on from the first.
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog.getByRole("button", { name: /cafe-window/ })).toHaveFocus();
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).not.toBeInTheDocument();
	});

	it("09-3 T117 going to another folder ends the search", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		const search = dialog.getByRole("searchbox", { name: "파일 이름 검색" });
		await openAssets(dialog);
		await userEvent.fill(search, "cafe");
		await expect.element(dialog.getByRole("button", { name: /cafe-window/ })).toBeVisible();
		await userEvent.click(pathOf(dialog).getByRole("button", { name: "미디어" }));
		await expect.element(search).toHaveValue("");
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).toBeVisible();
	});

	it("09-3 searching drops what was picked: what goes in is always a file in sight", async () => {
		await LibraryWindow.run();
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: /top-level-photo/ }));
		await expect.element(dialog.getByRole("button", { name: "넣기" })).toBeVisible();
		await userEvent.fill(dialog.getByRole("searchbox", { name: "파일 이름 검색" }), "없는 파일");
		await expect.element(dialog.getByRole("button", { name: /top-level-photo/ })).not.toBeInTheDocument();
		await expect.element(dialog.getByRole("button", { name: "넣기" })).not.toBeInTheDocument();
	});

	it("09-3 [mid-sentence] '/' between words: the file goes next to the sentence, which stays whole", async () => {
		await Draft.run();
		await userEvent.click(paragraph("글의 첫 문단"));
		await slash("이미지");
		await userEvent.keyboard("{Enter}");
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: /top-level-photo/ }));
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
		await openAssets(dialog);
		await expect.element(dialog.getByRole("button", { name: /notes-scan/ })).toBeVisible();
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
		await userEvent.fill(dialog.getByRole("searchbox", { name: "파일 이름 검색" }), "desk");
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

	it("09-3 a picture with no type or extension is an image block once the library knows it", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		const picture = await canvasFile("x.png");
		await paste(new File([picture], "screenshot"));
		await expect.element(body().getByRole("progressbar")).not.toBeInTheDocument();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
	});

	it("09-1 a picture that will not read leaves the body, and a toast says why", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(
			new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])], "broken.png", {
				type: "image/png",
			}),
		);
		await expect.element(page.getByText("broken.png · 읽을 수 없는 파일")).toBeVisible();
		await expect.element(body().getByText("broken.png")).not.toBeInTheDocument();
		await expect.element(body().getByRole("textbox", { name: "캡션" })).not.toBeInTheDocument();
	});

	it("09-1 a file the library does not take never becomes a block", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(new File([new Uint8Array([0x4d, 0x5a])], "setup.exe"));
		await expect.element(page.getByText("setup.exe · 지원하지 않는 형식")).toBeVisible();
		await expect.element(body().getByText("setup.exe")).not.toBeInTheDocument();
	});

	it("09-4 a pasted picture is in the library, used by the entry once saved", async () => {
		await Draft.run();
		await caretAfter("글의 첫 문단");
		await paste(await canvasFile("pasted-saved.png"));
		await expect.element(body().getByRole("textbox", { name: "캡션" })).toBeVisible();
		// A picture on its way is not stored: the caption shows from the start, so wait for the file, not for that.
		await expect.element(body().getByRole("progressbar")).not.toBeInTheDocument();
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
		await expect.element(page.getByText("대체 텍스트 없음")).toBeVisible();
		const decorative = page.getByRole("switch", { name: "장식 이미지" });
		await userEvent.click(decorative);
		await expect.element(page.getByText("대체 텍스트 없음")).not.toBeInTheDocument();
		// T122 A decorative picture has no words: the box goes, and the cursor stays on the switch; turned off, the box is back with the cursor in it.
		await expect.element(alt).not.toBeInTheDocument();
		await expect.element(decorative).toHaveFocus();
		await userEvent.keyboard(" ");
		await expect.element(alt).toHaveFocus();
	});

	it("09-1 a picked picture reads as picked: a line around it, and a handle on each corner", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const box = body().element().querySelector("[data-slot=block-box]");
		expect(box?.getAttribute("data-selected")).toBe("true");
		expect(
			[...(box?.querySelectorAll("[data-slot=resize-corner]") ?? [])].map((corner) =>
				corner.getAttribute("data-corner"),
			),
		).toEqual(["nw", "ne", "sw", "se"]);
		// The bottom two take the keyboard; the top two are for the pointer, so each side is heard once.
		expect(page.getByRole("button", { name: /크기 바꾸기/ }).elements()).toHaveLength(2);
	});

	it("09-1 T122 each handle moves the edge under it: a picture held to the left has handles only on its right", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "왼쪽 정렬" }));
		await userEvent.click(image());
		const corners = () =>
			[...(body().element().querySelectorAll("[data-slot=resize-corner]") ?? [])].map((corner) =>
				corner.getAttribute("data-corner"),
			);
		await expect.poll(corners).toEqual(["ne", "se"]);
	});

	it("09-1 the size is heard as it changes by the keyboard, in px", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const before = image().element().getBoundingClientRect().width;
		body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" }).element().focus();
		const region = body().element().querySelector("[data-slot=block-box] [aria-live]");
		// What is heard is the size it is drawn at: the 2400px desk (3:2) narrowed to the body, not its file's size.
		const shown = Math.floor(before);
		await expect.poll(() => region?.textContent).toBe(`${shown} × ${Math.round((shown * 2) / 3)}`);
		await userEvent.keyboard("{ArrowLeft}");
		const width = Math.round(before - 10);
		await expect.poll(() => region?.textContent).toBe(`${width} × ${Math.round((width * 2) / 3)}`);
	});

	it("09-1 a picture smaller than the body stands at its own size, and 'Edit' makes it 40 × 30: a free shape cuts it to the two numbers", async () => {
		await SmallImage.run();
		const icon = () => body().getByRole("img", { name: "아이콘" });
		await expect.poll(() => Math.round(icon().element().getBoundingClientRect().width)).toBe(80);
		await userEvent.click(icon());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("button", { name: "원본" })).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(dialog.getByRole("button", { name: "자유" }));
		await userEvent.fill(dialog.getByRole("textbox", { name: "가로" }), "40");
		await userEvent.fill(dialog.getByRole("textbox", { name: "세로" }), "30");
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog.getByRole("textbox", { name: "가로" })).toHaveValue("40");
		await expect.element(dialog.getByRole("textbox", { name: "세로" })).toHaveValue("30");
		await userEvent.click(dialog.getByRole("button", { name: "적용" }));
		await expect.element(dialog).not.toBeInTheDocument();
		await expect
			.poll(() => {
				const frame = icon().element().parentElement?.getBoundingClientRect();
				return frame ? [Math.round(frame.width), Math.round(frame.height)] : [];
			})
			.toEqual([40, 30]);
	});

	it("09-1 a picture keeps the unit it was given: a width in px stays px, a share of the body stays a share", async () => {
		await SizedImages.run();
		const desk = body().getByRole("img", { name: "아침 책상" });
		const code = body().getByRole("img", { name: "화면에 뜬 코드" });
		const column =
			desk.element().closest("[data-slot=block-box]")?.parentElement?.getBoundingClientRect().width ?? Number.NaN;
		// 1000px is wider than the body: it is drawn at the body's width, and keeps its 1000 for a wider one.
		await expect.poll(() => Math.round(desk.element().getBoundingClientRect().width)).toBe(Math.round(column));
		await userEvent.click(desk);
		const corner = () => body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" });
		// A corner pressed and let go where it was changes nothing.
		const at = corner().element().getBoundingClientRect();
		const still = { bubbles: true, clientX: at.left + 4, clientY: at.top + 4 };
		corner().element().dispatchEvent(new PointerEvent("pointerdown", still));
		window.dispatchEvent(new PointerEvent("pointerup", still));
		corner().element().focus();
		await userEvent.keyboard("{ArrowLeft}");
		const region = () => body().element().querySelector("[data-slot=block-box][data-selected] [aria-live]");
		// Ten px off the 1000 it keeps, not off the width it is drawn at here; what is heard is still what is drawn.
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		await expect.element(page.getByRole("textbox", { name: "가로" })).toHaveValue("990");
		await userEvent.click(page.getByRole("button", { name: "취소" }));
		await userEvent.click(code);
		await expect.poll(() => Math.round(code.element().getBoundingClientRect().width)).toBe(Math.round(column / 2));
		corner().element().focus();
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => region()?.textContent).toBe("45%");
		// A share stops where the picture would be under 24px, as a width in px does.
		for (let press = 0; press < 10; press++) await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => region()?.textContent).toBe(`${Math.ceil((24 / column) * 100)}%`);
	});

	it("09-1 a small picture's own size is as big as the keys take it: past it, it is its own size again", async () => {
		await SmallImage.run();
		await userEvent.click(body().getByRole("img", { name: "아이콘" }));
		body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" }).element().focus();
		const region = () => body().element().querySelector("[data-slot=block-box][data-selected] [aria-live]");
		await expect.poll(() => region()?.textContent).toBe("80 × 80");
		await userEvent.keyboard("{ArrowRight}");
		await expect.poll(() => region()?.textContent).toBe("80 × 80");
		await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => region()?.textContent).toBe("70 × 70");
		await userEvent.keyboard("{ArrowRight}");
		await expect.poll(() => region()?.textContent).toBe("80 × 80");
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		await expect.element(page.getByRole("textbox", { name: "가로" })).toHaveValue("");
	});

	it("09-1 the unit switched and back gives a picture with no size none, and a crop kept to its own shape opens on 원본", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const column = Math.round(image().element().getBoundingClientRect().width);
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		let dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: "%", exact: true }));
		await expect.element(dialog.getByRole("textbox", { name: "가로" })).toHaveValue("");
		await userEvent.click(dialog.getByRole("button", { name: "px", exact: true }));
		// Cut with 원본: the corner keeps the picture's shape.
		const corner = dialog.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard("{Shift>}{ArrowLeft}{ArrowLeft}{/Shift}");
		await userEvent.click(dialog.getByRole("button", { name: "적용" }));
		await expect.element(dialog).not.toBeInTheDocument();
		// Still the body's width: a cut picture is a box holding the placed file, so the box is what is measured.
		const box = () => body().element().querySelector("[data-slot=block-box]")?.getBoundingClientRect().width ?? 0;
		await expect.poll(() => Math.round(box())).toBe(column);
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("textbox", { name: "가로" })).toHaveValue("");
		await expect.element(dialog.getByRole("button", { name: "원본" })).toHaveAttribute("aria-pressed", "true");
	});

	it("09-1 a free shape given the height it already has keeps its crop", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: "자유" }));
		const corner = dialog.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard(
			"{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}",
		);
		const box = () =>
			dialog.getByRole("button", { name: "자를 곳: 화살표로 옮기기" }).element().getBoundingClientRect().width;
		const before = box();
		const height = dialog.getByRole("textbox", { name: "세로" });
		await userEvent.fill(height, height.element().getAttribute("placeholder") ?? "");
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => Math.abs(box() - before)).toBeLessThan(2);
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

	it("09-1 T122 [dragging] [dropped] a corner dragged changes the width, says its size in px meanwhile, and stays where it was let go", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const corner = body().getByRole("button", { name: "오른쪽에서 크기 바꾸기" });
		const before = image().element().getBoundingClientRect();
		const box = corner.element().getBoundingClientRect();
		const at = { clientX: box.left + 4, clientY: box.top + 4 };
		corner.element().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, ...at }));
		window.dispatchEvent(new PointerEvent("pointermove", { clientX: at.clientX - 120, clientY: at.clientY }));
		await expect.poll(() => image().element().getBoundingClientRect().width).toBeLessThan(before.width - 100);
		// A picture in the middle grows on both sides: the corner follows the pointer, so the width moves twice as far.
		const width = Math.round(before.width - 240);
		const size = `${width} × ${Math.round((width * 2) / 3)}`;
		await expect.element(body().getByText(size)).toBeVisible();
		window.dispatchEvent(new PointerEvent("pointerup", { clientX: at.clientX - 120, clientY: at.clientY }));
		await expect.poll(() => Math.abs(image().element().getBoundingClientRect().width - width)).toBeLessThan(1);
		// The badge goes once it is let go; the size stays only in what a screen reader hears.
		const badge = () =>
			[...body().element().querySelectorAll("[data-slot=block-box] span[aria-hidden=true]")].some(
				(span) => span.textContent === size,
			);
		await expect.poll(badge).toBe(false);
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
		// Ten px at a time.
		await expect.poll(() => Math.round(image().element().getBoundingClientRect().width)).toBe(Math.round(before - 10));
		// Never under the smallest picture the pointer can make (24px), however many times.
		for (let press = 0; press < 70; press++) await userEvent.keyboard("{ArrowLeft}");
		await expect.poll(() => Math.round(image().element().getBoundingClientRect().width)).toBe(24);
	});

	it("09-1 'Edit' sizes the picture in px, the other side following its shape, or as one share of the body; the settings card has no size", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const column = image().element().getBoundingClientRect().width;
		await userEvent.click(bar().getByRole("button", { name: "설정" }));
		await expect.element(page.getByRole("textbox", { name: "대체 텍스트" })).toBeVisible();
		await expect.element(page.getByRole("textbox", { name: "가로" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		// The picture picked again, its tools there whatever Escape left (a toast from another test can sit over them too).
		toast.dismiss();
		const edit = async () => {
			await userEvent.click(image());
			await userEvent.click(bar().getByRole("button", { name: "편집" }));
			return page.getByRole("dialog");
		};
		let dialog = await edit();
		await expect.element(dialog.getByRole("heading", { name: "편집" })).toBeVisible();
		const width = dialog.getByRole("textbox", { name: "가로" });
		const height = dialog.getByRole("textbox", { name: "세로" });
		// The picture's own size, until one is given; the desk is 3:2, and its shape is kept.
		await expect.element(width).toHaveAttribute("placeholder", "2400");
		await userEvent.fill(height, "100");
		await expect.element(width).toHaveValue("150");
		await userEvent.fill(width, "300");
		await expect.element(height).toHaveValue("200");
		await expect.element(dialog.getByRole("button", { name: "처음으로" })).toBeVisible();
		await userEvent.click(dialog.getByRole("button", { name: "적용" }));
		await expect.poll(() => Math.round(image().element().getBoundingClientRect().width)).toBe(300);
		// A share of the body is one number: the height follows the body.
		dialog = await edit();
		await userEvent.click(dialog.getByRole("button", { name: "%", exact: true }));
		await expect.element(dialog.getByRole("textbox", { name: "세로" })).not.toBeInTheDocument();
		await userEvent.fill(dialog.getByRole("textbox", { name: "가로" }), "50");
		await userEvent.click(dialog.getByRole("button", { name: "적용" }));
		await expect.poll(() => Math.round(image().element().getBoundingClientRect().width)).toBe(Math.round(column / 2));
	});

	it("09-1 the crop window can be left with nothing changed", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const height = () => Math.round(image().element().getBoundingClientRect().height);
		const before = height();
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		await userEvent.click(page.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await userEvent.click(page.getByRole("button", { name: "취소" }));
		await expect.element(page.getByRole("heading", { name: "편집" })).not.toBeInTheDocument();
		expect(height()).toBe(before);
	});

	it("09-1 a crop already drawn turns with the picture: the same part of it stays kept", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		// The crop starts as the whole picture, keeping its shape: freed, its corner pulled in to 80% wide and 65% high.
		await userEvent.click(page.getByRole("button", { name: "자유" }));
		const corner = page.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard(
			"{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}",
		);
		await userEvent.click(page.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await expect.element(page.getByRole("button", { name: "자를 곳: 화살표로 옮기기" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		await expect.element(page.getByRole("heading", { name: "편집" })).not.toBeInTheDocument();
		// 80% wide and 65% high of a 3:2 picture, turned a quarter: 65% wide and 80% high of a 2:3 one.
		await expect
			.poll(() => {
				const { width, height } = image().element().parentElement?.getBoundingClientRect() ?? { width: 0, height: 1 };
				return Math.round((width / height) * 100);
			})
			.toBe(Math.round(((2 * 0.65) / (3 * 0.8)) * 100));
	});

	it("[keys-move] the crop is made and moved with the keyboard alone", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		// The crop starts as the whole picture, keeping its shape: freed, a corner pulls it in, the box moves.
		await userEvent.click(page.getByRole("button", { name: "자유" }));
		const corner = page.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard(
			"{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}{/Shift}",
		);
		const box = page.getByRole("button", { name: "자를 곳: 화살표로 옮기기" });
		box.element().focus();
		await userEvent.keyboard("{Shift>}{ArrowRight}{ArrowRight}{/Shift}");
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		await expect.element(page.getByRole("heading", { name: "편집" })).not.toBeInTheDocument();
		// 80% wide of a 3:2 picture, 65% high.
		await expect
			.poll(() => {
				const frame = image().element().parentElement?.getBoundingClientRect();
				return frame ? Math.round((frame.width / frame.height) * 100) : 0;
			})
			.toBe(Math.round(((2400 * 0.8) / (1600 * 0.65)) * 100));
	});

	it("09-1 a shape keeps the crop to it: 1:1 makes the largest square in the middle; 처음으로 brings back the whole picture, upright", async () => {
		// Toasts earlier tests left lie over the dialog's last line: they go first.
		toast.dismiss();
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("button", { name: "처음으로" })).not.toBeInTheDocument();
		// The shape is measured on the picture's size as the body frames it (the story's file is drawn at another shape, so the body is what is checked).
		await userEvent.click(dialog.getByRole("button", { name: "1:1" }));
		await expect.element(dialog.getByRole("button", { name: "처음으로" })).toBeVisible();
		await userEvent.click(dialog.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await userEvent.click(dialog.getByRole("button", { name: "처음으로" }));
		await expect.element(dialog.getByRole("button", { name: "처음으로" })).not.toBeInTheDocument();
		await expect.element(dialog.getByRole("button", { name: "원본" })).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(dialog.getByRole("button", { name: "1:1" }));
		await userEvent.click(dialog.getByRole("button", { name: "적용" }));
		await expect
			.poll(() => {
				const frame = image().element().parentElement?.getBoundingClientRect();
				return frame ? Math.round((frame.width / frame.height) * 100) : 0;
			})
			.toBe(100);
	});

	it("09-1 a kept square answers an arrow on either side, stays square, and turns with the picture as the same part", async () => {
		toast.dismiss();
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: "1:1" }));
		const box = () =>
			dialog.getByRole("button", { name: "자를 곳: 화살표로 옮기기" }).element().getBoundingClientRect();
		const square = () => Math.abs(box().width - box().height) <= 2;
		await expect.poll(square).toBe(true);
		const before = box().width;
		const corner = dialog.getByRole("button", { name: "오른쪽 아래 모서리" });
		corner.element().focus();
		await userEvent.keyboard("{Shift>}{ArrowUp}{ArrowUp}{/Shift}");
		await expect.poll(() => box().width).toBeLessThan(before);
		expect(square()).toBe(true);
		// Turned, the picture is fitted to the frame again (taller now), so its square is drawn smaller: still a square.
		const frame = () =>
			(dialog.element().querySelector("[data-slot=crop-stage] img") as HTMLElement).getBoundingClientRect();
		await userEvent.click(dialog.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await expect.poll(() => frame().height > frame().width).toBe(true);
		await expect.poll(square).toBe(true);
		await expect.element(dialog.getByRole("button", { name: "1:1" })).toHaveAttribute("aria-pressed", "true");
	});

	it("09-1 a crop dragged past the picture stays inside it, and the entry still saves", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		const sheet = page.getByRole("dialog");
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

	it("09-1 when the crop dialog closes the keys are the text's again, even from the caption: ⌘Z takes the turn back at once", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const caption = body().getByRole("textbox", { name: "캡션" });
		await userEvent.click(caption);
		await userEvent.keyboard("캡션");
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
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

	it("09-1 the block menu and the tools agree where a picture is: the middle unless it says otherwise", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await expect.element(bar().getByRole("button", { name: "가운데 정렬" })).toHaveAttribute("aria-pressed", "true");
		const box = image().element().getBoundingClientRect();
		await pointerPath([
			{ x: box.left + 40, y: box.top + 40 },
			{ x: box.left - 20, y: box.top + 8 },
		]);
		await userEvent.click(page.getByRole("button", { name: "블록 메뉴" }));
		await userEvent.click(page.getByRole("menuitem", { name: "정렬" }));
		await expect.element(page.getByRole("menuitemradio", { name: "가운데" })).toHaveAttribute("aria-checked", "true");
		await userEvent.click(page.getByRole("menuitemradio", { name: "왼쪽" }));
		await userEvent.click(image());
		await expect.element(bar().getByRole("button", { name: "왼쪽 정렬" })).toHaveAttribute("aria-pressed", "true");
	});

	it("09-1 a selected picture keeps its colors: the ground of a text selection is not painted over it", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await expect.element(bar()).toBeVisible();
		expect(getComputedStyle(image().element(), "::selection").backgroundColor).toBe("rgba(0, 0, 0, 0)");
		const caption = body().getByRole("textbox", { name: "캡션" });
		await userEvent.click(caption);
		expect(getComputedStyle(caption.element(), "::selection").backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	});

	it("09-1 a caption stands where its picture stands", async () => {
		await WithImage.run();
		await userEvent.click(image());
		const caption = body().getByRole("textbox", { name: "캡션" });
		const side = () => getComputedStyle(caption.element()).textAlign;
		await userEvent.click(bar().getByRole("button", { name: "왼쪽 정렬" }));
		await expect.poll(side).toBe("start");
		await userEvent.click(bar().getByRole("button", { name: "오른쪽 정렬" }));
		await expect.poll(side).toBe("right");
		await userEvent.click(bar().getByRole("button", { name: "가운데 정렬" }));
		await expect.poll(side).toBe("center");
	});

	it("09-1 [flow 6·38] a file block is one thing: a press selects it, nothing in it takes a caret, and Backspace takes it out", async () => {
		await FileInBody.run();
		await expect.poll(() => body().element().querySelector("[data-block=file]")).not.toBeNull();
		const block = body().element().querySelector("[data-block=file]");
		if (!block) throw new Error("no file block");
		expect(block.querySelector("input")).toBeNull();
		await userEvent.click(page.elementLocator(block));
		await expect.element(bar()).toBeVisible();
		await expect.element(body()).toHaveFocus();
		await userEvent.keyboard("{Backspace}");
		await expect.poll(() => body().element().querySelector("[data-block=file]")).toBeNull();
	});

	it("09-1 the name a file shows is written in its settings, not in the text", async () => {
		await FileInBody.run();
		await expect.poll(() => body().element().querySelector("[data-block=file]")).not.toBeNull();
		const block = body().element().querySelector("[data-block=file]");
		if (!block) throw new Error("no file block");
		await userEvent.click(page.elementLocator(block));
		await userEvent.click(bar().getByRole("button", { name: "설정" }));
		await userEvent.fill(page.getByRole("textbox", { name: "보이는 이름" }), "올해 가격표");
		await userEvent.keyboard("{Escape}");
		await expect.element(body().getByText("올해 가격표")).toBeVisible();
	});

	it("09-1 a selected file block is drawn by its ring, with no text highlight over its name (2026-11-10, owner)", async () => {
		await FileInBody.run();
		await expect.poll(() => body().element().querySelector("[data-block=file]")).not.toBeNull();
		const block = body().element().querySelector("[data-block=file]");
		if (!block) throw new Error("no file block");
		await userEvent.click(page.elementLocator(block), { position: { x: 4, y: 4 } });
		await expect.element(bar()).toBeVisible();
		const name = block.querySelector("[data-slot=file-block] span:nth-child(2)");
		expect(name && getComputedStyle(name, "::selection").backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(block).marginBottom).toBe("20px");
	});

	it("09-1 a press under a file that ends the body opens a paragraph there, the cursor in it", async () => {
		await FileInBody.run();
		await expect.poll(() => body().element().querySelector("[data-block=file]")).not.toBeNull();
		const file = body().element().querySelector("[data-block=file]")?.getBoundingClientRect();
		const area = body().element().closest("[data-slot=editor-body]") ?? body().element().parentElement;
		if (!file || !area) throw new Error("no file block");
		const below = new MouseEvent("click", { bubbles: true, clientX: file.left + 40, clientY: file.bottom + 60 });
		area.dispatchEvent(below);
		await expect.element(body()).toHaveFocus();
		await userEvent.keyboard("다음 문단");
		await expect.element(paragraph("다음 문단")).toBeVisible();
		const blocks = [...body().element().children];
		expect(blocks.at(-1)?.textContent).toBe("다음 문단");
	});

	it("09-1 the crop dialog turns and crops, and the body shows what is kept", async () => {
		await WithImage.run();
		await userEvent.click(image());
		await userEvent.click(bar().getByRole("button", { name: "편집" }));
		await expect.element(page.getByRole("heading", { name: "편집" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "오른쪽으로 돌리기" }));
		await userEvent.click(page.getByRole("button", { name: "적용" }));
		await expect.element(page.getByRole("heading", { name: "편집" })).not.toBeInTheDocument();
		await expect
			.poll(() => {
				const { width, height } = image().element().getBoundingClientRect();
				return width < height;
			})
			.toBe(true);
	});
});

type Call = { name: string; input: unknown };
const bodyRead = (call: Call) =>
	call.name === "media.query" && ((call.input as { ids?: string[] }).ids ?? []).length > 0;

/** `ManyInBody` with the operations the page runs written down; `refuse` turns the body's reads of its files away, as a server error would. */
function recorded({ refuse = false } = {}) {
	const calls: Call[] = [];
	const [load] = media.ManyInBody.loaders as [() => Promise<{ site: StorySite }>];
	const story = composeStory(
		{
			...media.ManyInBody,
			loaders: [
				async () => {
					const loaded = await load();
					const { transport } = loaded.site;
					loaded.site.transport = async (name, input, options) => {
						const call = { name, input };
						calls.push(call);
						if (refuse && bodyRead(call)) return { status: 500, body: { error: "unexpected" } };
						return transport(name, input, options);
					};
					return loaded;
				},
			],
		},
		media.default,
	);
	return { run: () => story.run(), calls, reads: () => calls.filter(bodyRead) };
}

describe("opening a body with files", () => {
	it("09-1 T110 the body's pictures and files are read together, once", async () => {
		const story = recorded();
		await story.run();
		await expect.element(body().getByText("notes-scan.pdf")).toBeVisible();
		await expect.element(body().getByRole("img", { name: "아침 책상" })).toBeVisible();
		await expect.element(body().getByRole("img", { name: "화면에 뜬 코드" })).toBeVisible();
		expect(story.calls.filter((call) => call.name === "media.get")).toEqual([]);
		expect(story.reads()).toHaveLength(1);
		expect((story.reads()[0]?.input as { ids: string[] }).ids).toHaveLength(3);
	});

	it("09-1 T110 a block that comes back (undo) reads its file again, alone", async () => {
		const story = recorded();
		await story.run();
		await expect.element(body().getByText("notes-scan.pdf")).toBeVisible();
		const fileBlocks = () => body().element().querySelectorAll("[data-block=file]");
		const [first] = fileBlocks();
		if (!first) throw new Error("no file block");
		// Picked whole, then Backspace. On a busy machine the pick is sometimes lost before the key lands (the caret goes to the start of the body, T126): this
		// test is about what the block reads when it comes back, so it picks again until the block is gone. The file block's own test (flow 6·38) keeps to one press.
		await expect
			.poll(async () => {
				if (fileBlocks().length === 0) return 0;
				await userEvent.click(page.elementLocator(first));
				await expect.element(body()).toHaveFocus();
				if (first.closest(".ProseMirror-selectednode")) await userEvent.keyboard("{Backspace}");
				return fileBlocks().length;
			})
			.toBe(0);
		await userEvent.keyboard(navigator.userAgent.includes("Mac") ? "{Meta>}z{/Meta}" : "{Control>}z{/Control}");
		await expect.element(body().getByText("notes-scan.pdf")).toBeVisible();
		await expect.poll(() => story.reads().length).toBe(2);
		expect((story.reads()[1]?.input as { ids: string[] }).ids).toHaveLength(1);
	});

	it("09-1 T110 a read turned away leaves no file blank: each says it is not there, as a block's own read did", async () => {
		await recorded({ refuse: true }).run();
		await expect.element(body().getByText("파일 없음")).toBeVisible();
	});
});

describe("archiving while a file goes up", () => {
	it("02-6 T129 archiving waits for a file still going up: it says so and archives nothing, and archives once the file is up", async () => {
		const [load] = media.Draft.loaders as [() => Promise<{ site: StorySite }>];
		let release: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const story = composeStory(
			{
				...media.Draft,
				loaders: [
					async () => {
						const loaded = await load();
						const { uploader } = loaded.site;
						loaded.site.uploader = async (file, options) => {
							await held;
							return uploader(file, options);
						};
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		await userEvent.click(body());
		await paste(await canvasFile("slow.png"));
		await expect.element(body().getByRole("progressbar")).toBeVisible();
		const archive = async () => {
			await userEvent.click(page.getByRole("button", { name: "더 보기", exact: true }));
			await userEvent.click(page.getByRole("menuitem", { name: "보관", exact: true }));
		};
		await archive();
		await expect.element(page.getByText("파일을 올리는 중입니다")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "보관 풀기" })).not.toBeInTheDocument();
		release();
		await expect.element(body().getByRole("progressbar")).not.toBeInTheDocument();
		toast.dismiss();
		await archive();
		await expect.element(page.getByRole("button", { name: "보관 풀기" })).toBeVisible();
	});
});

describe("a file cut off, then the entry archived", () => {
	it("02-6 a file that was cut off stays in an archived entry's body, with no way to try it again there: nothing changes an entry that cannot be saved", async () => {
		const [load] = media.Draft.loaders as [() => Promise<{ site: StorySite }>];
		const story = composeStory(
			{
				...media.Draft,
				loaders: [
					async () => {
						const loaded = await load();
						loaded.site.uploader = async () => ({ status: 500, body: { error: "unexpected" } });
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		await userEvent.click(body());
		await paste(await canvasFile("cut.png"));
		await expect.element(body().getByRole("button", { name: "다시 올리기" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "더 보기", exact: true }));
		await userEvent.click(page.getByRole("menuitem", { name: "보관", exact: true }));
		await expect.element(page.getByRole("button", { name: "보관 풀기" })).toBeVisible();
		await expect.element(body().getByText("올리기 실패")).toBeVisible();
		await expect.element(body().getByRole("button", { name: "다시 올리기" })).not.toBeInTheDocument();
	});
});

describe("a picture picked, then the entry archived", () => {
	it("02-6 a picture that is picked when its entry is archived loses its tools at once: only the settings stay, and nothing moves or sizes it", async () => {
		const image = () => body().getByRole("img", { name: "아침 책상" });
		const bar = () => body().getByRole("toolbar");
		await WithImage.run();
		await userEvent.click(image());
		await expect.element(bar().getByRole("button", { name: "편집" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "더 보기", exact: true }));
		await userEvent.click(page.getByRole("menuitem", { name: "보관", exact: true }));
		await expect.element(page.getByRole("button", { name: "보관 풀기" })).toBeVisible();
		// No press in the body since: the picture is still the one picked.
		await expect.element(bar().getByRole("button", { name: "설정" })).toBeVisible();
		await expect.element(bar().getByRole("button", { name: "편집" })).not.toBeInTheDocument();
		await expect.element(bar().getByRole("button", { name: "가운데 정렬" })).not.toBeInTheDocument();
		await expect.element(body().getByRole("button", { name: /크기 바꾸기/ })).not.toBeInTheDocument();
	});
});

describe("a save the server refuses", () => {
	it("09-4 the reason shows, not an entry left unsaved with no word", async () => {
		const [load] = media.FileInBody.loaders as [() => Promise<{ site: StorySite }>];
		const story = composeStory(
			{
				...media.FileInBody,
				loaders: [
					async () => {
						const loaded = await load();
						const { transport } = loaded.site;
						loaded.site.transport = async (name, input, options) =>
							name === "entries.save"
								? { status: 422, body: { error: "check", reason: { key: "media.unknown", values: { id: "gone" } } } }
								: transport(name, input, options);
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		await userEvent.click(body().getByText("글의 첫 문단이에요."));
		await userEvent.keyboard("{End} 더");
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("없는 파일입니다.")).toBeVisible();
	});
});
