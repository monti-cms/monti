import { defineSchema } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sql } from "kysely";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { createScreenChannel, type ScreenChannel } from "../../operations/admin-context";
import { schema as storySchema } from "../story-schema";

type Loaded = { site: StorySite; screen: ScreenChannel };
type Monti = StorySite["monti"];

/** The stories' blog with the tags the reference list shows (a relation to many). */
const schema = defineSchema({
	...storySchema,
	collections: {
		...storySchema.collections,
		post: {
			...storySchema.collections.post,
			fields: { ...storySchema.collections.post.fields, tags: { kind: "relation", to: "tag", many: true } },
		},
		tag: {
			kind: "item",
			path: "/tags/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const admin = { actor: "admin" } as const;
export const wait = { timeout: 15000 };

/** The reference list's rows (`Screens/Reference/Lists` › Main): status, title, address, category, tags, other languages and date. */
const POSTS = [
	["changed", "발행 후 고친 글", "edited-post", "개발", ["리액트"], [], "2026-10-26"],
	["draft", "리액트 서버 컴포넌트 다시 보기", "rsc-again", "개발", ["리액트", "성능"], [], "2026-10-25"],
	["draft", "가을 사진 정리", "autumn-photos", "일상", [], [], "2026-10-22"],
	["published", "첫 번째 글", "first-post", "개발", ["리액트"], ["en"], "2026-10-01"],
	["published", "CMS elements: details", "cms-elements-details", "개발", [], ["en"], "2026-09-20"],
	["published", "CMS elements", "cms-elements", "개발", ["Blocks"], [], "2026-09-14"],
	["published", "서울의 밤", "seoul-night", "일상", [], [], "2026-09-02"],
	["published", "타입스크립트 5.9 정리", "ts-59", "개발", [], [], "2026-08-28"],
	["published", "여름 휴가 메모", "summer-notes", "일상", [], [], "2026-08-11"],
	[
		"published",
		"리액트 19 마이그레이션, 서버 컴포넌트와 액션까지 한 번에 옮긴 기록",
		"react-19-migration-notes",
		"개발",
		["리액트", "마이그레이션", "회고", "타입스크립트"],
		["en", "ja"],
		"2026-08-03",
	],
] as const;

export const run = <Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;

async function create(monti: Monti, collection: string, title: string, slug: string) {
	return (await run(monti, "entries.create", { collection, locale: "ko", title, slug })).output.id;
}

/**
 * The reference list's data, through operations where they exist. Relation values (doc 08), the reference's bare translations and dates in the past
 * are written as those docs store them; the older 138 posts fill the pages to 148 as the reference counts. A language the site lacks is left out.
 */
async function setup(monti: Monti, languages: readonly string[]) {
	for (const [collection, label] of [
		["post", "게시글"],
		["memo", "메모"],
		["category", "카테고리"],
		["tag", "태그"],
	] as const) {
		const values =
			collection === "post"
				? {
						label,
						folders: true,
						fields: {
							category: { label: "카테고리" },
							tags: { label: "태그" },
							summary: { label: "요약" },
							subtitle: { label: "부제" },
						},
					}
				: { label };
		await run(monti, "collections.updateAdminValues", { collection, values });
	}
	// Flow 1, step 02: the site's templates, so the new pill and the empty list offer "from a template".
	for (const [name, text] of [
		["기본 글", "도입"],
		["책 리뷰", "한 줄 평"],
		["튜토리얼", "준비물"],
	])
		await run(monti, "templates.save", {
			name,
			doc: { type: "doc", blocks: [{ id: `t_${text}`, type: "paragraph", content: [{ type: "text", text }] }] },
		});
	const groups = new Map<string, string>();
	const groupOf = async (id: string) =>
		(await monti.db.selectFrom("entries").select("translation_group").where("id", "=", id).executeTakeFirstOrThrow())
			.translation_group;
	for (const name of ["개발", "일상"]) groups.set(name, await groupOf(await create(monti, "category", name, "")));
	for (const name of ["리액트", "성능", "Blocks", "마이그레이션", "회고", "타입스크립트"])
		groups.set(name, await groupOf(await create(monti, "tag", name, "")));
	for (const [state, title, slug, category, tags, locales, date] of [...POSTS].reverse()) {
		const id = await create(monti, "post", title, slug);
		const group = await groupOf(id);
		if (state !== "draft") await run(monti, "entries.publish", { ids: [id] });
		if (state === "changed") await run(monti, "entries.save", { id, version: 2, values: { summary: "고친 요약" } });
		const links = [{ field: "category", to: category }, ...tags.map((tag) => ({ field: "tags", to: tag }))];
		for (const [position, link] of links.entries())
			await monti.db
				.insertInto("entry_links")
				.values({ from_group: group, field: link.field, to_group: groups.get(link.to) ?? "", position })
				.execute();
		for (const locale of locales.filter((code) => languages.includes(code)))
			await monti.db
				.insertInto("entries")
				.values({
					id: `${id}-${locale}`,
					collection: "post",
					translation_group: group,
					locale,
					slug,
					title,
					values: "{}",
				})
				.execute();
		await sql`update entries set updated_at = ${new Date(`${date}T09:00:00`)}, created_at = ${new Date(`${date}T08:00:00`)}
			where translation_group = ${group}`.execute(monti.db);
		await sql`update entries set created_at = created_at + interval '1 minute' where translation_group = ${group} and locale <> 'ko'`.execute(
			monti.db,
		);
	}
	await sql`insert into entries (id, collection, translation_group, locale, slug, title, status, values, created_at, updated_at)
		select 'old-' || n, 'post', 'old-group-' || n, 'ko', 'old-post-' || n, '지난 글 ' || n, 'published', '{}',
			timestamp '2026-07-30 09:00' - n * interval '1 day', timestamp '2026-07-30 09:00' - n * interval '1 day'
		from generate_series(1, 138) n`.execute(monti.db);
	// The reference's folder (doc 07): "시리즈 원고", holding two posts.
	const series = (
		await run<{ output: { id: string } }>(monti, "folders.create", {
			scope: { collection: "post" },
			parentId: null,
			name: "시리즈 원고",
		})
	).output.id;
	await run(monti, "entries.moveToFolder", { ids: ["old-1", "old-2"], folder: series });
}

/** The same blog written in Korean only: no language column, no translations (doc 04, T52). */
export const oneLanguage = defineSchema({
	...schema,
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
});

const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });

/** Posts written in full and translated into English and Japanese; `changed` ones were changed and published again after (doc 04, flow 3 step 08). */
export const translatedPosts = [
	{ title: "서울의 밤", changed: true },
	{ title: "타입스크립트 5.9 정리", changed: false },
	{ title: "여름 휴가 메모", changed: true },
] as const;

/** Gives the `translatedPosts` posts a body and their translations through the operations, and changes and republishes the source of the `changed` ones. */
export async function translated({ monti, db }: StorySite) {
	const versionOf = async (id: string) =>
		(await db.selectFrom("entries").select("version").where("id", "=", id).executeTakeFirstOrThrow()).version;
	for (const { title, changed } of translatedPosts) {
		const { id } = await db
			.selectFrom("entries")
			.select("id")
			.where("title", "=", title)
			.where("locale", "=", "ko")
			.executeTakeFirstOrThrow();
		const doc = (second: string) => ({ type: "doc", blocks: [paragraph("b1", title), paragraph("b2", second)] });
		await run(monti, "entries.save", { id, version: await versionOf(id), doc: doc("처음 쓴 문단") });
		await run(monti, "entries.publish", { ids: [id] });
		for (const locale of ["en", "ja"]) await run(monti, "translations.create", { source: id, locale });
		if (!changed) continue;
		await run(monti, "entries.save", { id, version: await versionOf(id), doc: doc("고쳐 쓴 문단") });
		await run(monti, "entries.publish", { ids: [id] });
	}
}

export const site = (
	more?: (site: StorySite) => Promise<void>,
	hash = "#/c/post",
	options: { schema?: typeof schema } = {},
) => [
	async (): Promise<Loaded> => {
		startAt(hash);
		const chosen = options.schema ?? schema;
		const languages = chosen.locales.list.map((locale) => locale.code);
		const made = await storySite({
			schema: chosen,
			auth: { password: true },
			signedIn: true,
			setup: (monti) => setup(monti, languages),
		});
		await more?.(made);
		return { site: made, screen: createScreenChannel() };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/List",
	render: (_args, { loaded }) => {
		const { site: made, screen } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} siteName="example.dev" screen={screen} />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const rowsShown = (canvas: HTMLElement) =>
	waitFor(() => expect(within(canvas).getByText("발행 후 고친 글")).toBeTruthy(), wait);

/** Flow 1, step 01: the posts list as the reference draws it, newest change first, 25 of 148. */
export const Main: Story = {
	loaders: site(),
	play: ({ canvasElement }) => rowsShown(canvasElement),
};

/** A row right-clicked over its title: its menu opens at the cursor, the row keeps the hover ground (flow 5, step 07). */
export const MainRowMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		const title = within(canvasElement).getByText("리액트 서버 컴포넌트 다시 보기");
		const row = title.closest("tr") as HTMLElement;
		const box = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: box.left + 320,
				clientY: box.top + box.height / 2,
			}),
		);
		await waitFor(() => expect(within(document.body).getByRole("menu")).toBeTruthy(), wait);
	},
};

