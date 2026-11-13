import type { ScriptedProvider } from "@monti-cms/ai";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { assisted } from "../../assistant/assistant.stories";
import * as media from "./media.stories";

/**
 * "✦ fill" for a picture (T104; doc 10, item 37): its words in the settings card of a body's image and of a media field, and its caption
 * at the end of the empty caption line. The quick-task model looks at the picture; here it is the scripted one.
 */
type Loaded = { site: StorySite; model: ScriptedProvider };
type Answer = Parameters<typeof assisted>[1];
type Story = Parameters<typeof scene>[0];

const on = (story: Story, answer?: Answer, options?: Parameters<typeof assisted>[2]) =>
	scene<Loaded>(
		{ ...story, loaders: [assisted([], answer, options), ...((story as { loaders: unknown[] }).loaders ?? [])] },
		media.default,
	);
const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const alt = () => page.getByRole("textbox", { name: "대체 텍스트" });
const caption = () => body().getByRole("textbox", { name: "캡션" });
const imageOf = async ({ site }: Loaded) => {
	const [entry] = await site.db.selectFrom("entries").select(["doc", "values"]).where("slug", "=", "writing").execute();
	const block = (entry?.doc as { blocks: { type: string; attrs?: Record<string, unknown> }[] }).blocks.find(
		(each) => each.type === "image",
	);
	return { attrs: block?.attrs ?? {}, values: entry?.values as Record<string, { alt?: string }> };
};

describe("the entry editor: '✦ fill' for a picture (T104)", () => {
	it("10-1 [flow 6·06] the image's settings card has '채우기' before the count: the model is shown the picture and the text around it, and its words go in blue, cut at the 80 the box takes", async () => {
		const long = `아침 햇빛이 드는 나무 책상 위에 노트북과 커피잔이 놓여 있다${" 그리고 더".repeat(12)}`;
		const made = on(media.ImageTools, () => ({ value: long }));
		await made.run();
		await expect.element(alt()).toBeVisible();
		await userEvent.click(button("채우기"));
		await expect.element(alt()).toHaveValue(long.slice(0, 80));
		expect(alt().element().hasAttribute("data-proposal")).toBe(true);
		await expect.element(page.getByText("80 / 80")).toBeVisible();
		const [asked] = made.loaded().model.answers;
		expect(asked?.picture?.mime).toMatch(/^image\//);
		expect(asked?.prompt).toContain("Text before the picture: 글의 첫 문단이에요.");
		// Filled, the button offers another try; the words are the block's own, unsaved.
		await expect.element(button("다시")).toBeVisible();
		expect((await imageOf(made.loaded())).attrs.alt).toBeUndefined();
	});

	it("10-1 a model that does not read pictures is not asked to guess: the card says so under the box and the box stays empty", async () => {
		const made = on(media.ImageTools, () => ({ value: "보지 않고 쓴 말" }), { pictures: false });
		await made.run();
		await expect.element(alt()).toBeVisible();
		await userEvent.click(button("채우기"));
		await expect.element(page.getByText("이 모델은 그림을 읽지 못합니다")).toBeVisible();
		await expect.element(alt()).toHaveValue("");
		expect(made.loaded().model.answers).toHaveLength(0);
	});

	it("10-1 the empty caption line has '채우기' at its end while the caret is in it: the caption comes in blue, and a line with words has '다시' instead", async () => {
		const made = on(media.WithImage, (request) => ({
			value: request.prompt.includes("caption") ? "책상에서 시작한 아침" : "다른 답",
		}));
		await made.run();
		await expect.element(caption()).toBeVisible();
		// Not before the caret is in the line.
		await expect.element(button("채우기")).not.toBeInTheDocument();
		await userEvent.click(caption());
		await userEvent.click(button("채우기"));
		await expect.element(caption()).toHaveValue("책상에서 시작한 아침");
		expect(caption().element().hasAttribute("data-proposal")).toBe(true);
		// The caret stayed in the caption through the press; with words in it the button asks again, as the alt text's does (screens/common.md).
		expect(document.activeElement).toBe(caption().element());
		await expect.element(button("채우기")).not.toBeInTheDocument();
		await expect.element(button("다시")).toBeVisible();
		await userEvent.keyboard("!");
		await expect.element(caption()).toHaveValue("책상에서 시작한 아침!");
		expect(caption().element().hasAttribute("data-proposal")).toBe(false);
	});

	it("10-1 a caption typed while its fill is on the way stays: the answer that comes late is not put over it", async () => {
		let answerNow = (_value: unknown) => {};
		const made = on(
			media.WithImage,
			() =>
				new Promise((resolve) => {
					answerNow = resolve;
				}),
		);
		await made.run();
		await userEvent.click(caption());
		await userEvent.click(button("채우기"));
		await expect.element(page.getByText("쓰는 중…")).toBeVisible();
		await userEvent.keyboard("내가 쓴 캡션");
		answerNow({ value: "늦게 온 캡션" });
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect.element(caption()).toHaveValue("내가 쓴 캡션");
	});

	it("10-1 a media field's settings card has the same '채우기': the cover's words are filled from its picture", async () => {
		const made = on({ loaders: media.MissingAlt.loaders }, () => ({ value: "아침 책상" }));
		await made.run();
		const open = button("속성");
		await expect.element(open).toBeVisible();
		if (open.element().getAttribute("aria-pressed") !== "true") await userEvent.click(open);
		await userEvent.click(button("대표 이미지 설정"));
		await expect.element(alt()).toBeVisible();
		await userEvent.click(button("채우기"));
		await expect.element(alt()).toHaveValue("아침 책상");
		expect(made.loaded().model.answers[0]?.picture).toBeDefined();
	});

	it("10-1 a site without the assistant has no '채우기' in the picture's card or on its caption line", async () => {
		const plain = scene<Loaded>(media.ImageTools, media.default);
		await plain.run();
		await expect.element(alt()).toBeVisible();
		await expect.element(button("채우기")).not.toBeInTheDocument();
	});
});
