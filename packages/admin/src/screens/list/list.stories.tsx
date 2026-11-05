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
const wait = { timeout: 15000 };

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

const run = <Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;

async function create(monti: Monti, collection: string, title: string, slug: string) {
	return (await run(monti, "entries.create", { collection, locale: "ko", title, slug })).output.id;
}

/**
 * The reference list's data, through operations where they exist. Relation values (doc 08), translations (doc 04) and dates in the past have no
 * operation yet, so they are written as those docs will store them; the older 138 posts fill the pages to 148 as the reference counts.
 */
async function setup(monti: Monti) {
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
		for (const locale of locales)
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
}

const site = (more?: (site: StorySite) => Promise<void>, hash = "#/c/post") => [
	async (): Promise<Loaded> => {
		startAt(hash);
		const made = await storySite({ schema, auth: { password: true }, signedIn: true, setup });
		await more?.(made);
		return { site: made, screen: createScreenChannel() };
	},
];

const meta = {
	tags: ["visual"],
	title: "Screens/List",
	render: (_args, { loaded }) => {
		const { site: made, screen } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} siteName="example.dev" screen={screen} />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const rowsShown = (canvas: HTMLElement) =>
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

/** The categories, drawn by the same code: only the columns its schema gives differ (06-2). */
export const Categories: Story = {
	loaders: site(undefined, "#/c/category"),
	play: ({ canvasElement }) => waitFor(() => expect(within(canvasElement).getByText("일상")).toBeTruthy(), wait),
};

const body = () => within(document.body);
/** Opens a column's menu by its name in the head row. */
async function openColumn(canvas: HTMLElement, name: string) {
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

/** The language's menu with English picked, its languages named in the admin's language: the groups that have an English entry (flow 7, step 04c; its translation group is T52). */
export const LanguageMenu: Story = {
	loaders: site(undefined, "#/c/post?locale=en"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "언어");
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /영어/ })).toBeTruthy(), wait);
	},
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

/** "Pick dates" opens a calendar beside the menu (flow 7, step 05b). */
export const DatePick: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "기간 고르기" }));
		await waitFor(() => expect(body().getByRole("grid")).toBeTruthy(), wait);
	},
};

/** A range picked: the calendar shows it and stays open, the name has its dot (flow 7, step 05c). */
export const DateRange: Story = {
	loaders: site(undefined, "#/c/post?updatedAt=2026-10-05..2026-10-26"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "기간 고르기" }));
		await waitFor(() => expect(body().getByRole("grid")).toBeTruthy(), wait);
	},
};

/** One day: "pick a day" opens a one-day calendar; one press filters to that day and the calendar shows it ("all dates" lifts it, 2026-11-06). */
export const DateOneDay: Story = {
	loaders: site(undefined, "#/c/post?updatedAt=2026-10-26..2026-10-26"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "하루 고르기" }));
		await waitFor(() => expect(body().getByRole("button", { name: /10월 26일.*선택됨/ })).toBeTruthy(), wait);
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

/** The session ended while the list was open: the next read comes back without one, and the banner stands at the top of the page (doc 15). */
export const SessionEnded: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const { site: made } = loaded as Loaded;
		const page = within(canvasElement);
		await page.findByText("발행 후 고친 글", {}, { timeout: 15000 });
		await made.db.deleteFrom("monti_session").execute();
		await userEvent.click(page.getByRole("button", { name: "메모" }));
		await page.findByText("로그인이 풀렸어요", {}, { timeout: 15000 });
		await expect(page.getByRole("button", { name: "다시 로그인" })).toBeVisible();
	},
};
