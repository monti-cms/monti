import { defineSchema, type TrashRef } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sql } from "kysely";
import { userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { addFile } from "../media/media.stories";
import { schema as storySchema } from "../story-schema";

type Loaded = { site: StorySite };
type Monti = StorySite["monti"];
export const wait = { timeout: 15000 };

/** The stories' blog with tags, which posts point at (doc 08): a thrown-away tag shows who pointed at it. */
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
			path: "/tag/:slug",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

const admin = { actor: "admin" } as const;
const run = <Output = { output: { id: string } }>(monti: Monti, name: string, input: unknown) =>
	monti.run(name, input, admin) as Promise<Output>;
const entry = (id: string): TrashRef => ({ kind: "entry", id });
/** A post's relation to these tags, by their groups. */
const tagged = (...groups: string[]) => Object.fromEntries([["tags", groups]]);

export type TrashIds = Awaited<ReturnType<typeof fillTrash>>;

/** What the admin calls the collections and the posts' fields. */
async function nameCollections(monti: Monti) {
	const fields = {
		title: { label: "제목" },
		slug: { label: "주소" },
		summary: { label: "요약" },
		subtitle: { label: "부제" },
		cover: { label: "대표 이미지" },
		category: { label: "카테고리" },
		tags: { label: "태그" },
	};
	for (const [collection, values] of [
		["post", { label: "게시글", folders: true, fields }],
		["memo", { label: "메모" }],
		["category", { label: "카테고리" }],
		["tag", { label: "태그" }],
	] as const)
		await run(monti, "collections.updateAdminValues", { collection, values });
}

/**
 * The reference trash (`Screens/Reference/Lists` › Trash): a post with its translation, a folder of posts, a folder of files, a file, a post published once, a
 * post whose translation was thrown away before it (one row all the same), a memo, and a tag that posts point at, each thrown away on its own day. Outside it stay a published post, and a
 * tag that published posts use.
 */
export async function fillTrash(site: StorySite) {
	const { monti, db } = site;
	const create = async (collection: string, title: string, slug: string, values?: Record<string, unknown>) =>
		(await run(monti, "entries.create", { collection, locale: "ko", title, slug, values })).output.id;
	const tag = async (title: string, slug: string) =>
		(
			await run<{ output: { group: string; locales: Record<string, { id: string }> } }>(monti, "items.saveGroup", {
				collection: "tag",
				locales: { ko: { title, slug } },
			})
		).output;
	const folder = async (scope: unknown, name: string, parentId: string | null = null) =>
		(await run(monti, "folders.create", { scope, parentId, name })).output.id;
	const move = (...rows: TrashRef[]) => run(monti, "trash.move", { rows });
	/** Sets when rows went to the trash: `days` ago, so each has its own days left. */
	const ago = async (table: "entries" | "folders" | "media", ids: string[], days: number) => {
		await sql`update ${sql.table(table)} set trashed_at = now() - make_interval(days => ${days}::int)
			where trashed_at is not null and (id in (${sql.join(ids)})
				${
					table === "entries"
						? sql`or translation_group in (select translation_group from entries where id in (${sql.join(ids)}))`
						: sql``
				})`.execute(db);
	};

	// What stays: a tag in use, and the posts that use the tags.
	const temp = await tag("임시", "temp");
	const react = await tag("리액트", "react");
	const pointing: string[] = [];
	for (const [title, slug] of [
		["여름 여행기", "summer-trip"],
		["겨울 기록", "winter-notes"],
		["봄 산책", "spring-walk"],
	]) {
		const id = await create("post", title, slug, tagged(temp.group, react.group));
		await run(monti, "entries.publish", { ids: [id] });
		pointing.push(id);
	}

	const first = await create("post", "첫 번째 글", "first-post");
	await run(monti, "translations.create", { source: first, locale: "en" });
	await run(monti, "entries.publish", { ids: [first] });

	const series = await folder({ collection: "post" }, "시리즈 원고");
	const inSeries = [
		await create("post", "시리즈 1: 시작", "series-1"),
		await create("post", "시리즈 2: 리액트로 옮기기", "series-2"),
	];
	await run(monti, "entries.moveToFolder", { ids: inSeries, folder: series });

	const assets = await folder("media", "Blog Assets");
	const diagrams = await folder("media", "diagrams", assets);
	const files = { monti, storage: site.storage };
	for (const name of ["flow-01.jpg", "flow-02.jpg", "flow-03.jpg"])
		await addFile(files, { name, from: "#c9d3dd", to: "#7f8fa1", width: 1200, height: 800, folderId: diagrams });
	const winter = await addFile(files, {
		name: "winter-01.jpg",
		from: "#dfe6ec",
		to: "#8ea0b3",
		width: 2400,
		height: 1600,
		folderId: assets,
	});

	const about = await create("post", "옛 소개 글", "about-old", tagged(temp.group));
	await run(monti, "entries.publish", { ids: [about] });

	const react19 = await create("post", "리액트 19 마이그레이션", "react-19");
	const react19En = (await run(monti, "translations.create", { source: react19, locale: "en" })).output.id;
	const version = await db
		.selectFrom("entries")
		.select("version")
		.where("id", "=", react19En)
		.executeTakeFirstOrThrow();
	await run(monti, "entries.save", { id: react19En, version: version.version, title: "React 19 migration" });

	const scratch = await create("memo", "연습장", "scratch");

	// Thrown away, oldest first: the list shows the newest at the top.
	await move(entry(temp.locales.ko.id));
	await ago("entries", [temp.locales.ko.id], 27);
	await move(entry(react19En), entry(scratch));
	await ago("entries", [react19En, scratch], 15);
	await move(entry(react19));
	await ago("entries", [react19], 13);
	await move(entry(about));
	await ago("entries", [about], 7);
	await move({ kind: "media", id: winter });
	await ago("media", [winter], 2);
	await move({ kind: "folder", id: diagrams });
	await ago("folders", [diagrams], 1);
	await db
		.updateTable("media")
		.set({ trashed_at: sql`now() - interval '1 day'` })
		.where("folder_id", "=", diagrams)
		.execute();
	await move({ kind: "folder", id: series });
	await move(entry(first));
	return { first, series, inSeries, diagrams, winter, about, react19, react19En, scratch, temp, react, pointing };
}

/** Starts at an address with the trash filled, signed in. `hash` may be made from what was put in (an entry's own address). */
export const trash = (
	hash: string | ((ids: TrashIds) => string) = "#/trash",
	{ also, empty = false }: { also?: (site: StorySite, ids: TrashIds) => Promise<void>; empty?: boolean } = {},
) => [
	async (): Promise<Loaded> => {
		startAt(typeof hash === "string" ? hash : "#/trash");
		const made = await storySite({ schema, auth: { password: true }, signedIn: true });
		await nameCollections(made.monti);
		if (!empty) {
			const ids = await fillTrash(made);
			await also?.(made, ids);
			if (typeof hash !== "string") startAt(hash(ids));
		}
		return { site: made };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Trash",
	render: (_args, { loaded }) => {
		const { site } = loaded as Loaded;
		return <MontiAdmin transport={site.transport} uploader={site.uploader} siteName="example.dev" />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const rowOf = async (canvas: HTMLElement, title: string) => {
	const row = (await within(canvas).findByText(title, {}, wait)).closest("tr");
	if (!row) throw new Error(`No row "${title}".`);
	return row;
};
const openRowMenu = async (canvas: HTMLElement, title: string) => {
	const row = await rowOf(canvas, title);
	await userEvent.hover(row);
	await userEvent.click(within(row).getByRole("button", { name: "행 메뉴" }));
};

/** Flow 5·11: the trash, newest first. A thrown-away folder is one row; each row says how long it stays, in the warning tone under a week. */
export const Top: Story = { loaders: trash() };

/** Flow 5·11: the kind column's menu filters by kind, each with its count; several can be on. */
export const KindMenu: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "종류" }, wait));
	},
};

