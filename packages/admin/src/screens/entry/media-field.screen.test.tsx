import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as media from "./media.stories";

const { Draft, WithCover, ArchivedCover, ArchivedImage, MissingAlt, TranslationCover, TranslationCoverChanged } =
	composeStories(media);

const cover = () => page.getByRole("button", { name: "대표 이미지", exact: true });
const alt = () => page.getByRole("textbox", { name: "대체 텍스트" });
const settings = () => page.getByRole("button", { name: "대표 이미지 설정" });
/** A picture's words are in its settings card, at the end of the field's line. */
const openCard = () => userEvent.click(settings());
const closeCard = () => userEvent.keyboard("{Escape}");
const body = () => page.getByRole("textbox", { name: "본문" });
/** The window opens at the top of the library: the story's files are in a folder. */
const openAssets = async () => {
	const card = () => document.querySelector<HTMLElement>("[role=dialog] button[data-slot=folder-tile]");
	await expect.poll(card).not.toBeNull();
	await userEvent.click(page.elementLocator(card() as HTMLElement));
};
const properties = async () => {
	const open = page.getByRole("button", { name: "속성" });
	if (open.elements().length > 0 && open.element().getAttribute("aria-pressed") !== "true") await userEvent.click(open);
};

describe("a read-only entry", () => {
	it("09-3 T130 an archived entry's picture in the body can still be read: picked, its bar has only the settings, and their fields cannot be typed in", async () => {
		await ArchivedImage.run();
		// The story has picked the picture and opened its settings.
		await expect.element(alt()).toHaveValue("아침 책상");
		// Read-only, not off: the words stay in their ink, to read and select (screens/editor.md).
		await expect.element(alt()).toHaveAttribute("readonly");
		await expect.element(alt()).toBeEnabled();
		const bar = page.getByRole("toolbar");
		await expect.element(bar.getByRole("button", { name: "설정" })).toBeVisible();
		// Nothing that changes the picture: no alignment, no edit.
		await expect.element(bar.getByRole("button", { name: "편집" })).not.toBeInTheDocument();
		await expect.element(bar.getByRole("button", { name: "가운데 정렬" })).not.toBeInTheDocument();
	});

	it("02-6 T131 an archived entry's fields that pick from a list are off for the keyboard too, like its other fields", async () => {
		await ArchivedCover.run();
		await closeCard();
		const lists = page.getByRole("complementary").getByRole("combobox");
		await expect.poll(() => lists.elements().length).toBeGreaterThan(0);
		for (const field of lists.elements()) await expect.element(page.elementLocator(field)).toBeDisabled();
	});
});

