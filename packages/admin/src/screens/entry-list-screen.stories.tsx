import type { Folder, ListEntriesItem } from "@monti-cms/core/site";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, ScreenFrame } from "../stories/screen-frame";
import { EntryListScreen, TrashScreen } from "./entry-list-screen";

const meta = { title: "Screens/Entry list", parameters: { layout: "fullscreen" } } satisfies Meta;
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
const folder = (id: string, name: string, position: number, parentId: string | null = null): Folder => ({
	id,
	collection: "post",
	parentId,
	name,
	position,
	version: 1,
});
const folders = [
	folder("f-news", "뉴스", 0),
	folder("f-notes", "노트", 1),
	folder("f-weekly", "주간 정리", 0, "f-news"),
];
const trashed = [
	entry("버린 글", { status: "trashed", trashedAt: new Date("2026-10-15T00:00:00Z") }),
	entry("오래된 초안", { status: "trashed", trashedAt: new Date("2026-10-10T00:00:00Z") }),
];

type ListOptions = {
	items?: ListEntriesItem[];
	folders?: Folder[];
	trashed?: ListEntriesItem[];
	/** Answers for the list request itself (loading, failure). */
	list?: (url: URL) => unknown;
	/** Anything else: runs first, `undefined` falls through to the defaults. */
	extra?: FakeApi;
};

/** The admin API of the list screens: entries (list and trash), folders and saved list settings. */
const server =
	({ items = posts, folders: folderList = [], trashed: trash = [], list, extra }: ListOptions = {}): FakeApi =>
	(path, method) => {
		const extraAnswer = extra?.(path, method);
		if (extraAnswer !== undefined) return extraAnswer;
		const url = new URL(path, "http://admin");
		if (url.pathname === "/api/monti/v1/preferences") return {};
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return folderList;
		if (url.pathname === "/api/monti/v1/entries" && method === "GET") {
			const collection = url.searchParams.get("collection");
			const inTrash = url.searchParams.getAll("status").includes("trashed");
			// The sidebar's trash badge asks for trashed rows of the same collection; only the list itself goes through `list`.
			if (list && !inTrash && collection === "post") return list(url);
			const rows = collection !== "post" ? [] : inTrash ? trash : items;
			return { items: rows, total: rows.length };
		}
		return undefined;
	};

const listScreen =
	(api: FakeApi, search = "collection=post") =>
	() => (
		<ScreenFrame api={api} title="게시글" nav="post" pathname="/admin" search={search}>
			<EntryListScreen />
		</ScreenFrame>
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

export const Loaded: Story = { render: listScreen(server({ trashed })) };

export const WithFolders: Story = { render: listScreen(server({ folders, trashed })) };

export const Empty: Story = { render: listScreen(server({ items: [] })) };

export const NoSearchResults: Story = {
	render: listScreen(server({ items: [] }), "collection=post&search=없는 검색어"),
};

export const Loading: Story = { render: listScreen(server({ list: () => "pending" })) };

export const LoadFailed: Story = { render: listScreen(server({ list: () => serverError() })) };

export const RowsSelected: Story = {
	render: listScreen(server({ folders })),
	play: ({ canvasElement }) => selectRows(canvasElement, "첫 번째 글", "쓰는 중인 글"),
};

export const RowMenuOpen: Story = {
	render: listScreen(server({ folders })),
	play: async ({ canvasElement }) => {
		await openRowMenu(canvasElement, "첫 번째 글");
	},
};

export const ViewPopoverOpen: Story = {
	render: listScreen(server()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /보기/ }));
	},
};

export const StatusFiltered: Story = { render: listScreen(server(), "collection=post&status=published") };

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
	<ScreenFrame api={api} title="태그" nav="tag" pathname="/admin" search="collection=tag">
		<EntryListScreen />
	</ScreenFrame>
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
	render: tagScreen(tagServer()),
	play: async ({ canvasElement }) => {
		await openTag(canvasElement);
	},
};

export const RecordPanelNew: Story = {
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
	<ScreenFrame
		api={api}
		title="휴지통"
		nav="trash"
		pathname="/admin/trash"
		search="collection=post"
		shell={{ large: true }}
	>
		<TrashScreen />
	</ScreenFrame>
);
export const TrashLoaded: Story = { render: trashScreen(server({ trashed })) };

export const TrashEmpty: Story = { render: trashScreen(server()) };

export const TrashLoadFailed: Story = {
	render: trashScreen(server({ extra: (path) => (path.includes("status=trashed") ? serverError() : undefined) })),
};

export const TrashRowsSelected: Story = {
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