/** Flow 5·17: only media, a dot on the kind column. */
export const OnlyMedia: Story = { loaders: trash("#/trash?kind=media") };

/** Flow 5·12: inside a thrown-away folder, with the way back above its name and the folder's own actions in the head. */
export const InFolder: Story = { loaders: trash((ids) => `#/trash?folder=${ids.series}`) };

/** Flow 5·12: the folder's own ⋯ holds what cannot be undone. */
export const FolderMenu: Story = {
	loaders: trash((ids) => `#/trash?folder=${ids.series}`),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "더 보기" }, wait));
	},
};

/** Flow 5·14: inside a folder the chip in the search box says where it looks: that folder, or every folder. */
export const SearchingInFolder: Story = {
	loaders: trash((ids) => `#/trash?folder=${ids.series}&q=${encodeURIComponent("리액트")}`),
};

/** A search or a filter that finds nothing says so, with the way out. */
export const NoMatch: Story = { loaders: trash(`#/trash?q=${encodeURIComponent("없는 말")}`) };

/** Flow 5·14: a search looks inside thrown-away folders and says which folder a row sits in. */
export const Searching: Story = { loaders: trash(`#/trash?q=${encodeURIComponent("리액트")}`) };

/** A row's ⋯: restore, and delete for good (2026-11-11, owner: every action of a row is in its ⋯). */
export const RowMenu: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => openRowMenu(canvasElement, "옛 소개 글"),
};

