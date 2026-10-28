import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type FakeApi, PageFrame } from "../../stories/screen-frame";
import { TrashBackend } from "./__test__/trash-backend";
import { at, entry, folder, inside, media, STORY_NOW } from "./__test__/trash-fixtures";
import { TrashScreen } from "./trash-screen";

/**
 * The trash screen, one story per stage of the Trash board (canvas `Trash`, flow 5). The days left are counted to the board's day (10. 27), so a picture
 * does not change with the date. The stories that change the layout are shot by the visual checks.
 */
const meta = { title: "Screens/Trash", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const visual = { tags: ["visual"] };
const body = () => within(document.body);

const first = entry("first", "첫 번째 글", { slug: "first-post", deletedAt: at(10, 27), locales: ["ko", "en"] });
const about = entry("about", "옛 소개 글", {
	slug: "about-old",
	deletedAt: at(10, 20),
	everPublished: true,
	locales: ["ko"],
});
const ko = entry("react", "리액트 19 마이그레이션", {
	slug: "react-19",
	translationGroupId: "react",
	deletedAt: at(10, 14),
	locales: ["ko"],
});
const en = (sourceTrashed = false) =>
	entry("react-en", "React 19 migration", {
		slug: "en/react-19",
		translationGroupId: "react",
		isSource: false,
		locale: "en",
		deletedAt: at(10, 12),
		sourceTrashed,
		sourceTitle: sourceTrashed ? "리액트 19 마이그레이션" : null,
	});
const scratch = entry("scratch", "연습장", {
	collection: "memo",
	slug: "scratch",
	deletedAt: at(10, 12),
	locales: ["ko"],
});
const tag = entry("tag", "임시", { collection: "tag", slug: "temp", deletedAt: at(9, 30), usages: 4 });
const series = folder("series", "시리즈 원고", { deletedAt: at(10, 27), entries: 2 });
const diagrams = folder("diagrams", "diagrams", {
	collection: "media",
	deletedAt: at(10, 26),
	entries: 0,
	files: 3,
	path: ["Blog Assets"],
});
const image = media("winter", "winter-01.jpg", { deletedAt: at(10, 25), path: ["Blog Assets"], folderId: "assets" });
const episode1 = inside(
	entry("ep1", "시리즈 1화 · 블로그를 다시 만든 이유", {
		slug: "series-1",
		everPublished: true,
		deletedAt: at(10, 27),
	}),
	"시리즈 원고",
);
const episode2 = inside(
	entry("ep2", "시리즈 2화 · 저장소 고르기", { slug: "series-2", deletedAt: at(10, 27) }),
	"시리즈 원고",
);
const notes = entry("notes", "저장소 비교 메모", {
	collection: "memo",
	slug: "storage-notes",
	deletedAt: at(10, 8),
	locales: ["ko"],
});

const referrers = [
	{ entryId: "r1", title: "첫 번째 글", collection: "post", trashed: false },
	{ entryId: "r2", title: "발행 후 고친 글", collection: "post", trashed: false },
	{ entryId: "r3", title: "가을 사진 정리", collection: "post", trashed: false },
	{ entryId: "r4", title: "연습장", collection: "memo", trashed: true },
];

/** The board's rows, newest first. */
const rows = (sourceTrashed = false) => [first, series, diagrams, image, about, ko, en(sourceTrashed), scratch, tag];

const backendOf = (top = rows()) => {
	const backend = new TrashBackend(top, { series: [episode1, episode2] });
	backend.referrers = { tag: referrers };
	return backend;
};

/** The trash API over `backend`, as the story frame asks for it. */
const apiOf =
	(backend: TrashBackend): FakeApi =>
	(path, method, requestBody) => {
		const answer = backend.handle(new URL(path, "http://admin"), method, requestBody as never);
		return answer?.body;
	};

const screen =
	(backend: TrashBackend, search = "") =>
	() => (
		<PageFrame api={apiOf(backend)} pathname="/admin/trash" search={search}>
			<TrashScreen now={STORY_NOW} />
		</PageFrame>
	);

/** Waits for a row by its name. */
const rowNamed = (canvasElement: HTMLElement, name: RegExp) => within(canvasElement).findByRole("row", { name });

// 보통: one list for every kind, newest first; a folder is one line, a translation says what it is.
export const Default: Story = { ...visual, render: screen(backendOf()) };

// 미디어: the media tab, files and media folders.
export const Media: Story = { ...visual, render: screen(backendOf(), "kind=media") };

// 휴지통 폴더 안: the trail, the folder's name, its day, folder restore and permanent delete, the way up, and rows with no day.
export const InsideFolder: Story = { ...visual, render: screen(backendOf(), "folder=series") };

// 휴지통 찾기: the search finds what is inside folders and says which folder.
export const Searching: Story = {
	...visual,
	render: () => {
		const backend = backendOf([...rows(), notes]);
		return screen(backend, "search=저장소")();
	},
};

// 번역 막힘: a translation whose original is in the trash says so, and its button restores the original.
export const OriginalInTrash: Story = { ...visual, render: screen(backendOf(rows(true))) };

// 항목 열기: an item opens in the read-only panel beside the list, with what points at it.
export const ItemOpen: Story = {
	...visual,
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(within(await rowNamed(canvasElement, /임시/)).getByRole("button", { name: "임시" }));
		await body().findByText("가리키는 글 · 4");
	},
};