describe("a cover in the property panel", () => {
	it("09-3 T125 in an archived entry the cover is read, not changed: its line is no button and has no ×, and its settings open with their fields read-only", async () => {
		await ArchivedCover.run();
		// The story has opened the card: what the entry says of the picture is there to read, and cannot be typed in.
		await expect.element(alt()).toHaveValue("아침 책상");
		await expect.element(alt()).toHaveAttribute("readonly");
		await expect.element(alt()).toBeEnabled();
		const decorative = page.getByRole("switch", { name: "장식 이미지" });
		await expect.element(decorative).toHaveAttribute("aria-readonly", "true");
		await expect.element(decorative).toBeEnabled();
		await userEvent.click(decorative);
		await expect.element(decorative).not.toBeChecked();
		await closeCard();
		// The field is named by its label, shows the file, and is not something to press.
		const field = page.getByRole("group", { name: "대표 이미지" });
		await expect.element(field).toHaveTextContent("desk-morning.jpg");
		await expect.element(cover()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "대표 이미지 빼기" })).not.toBeInTheDocument();
		await userEvent.click(field.getByText("desk-morning.jpg"));
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
		// The settings are the one control it keeps.
		await expect.element(settings()).toBeVisible();
	});

	it("09-3 T67 [flow 6·30] the field opens the same window, showing images, and what is picked goes in", async () => {
		await Draft.run();
		await properties();
		await userEvent.click(cover());
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("heading", { name: "대표 이미지" })).toBeVisible();
		await openAssets();
		await expect.element(dialog.getByRole("button", { name: /desk-morning/ })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /notes-scan/ })).not.toBeInTheDocument();
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await userEvent.click(dialog.getByRole("button", { name: "고르기" }));
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(page.getByText("대체 텍스트 없음")).toBeVisible();
		await expect.element(alt()).not.toBeInTheDocument();
		await openCard();
		await expect.element(alt()).toHaveValue("");
	});

	it("09-2 T67 the alt text is this entry's: written here, saved with it", async () => {
		await WithCover.run();
		await properties();
		await openCard();
		await expect.element(alt()).toHaveFocus();
		await expect.element(alt()).toHaveValue("아침 책상");
		await userEvent.fill(alt(), "아침의 책상 위");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect.element(alt()).toHaveValue("아침의 책상 위");
		await expect.element(page.getByRole("button", { name: "저장 전 변경사항" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Enter}");
		await expect.element(alt()).not.toBeInTheDocument();
		await expect.element(settings()).toHaveFocus();
	});

	it("09-2 Enter that ends a Korean syllable leaves the card open", async () => {
		await WithCover.run();
		await properties();
		await openCard();
		await expect.element(alt()).toHaveFocus();
		alt()
			.element()
			.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
		await expect.element(alt()).toBeVisible();
	});

	it("09-1 the settings card opens right under the field's line, as wide as it", async () => {
		await WithCover.run();
		await properties();
		await openCard();
		await expect.element(alt()).toBeVisible();
		const line = cover().element().closest("[data-slot=media-input]");
		const card = alt().element().closest("[data-slot=popover-content]");
		if (!line || !card) throw new Error("no line or card");
		// Measured once it stops moving: it grows in as it opens.
		await expect
			.poll(() => Math.round(card.getBoundingClientRect().width))
			.toBe(Math.round(line.getBoundingClientRect().width));
		const [under, box] = [line.getBoundingClientRect(), card.getBoundingClientRect()];
		expect(Math.round(box.left)).toBe(Math.round(under.left));
		expect(Math.round(box.top - under.bottom)).toBe(4);
	});

	it("09-1 T67 × takes the file out", async () => {
		await WithCover.run();
		await properties();
		await userEvent.click(page.getByRole("button", { name: "대표 이미지 빼기" }));
		await expect.element(cover()).not.toHaveTextContent("desk-morning.jpg");
		await expect.element(settings()).not.toBeInTheDocument();
	});
});

describe("images with nothing to say for them", () => {
	it("09-1 T25 [flow 1·10] the to-do list says how many, and its row goes to the cover's alt text first", async () => {
		await MissingAlt.run();
		await userEvent.click(page.getByRole("button", { name: /할 일/ }));
		const row = page.getByRole("button", { name: /이미지 3개에 대체 텍스트 넣기/ });
		await userEvent.click(row);
		await expect.element(alt()).toHaveFocus();
	});

	it("09-1 T25 [flow 1·12] once the cover has its words, the row goes to the body's image and its card, and 'next image' walks on", async () => {
		await MissingAlt.run();
		await properties();
		await openCard();
		await userEvent.fill(alt(), "표지");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await userEvent.click(page.getByRole("button", { name: /할 일/ }));
		await userEvent.click(page.getByRole("button", { name: /이미지 2개에 대체 텍스트 넣기/ }));
		const card = page.getByRole("textbox", { name: "대체 텍스트" }).last();
		await expect.element(card).toHaveFocus();
		await userEvent.keyboard("첫 그림{Enter}");
		await expect.element(card).toHaveValue("");
		await userEvent.keyboard("둘째 그림");
		await expect.element(card).toHaveValue("둘째 그림");
		await expect.element(body().getByRole("img", { name: "첫 그림" })).toBeVisible();
	});
});