/** The memos with nothing in them: one line, and the ways to start under it (T40). */
export const Empty: Story = {
	loaders: site(undefined, "#/c/memo"),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByText("아직 메모가 없어요.")).toBeTruthy(), wait),
};

/** The status column's menu: each state with its count; picking one leaves the menu open and dots the name (flow 7, step 04). */
export const StatusMenu: Story = {
	loaders: site(undefined, "#/c/post?status=draft"),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(within(canvasElement).getByText("가을 사진 정리")).toBeTruthy(), wait);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "상태" }));
		await waitFor(
			() => expect(within(document.body).getByRole("menuitemcheckbox", { name: /수정 중/ })).toBeTruthy(),
			wait,
		);
	},
};

/** The title sorted A → Z from its menu: the menu closed, the name in ink with ↑ (flow 7, step 01b). */
export const TitleSorted: Story = {
	loaders: site(undefined, "#/c/post?sort=title"),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByText("CMS elements")).toBeTruthy(), wait),
};

/** Two rows picked: the bulk bar takes the head row's place (flow 7, step 10). */
export const Picked: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		const page = within(canvasElement);
		await userEvent.click(page.getByRole("checkbox", { name: "발행 후 고친 글 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "가을 사진 정리 고르기" }));
		await waitFor(() => expect(page.getByText("2개 선택")).toBeTruthy(), wait);
	},
};

/** The assistant picked two rows (`list.select`): blue until the admin touches the pick (flow 2, step 10). */
export const AiPicked: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		await rowsShown(canvasElement);
		const { site: made, screen } = loaded as Loaded;
		const ids = await made.db
			.selectFrom("entries")
			.select("id")
			.where("title", "in", ["리액트 서버 컴포넌트 다시 보기", "가을 사진 정리"])
			.where("locale", "=", "ko")
			.execute();
		screen.run("list.select", { ids: ids.map((row) => row.id) });
		await waitFor(() => expect(within(canvasElement).getByText("2개 선택")).toBeTruthy(), wait);
	},
};