// 미디어 열기: a file opens in the same panel, with a preview and where it is used.
export const MediaOpen: Story = {
	...visual,
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(await rowNamed(canvasElement, /winter-01/)).getByRole("button", { name: "winter-01.jpg" }),
		);
		await body().findByText("쓰는 곳");
	},
};

// 삭제 확인: permanent delete asks, and says the address that was published stays reserved.
export const DeleteConfirm: Story = {
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(await rowNamed(canvasElement, /옛 소개 글/)).getByRole("button", { name: "더보기: 영구 삭제" }),
		);
		await userEvent.click(await body().findByRole("menuitem", { name: "영구 삭제" }));
		await body().findByRole("alertdialog", { name: "영구 삭제할까요?" });
	},
};

// 삭제 막힘: entries point at the item, so the dialog lists them with the way out of each and the delete stays off.
export const DeleteBlocked: Story = {
	...visual,
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(
			within(await rowNamed(canvasElement, /임시/)).getByRole("button", { name: "더보기: 영구 삭제" }),
		);
		await userEvent.click(await body().findByRole("menuitem", { name: "영구 삭제" }));
		await body().findByRole("button", { name: "연결 끊기" });
	},
};

// 선택: the head becomes the bar with the count, restore and permanent delete.
export const Picked: Story = {
	...visual,
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		for (const name of [/옛 소개 글/, /연습장/])
			await userEvent.click(within(await rowNamed(canvasElement, name)).getByRole("checkbox", { name: "고르기" }));
		await within(canvasElement).findByRole("toolbar", { name: "2개 선택" });
	},
};

// 행 메뉴: right-click on a row.
export const RowMenu: Story = {
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		fireEvent.contextMenu(await rowNamed(canvasElement, /옛 소개 글/));
		await body().findByRole("menuitem", { name: /영구 삭제/ });
	},
};

// 복원함: restored as a draft, and the toast offers to open it.
export const Restored: Story = {
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(within(await rowNamed(canvasElement, /옛 소개 글/)).getByRole("button", { name: "복원" }));
		await body().findByText("초안으로 복원했어요");
	},
};

// 폴더에서 하나 복원: one entry from inside a folder; the folder is made again.
export const RestoredFromFolder: Story = {
	render: () => {
		const backend = backendOf();
		backend.onRestore = ({ items }) =>
			items.map((item) => ({ type: item.type, id: item.id, ok: true, recreated: true }));
		return screen(backend, "folder=series")();
	},
	play: async ({ canvasElement }) => {
		await userEvent.click(within(await rowNamed(canvasElement, /시리즈 1화/)).getByRole("button", { name: "복원" }));
		await body().findByText("시리즈 원고 폴더를 다시 만들고 초안으로 복원했어요");
	},
};

// 비우기 확인: how many go, and that what is pointed at stays.
export const EmptyConfirm: Story = {
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "비우기" }));
		await body().findByRole("alertdialog", { name: "휴지통을 비울까요?" });
	},
};

// 비운 뒤: the toast tells what went and what stayed; the kept row says why and offers the permanent delete.
export const Emptied: Story = {
	...visual,
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "비우기" }));
		await userEvent.click(
			await within(await body().findByRole("alertdialog")).findByRole("button", { name: "비우기" }),
		);
		await body().findByText(/개를 지웠어요 · 1개는 남겼어요/);
		await waitFor(() => expect(within(canvasElement).queryByRole("row", { name: /첫 번째 글/ })).toBeNull());
	},
};

// 빔: nothing in the trash.
export const Empty: Story = { ...visual, render: screen(backendOf([])) };
