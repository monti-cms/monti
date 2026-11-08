import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as media from "./media.stories";

const { Draft, WithCover, MissingAlt, TranslationCover } = composeStories(media);

const cover = () => page.getByRole("button", { name: "대표 이미지", exact: true });
const alt = () => page.getByRole("textbox", { name: "대체 텍스트" });
const body = () => page.getByRole("textbox", { name: "본문" });
const properties = async () => {
	const open = page.getByRole("button", { name: "속성" });
	if (open.elements().length > 0 && open.element().getAttribute("aria-pressed") !== "true") await userEvent.click(open);
};

describe("a cover in the property panel", () => {
	it("09-3 T67 [flow 6·30] the field opens the same window, showing images, and what is picked goes in", async () => {
		await Draft.run();
		await properties();
		await userEvent.click(cover());
		const dialog = page.getByRole("dialog");
		await expect.element(dialog.getByRole("heading", { name: "대표 이미지" })).toBeVisible();
		await expect.element(dialog.getByRole("button", { name: /notes-scan/ })).not.toBeInTheDocument();
		await userEvent.click(dialog.getByRole("button", { name: /desk-morning/ }));
		await userEvent.click(dialog.getByRole("button", { name: "고르기" }));
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(alt()).toHaveValue("");
		await expect.element(page.getByText("이 그림이 말하는 것을 쓰세요.")).toBeVisible();
	});

	it("09-2 T67 the alt text is this entry's: written here, saved with it", async () => {
		await WithCover.run();
		await properties();
		await expect.element(alt()).toHaveValue("아침 책상");
		await userEvent.fill(alt(), "아침의 책상 위");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect.element(alt()).toHaveValue("아침의 책상 위");
		await expect.element(page.getByRole("button", { name: "저장 전 변경사항" })).not.toBeInTheDocument();
	});

	it("09-1 T67 × takes the file out", async () => {
		await WithCover.run();
		await properties();
		await userEvent.click(page.getByRole("button", { name: "대표 이미지 빼기" }));
		await expect.element(cover()).not.toHaveTextContent("desk-morning.jpg");
		await expect.element(alt()).not.toBeInTheDocument();
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
		await expect.element(page.getByRole("button", { name: "대표 이미지 빼기" })).not.toBeInTheDocument();
		await expect.element(alt()).toHaveAttribute("placeholder", "아침 책상");
		await expect.element(alt()).toHaveValue("");
	});

	it("04-5 words of its own keep the file and make it its own; × follows the source again", async () => {
		await TranslationCover.run();
		await properties();
		await userEvent.fill(alt(), "A desk");
		await expect.element(page.getByRole("button", { name: "대표 이미지 빼기" })).toBeVisible();
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await userEvent.click(page.getByRole("button", { name: "대표 이미지 빼기" }));
		await expect.element(cover()).toHaveTextContent("desk-morning.jpg");
		await expect.element(alt()).toHaveValue("");
	});

	it("04-5 another picture is this translation's own", async () => {
		await TranslationCover.run();
		await properties();
		await userEvent.click(cover());
		const dialog = page.getByRole("dialog");
		await userEvent.click(dialog.getByRole("button", { name: /seoul-night/ }));
		await userEvent.click(dialog.getByRole("button", { name: "고르기" }));
		await expect.element(cover()).toHaveTextContent("seoul-night.jpg");
	});
});
