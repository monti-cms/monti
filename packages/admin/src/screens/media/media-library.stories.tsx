import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { testSite } from "../../../../core/test/site";
import type { MediaItem } from "../../api/media";
import { writePreference } from "../../lib/utils/site-storage";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { MediaLibrary } from "./media-library";
import { MediaNotConfigured } from "./media-not-configured";

const meta = { title: "Screens/Media library", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A flat colored square, so the tiles have something to show without a network. */
const picture = (color: string) =>
	`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${color}"/></svg>`)}`;

const media = (id: string, color: string, fields: Partial<MediaItem> = {}): MediaItem => ({
	id,
	folderId: null,
	status: "ready",
	filename: `${id}.png`,
	mimeType: "image/png",
	byteSize: 245_760,
	width: 320,
	height: 240,
	publicUrl: picture(color),
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: "2026-10-01T09:30:00.000Z",
	referencesCount: 0,
	references: [],
	...fields,
});

const items: MediaItem[] = [
	media("고양이", "#d9a066", {
		defaultAlt: "창가의 고양이",
		referencesCount: 2,
		references: [
			{ entryId: "e1", title: "고양이와 보낸 하루", collection: "post", state: "working" },
			{ entryId: "e1", title: "고양이와 보낸 하루", collection: "post", state: "published" },
			{ entryId: "e2", title: "새 글 초안", collection: "post", state: "working" },
		],
	}),
	media("강아지", "#8fb3a0"),
	media("노을", "#c97b84"),
	media("안내서", "#999999", {
		filename: "안내서.pdf",
		mimeType: "application/pdf",
		publicUrl: null,
		width: null,
		height: null,
		byteSize: 1_500_000,
	}),
	media("삭제 중", "#bbbbbb", { status: "deleting" }),
];

const folders = [
	{ id: "f1", collection: "media", parentId: null, name: "여행 사진", position: 0, version: 1 },
	{ id: "f2", collection: "media", parentId: null, name: "로고", position: 1, version: 1 },
];

const mediaPath = "/api/monti/v1/media";

/** Answers what the library reads; `over` replaces single routes (exact path without query → answer). */
const serve =
	(over: Record<string, (method: string) => unknown> = {}, shown: MediaItem[] = items): FakeApi =>
	(path, method) => {
		const [route = "", query = ""] = path.split("?");
		const respond = over[route];
		if (respond) return respond(method);
		const params = new URLSearchParams(query);
		if (route === mediaPath) {
			let list = shown;
			if (params.get("used") === "unused") list = list.filter((item) => item.referencesCount === 0);
			if (params.get("used") === "used") list = list.filter((item) => item.referencesCount > 0);
			const search = params.get("search");
			if (search) list = list.filter((item) => item.filename.includes(search));
			return { items: list, total: list.length };
		}
		if (route === "/api/monti/v1/folders") return params.get("collection") === "media" ? folders : [];
		if (route.startsWith("/api/monti/v1/folders/")) return { entryCount: 0, childFolders: [] };
		if (route === "/api/monti/v1/entries") return { items: [], total: 0 };
		return undefined;
	};

const screen =
	(api: FakeApi, options: { view?: "grid" | "list"; search?: string } = {}) =>
	() => {
		// The view is a per-device choice kept in the browser: set it for every story so one story does not leak into the next.
		writePreference(testSite, "media-view", options.view ?? "grid");
		return (
			<PageFrame api={api} pathname="/admin/media" search={options.search}>
				<MediaLibrary />
			</PageFrame>
		);
	};

const tile = async (canvasElement: HTMLElement, name: RegExp) => within(canvasElement).findByRole("button", { name });

export const Loaded: Story = { render: screen(serve()) };

export const ListView: Story = { render: screen(serve(), { view: "list" }) };

export const Empty: Story = { render: screen(serve({}, [])) };

export const EmptyNoMatch: Story = { render: screen(serve({}, []), { search: "search=없는파일" }) };

export const Loading: Story = { render: screen(serve({ [mediaPath]: () => "pending" })) };

export const LoadFailed: Story = {
	render: screen(serve({ [mediaPath]: () => answer(500, { error: { message: "The media list is unavailable." } }) })),
};

/** Only the files nothing uses (the filter that finds what can be deleted). */
export const UnusedFilter: Story = { render: screen(serve(), { search: "used=unused" }) };

/** A file open in the detail panel on the right. */
export const FileSelected: Story = {
	tags: ["visual"],
	render: screen(serve()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^강아지\.png/));
		await within(canvasElement).findByRole("complementary", { name: "강아지.png" });
	},
};

/** A file in use: its usages are listed and it cannot be deleted. */
export const UsedFileSelected: Story = {
	tags: ["visual"],
	render: screen(serve()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^고양이\.png/));
		await within(canvasElement).findByRole("complementary", { name: "고양이.png" });
	},
};

export const RenameFailed: Story = {
	render: screen(
		serve({
			[`${mediaPath}/${encodeURIComponent("강아지")}`]: (method) =>
				method === "PATCH" ? answer(409, { error: { message: "A file with this name already exists." } }) : undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /강아지\.png$/));
		const detail = await within(canvasElement).findByRole("complementary");
		const name = within(detail).getByRole("textbox", { name: "파일 이름" });
		fireEvent.change(name, { target: { value: "노을" } });
		await waitFor(() => expect(within(detail).getByRole("button", { name: "파일 이름 저장" })).toBeEnabled());
		await userEvent.click(within(detail).getByRole("button", { name: "파일 이름 저장" }));
	},
};

/** Files are being sent: the storage never answers, so the button keeps its progress. */
export const UploadInProgress: Story = {
	render: screen(serve({ [`${mediaPath}/uploads`]: () => "pending" })),
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole("button", { name: /강아지\.png$/ });
		const input = canvasElement.querySelector<HTMLInputElement>("input[type=file]");
		if (!input) throw new Error("The upload input is missing.");
		await userEvent.upload(input, new File(["x"], "새 사진.png", { type: "image/png" }));
	},
};

export const NewFolderDialog: Story = {
	render: screen(serve()),
	play: async ({ canvasElement }) => {
		await within(canvasElement).findByRole("button", { name: /강아지\.png$/ });
		await userEvent.click(within(canvasElement).getAllByRole("button", { name: "폴더 추가" })[0] as HTMLElement);
		await within(document.body).findByRole("dialog");
	},
};

const openFolderMenu = async (canvasElement: HTMLElement, item: string) => {
	// The sidebar tree has the same button; the tile in the page is the last one.
	const buttons = await within(canvasElement).findAllByRole("button", { name: "'여행 사진' 폴더 작업" });
	await userEvent.click(buttons[buttons.length - 1] as HTMLElement);
	await userEvent.click(await within(document.body).findByRole("menuitem", { name: item }));
};

export const RenameFolderDialog: Story = {
	render: screen(serve()),
	play: async ({ canvasElement }) => {
		await openFolderMenu(canvasElement, "이름 변경");
		await within(document.body).findByRole("dialog");
	},
};

export const RenameFolderFailed: Story = {
	render: screen(
		serve({
			"/api/monti/v1/folders/f1": (method) =>
				method === "PATCH" ? answer(409, { error: { message: "A folder with this name already exists." } }) : undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await openFolderMenu(canvasElement, "이름 변경");
		const dialog = await within(document.body).findByRole("dialog");
		await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
	},
};

/** Deleting a folder says what moves up to its parent. */
export const DeleteFolderConfirm: Story = {
	render: screen(
		serve({
			"/api/monti/v1/folders/f1": (method) =>
				method === "GET" ? { entryCount: 12, childFolders: [folders[1]] } : undefined,
		}),
	),
	play: async ({ canvasElement }) => {
		await openFolderMenu(canvasElement, "삭제");
		await within(document.body).findByRole("alertdialog");
	},
};

/** An unused file asks before it goes. */
export const DeleteFileConfirm: Story = {
	render: screen(serve()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /강아지\.png$/));
		const detail = await within(canvasElement).findByRole("complementary");
		await userEvent.click(within(detail).getByRole("button", { name: "삭제" }));
		await within(document.body).findByRole("alertdialog");
	},
};

/** The site has no media storage configured. */
export const NotConfigured: Story = {
	render: () => (
		<PageFrame api={serve()} pathname="/admin/media">
			<MediaNotConfigured />
		</PageFrame>
	),
};