/** The assistant showed a list (`list.show`): its filter is a blue chip; the rows are what a person gets with the same filter (06-3, flow 2 step 03). */
export const AiFiltered: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		await rowsShown(canvasElement);
		(loaded as Loaded).screen.run("list.show", { collection: "post", filters: [{ on: "empty", field: "summary" }] });
		await waitFor(() => expect(within(canvasElement).getByText("요약 비어 있음")).toBeTruthy(), wait);
	},
};

/** Filters that match nothing: not the empty collection, a line and the way back. */
export const NoMatch: Story = {
	loaders: site(undefined, "#/c/post?q=없는말"),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByText("맞는 글이 없어요.")).toBeTruthy(), wait),
};

/** Opens the list inside "시리즈 원고" (doc 07): its id is made with the site, so the address is set once it is known. */
const inSeries =
	(query = "", more?: (site: StorySite, folder: string) => Promise<void>) =>
	async (made: StorySite) => {
		const { id } = await made.db
			.selectFrom("folders")
			.select("id")
			.where("name", "=", "시리즈 원고")
			.executeTakeFirstOrThrow();
		await more?.(made, id);
		startAt(`#/c/post?folder=${id}${query}`);
	};

/** Right-clicks a row over its title, as a person does: its menu opens at the cursor. */
async function rightClick(canvas: HTMLElement, title: string) {
	const table = await within(canvas).findByRole("table", {}, wait);
	const row = (await within(table).findByRole("link", { name: title }, wait)).closest("tr") as HTMLElement;
	const box = row.getBoundingClientRect();
	row.dispatchEvent(
		new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
			clientX: box.left + 320,
			clientY: box.top + box.height / 2,
		}),
	);
	await waitFor(() => expect(body().getByRole("menu")).toBeTruthy(), wait);
}

