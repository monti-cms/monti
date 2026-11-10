import type { Doc, Schema } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";
import { admin, opened, wait } from "./entry.stories";

type Loaded = { site: StorySite; ids: Record<string, string> };
type Monti = StorySite["monti"];

let count = 0;
const text = (value: string) => [{ type: "text" as const, text: value }];
const p = (value: string, id = `t_${++count}`) => ({ id, type: "paragraph", content: text(value) });
const h = (value: string, id = `t_${++count}`) => ({ id, type: "heading", attrs: { level: 2 }, content: text(value) });
const code = (value: string, id = `t_${++count}`) => ({ id, type: "codeBlock", content: text(value) });
const doc = (...blocks: Doc["blocks"]): Doc => ({ type: "doc", blocks });

/** The reference entry (Editor › EditorTranslate), with a code block that follows the source. */
const source = () =>
	doc(
		p("블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.", "s_1"),
		h("무엇을 덜어냈나", "s_2"),
		p("목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.", "s_3"),
		code("pnpm add @monti-cms/core", "s_4"),
		p("편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.", "s_5"),
	);

/** The source again, published later: one sentence changed, one removed, one new (flow 3, step 08). */
const sourceLater = () =>
	doc(
		p("블로그를 다시 만들기로 한 건 도구를 고치는 시간이 글을 쓰는 시간보다 길어졌기 때문이다.", "s_1"),
		h("무엇을 덜어냈나", "s_2"),
		code("pnpm add @monti-cms/core", "s_4"),
		p("편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.", "s_5"),
		p("다음 글에서는 번역을 다룬다.", "s_6"),
	);

const ENGLISH = [
	"I rebuilt the blog because fixing the tool took longer than writing.",
	"What I took out",
	"The list keeps only the title, the address and the state. The rest I open when I need it.",
	"",
	"The editor follows the same rule. While writing, only the writing shows.",
];

/**
 * - `alone`: the Korean post, published, with no translation.
 * - `new`: an English translation just made: every block still in the Korean words.
 * - `changed`: the English translation after the source was published again.
 * - `fieldsChanged`: the same, its title and summary the only things changed (T111).
 * - `all`: the Korean post with a translation in every other language.
 */
type Kind = "alone" | "new" | "changed" | "fieldsChanged" | "all";

async function run<Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) {
	return (await monti.run(name, input, admin)) as Output;
}
const version = async (monti: Monti, id: string) =>
	(await run<{ entry: { version: number; doc: Doc } }>(monti, "entries.get", { id })).entry;

/** An English translation of `korean`, written block by block and published. */
async function translated(monti: Monti, korean: string) {
	const id = (await run(monti, "translations.create", { source: korean, locale: "en" })).output.id;
	const made = await version(monti, id);
	await run(monti, "entries.save", {
		id,
		version: made.version,
		title: "The first post",
		values: { summary: "What I took out of the blog, and what I kept." },
		doc: {
			type: "doc",
			blocks: made.doc.blocks.map((block, index) =>
				block.type === "codeBlock" ? block : { ...block, content: text(ENGLISH[index] ?? "") },
			),
		},
	});
	await run(monti, "entries.publish", { ids: [id] });
	return id;
}

async function entries(monti: Monti, kind: Kind, current: Schema): Promise<Record<string, string>> {
	await run(monti, "collections.updateAdminValues", {
		collection: "post",
		values: {
			label: "게시글",
			fields: {
				title: { label: "제목" },
				slug: { label: "주소" },
				summary: { label: "요약" },
				subtitle: { label: "부제" },
				cover: { label: "대표 이미지" },
				category: { label: "카테고리" },
			},
		},
	});
	const hasEn = current.locales.list.some((l) => l.code === "en");
	const devCat = (
		await run<{ output: { group: string } }>(monti, "items.saveGroup", {
			collection: "category",
			locales: {
				ko: { title: "개발", slug: "dev" },
				...(hasEn ? { en: { title: "Development", slug: "dev" } } : {}),
			},
		})
	).output;
	const korean = (
		await run(monti, "entries.create", {
			collection: "post",
			title: "첫 번째 글",
			slug: "first-post",
			values: {
				summary: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것.",
				subtitle: "도구보다 글",
				category: devCat.group,
			},
			doc: source(),
		})
	).output.id;
	await run(monti, "entries.publish", { ids: [korean] });
	if (kind === "alone") return { korean };
	if (kind === "new")
		return { korean, english: (await run(monti, "translations.create", { source: korean, locale: "en" })).output.id };
	const english = await translated(monti, korean);
	if (kind === "all") {
		for (const locale of current.locales.list.map((each) => each.code).filter((code) => code !== "ko" && code !== "en"))
			await run(monti, "translations.create", { source: korean, locale });
		return { korean, english };
	}
	await run(monti, "entries.save", {
		id: korean,
		version: (await version(monti, korean)).version,
		...(kind === "fieldsChanged"
			? {
					title: "첫 번째 글을 고치며",
					values: { summary: "도구를 덜어낸 까닭.", subtitle: "도구보다 글", category: devCat.group },
				}
			: { doc: sourceLater() }),
	});
	await run(monti, "entries.publish", { ids: [korean] });
	return { korean, english };
}

