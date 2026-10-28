import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, PageFrame } from "../stories/screen-frame";
import { EntryListScreen, TrashScreen } from "./entry-list-screen";

const meta = { title: "Screens/Entry list", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const serverError = () => answer(500, { error: { code: "internal", message: "서버에서 처리하지 못했어요." } });

const entry = (id: string, fields: Partial<ListEntriesItem> = {}): ListEntriesItem => ({
	id,
	collection: "post",
	locale: "ko",
	translationGroupId: id,
	title: id,
	slug: id,
	status: "draft",
	version: 3,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: null,
	createdAt: new Date("2026-09-01T00:00:00Z"),
	updatedAt: new Date("2026-10-01T00:00:00Z"),
	trashedAt: null,
	...fields,
});

const tags = (...names: string[]) => ({ tagIds: names.map((title) => ({ id: `tag-${title}`, title })) });
const posts = [
	entry("첫 번째 글", {
		slug: "first-post",
		status: "published",
		publishedAt: new Date("2026-09-10T00:00:00Z"),
		relations: tags("리액트", "프론트엔드"),
	}),
	entry("발행 후 고친 글", {
		slug: "edited-post",
		status: "published",
		hasUnpublishedChanges: true,
		relations: tags("리액트"),
	}),
	entry("쓰는 중인 글", { slug: "draft-post", relations: tags("메모", "일상", "회고") }),
	entry("지난해 공지", { slug: "old-notice", status: "archived" }),
];
const folder = (
	id: string,
	name: string,
	position: number,
	parentId: string | null = null,
	entryCount?: number,
): Folder & { entryCount?: number } => ({
	id,
	collection: "post",
	parentId,
	name,
	position,
	version: 1,
	entryCount,
});
const folders = [
	folder("f-news", "뉴스", 0, null, 12),
	folder("f-notes", "노트", 1, null, 2),
	folder("f-weekly", "주간 정리", 0, "f-news", 5),
];
const trashed = [
	entry("버린 글", { status: "trashed", trashedAt: new Date("2026-10-15T00:00:00Z") }),
	entry("오래된 초안", { status: "trashed", trashedAt: new Date("2026-10-10T00:00:00Z") }),
];

type ListOptions = {
	items?: ListEntriesItem[];
	/** The total the list API answers with, when the page shown is only part of it. */
	total?: number;
	folders?: Folder[];
	trashed?: ListEntriesItem[];
	/** Answers for the list request itself (loading, failure). */
	list?: (url: URL) => unknown;
	/** Anything else: runs first, `undefined` falls through to the defaults. */
	extra?: FakeApi;
};

/** The admin API of the list screens: entries (list and trash), folders and saved list settings. */
const server =
	({ items = posts, total, folders: folderList = [], trashed: trash = [], list, extra }: ListOptions = {}): FakeApi =>
	(path, method) => {
		const extraAnswer = extra?.(path, method);
		if (extraAnswer !== undefined) return extraAnswer;
		const url = new URL(path, "http://admin");
		if (url.pathname === "/api/monti/v1/preferences") return {};
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return folderList;
		if (url.pathname === "/api/monti/v1/entries/counts")
			return countsOf(url.searchParams.get("field") ?? url.searchParams.get("facet") ?? "");
		if (url.pathname === "/api/monti/v1/entries/search") {
			const ids = url.searchParams.getAll("id");
			const found = filterTags.filter((tag) => ids.length === 0 || ids.includes(tag.id));
			return { items: found.map(({ id, title }) => ({ id, title, slug: id, status: "published" })) };
		}
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const collection = url.searchParams.get("collection");
			const inTrash = url.searchParams.getAll("status").includes("trashed");
			// The sidebar's trash badge asks for trashed rows of the same collection; only the list itself goes through `list`.
			if (list && !inTrash && collection === "post") return list(url);
			// The tags the bulk bar adds or takes away: every tag a row holds, and the ones the filter menu lists.
			if (collection === "tag" && !inTrash) return { items: tagEntries, total: tagEntries.length };
			const rows = collection !== "post" ? [] : inTrash ? trash : items;
			return { items: rows, total: inTrash || collection !== "post" ? rows.length : (total ?? rows.length) };
		}
		return undefined;
	};