/** "새 폴더" from the pill's menu: a folder row on top, its name picked to type over (flow 5, step 01). */
export const NewFolder: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "더 만들기" }));
		await userEvent.click(await body().findByRole("menuitem", { name: "새 폴더" }, wait));
		await waitFor(() => expect(within(canvasElement).getByRole("textbox", { name: "폴더 이름" })).toBeTruthy(), wait);
	},
};

/** Inside a folder: its name for the title, the way back above it, "상위 폴더로" first (flow 5, step 02). */
export const InFolder: Story = {
	loaders: site(inSeries()),
	play: ({ canvasElement }) => waitFor(() => expect(within(canvasElement).getByText("상위 폴더로")).toBeTruthy(), wait),
};

/** A search inside a folder: "찾는 곳 시리즈 원고 | 모든 폴더" over the rows (flow 5, step 03). */
export const InFolderSearch: Story = {
	loaders: site(inSeries("&q=지난 글")),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByRole("button", { name: "모든 폴더" })).toBeTruthy(), wait),
};

/** A folder row right-clicked: open, rename, move ▸, delete (flow 5, step 04). */
export const FolderMenu: Story = {
	loaders: site(),
	play: ({ canvasElement }) => rightClick(canvasElement, "시리즈 원고"),
};

/** Deleting a folder that holds a published post asks first (flow 5, step 05). */
export const FolderRemoveConfirm: Story = {
	loaders: site(async (made) => {
		const [first] = await made.db.selectFrom("entries").select("id").where("title", "=", "첫 번째 글").execute();
		const { id } = await made.db.selectFrom("folders").select("id").executeTakeFirstOrThrow();
		await run(made.monti, "entries.moveToFolder", { ids: [first?.id ?? ""], folder: id });
	}),
	play: async ({ canvasElement }) => {
		await rightClick(canvasElement, "시리즈 원고");
		await userEvent.click(await body().findByRole("menuitem", { name: "폴더 지우기" }, wait));
		await waitFor(() => expect(body().getByRole("alertdialog")).toBeTruthy(), wait);
	},
};

/** A post row's menu with "폴더로 ▸" open: the top level and the folders, its place ticked (flow 5, step 07). */
export const RowMenuToFolder: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rightClick(canvasElement, "리액트 서버 컴포넌트 다시 보기");
		await userEvent.click(body().getByRole("menuitem", { name: "폴더로" }));
		await waitFor(() => expect(body().getByRole("menuitem", { name: "맨 위" })).toBeTruthy(), wait);
	},
};

/** The categories, drawn by the same code: only the columns its schema gives differ (06-2). */
export const Categories: Story = {
	loaders: site(undefined, "#/c/category"),
	play: ({ canvasElement }) => waitFor(() => expect(within(canvasElement).getByText("일상")).toBeTruthy(), wait),
};

export const body = () => within(document.body);
/** Opens a column's menu by its name in the head row. */
export async function openColumn(canvas: HTMLElement, name: string) {
	await waitFor(() => expect(within(canvas).getByRole("button", { name })).toBeTruthy(), wait);
	await userEvent.click(within(canvas).getByRole("button", { name }));
	await waitFor(() => expect(body().getByRole("menu")).toBeTruthy(), wait);
}