/** Flow 5·16: a right click opens the same rows, with the key that deletes; on picked rows it starts with how many they are and has no icons. */
export const PickedRightClick: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("checkbox", { name: "옛 소개 글 고르기" }, wait));
		await userEvent.click(page.getByRole("checkbox", { name: "연습장 고르기" }));
		// The menu opens where the pointer is: over the row, as a person would press.
		const row = await rowOf(canvasElement, "연습장");
		const box = row.getBoundingClientRect();
		row.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: box.left + 320,
				clientY: box.top + box.height / 2,
			}),
		);
		await body().findByText("2개 항목", {}, wait);
	},
};

/** Flow 5·25: picked rows, with what can be done to them in the bar. */
export const Picked: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("checkbox", { name: "옛 소개 글 고르기" }, wait));
		await userEvent.click(page.getByRole("checkbox", { name: "연습장 고르기" }));
	},
};

/** Flow 5·19: an item open beside the list, to read: its name and address, and the entries that point at it. */
export const ItemPanel: Story = { loaders: trash((ids) => `#/trash?open=entry:${ids.temp.locales.ko.id}`) };

/** Flow 5·20: a file open beside the list, as the library's panel shows it, to read. */
export const FilePanel: Story = { loaders: trash((ids) => `#/trash?open=media:${ids.winter}`) };

/** Flow 5·23: deleting for good asks every time, and says which address stays taken. */
export const PurgeConfirm: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "옛 소개 글");
		await userEvent.click(await body().findByRole("menuitem", { name: "영구 삭제" }, wait));
	},
};

/** Flow 5·26: emptying the trash asks, with how many go. */
export const EmptyConfirm: Story = {
	loaders: trash(),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "비우기" }, wait));
	},
};

/** Flow 5·28: nothing in the trash. */
export const Empty: Story = { loaders: trash("#/trash", { empty: true }) };

/** Flow 5·15: what the assistant threw away has its ✦ before the days. */
export const ByAssistant: Story = {
	loaders: trash("#/trash", {
		also: async ({ monti }, ids) => {
			const [post] = ids.pointing;
			const proposal = await monti.proposals.create("c-tidy", "지난 여행 글을 정리해 줘");
			await monti.proposals.add(proposal, "trash.move", { rows: [entry(post ?? "")] });
			await monti.proposals.apply(proposal);
		},
	}),
};

/** Flow 5·18: an entry in the trash, opened: read only, with how long it stays, "Restore" as its one pill and "Delete for good" in its ⋯. */
export const TrashedEntry: Story = {
	loaders: trash((ids) => `#/c/post/${ids.about}`),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "더 보기" }, wait));
	},
};

/** Flow 5·10: a published entry asks before it goes, saying what leaves the site and which translation goes with it. */
export const AskPublished: Story = {
	loaders: trash("#/c/post", {
		also: async ({ monti }, ids) => {
			const [post] = ids.pointing;
			await monti.run("translations.create", { source: post, locale: "en" }, admin);
		},
	}),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "여름 여행기");
		await userEvent.click(await body().findByRole("menuitem", { name: /휴지통으로/ }, wait));
	},
};

/** An item that published entries point at asks before it goes: the site loses it there (2026-11-11, owner). */
export const AskPointedAt: Story = {
	loaders: trash("#/c/tag"),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "리액트");
		await userEvent.click(await body().findByRole("menuitem", { name: /휴지통으로/ }, wait));
	},
};