/** The tags the filter menu lists, and the numbers beside every value of the filters. */
const filterTags = [
	{ id: "tag-react", title: "리액트", count: 38 },
	{ id: "tag-typescript", title: "타입스크립트", count: 21 },
	{ id: "tag-next", title: "넥스트", count: 17 },
	{ id: "tag-retro", title: "회고", count: 9 },
	{ id: "tag-perf", title: "성능", count: 8 },
	{ id: "tag-tools", title: "도구", count: 6 },
	{ id: "tag-design", title: "디자인", count: 4 },
];

const tagEntries = [
	...new Map(
		[...posts.flatMap((post) => post.relations.tagIds ?? []), ...filterTags].map(({ id, title }) => [
			id,
			entry(title ?? id, { id, title, slug: id, status: "published" }),
		]),
	).values(),
];
const countsOf = (facet: string) =>
	facet === "tagIds"
		? { total: 148, empty: 12, values: Object.fromEntries(filterTags.map((tag) => [tag.id, tag.count])) }
		: facet === "translation"
			? { total: 148, values: { none: 41, changed: 3, current: 104 } }
			: facet === "status"
				? { total: 148, values: { published: 101, editing: 3, draft: 41, archived: 3 } }
				: { total: 148, empty: 20, filled: 128, values: {} };

const listScreen =
	(api: FakeApi, search = "collection=post") =>
	() => (
		<PageFrame api={api} pathname="/admin" search={search}>
			<EntryListScreen />
		</PageFrame>
	);

/** The list reloads once when the saved settings arrive, and that clears a selection made before. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 800));

/** Opens a row's menu the way a right click does, at the row. */
const openRowMenu = async (canvasElement: HTMLElement, title: string) => {
	const row = await within(canvasElement).findByRole("row", { name: new RegExp(title) });
	const box = row.getBoundingClientRect();
	fireEvent.contextMenu(row, { clientX: box.left + 200, clientY: box.top + box.height / 2 });
	await within(document.body).findAllByRole("menuitem");
};
const body = () => within(document.body);

/** Ticks the rows' checkboxes one after the other, waiting for the bulk bar to count each (the table re-renders on the first). */
const selectRows = async (canvasElement: HTMLElement, ...titles: string[]) => {
	const c = within(canvasElement);
	await c.findByRole("checkbox", { name: `${titles[0]} 선택` });
	await settle();
	for (const [index, title] of titles.entries()) {
		await userEvent.click(await c.findByRole("checkbox", { name: `${title} 선택` }));
		await c.findByText(`${index + 1}개 선택`);
	}
};

/** The stories that show the list screen itself are shot by the visual checks. */
const visual = { tags: ["visual"] };

export const Loaded: Story = { ...visual, render: listScreen(server({ trashed, total: 148 })) };

export const WithFolders: Story = {
	...visual,
	render: listScreen(server({ folders, trashed, total: 148 })),
};

export const Empty: Story = {
	...visual,
	render: listScreen(server({ items: [] })),
};

export const NoSearchResults: Story = {
	...visual,
	render: listScreen(server({ items: [] }), "collection=post&search=없는 검색어"),
};

export const Loading: Story = {
	...visual,
	render: listScreen(server({ list: () => "pending" })),
};

export const LoadFailed: Story = {
	...visual,
	render: listScreen(server({ list: () => serverError() })),
};

export const RowsSelected: Story = {
	...visual,
	render: listScreen(server({ folders })),
	play: ({ canvasElement }) => selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글"),
};

export const RowMenuOpen: Story = {
	...visual,
	render: listScreen(server({ folders })),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "첫 번째 글");
	},
};

/** Presses the name of a column in the head row, which opens its menu under it. */
const openColumn = async (canvasElement: HTMLElement, name: string) => {
	const head = within((await within(canvasElement).findAllByRole("rowgroup"))[0] as HTMLElement);
	await userEvent.click(await head.findByRole("button", { name }));
	await body().findByRole("menu");
};

/** Every state of the status column is one of four values, ticked in the status menu, which stays open for the next. */
export const StatusMenuOpen: Story = {
	...visual,
	render: listScreen(server({ total: 3 }), "collection=post&status=editing"),
	play: ({ canvasElement }) => openColumn(canvasElement, "상태"),
};