/** The title's menu: A → Z, Z → A (flow 7, step 01). */
export const TitleMenu: Story = {
	loaders: site(),
	play: ({ canvasElement }) => openColumn(canvasElement, "제목"),
};

/** The + over the rows' ⋯: only the hidden columns (flow 7, step 02). */
export const AddColumn: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "열 추가" }));
		await waitFor(() => expect(body().getByRole("menuitem", { name: "요약" })).toBeTruthy(), wait);
	},
};

/** A column name held and dragged left: it follows the pointer and the others make room, rows too (flow 7, step 02b). */
export const ColumnMoving: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		const held = canvasElement.querySelector<HTMLElement>("th[data-column=tags]");
		const row = held?.parentElement;
		if (!held || !row) return;
		const box = held.getBoundingClientRect();
		let x = box.left + 20;
		const y = box.top + box.height / 2;
		held.dispatchEvent(
			new PointerEvent("pointerdown", { bubbles: true, button: 0, buttons: 1, clientX: x, clientY: y }),
		);
		for (let step = 0; step < 6; step++) {
			x -= 20;
			row.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, buttons: 1, clientX: x, clientY: y }));
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
	},
};

/** Drags a column's resize handle by `by` px; lets go unless `hold`. */
export async function dragHandle(canvas: HTMLElement, name: string, by: number, hold = false) {
	const handle = await within(canvas).findByRole("separator", { name }, wait);
	const box = handle.getBoundingClientRect();
	const y = box.top + box.height / 2;
	const at = (type: string, x: number) =>
		handle.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: 1, clientX: x, clientY: y }));
	at("pointerdown", box.left);
	for (let step = 1; step <= 4; step++) {
		at("pointermove", box.left + (by * step) / 4);
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	if (!hold) at("pointerup", box.left + by);
	return handle;
}
export const columnWidth = (canvas: HTMLElement, id: string) =>
	Math.round(canvas.querySelector(`th[data-column=${id}]`)?.getBoundingClientRect().width ?? 0);

const rightEdge = (canvas: HTMLElement, id: string) =>
	Math.round(canvas.querySelector(`th[data-column=${id}]`)?.getBoundingClientRect().right ?? 0);

/**
 * The edge between the title and the category held and dragged 80px left: the edge stays under the pointer with its accent line, the title is 80px
 * narrower and the category 80px wider, every other edge stays, rows too (06).
 */
export const ColumnResizing: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		const edge = rightEdge(canvasElement, "title");
		const after = rightEdge(canvasElement, "category");
		await dragHandle(canvasElement, "제목 열 너비 조절", -80, true);
		await waitFor(() => expect(rightEdge(canvasElement, "title")).toBe(edge - 80), wait);
		await expect(rightEdge(canvasElement, "category")).toBe(after);
	},
};

/** "25 per page ▾" under the table, opened upward: 25, 50, 100 (flow 7, step 02c). */
export const PageSize: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "쪽마다 개수" }));
		await waitFor(() => expect(body().getByRole("menuitemradio", { name: "100개씩" })).toBeTruthy(), wait);
	},
};

/** The search box open, its "search in" menu showing title·address and all (flow 7, step 03). */
export const SearchIn: Story = {
	loaders: site(undefined, "#/c/post?q=리액트"),
	play: async ({ canvasElement }) => {
		const target = { name: /찾을 곳/ };
		await waitFor(() => expect(within(canvasElement).getByRole("button", target)).toBeTruthy(), wait);
		await userEvent.click(within(canvasElement).getByRole("button", target));
		await waitFor(() => expect(body().getByRole("menu")).toBeTruthy(), wait);
	},
};

/** The tags' menu: a search row, "None", each tag with its count (flow 7, step 04b). */
export const TagMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "태그");
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /리액트/ })).toBeTruthy(), wait);
	},
};

/**
 * The language's menu with English picked, its languages named in the admin's language: the groups that have an English entry, and under "번역" how
 * many of them lack English, have an English translation behind its source, or are up to date (flow 7, step 04c).
 */
export const LanguageMenu: Story = {
	loaders: site(translated, "#/c/post?locale=en"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "언어");
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /원문 변경/ })).toBeTruthy(), wait);
	},
};

