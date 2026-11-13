import { type Doc, definePlugin, defineSchema, type Plugin, type Schema } from "@monti-cms/core";
import { seo } from "@monti-cms/seo";
import { seoAdmin } from "@monti-cms/seo/admin";
import { Checkbox, Stack, Text } from "@monti-cms/ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { defineAdminPlugin } from "../../plugins";
import { schema } from "../story-schema";

type Loaded = { site: StorySite; id: string; checked: { id: string; text: string }[][] };

export const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

/**
 * A spelling check as a plugin brings one (doc 03): it reads Korean, finds two well-known slips and says what to write. `checked` keeps
 * what it was asked, for the tests.
 */
export const spelling = (checked: Loaded["checked"] = []): Plugin =>
	definePlugin({
		name: "bareun",
		label: "바른 맞춤법",
		textCheck: {
			label: "맞춤법",
			locales: ["ko"],
			check(blocks) {
				checked.push(blocks.map((block) => ({ ...block })));
				const slips = [
					["몇일", "며칠"],
					["안되요", "안 돼요"],
				] as const;
				return blocks.flatMap((block) =>
					slips.flatMap(([wrong, right]) => {
						const at = block.text.indexOf(wrong);
						return at < 0 ? [] : [{ block: block.id, from: at, to: at + wrong.length, replacement: right }];
					}),
				);
			},
		},
	});

/** A plugin with a tool page: a search index that is built again from the tools. */
export const search = (): Plugin =>
	definePlugin({ name: "search", label: "검색", toolPages: [{ id: "index", label: "검색 색인" }] });

/** The browser half of the search plugin: its tool page's screen, drawn from the admin's own parts. */
const searchAdmin = defineAdminPlugin({
	name: "search",
	toolPages: {
		index: () => (
			<Stack gap={8} paddingTop={24}>
				<Text>글 128편이 색인에 있습니다.</Text>
				<Text variant="note" tone="subtle">
					마지막 색인 11. 12. 오후 3:20
				</Text>
			</Stack>
		),
	},
});

/**
 * The blog with a field of its own schema that names its input (doc 14: a site's field takes an input as a plugin's does): whether a post
 * is promoted, a choice of one with a field under it, drawn by the site's own input and not by the switch its kind has.
 */
const withPromo = defineSchema({
	...schema,
	collections: {
		...schema.collections,
		post: {
			...schema.collections.post,
			fields: {
				...schema.collections.post?.fields,
				promo: {
					kind: "conditional",
					options: ["on"],
					control: "toggle",
					input: "site.promo",
					fields: { on: { promoLine: { kind: "text" } } },
				},
			},
		},
	},
} as Schema);

/** The site's own plugin: a tab with a view that lists the values the entry has, as a plugin is handed them. */
export const site_ = (): Plugin =>
	definePlugin({
		name: "site",
		fields: [{ tab: "값", collections: ["post"], fields: { heldValues: { kind: "view", view: "site.values" } } }],
	});

/** Its browser half: the promo field's input (a checkbox, to tell it from the kind's switch) and the view. */
const siteAdmin = defineAdminPlugin({
	name: "site",
	inputs: {
		"site.promo": ({ id, value, onChange, readOnly }) => (
			<Checkbox
				id={id}
				checked={value === "on"}
				disabled={readOnly}
				onCheckedChange={(on) => onChange(on ? "on" : null)}
			/>
		),
	},
	views: {
		"site.values": ({ entry }) => (
			<Text variant="note" mono>
				{Object.entries(entry.values)
					.filter(([, value]) => typeof value === "string" && value !== "")
					.map(([name, value]) => `${name}=${String(value)}`)
					.join(" ")}
			</Text>
		),
	},
});

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Plugins",
	render: (_args, { loaded }) => (
		<MontiAdmin
			transport={(loaded as Loaded).site.transport}
			siteName="example.dev"
			plugins={[seoAdmin, searchAdmin, siteAdmin]}
		/>
	),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

let count = 0;
const p = (value: string) => ({
	id: `b_${++count}`,
	type: "paragraph",
	content: [{ type: "text" as const, text: value }],
});
const body = (): Doc => ({
	type: "doc",
	blocks: [
		p("몇일 전에 블로그를 다시 만들기로 했다."),
		p("목록에는 제목과 주소, 지금 상태만 남겼다."),
		p("이렇게 하면 안되요 하는 말을 여러 번 들었다."),
	],
});

/**
 * A site with three plugins (doc 14): SEO (a tab of fields, list columns), a spelling check (a cell of the editor's status bar) and a search
 * (a tool page). `at` is where the story opens: the entry, the list, the settings or the tools. `seoValues` are the entry's SEO values.
 */