/** The chips row holds still while a column menu is open: ticking a value does not push the head and the menu down, so the next tick lands on its row. */
export const StatusMenuHoldsStill: Story = {
	render: listScreen(server({ total: 148 })),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "상태");
		const top = () => body().getByRole("menu").getBoundingClientRect().top;
		// The card's open animation moves it a little; measure once it has settled.
		await new Promise((resolve) => setTimeout(resolve, 400));
		const before = top();
		await userEvent.click(await body().findByRole("menuitemcheckbox", { name: /^초안/ }));
		await waitFor(() => expect(body().getByRole("menuitemcheckbox", { name: /^초안/ })).toBeChecked());
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect(top()).toBe(before);
		await expect(canvasElement.querySelector("[data-slot=chip-row]")).toBeNull();
		await userEvent.click(body().getByRole("menuitemcheckbox", { name: /^수정 중/ }));
		await expect(body().getByRole("menuitemcheckbox", { name: /^초안/ })).toBeChecked();
		await expect(body().getByRole("menuitemcheckbox", { name: /^수정 중/ })).toBeChecked();
		await expect(body().getByRole("menuitemcheckbox", { name: /^발행됨/ })).not.toBeChecked();
		await userEvent.keyboard("{Escape}");
		await waitFor(() => expect(canvasElement.querySelector("[data-slot=chip-row]")).not.toBeNull());
	},
};

/** A relation's menu: a search row, "none", a rule, then the items with how many rows each has. */
export const TagMenuOpen: Story = {
	...visual,
	render: listScreen(server({ total: 148 })),
	play: ({ canvasElement }) => openColumn(canvasElement, "태그"),
};

/** The languages, a rule, and the translation state under its own name. */
export const LanguageMenuOpen: Story = {
	...visual,
	render: listScreen(server({ total: 3 }), "collection=post&translation=changed"),
	play: ({ canvasElement }) => openColumn(canvasElement, "언어"),
};

export const TitleMenuOpen: Story = {
	...visual,
	render: listScreen(server({ total: 148 })),
	play: ({ canvasElement }) => openColumn(canvasElement, "제목"),
};

/** The sorted column's name is in ink with its arrow; the menu is closed. */
export const TitleSorted: Story = {
	...visual,
	render: listScreen(server({ total: 148 }), "collection=post&sortField=title&sortDirection=asc"),
};

/** The date menu: sort, then today, the last 7 and 30 days and a period, one at a time with the ✓. */
export const UpdatedMenuOpen: Story = {
	...visual,
	render: listScreen(server({ total: 148 })),
	play: ({ canvasElement }) => openColumn(canvasElement, "수정일"),
};

/** Opens the updated date's menu and, from its "pick a period" row, the calendar beside it; the menu stays open behind it. */
const openCalendar = async (canvasElement: HTMLElement) => {
	await openColumn(canvasElement, "수정일");
	fireEvent.keyDown(await body().findByRole("menuitem", { name: "기간 고르기" }), { key: "ArrowRight" });
	await body().findByRole("grid");
};

/** "Pick a period": the first day clicked starts it, the second sets it and the calendar stays open showing it. */
export const UpdatedRangeOpen: Story = {
	...visual,
	render: listScreen(server({ total: 148 })),
	play: ({ canvasElement }) => openCalendar(canvasElement),
};

/** A period that is on: the calendar shows its two days filled and the days between banded, and the chip says it. */
export const UpdatedRangePicked: Story = {
	...visual,
	render: listScreen(server({ total: 148 }), "collection=post&updated=2026-10-05..2026-10-16"),
	play: ({ canvasElement }) => openCalendar(canvasElement),
};

/** The second day sets the period: the chip appears, and the calendar stays open showing it (a press outside or Escape closes it). */
export const UpdatedRangeSet: Story = {
	render: listScreen(server({ total: 148 })),
	play: async ({ canvasElement }) => {
		await openCalendar(canvasElement);
		const day = (n: string) => within(body().getByRole("grid")).getByRole("button", { name: new RegExp(`${n}일`) });
		await userEvent.click(day("10"));
		await userEvent.click(day("20"));
		await within(canvasElement).findByRole("button", { name: /수정한 날: \d\d\. 10 – \d\d\. 20 지우기/ });
		await expect(body().getByRole("grid")).toBeVisible();
		await expect(body().getAllByRole("menu").length).toBeGreaterThanOrEqual(2);
	},
};

/** The period as a chip alone, the menus closed. */
export const UpdatedRangeChip: Story = {
	...visual,
	render: listScreen(server({ total: 148 }), "collection=post&updated=2026-10-05..2026-10-16"),
};

