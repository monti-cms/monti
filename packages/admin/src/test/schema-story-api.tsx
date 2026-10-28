import type { StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { testSite } from "../../../core/test/site";
import { schemaCollectionMessages } from "../screens/schema/collection.messages";
import { schemaFieldsMessages } from "../screens/schema/fields.messages";
import { schemaLocalesMessages } from "../screens/schema/locales.messages";
import { schemaMessages } from "../screens/schema/messages";
import { schemaReviewMessages } from "../screens/schema/review.messages";
import { schemaSiteMessages } from "../screens/schema/site.messages";
import { SettingsScreen } from "../screens/settings/settings-screen";
import type { SchemaTab } from "../screens/settings/tabs";
import { answer, type FakeApi, PageFrame } from "../stories/screen-frame";

/**
 * What the stories of the Settings page and of the schema screens share: the schema file and what the server says about it, the page in its place, the
 * words the plays look for, and the steps that more than one story takes. Not a story file.
 */

export { answer, expect, fireEvent, userEvent, waitFor, within };
export type { FakeApi };

/** A story of a screen; the file's `meta` carries the layout and the `visual` tag. */
export type Story = StoryObj;

export const t = testSite.createTranslator(schemaMessages);
export const tCollection = testSite.createTranslator(schemaCollectionMessages);
export const tFields = testSite.createTranslator(schemaFieldsMessages);
export const tLocales = testSite.createTranslator(schemaLocalesMessages);
export const tReview = testSite.createTranslator(schemaReviewMessages);
export const tSite = testSite.createTranslator(schemaSiteMessages);

export const SCHEMA = "/api/monti/v1/schema";

const item = (label: string) => ({
	label,
	kind: "item",
	fields: { title: { kind: "text", label: "이름", required: true } },
});

/**
 * The schema file the boards show: the 게시글 collection with its eight fields (the board counts ten), 메모 and the three item collections, two languages with
 * 한국어 as the source, and the site settings of the Settings board.
 */
export const schema = () => ({
	site: {
		name: "몬티 블로그",
		homeLink: "/",
		aliases: ["www.example.dev"],
		previewPath: "/preview",
		previewLocaleParam: false,
		localePrefix: "always",
	},
	collections: {
		post: {
			label: "게시글",
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", label: "제목", required: true },
				slug: { kind: "slug", label: "주소", from: "title" },
				summary: {
					kind: "text",
					label: "요약",
					max: 120,
					description: "목록과 검색 결과에 나오는 한 문장. 결론을 먼저.",
				},
				subtitle: { kind: "text", label: "부제" },
				cover: {
					kind: "media",
					label: "대표 이미지",
					accept: "image",
					description: "대체 텍스트는 보이는 것만, 80자 안.",
				},
				category: { kind: "relation", label: "카테고리", to: "category" },
				tags: { kind: "relation", label: "태그", to: "tag", many: true },
				series: { kind: "relation", label: "시리즈", to: "series" },
			},
			layout: [
				{ fields: ["title", "slug", "summary", "subtitle", "cover"] },
				{ group: "분류", fields: ["category", "tags", "series"] },
			],
		},
		memo: {
			label: "메모",
			kind: "document",
			path: "/memos/:slug",
			fields: {
				title: { kind: "text", label: "제목", required: true },
				slug: { kind: "slug", label: "주소", from: "title" },
				mood: { kind: "text", label: "기분" },
				pinned: { kind: "text", label: "고정" },
			},
		},
		category: item("카테고리"),
		tag: item("태그"),
		series: item("시리즈"),
	},
	locales: [
		{ code: "ko", name: "한국어" },
		{ code: "en", name: "English", label: "영어" },
	],
	defaultLocale: "ko",
	timeZone: "Asia/Seoul",
	admin: { messages: { ko: { "entries.title": "콘텐츠" } } },
});

