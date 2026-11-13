import { ProviderError, type ScriptedProvider } from "@monti-cms/ai";
import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { assisted } from "../../assistant/assistant.stories";
import { admin, opened, site, wait } from "./entry.stories";
import * as media from "./media.stories";
import * as translation from "./translation.stories";

/**
 * The assistant's entry points in the entry editor (doc 10; T41, T64, T69, T94, T104), on a site that has the assistant: the model says
 * what each story tells it to.
 */
type Loaded = { site: StorySite; id: string };

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Entry/Assist",
	render: (_args, { loaded }) => {
		const { site: made } = loaded as Loaded;
		return (
			<MontiAdmin transport={made.transport} streams={made.streams} uploader={made.uploader} siteName="example.dev" />
		);
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const never = new Promise<never>(() => {});
const GROUP = "_group";

/** Picks words of the body as a hand does: a selection over them, with the caret in the text. */
function pick(bodyElement: HTMLElement, words: string) {
	const walker = document.createTreeWalker(bodyElement, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const at = node.textContent?.indexOf(words) ?? -1;
		if (at < 0) continue;
		bodyElement.focus();
		const range = document.createRange();
		range.setStart(node, at);
		range.setEnd(node, at + words.length);
		const selection = window.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		return;
	}
	throw new Error(`"${words}" is not in the body`);
}

/** Flow 2·10: a field filled by "✦ fill": its words in blue, the button now "again". */
export const FieldFilled: Story = {
	loaders: [assisted([], () => ({ value: "도구보다 글" })), ...site("draft")],
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("textbox", { name: "부제" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "부제 채우기" }, wait));
		await page.findByRole("button", { name: "부제 다시 채우기" }, wait);
	},
};

/** A field being filled: the button says "writing…". */
export const FieldFilling: Story = {
	loaders: [assisted([], () => never), ...site("draft")],
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("textbox", { name: "부제" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "부제 채우기" }, wait));
		await page.findByText("쓰는 중…", {}, wait);
	},
};

/** The service refused the fill: a line under the field with the key's name. */
export const FieldFillFailed: Story = {
	loaders: [
		assisted([], () => {
			throw new ProviderError("refused", "Your credit balance is too low.");
		}),
		...site("draft"),
	],
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("textbox", { name: "부제" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "부제 채우기" }, wait));
		await page.findByText("서비스가 거절했습니다 · Anthropic 개인", {}, wait);
	},
};

/** Flow 2·08: a request on picked words, just opened: the words underlined, a card that is a box alone with the caret in it. */
export const RequestOpen: Story = {
	loaders: [assisted(), ...site("draft")],
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		pick(body, "나머지는 필요할 때 꺼내 본다.");
		await userEvent.click(await all.findByRole("button", { name: "요청" }, wait));
		await all.findByRole("textbox", { name: "어시스턴트에게 요청" }, wait);
	},
};

/** The request sent: its mark says "…", the card's button stops it, and the status bar counts it. */
export const RequestWorking: Story = {
	loaders: [assisted([{ hold: never }]), ...site("draft")],
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		pick(body, "나머지는 필요할 때 꺼내 본다.");
		await userEvent.click(await all.findByRole("button", { name: "요청" }, wait));
		await userEvent.type(
			await all.findByRole("textbox", { name: "어시스턴트에게 요청" }, wait),
			"뒤 문장만 줄여 줘{Enter}",
		);
		await all.findByText("고치는 중…", {}, wait);
	},
};

/** Flow 2·09: one proposed change's own card, open from its mark: discard, take, what was asked, and a box to go on. */
export const ProposalCard: Story = {
	loaders: [assisted(), ...site("proposed")],
	play: async ({ canvasElement }) => {
		const { all } = await opened(canvasElement);
		const [mark] = await all.findAllByRole("button", { name: "제안: 더 짧게 다듬기" }, wait);
		if (mark) await userEvent.click(mark);
		await all.findByRole("textbox", { name: "이어서 요청" }, wait);
	},
};

type Translated = { site: StorySite; ids: Record<string, string>; model: ScriptedProvider };

/** "✦ translate" by the language tabs: the assistant's blue text button. */
const translateButton = (canvasElement: HTMLElement) =>
	waitFor(() => {
		const found = canvasElement.querySelector<HTMLElement>("[data-slot=text-button][data-tone=proposal]");
		if (!found) throw new Error("no button yet");
		return found;
	}, wait);

/** Flow 3·03: a new translation with "✦ translate" by its tabs. */
export const Translate: Story = {
	loaders: [assisted(), ...translation.site("new", "english")],
	play: async ({ canvasElement }) => {
		await opened(canvasElement);
		await translateButton(canvasElement);
	},
};

/** The translations proposed: each in blue where the block's own words will stand, and the bubble named by the button. */
export const TranslateProposed: Story = {
	loaders: [assisted(), ...translation.site("new", "english")],
	play: async ({ canvasElement, loaded }) => {
		const { site: made, ids, model } = loaded as Translated;
		const id = ids.english ?? "";
		const read = (await made.monti.run("entries.get", { id }, admin)) as { entry: { doc: Doc; version: number } };
		const words = ["I rebuilt the blog because fixing the tool took longer than writing.", "What I took out"];
		// The model translates the first two blocks: one change for each.
		model.add(
			{
				calls: read.entry.doc.blocks.slice(0, 2).map((block, index) => ({
					name: "body_edit",
					input: {
						id,
						version: read.entry.version,
						ops: [
							{
								op: "replaceText",
								block: block.id,
								from: 0,
								to: (block.content ?? []).map((part) => ("text" in part ? part.text : "")).join("").length,
								text: words[index],
							},
						],
						[GROUP]: "번역",
					},
				})),
			},
			{ text: "두 문단을 번역했습니다." },
		);
		const { all } = await opened(canvasElement);
		await userEvent.click(await translateButton(canvasElement));
		await all.findByText("1 / 2", {}, wait);
	},
};

/** Flow 6·06: a picture's settings card with "✦ fill" before the count. */
export const PictureFill: Story = {
	loaders: [assisted([], () => ({ value: "아침 햇빛이 드는 책상" })), ...(media.ImageTools.loaders as [])],
	play: async (context) => {
		await media.ImageTools.play?.(context as never);
		const page = within(context.canvasElement.ownerDocument.body);
		await page.findByRole("button", { name: "채우기" }, wait);
	},
};

/** The empty caption line with the caret in it: "✦ fill" at its end. */
export const CaptionFill: Story = {
	loaders: [assisted([], () => ({ value: "책상에서 시작한 아침" })), ...(media.WithImage.loaders as [])],
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const caption = await page.findByRole("textbox", { name: "캡션" }, wait);
		await userEvent.click(caption);
		fireEvent.focus(caption);
		await page.findByRole("button", { name: "채우기" }, wait);
	},
};
