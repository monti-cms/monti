import type { Meta, StoryObj } from "@storybook/react-vite";
import { fireEvent, userEvent, waitFor, within } from "storybook/test";
import { testSite } from "../../../../core/test/site";
import type { MediaItem } from "../../api/media";
import { writePreference } from "../../lib/utils/site-storage";
import { type FakeApi, PageFrame } from "../../stories/screen-frame";
import { folderItem, image, MediaBackend, pdf } from "./__test__/media-backend";
import { MediaLibrary } from "./media-library";
import { MediaNotConfigured } from "./media-not-configured";

/**
 * The media library, one story per mode of the Media board (canvas `Media`, flow 6): the top and the inside of a folder, a new folder, the menus, dragging
 * files over it, uploads going up and failing, the file panel, replacing a file, picking several, the alt text and type conditions, files that are not
 * pictures, and no storage. Stories that change the layout are shot by the visual checks.
 */
const meta = { title: "Screens/Media library", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** A flat gradient, so the tiles have a picture without a network. */
const picture = (from: string, to: string) =>
	`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/></svg>`)}`;

const use = (n: number, notes: ("working" | "published")[] = ["published"]) => ({
	referencesCount: n,
	references: Array.from({ length: n }, (_, i) => ({
		entryId: `e${i}`,
		title: ["첫 번째 글", "쓰는 중인 글", "여행 기록"][i] ?? `글 ${i}`,
		collection: "post",
		state: notes[i % notes.length] ?? ("published" as const),
	})),
});
const shot = (id: string, from: string, to: string, fields: Partial<MediaItem> = {}) =>
	image(id, { publicUrl: picture(from, to), ...fields });

const blog = folderItem("blog", "Blog Assets", null, 5);
const covers = folderItem("covers", "covers", "blog", 6);
const diagrams = folderItem("diagrams", "diagrams", "blog", 3);
const wall = folderItem("wall", "Wallpapers", null, 7);

const items = [
	shot("cybersecurity-code", "#2f3a2c", "#121611", { folderId: "blog", width: 1600, height: 900, ...use(2) }),
	shot("desk-morning", "#d8cdb8", "#a69479", {
		folderId: "blog",
		defaultAlt: "아침 햇빛이 드는 책상 위의 노트북과 커피잔",
		original: { mimeType: "image/jpeg", byteSize: 3_100_000, width: 4032, height: 2688 },
		...use(2, ["published", "working"]),
	}),
	shot("seoul-night", "#3a3f55", "#1c1e2b", { folderId: "blog", defaultAlt: "", width: 3000, height: 2000, ...use(1) }),
	pdf("notes-scan", { folderId: "blog" }),
	shot("cafe-window", "#b9a184", "#6d5a44", { folderId: "blog", defaultAlt: "", width: 2000, height: 1333, ...use(1) }),
	shot("cover-react", "#c9d6d3", "#8ea7a2", { folderId: "covers", width: 1600, height: 900, ...use(3) }),
	shot("cover-cache", "#e9e5dc", "#cfc8b9", {
		folderId: "covers",
		defaultAlt: "",
		width: 1600,
		height: 900,
		...use(1),
	}),
	shot("cover-2024-retro", "#d6c3b4", "#9c8473", { folderId: "covers", width: 1600, height: 900 }),
	shot("old-cover", "#3a3f55", "#1c1e2b", { folderId: null, width: 1600, height: 900 }),
	pdf("resume", { folderId: null, byteSize: 180_000, ...use(1) }),
];

const backendOf = () => new MediaBackend(items, [blog, covers, diagrams, wall]);

const apiOf =
	(backend: MediaBackend, over: (path: string) => unknown = () => undefined): FakeApi =>
	(path, method, requestBody) => {
		const custom = over(path);
		if (custom !== undefined) return custom;
		const answer = backend.handle(new URL(path, "http://admin"), method, requestBody as never);
		return answer?.body;
	};

const screen =
	(
		backend: MediaBackend,
		options: { search?: string; view?: "grid" | "list"; over?: (path: string) => unknown } = {},
	) =>
	() => {
		// The view is a per-device choice kept in the browser: set it for every story so one story does not leak into the next.
		writePreference(testSite, "media-view", options.view ?? "grid");
		return (
			<PageFrame api={apiOf(backend, options.over)} pathname="/admin/media" search={options.search ?? "folder=blog"}>
				<MediaLibrary />
			</PageFrame>
		);
	};

/** A tile of the grid (the sidebar lists the folders too, so the search is inside the grid). */
const tile = async (canvasElement: HTMLElement, name: RegExp) => {
	const grid = await waitFor(() => {
		const found = canvasElement.querySelector("[data-slot=drop-area]");
		if (!found) throw new Error("The grid is not there yet");
		return found as HTMLElement;
	});
	return within(grid).findByRole("button", { name });
};
const area = () => document.querySelector("[data-slot=drop-area]") as HTMLElement;
/** A right click on an element, where it is (the menu opens at the pointer). */
const rightClick = (element: Element) => {
	const box = element.getBoundingClientRect();
	fireEvent.contextMenu(element, { clientX: box.x + box.width / 2, clientY: box.y + Math.min(box.height / 2, 40) });
};

/** Drags files over, or drops them on, an element. `fireEvent` copies a `DataTransfer` into an empty one, so the event is made by hand to keep the files. */
const drag = (element: Element, type: "dragenter" | "drop", files: File[]) => {
	const data = new DataTransfer();
	for (const file of files) data.items.add(file);
	element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
};

// 폴더 안: the sub-folders and the files of Blog Assets.
export const InFolder: Story = { tags: ["visual"], render: screen(backendOf()) };

// 최상위: the folders and the files in no folder.
export const TopLevel: Story = { tags: ["visual"], render: screen(backendOf(), { search: "" }) };

// 하위 폴더: a folder with its own path above the title.
export const SubFolder: Story = { tags: ["visual"], render: screen(backendOf(), { search: "folder=covers" }) };

// 목록 보기: name, use, type, size, dimensions and day.
export const ListView: Story = { tags: ["visual"], render: screen(backendOf(), { view: "list" }) };

export const Empty: Story = { tags: ["visual"], render: screen(new MediaBackend([], []), { search: "" }) };

export const Loading: Story = {
	render: screen(backendOf(), { over: (path) => (path.startsWith("/api/monti/v1/media?") ? "pending" : undefined) }),
};

// 새 폴더: the name opens in place with "새 폴더" selected.
export const NewFolder: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "+ 폴더" }));
		await within(canvasElement).findByRole("textbox", { name: "폴더 이름" });
	},
};

// 폴더 우클릭: open, rename, move, delete the folder.
export const FolderMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		rightClick(await tile(canvasElement, /^covers/));
		await body().findByRole("menuitem", { name: "폴더 지우기" });
	},
};

// 파일 메뉴: open, used in, to folder, the trash.
export const FileMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		rightClick(await tile(canvasElement, /^desk-morning/));
		await body().findByRole("menuitem", { name: "쓰는 곳" });
	},
};

// 빈 곳 우클릭: upload and new folder.
export const BlankMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		rightClick(document.querySelector("[data-slot=blank-space]") as HTMLElement);
		await body().findByRole("menuitem", { name: "새 폴더" });
	},
};

// 끌어 놓기: files over the library, the frame and the hint at the bottom.
export const DraggingOver: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		drag(area(), "dragenter", [new File(["x"], "a.png", { type: "image/png" })]);
		await waitFor(() => body().getByText("여기에 올려요"));
	},
};

// 폴더 위로 끌기: only that folder is picked out, and the hint names it.
export const DraggingOverFolder: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		drag(await tile(canvasElement, /^covers/), "dragenter", [new File(["x"], "a.png", { type: "image/png" })]);
		await waitFor(() => body().getByText("covers"));
	},
};

// 올리는 중: the first file going up with its progress, the others waiting. (A picture, a PDF and a CSV.)
export const Uploading: Story = {
	tags: ["visual"],
	render: screen(backendOf(), { over: (path) => (path.includes("/media/uploads") ? "pending" : undefined) }),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		const png = new File([new Uint8Array(2000)], "hero.png", { type: "image/png" });
		drag(area(), "drop", [
			png,
			new File(["x"], "price-list-2026.pdf", { type: "application/pdf" }),
			new File(["x"], "subscribers.csv", { type: "text/csv" }),
		]);
		await tile(canvasElement, /^subscribers\.csv/);
	},
};

// 올리기 실패: a format that is not taken, a file that is over the limit, and a type the site does not accept stay in place.
export const UploadsFailed: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		const big = new File(["x"], "panorama.jpg", { type: "image/jpeg" });
		Object.defineProperty(big, "size", { value: testSite.api.MAX_MEDIA_BYTES + 4_000_000 });
		drag(area(), "drop", [
			new File(["x"], "IMG_2041.HEIC", { type: "image/heic" }),
			big,
			new File(["x"], "setup.exe", { type: "application/x-msdownload" }),
		]);
		await tile(canvasElement, /^setup\.exe/);
	},
};

// 파일 열기: the panel of a picture.
export const OpenImage: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^desk-morning/));
		await within(canvasElement).findByRole("complementary", { name: "desk-morning.jpg" });
	},
};

// PDF 열기: the panel of a file has no alt text; replace and the trash are in the foot.
export const OpenPdf: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^notes-scan/));
		await within(document.body).findByRole("complementary", { name: "notes-scan.pdf" });
	},
};

// 바꾸기 메뉴: the panel's ⋯.
export const PanelMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^desk-morning/));
		const panel = await body().findByRole("complementary", { name: "desk-morning.jpg" });
		await userEvent.click(within(panel).getByRole("button", { name: /^더보기:/ }));
		await body().findByRole("menuitem", { name: "파일 바꾸기" });
	},
};

// 파일 바꾸기: the question before the file is replaced, with how many places use it.
export const ReplaceDialog: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await userEvent.click(await tile(canvasElement, /^desk-morning/));
		const panel = await body().findByRole("complementary", { name: "desk-morning.jpg" });
		await userEvent.click(within(panel).getByRole("button", { name: /^더보기:/ }));
		await userEvent.click(await body().findByRole("menuitem", { name: "파일 바꾸기" }));
		const input = document.querySelector("input[data-slot=replace-input]") as HTMLInputElement;
		const data = new DataTransfer();
		data.items.add(new File([new Uint8Array(3000)], "desk-morning-v2.jpg", { type: "image/jpeg" }));
		Object.defineProperty(input, "files", { value: data.files, configurable: true });
		fireEvent.change(input);
		await body().findByRole("alertdialog");
	},
};

// 여러 개 선택: the bar with the count, to folder, the trash and letting go.
export const Picking: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("checkbox", { name: /desk-morning/ }));
		await userEvent.click(within(canvasElement).getByRole("checkbox", { name: /cafe-window/ }));
		await within(canvasElement).findByRole("toolbar", { name: "2개 선택" });
	},
};

// 폴더로 옮기기: the bar's menu.
export const MoveMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("checkbox", { name: /desk-morning/ }));
		await userEvent.click(within(canvasElement).getByRole("checkbox", { name: /cafe-window/ }));
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^폴더로$/ }));
		await body().findByRole("menuitem", { name: "+ 새 폴더" });
	},
};

// 필터 열기: alt text, none or has, with the counts.
export const AltFilterMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("button", { name: /^대체 텍스트/ }));
		await body().findByRole("menuitemcheckbox", { name: /없음/ });
	},
};

// 필터 걸림: the chip with its ×, and the place to look.
export const AltFilterOn: Story = { tags: ["visual"], render: screen(backendOf(), { search: "folder=blog&alt=none" }) };

// 대체 텍스트 없는 것 고름: every file that matches is picked.
export const AltFilterAllPicked: Story = {
	tags: ["visual"],
	render: screen(backendOf(), { search: "folder=blog&alt=none" }),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^seoul-night/);
		await userEvent.click(within(canvasElement).getByRole("checkbox", { name: /seoul-night/ }));
		await userEvent.click(await within(canvasElement).findByRole("checkbox", { name: "전체 선택" }));
		await within(canvasElement).findByRole("toolbar", { name: "3개 선택" });
	},
};

// 찾는 중: the search widened to all folders, with each result's folder path.
export const Searching: Story = {
	tags: ["visual"],
	render: screen(backendOf(), { search: "folder=blog&search=cover&scope=all" }),
};

// 정렬: the order menu, newest upload first by default.
export const SortMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("button", { name: "최근 올린순" }));
		await body().findByRole("menuitemradio", { name: "큰 파일순" });
	},
};

// 종류 열기: images and files with their counts.
export const KindMenu: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		await tile(canvasElement, /^desk-morning/);
		await userEvent.click(within(canvasElement).getByRole("button", { name: /^종류/ }));
		await body().findByRole("menuitemcheckbox", { name: /파일/ });
	},
};

// 종류 파일: files only; the alt text condition is gone.
export const KindFiles: Story = { tags: ["visual"], render: screen(backendOf(), { search: "folder=blog&kind=file" }) };

// 휴지통으로 옮김: the toast with its undo.
export const MovedToTrash: Story = {
	tags: ["visual"],
	render: screen(backendOf()),
	play: async ({ canvasElement }) => {
		rightClick(await tile(canvasElement, /^notes-scan/));
		await userEvent.click(await body().findByRole("menuitem", { name: /휴지통으로/ }));
		await body().findByText(/휴지통으로 옮겼어요/);
	},
};

// 저장소 없음: the title stays, uploading is off, and the text says how to connect.
export const NoStorage: Story = {
	tags: ["visual"],
	render: () => (
		<PageFrame api={() => ({})} pathname="/admin/media">
			<MediaNotConfigured />
		</PageFrame>
	),
};