describe("in a translation", () => {
	it("04-5 the cover follows the source's, faint, with nothing to take out, and the source's words as a placeholder", async () => {
		await TranslationCover.run();
		await properties();
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(page.getByRole("button", { name: "대표 이미지 원문으로 되돌리기" })).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "대표 이미지 빼기" })).not.toBeInTheDocument();
		await openCard();
		await expect.element(alt()).toHaveAttribute("placeholder", "아침 책상");
		await expect.element(alt()).toHaveValue("");
	});

	it("09-1 another file starts with no alt text, so the old words cannot go out with it; the same file keeps them", async () => {
		await WithCover.run();
		await properties();
		await openCard();
		await expect.element(alt()).toHaveValue("아침 책상");
		await closeCard();
		const pick = async (name: RegExp) => {
			await userEvent.click(cover());
			const dialog = page.getByRole("dialog");
			await openAssets();
			await userEvent.click(dialog.getByRole("button", { name }));
			await userEvent.click(dialog.getByRole("button", { name: "고르기" }));
			await expect.element(dialog).not.toBeInTheDocument();
		};
		await pick(/desk-morning/);
		await openCard();
		await expect.element(alt()).toHaveValue("아침 책상");
		await closeCard();
		await pick(/seoul-night/);
		await expect.element(cover()).toHaveTextContent("seoul-night");
		await expect.element(page.getByText("대체 텍스트 없음")).toBeVisible();
		await openCard();
		await expect.element(alt()).toHaveValue("");
	});

	it("09-1 a cover can be decorative: then nothing asks for its alt text", async () => {
		await WithCover.run();
		await properties();
		await openCard();
		await userEvent.fill(alt(), "");
		await expect.element(page.getByText("대체 텍스트 없음")).toBeVisible();
		await userEvent.click(page.getByRole("switch", { name: "장식 이미지" }));
		await expect.element(page.getByText("대체 텍스트 없음")).not.toBeInTheDocument();
		await expect.element(alt()).not.toBeInTheDocument();
	});

	it("04-5 a following cover says it follows the source, and says nothing once it is the translation's own", async () => {
		await TranslationCover.run();
		await properties();
		const note = page.getByText("원문 따름", { exact: true });
		await expect.element(note).toBeVisible();
		await openCard();
		await userEvent.fill(alt(), "A desk in the morning");
		await expect.element(note).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "대표 이미지 원문으로 되돌리기" }));
		await expect.element(note).toBeVisible();
	});

	it("04-5 words of its own keep the file and make it its own; × follows the source again", async () => {
		await TranslationCover.run();
		await properties();
		await openCard();
		await userEvent.fill(alt(), "A desk");
		await expect.element(page.getByRole("button", { name: "대표 이미지 원문으로 되돌리기" })).toBeVisible();
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await userEvent.click(page.getByRole("button", { name: "대표 이미지 원문으로 되돌리기" }));
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await openCard();
		await expect.element(alt()).toHaveValue("");
	});

	it("09-1 T111 a translation's own cover keeps its picture when the source's changes, says so, and shows it before and after", async () => {
		await TranslationCoverChanged.run();
		await properties();
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(page.getByText("원문 따름", { exact: true })).not.toBeInTheDocument();
		const mark = page.getByRole("button", { name: "변경", exact: true });
		await userEvent.click(mark);
		await expect.element(page.getByText("desk-morning.jpg · 아침 책상")).toBeVisible();
		await expect.element(page.getByText("cybersecurity-code.jpg · 화면에 뜬 코드")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "번역 유지", exact: true }));
		await expect.element(mark).not.toBeInTheDocument();
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(page.getByText("원문 따름", { exact: true })).not.toBeInTheDocument();
	});

	it("04-5 another picture is this translation's own", async () => {
		await TranslationCover.run();
		await properties();
		await userEvent.click(cover());
		const dialog = page.getByRole("dialog");
		await openAssets();
		await userEvent.click(dialog.getByRole("button", { name: /seoul-night/ }));
		await userEvent.click(dialog.getByRole("button", { name: "고르기" }));
		await expect.element(cover()).toHaveTextContent("seoul-night.jpg");
	});
});