/** The + at the end of the head row lists only the columns that are off, as plain rows. */
export const ColumnAddOpen: Story = {
	...visual,
	render: listScreen(server({ folders, total: 148 })),
	play: async ({ canvasElement }) => {
		const head = within((await within(canvasElement).findAllByRole("rowgroup"))[0] as HTMLElement);
		await userEvent.click(await head.findByRole("button", { name: "열 추가" }));
		await body().findByRole("menu");
	},
};

/** The filters that are on are chips under the title, each with its ×, and the columns they filter have a dot after the name. */
export const Filtered: Story = {
	...visual,
	render: listScreen(
		server({ total: 12 }),
		"collection=post&status=published&status=editing&field=tagIds:empty&updated=last30&translation=none",
	),
};

/** The footer holds the range, the page size beside it (its menu opens upward) and the pager. */
export const PageSizeOpen: Story = {
	...visual,
	render: listScreen(server({ total: 148 })),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "페이지당 행 수" }));
		await body().findByRole("menu");
	},
};

/** The bulk bar's ⋯ has the rest of the actions, the trash last in red. */
export const BulkMoreOpen: Story = {
	...visual,
	render: listScreen(server({ folders })),
	play: async ({ canvasElement }) => {
		await selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "더보기" }));
		await body().findAllByRole("menuitem");
	},
};

/** "Take a tag away" offers only the tags the picked rows hold. */
export const BulkTagRemoveOpen: Story = {
	...visual,
	render: listScreen(server({ folders })),
	play: async ({ canvasElement }) => {
		await selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "더보기" }));
		await userEvent.click(await body().findByRole("menuitem", { name: "태그 빼기" }));
		await body().findByRole("menuitem", { name: "회고" });
	},
};

export const BulkFolderMenuOpen: Story = {
	...visual,
	render: listScreen(server({ folders })),
	play: async ({ canvasElement }) => {
		await selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글");
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "폴더로" }));
		await body().findAllByRole("menuitem");
	},
};

/** The pager on a later page: first and last, the current page with its neighbours, gaps between. */
export const PagerOnPageFour: Story = {
	...visual,
	render: listScreen(server({ total: 148 }), "collection=post&page=4"),
};

/** The row menu's "Move to trash" asks first. */
export const DeleteDialog: Story = {
	render: listScreen(server()),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "쓰는 중인 글");
		await userEvent.click(await body().findByRole("menuitem", { name: /휴지통/ }));
		await body().findByRole("alertdialog");
	},
};

export const BulkActionFailed: Story = {
	render: listScreen(
		server({
			extra: (path, method) => (path.startsWith("/api/monti/v1/bulk") && method === "POST" ? serverError() : undefined),
		}),
	),
	play: async ({ canvasElement }) => {
		await selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글");
		// The Delete key asks to move every selected row to the trash.
		fireEvent.keyDown(await within(canvasElement).findByRole("checkbox", { name: "쓰는 중인 글 선택" }), {
			key: "Delete",
		});
		const dialog = await body().findByRole("alertdialog");
		await userEvent.click(within(dialog).getAllByRole("button").at(-1) as HTMLElement);
	},
};

// Item collections (category, tag, series) edit in a panel beside the list.
const tagItems = [
	entry("tag-react", { collection: "tag", title: "리액트", slug: "react", status: "published" }),
	entry("tag-frontend", { collection: "tag", title: "프론트엔드", slug: "frontend", status: "published" }),
	entry("tag-retrospective", { collection: "tag", title: "회고", slug: "retrospective", status: "published" }),
];
const tagRecord = (id: string, title: string) => ({
	id,
	collection: "tag",
	status: "published",
	version: 1,
	folderId: null,
	workingSlug: id,
	publishedSlug: id,
	working: { metadata: { title }, mdx: "" },
});
const tagServer = (save?: FakeApi) =>
	server({
		extra: (path, method) => {
			const saved = save?.(path, method);
			if (saved !== undefined) return saved;
			const url = new URL(path, "http://admin");
			if (url.pathname === "/api/monti/v1/entries" && url.searchParams.get("collection") === "tag" && method === "GET")
				return { items: tagItems, total: tagItems.length };
			const found = tagItems.find((item) => url.pathname === `/api/monti/v1/entries/${item.id}`);
			return found && method === "GET" ? tagRecord(found.id, found.title ?? "") : undefined;
		},
	});