export const site = ({
	at = "entry",
	seoValues = {},
	locale = "ko",
	ownInput = false,
}: {
	/** The posts have a field of the site's own that names its input, and a plugin's view that lists the entry's values. */
	ownInput?: boolean;
	at?: "entry" | "list" | "settings" | "tools";
	seoValues?: Record<string, unknown>;
	/** The entry's language: the spelling check reads Korean alone. */
	locale?: "ko" | "en";
} = {}) => [
	async (): Promise<Loaded> => {
		const checked: Loaded["checked"] = [];
		let id = "";
		const made = await storySite({
			schema: ownInput ? withPromo : schema,
			auth: { password: true },
			signedIn: true,
			plugins: ownInput ? [seo(), spelling(checked), search(), site_()] : [seo(), spelling(checked), search()],
			setup: async (monti) => {
				await monti.run(
					"collections.updateAdminValues",
					{
						collection: "post",
						values: {
							label: "게시글",
							fields: {
								slug: { label: "주소" },
								summary: { label: "요약" },
								subtitle: { label: "부제" },
								cover: { label: "대표 이미지" },
								category: { label: "카테고리" },
							},
						},
					},
					admin,
				);
				const entry = (await monti.run(
					"entries.create",
					{
						collection: "post",
						title: "첫 번째 글",
						slug: "first-post",
						values: { summary: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것.", ...seoValues },
						doc: body(),
					},
					admin,
				)) as { output: { id: string } };
				id = entry.output.id;
				if (locale === "en") {
					const translated = (await monti.run("translations.create", { source: id, locale: "en" }, admin)) as {
						output: { id: string };
					};
					id = translated.output.id;
				}
				await monti.run("entries.create", { collection: "post", title: "둘째 글", slug: "second-post" }, admin);
			},
		});
		checked.length = 0;
		startAt(
			at === "entry"
				? `#/c/post/${id}`
				: at === "list"
					? "#/c/post"
					: at === "settings"
						? "#/settings/collections"
						: "#/tools/p/search/index",
		);
		return { site: made, id, checked };
	},
];

const screen = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

/** The property panel's SEO tab (flow 1, step 08): each empty field says which value the site uses instead, and how long it is. */
export const SeoTab: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await userEvent.click(await page.findByRole("tab", { name: "SEO" }, wait));
		await page.findByRole("region", { name: "검색 결과" }, wait);
	},
};

/** The SEO tab with its values written: the counts beside the labels, one past its length, and the page hidden from search. */
export const SeoWritten: Story = {
	loaders: site({
		seoValues: {
			seoTitle:
				"리액트로 블로그를 다시 만들면서 덜어낸 것과 끝까지 남긴 것, 그리고 다음에 할 일까지 모두 적어 둔 아주 긴 제목",
			seoDescription: "도구를 고치는 시간이 글 쓰는 시간보다 길어졌다.",
			seoNoindex: "noindex",
		},
	}),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await userEvent.click(await page.findByRole("tab", { name: "SEO" }, wait));
		await page.findByText("검색에서 숨김", {}, wait);
	},
};

/**
 * The assistant's proposals for two of a plugin's fields (doc 10 with doc 14): the SEO title, in the plugin's own input, and "hide from
 * search", the plugin's switch. Each stands as proposed in the proposal's blue with the dot and "discard" on its label row; the plugin's
 * tab has the blue dot while another tab is open, and the bubble walks to them. The preview is a view with no value: it carries no mark.
 */
export const SeoProposed: Story = {
	loaders: [
		async (): Promise<Loaded> => {
			const [load] = site() as [() => Promise<Loaded>];
			const made = await load();
			const read = (await made.site.monti.run("entries.get", { id: made.id }, admin)) as { entry: { version: number } };
			const at = { id: made.id, version: read.entry.version };
			const proposal = await made.site.monti.proposals.create("conversation-1", "검색 제목 다듬고 검색에서 숨겨 줘");
			await made.site.monti.proposals.add(proposal, "entries.save", {
				...at,
				values: { seoTitle: "블로그를 다시 만든 까닭" },
			});
			await made.site.monti.proposals.add(proposal, "entries.save", { ...at, values: { seoNoindex: "noindex" } });
			return made;
		},
	],
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await page.findByText("1 / 2", {}, wait);
		await userEvent.click(await page.findByRole("tab", { name: /SEO/ }, wait));
		await page.findByRole("button", { name: "SEO 제목 제안 버리기" }, wait);
	},
};

/** The status bar's plugin cell (flow 1, step 06): what the spelling check found in the body. */
export const Spelling: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await page.findByRole("button", { name: "맞춤법 2" }, wait);
	},
};

/** The cell opened: each finding with what to write and "고치기", and "모두 고치기" under them. */
export const SpellingOpen: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "맞춤법 2" }, wait));
		await page.findByRole("button", { name: "모두 고치기" });
	},
};

/** Settings › collections › fields: the plugin's tab after the collection's own, locked, with the plugin's fields. */
export const LockedTab: Story = {
	loaders: site({ at: "settings" }),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await userEvent.click(await page.findByRole("tab", { name: /SEO/ }, wait));
		await page.findByText("seo 플러그인의 탭", {}, wait);
	},
};

/** The list's "add column" menu offers the plugin's columns (doc 06). */
export const ListColumns: Story = {
	loaders: site({ at: "list" }),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "열 추가" }, wait));
		await page.findByRole("menuitem", { name: "SEO 제목" }, wait);
	},
};

/** A plugin's tool page: a tab of the tools, with the screen the plugin's browser half brings. */
export const ToolPage: Story = {
	loaders: site({ at: "tools" }),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await page.findByText("글 128편이 색인에 있습니다.", {}, wait);
	},
};

/** A field of the site's own schema drawn with the input it names, and a plugin's view of the entry's values beside it. */
export const OwnInput: Story = {
	loaders: site({ ownInput: true }),
	play: async ({ canvasElement }) => {
		const page = screen(canvasElement);
		await page.findByRole("checkbox", { name: "promo" }, wait);
	},
};