/** The site with the story's entries, opened at one of them (`at`). `current` replaces the stories' schema (another set of languages). */
export const site = (kind: Kind, at: "korean" | "english", current: Schema = schema) => [
	async (): Promise<Loaded> => {
		let ids: Record<string, string> = {};
		const made = await storySite({
			schema: current,
			auth: { password: true },
			signedIn: true,
			setup: async (monti) => {
				ids = await entries(monti, kind, current);
			},
		});
		startAt(`#/c/post/${ids[at]}`);
		return { site: made, ids };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Entry/Translation",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The source after it was published again: its languages over the title, a dot on English, and "+ 언어" open with Japanese (flow 3, 01 and 08). */
export const LanguageMenu: Story = {
	loaders: site("changed", "korean"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "+ 언어" }, wait));
	},
};

/** A new translation: every block still in the Korean words, the source beside it, the address copied (flow 3, step 02). */
export const NewTranslation: Story = {
	loaders: site("new", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await page.findByRole("complementary", { name: "한국어 원문 · 읽기 전용" }, wait);
	},
};

/** A dimmed block's menu: keep it in the source's words, or remove it (flow 3, step 04). */
export const PendingMenu: Story = {
	loaders: site("new", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "끔" }, wait));
		// The undecided heading is empty: the source's words are its placeholder.
		const heading = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>("h2[data-source-placeholder*='무엇을 덜어냈나']");
			if (!found) throw new Error("no undecided heading yet");
			return found;
		}, wait);
		const line = heading.getBoundingClientRect();
		fireEvent.mouseMove(heading, { clientX: line.left + 8, clientY: line.top + 8 });
		await userEvent.click(
			await within(canvasElement.ownerDocument.body).findByRole("button", { name: "블록 메뉴" }, wait),
		);
	},
};

/** The to-do list open: what stops publishing, then the "원문 변경" group with each mark's block and its decision (flow 3, step 09). */
export const ChangesList: Story = {
	loaders: site("changed", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "끔" }, wait));
		await userEvent.click(await page.findByRole("button", { name: /^할 일/ }, wait));
	},
};

/** The translation after the source changed: the banner, and a mark in the margin by each changed, new and removed block (flow 3, step 09). */
export const SourceChanged: Story = {
	loaders: site("changed", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await page.findByText("원문 변경", undefined, wait);
		await userEvent.click(page.getByRole("button", { name: "끔" }));
	},
};

/** The source's title and summary changed: the mark in the title's margin, and on the summary's label row (T111). */
export const FieldsChanged: Story = {
	loaders: site("fieldsChanged", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "끔" }, wait));
		const panel = await page.findByRole("button", { name: "속성" }, wait);
		if (panel.getAttribute("aria-pressed") !== "true") await userEvent.click(panel);
		await page.findByRole("textbox", { name: "요약" }, wait);
	},
};

/** The title's card: the source's title before and after, and "번역 유지" (T111). */
export const TitleCard: Story = {
	loaders: site("fieldsChanged", "english"),
	play: async (context) => {
		await FieldsChanged.play?.(context);
		const { page } = await opened(context.canvasElement);
		const mark = await waitFor(() => {
			const found = context.canvasElement.querySelector<HTMLElement>("[data-field-mark=title]");
			if (!found) throw new Error("no mark yet");
			return found;
		}, wait);
		await userEvent.click(mark);
		await page.findByRole("textbox", { name: "제목" }, wait);
	},
};

/** The to-do list with only the source's changes: the fields by name (T111). */
export const FieldsInTheList: Story = {
	loaders: site("fieldsChanged", "english"),
	play: async (context) => {
		await FieldsChanged.play?.(context);
		const { page } = await opened(context.canvasElement);
		await userEvent.click(await page.findByRole("button", { name: /^할 일/ }, wait));
	},
};

/** A changed block's card: the source before and after, and "번역 유지" (flow 3, step 10). */
export const ChangedCard: Story = {
	loaders: site("changed", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "끔" }, wait));
		await userEvent.click(await page.findByRole("button", { name: "변경" }, wait));
		await within(canvasElement.ownerDocument.body).findByText("원문 변경", undefined, wait);
	},
};

/** The source and the translation side by side, block by block, with the source's changes noted (flow 3, step 05). */
export const SideBySide: Story = {
	loaders: site("changed", "english"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "나란히" }, wait));
	},
};