const tagScreen = (api: FakeApi) => () => (
	<PageFrame api={api} pathname="/admin" search="collection=tag">
		<EntryListScreen />
	</PageFrame>
);
const openTag = async (canvasElement: HTMLElement) => {
	await userEvent.click(await within(canvasElement).findByRole("button", { name: "리액트" }));
	const name = (await within(canvasElement).findByRole("textbox", { name: /이름/ })) as HTMLInputElement;
	// The form fills once the item has loaded; typing earlier would be overwritten.
	await waitFor(() => expect(name).toHaveValue("리액트"));
	return name;
};

export const ItemCollection: Story = { render: tagScreen(tagServer()) };

export const RecordPanelOpen: Story = {
	tags: ["visual"],
	render: tagScreen(tagServer()),
	play: async ({ canvasElement }) => {
		await openTag(canvasElement);
	},
};

export const RecordPanelNew: Story = {
	tags: ["visual"],
	render: tagScreen(tagServer()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "태그 추가" }));
		await within(canvasElement).findByRole("textbox", { name: /이름/ });
	},
};

export const RecordPanelSaveFailed: Story = {
	render: tagScreen(
		tagServer((path, method) =>
			method === "PATCH" && path.startsWith("/api/monti/v1/entries/")
				? answer(409, {
						error: { code: "conflict", message: "다른 곳에서 먼저 고쳤어요. 새로 고친 뒤 다시 시도해 주세요." },
					})
				: undefined,
		),
	),
	play: async ({ canvasElement }) => {
		const name = await openTag(canvasElement);
		fireEvent.change(name, { target: { value: "리액트 2" } });
		const save = await within(canvasElement).findByRole("button", { name: "저장" });
		await waitFor(() => expect(save).toBeEnabled());
		await userEvent.click(save);
		await within(canvasElement).findByText(/다른 곳에서 먼저 고쳤어요/);
	},
};

export const RecordPanelDiscardDialog: Story = {
	render: tagScreen(tagServer()),
	play: async ({ canvasElement }) => {
		const name = await openTag(canvasElement);
		fireEvent.change(name, { target: { value: "리액트 2" } });
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "프론트엔드" }));
		await body().findByRole("alertdialog", { name: "저장하지 않은 내용" });
	},
};

// The trash screen.
const trashScreen = (api: FakeApi) => () => (
	<PageFrame api={api} pathname="/admin/trash" search="collection=post">
		<TrashScreen />
	</PageFrame>
);
export const TrashLoaded: Story = {
	...visual,
	render: trashScreen(server({ trashed })),
};

export const TrashEmpty: Story = {
	...visual,
	render: trashScreen(server()),
};

export const TrashLoadFailed: Story = {
	render: trashScreen(server({ extra: (path) => (path.includes("status=trashed") ? serverError() : undefined) })),
};

export const TrashRowsSelected: Story = {
	...visual,
	render: trashScreen(server({ trashed })),
	play: ({ canvasElement }) => selectRows(canvasElement, "버린 글", "오래된 초안"),
};

export const TrashRowMenuOpen: Story = {
	render: trashScreen(server({ trashed })),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "버린 글");
	},
};

/** Restoring needs no confirmation; deleting forever asks, for one row or for the selected rows. */
export const DeleteForeverSelectedDialog: Story = {
	render: trashScreen(server({ trashed })),
	play: async ({ canvasElement }) => {
		await selectRows(canvasElement, "버린 글", "오래된 초안");
		// The bulk bar sits above the table, so its button comes before the rows' own.
		const [bulkDelete] = await within(canvasElement).findAllByRole("button", { name: "영구 삭제" });
		await userEvent.click(bulkDelete as HTMLElement);
		await body().findByRole("alertdialog");
	},
};

export const DeleteForeverDialog: Story = {
	render: trashScreen(server({ trashed })),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "버린 글");
		await userEvent.click(await body().findByRole("menuitem", { name: /영구 삭제/ }));
		await body().findByRole("alertdialog");
	},
};

export const RestoreFailed: Story = {
	render: trashScreen(
		server({
			trashed,
			extra: (path, method) =>
				path.endsWith("/restore") && method === "POST"
					? answer(409, { error: { code: "conflict", message: "다른 곳에서 먼저 바뀌었어요." } })
					: undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		const row = await within(canvasElement).findByRole("row", { name: /버린 글/ });
		await userEvent.click(within(row).getByRole("button", { name: "복원" }));
	},
};