/** "원문 변경" picked in the language's menu: the groups with a translation behind its source, the language column dotted (flow 3, step 12). */
export const SourceChanged: Story = {
	loaders: site(translated, "#/c/post?translation=sourceChanged"),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(within(canvasElement).getByText("여름 휴가 메모")).toBeTruthy(), wait);
		await openColumn(canvasElement, "언어");
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /원문 변경/ })).toBeTruthy(), wait);
	},
};

/** A site written in one language: the list has no language column (doc 04, T52). */
export const OneLanguage: Story = {
	loaders: site(undefined, "#/c/post", { schema: oneLanguage }),
	play: ({ canvasElement }) => rowsShown(canvasElement),
};

/** The summary column turned on with + and filtered by "empty" (flow 7, step 04d). */
export const SummaryMenu: Story = {
	loaders: site(async (made) => {
		await made.monti.run(
			"list.savePrefs",
			{
				collection: "post",
				order: [
					"status",
					"title",
					"summary",
					"subtitle",
					"category",
					"tags",
					"locale",
					"updatedAt",
					"publishedAt",
					"createdAt",
				],
				hidden: ["subtitle", "publishedAt", "createdAt"],
			},
			admin,
		);
	}, "#/c/post?summary=empty"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "요약");
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /비어 있음/ })).toBeTruthy(), wait);
	},
};

/** Two filters at once: a dot on each filtered name, no chip row (flow 7, step 04e). */
export const SeveralFilters: Story = {
	loaders: site(undefined, "#/c/post?status=draft,changed&updatedAt=30d"),
	play: ({ canvasElement }) =>
		waitFor(() => expect(within(canvasElement).getByText("가을 사진 정리")).toBeTruthy(), wait),
};

/** The updated date's menu: newest or oldest first | all dates, today, 7 days, 30 days, pick a day, pick dates (flow 7, step 05). */
export const DateMenu: Story = {
	loaders: site(undefined, "#/c/post?updatedAt=7d"),
	play: ({ canvasElement }) => openColumn(canvasElement, "수정일"),
};

/** A day of the month the calendar opens on (this one): its button's name and its date in the address. */
const thisMonth = (day: number) => {
	const now = new Date();
	const month = now.getMonth() + 1;
	return {
		name: new RegExp(`${month}월 ${day}일`),
		iso: `${now.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
	};
};

/** "하루 고르기": one press on a day filters to that day; the calendar marks it and stays open (flow 7, step 05b). */
export const DatePickDay: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "하루 고르기" }));
		const day = thisMonth(3);
		await userEvent.click(await body().findByRole("button", { name: day.name }, wait));
		await waitFor(() => expect(window.location.hash).toContain(`updatedAt=${day.iso}..${day.iso}`), wait);
		await body().findByRole("button", { name: new RegExp(`${day.name.source}.*선택됨`) }, wait);
	},
};

/** "기간 고르기": the first press starts the range, the second ends it and filters (flow 7, step 05b). */
export const DatePickRange: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "기간 고르기" }));
		const [from, to] = [thisMonth(2), thisMonth(5)];
		await userEvent.click(await body().findByRole("button", { name: from.name }, wait));
		await expect(window.location.hash).not.toContain("updatedAt");
		await userEvent.click(body().getByRole("button", { name: to.name }));
		await waitFor(() => expect(window.location.hash).toContain(`updatedAt=${from.iso}..${to.iso}`), wait);
	},
};

/** A right click on one of two picked rows: the bulk bar's actions by the same names (flow 5, step 08). */
export const RowsMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await rowsShown(canvasElement);
		const page = within(canvasElement);
		await userEvent.click(page.getByRole("checkbox", { name: "리액트 서버 컴포넌트 다시 보기 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "가을 사진 정리 고르기" }));
		const row = page.getByText("가을 사진 정리").closest("tr") as HTMLElement;
		const box = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: box.left + 320,
				clientY: box.top + box.height / 2,
			}),
		);
		await waitFor(() => expect(body().getByText("2개 항목")).toBeTruthy(), wait);
	},
};