export const screenState = (over: Record<string, unknown> = {}) => ({
	access: { writable: true },
	file: "monti.schema.ts",
	hash: "hash-1",
	schema: schema(),
	source: "file",
	comments: false,
	issues: [],
	applied: { appliedAt: "2026-10-01T00:00:00.000Z" },
	codeCollections: [],
	vocabulary: { blocks: ["table", "image", "callout"], marks: ["bold", "italic"] },
	collections: ["post", "memo", "category", "tag", "series"],
	// The numbers of the boards: 게시글 148 with 3 folders, 메모 23 with 2 in the trash and 2 folders.
	footprints: {
		post: { entries: 148, trashed: 0, folders: 3 },
		memo: { entries: 23, trashed: 2, folders: 2 },
		category: { entries: 6, trashed: 0, folders: 0 },
		tag: { entries: 12, trashed: 0, folders: 0 },
		series: { entries: 4, trashed: 0, folders: 0 },
	},
	siteUrl: { url: null, from: "none" },
	...over,
});

/** A file nobody can write to, for the read-only variants of the boards. */
export const readOnlyState = (reason: "not_writable" | "production" = "not_writable") =>
	screenState({ access: { writable: false, reason } });

export const previewOf = (over: Record<string, unknown> = {}) => ({
	valid: true,
	issues: [],
	changed: true,
	impacts: [],
	decisions: [],
	transforms: [],
	problems: [],
	baseline: "applied",
	bodiesRead: 0,
	...over,
});

const SAVED = { saved: true, file: "monti.schema.ts", hash: "hash-2", transforms: [] };

/** The server: the schema file, the check of an edit, and what saving answers. */
export const server =
	({
		state = screenState(),
		preview = previewOf(),
		save,
	}: {
		state?: unknown;
		preview?: unknown;
		save?: ReturnType<typeof answer>;
	} = {}): FakeApi =>
	(path, method) => {
		if (path === SCHEMA && method === "GET") return state;
		if (path === `${SCHEMA}/preview` && method === "POST") return preview;
		if (path === SCHEMA && method === "PUT") return save ?? SAVED;
		return undefined;
	};

/**
 * The page keeps its tab and the open collection in the address of the frame; this sets them before the story renders, so one story does not leave its place to the next.
 * (Tabs are picked by the `tab` prop here: the tab links would move the Storybook frame itself.)
 */
export const place =
	(query: Record<string, string> = {}) =>
	() => {
		const url = new URL(window.location.href);
		url.searchParams.delete("collection");
		url.searchParams.delete("section");
		for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
		window.history.replaceState(null, "", `${url.pathname}${url.search}`);
		// A toast one story left in the session is not the next one's.
		try {
			window.sessionStorage.clear();
		} catch {
			// no storage: nothing to clear
		}
	};

export const screen =
	(api: FakeApi, tab: SchemaTab = "collections") =>
	() => (
		<PageFrame api={api} pathname={`/admin/settings/${tab}`}>
			<SettingsScreen tab={tab} />
		</PageFrame>
	);

/** A story of the Settings page on `tab`, with `query` in the address and `extra` (a `play`, a `name`) on top; `before` runs once more before it renders (a note left for the page). */
export const story = (
	api: FakeApi,
	tab: SchemaTab,
	query?: Record<string, string>,
	{ before, ...extra }: Partial<Story> & { before?: () => void } = {},
): Story => ({
	beforeEach: () => {
		place(query)();
		before?.();
	},
	render: screen(api, tab),
	...extra,
});

export type Play = NonNullable<Story["play"]>;
type PlayContext = Parameters<Play>[0];
export type Canvas = PlayContext["canvasElement"];

export const body = () => within(document.body);

/** Types into an input: a change event, not typed keys (the input tracks its value for React, and typing does not reach it here). */
export const setValue = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

/** The title row's group of the changes: the button that opens its list. */
export const changesButton = (canvas: Canvas) => within(canvas).findByRole("button", { name: t("bar.list") });
export const saveButton = (canvas: Canvas) => within(canvas).findByRole("button", { name: t("bar.save") });

/** Presses the title row's save and waits for the sheet of the review; the apply button is on once the server has answered. */
export const openReview = async (canvas: Canvas, applyName = tReview("review.save")) => {
	await userEvent.click(await saveButton(canvas));
	const sheet = await body().findByRole("dialog");
	const apply = await within(sheet).findByRole("button", { name: applyName });
	await waitFor(() => expect(apply).toBeEnabled());
	return sheet;
};
