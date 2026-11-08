import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scrollsSideways } from "../../../../../testing/input";
import * as media from "./media.stories";
import { samplePhoto } from "./media.stories";

const { Top, NoStorage, ListView } = composeStories(media);

const main = () => page.getByRole("main");
const heading = () => main().getByRole("heading", { level: 1 });
const tile = (name: string) => main().getByRole("button", { name: new RegExp(name) });
const folder = (name: string) => main().getByRole("button", { name: new RegExp(`^${name}`) });
const toast = (text: string) => page.getByRole("listitem").filter({ hasText: text });

/** Files from outside dropped on an element, as the browser hands them over. The OS's own drag is L5's. */
function dropFiles(on: Element, files: File[]) {
	const dataTransfer = new DataTransfer();
	for (const file of files) dataTransfer.items.add(file);
	for (const type of ["dragenter", "dragover", "drop"])
		on.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
}

const jpeg = async (name: string) =>
	new File([(await samplePhoto("#111111", "#eeeeee")).slice().buffer], name, { type: "image/jpeg" });
const named = (name: string, bytes: number[], type = "") => new File([new Uint8Array(bytes)], name, { type });

async function openAssets() {
	await Top.run();
	await userEvent.click(folder("Blog Assets"));
	await expect.element(heading()).toHaveTextContent("Blog Assets");
}

describe("browsing", () => {
	it("09-1 [flow 6·07] the top shows the folders and the files in no folder, with how many", async () => {
		await Top.run();
		await expect.element(folder("Blog Assets")).toBeVisible();
		await expect.element(folder("Wallpapers")).toBeVisible();
		await expect.element(tile("top-level-photo.jpg")).toBeVisible();
		await expect.element(tile("desk-morning.jpg")).not.toBeInTheDocument();
		await expect.element(main().getByText("1개")).toBeVisible();
	});

	it("09-1 [flow 6·08] a folder shows its subfolders and files under its path, and the path goes back up", async () => {
		await openAssets();
		await expect.element(folder("covers")).toBeVisible();
		await expect.element(tile("desk-morning.jpg")).toBeVisible();
		await expect.element(main().getByText("2400×1600 · 글 1")).toBeVisible();
		await expect.element(main().getByText("2.1 MB · 사용 안 함")).toBeVisible();
		await userEvent.click(main().getByRole("navigation", { name: "경로" }).getByRole("button", { name: "미디어" }));
		await expect.element(folder("Blog Assets")).toBeVisible();
	});

	it("09-1 [flow 6·09] '새 폴더' in the pill's menu puts a folder in place with its name picked; Enter keeps it, Esc drops it", async () => {
		await Top.run();
		await expect.element(folder("Blog Assets")).toBeVisible();
		await userEvent.click(main().getByRole("button", { name: "더 만들기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).toHaveValue("새 폴더");
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: "더 만들기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
		await userEvent.keyboard("표지{Enter}");
		await expect.element(folder("표지")).toBeVisible();
	});

	it("09-1 [flow 6·10] a folder's right-click menu renames it and opens it", async () => {
		await Top.run();
		await userEvent.click(folder("Wallpapers"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "이름 바꾸기" }));
		await userEvent.fill(page.getByRole("textbox", { name: "폴더 이름" }), "배경");
		await userEvent.keyboard("{Enter}");
		await userEvent.click(folder("배경"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "열기" }));
		await expect.element(heading()).toHaveTextContent("배경");
	});

	it("09-1 [flow 6·13] a right click on empty ground offers uploading and a new folder", async () => {
		await Top.run();
		await expect.element(folder("Blog Assets")).toBeVisible();
		const { width, height } = main().element().getBoundingClientRect();
		await userEvent.click(main(), { button: "right", position: { x: width / 2, y: height - 60 } });
		await expect.element(page.getByRole("menuitem", { name: "올리기" })).toBeVisible();
		await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).toHaveValue("새 폴더");
		await userEvent.keyboard("{Escape}");
	});

	it("09-1 [flow 6·14] the list view has a row per file: use, type, size, measure", async () => {
		await ListView.run();
		await userEvent.click(folder("Blog Assets").or(main().getByRole("link", { name: "Blog Assets" })));
		const row = main().getByRole("row").filter({ hasText: "desk-morning.jpg" });
		await expect.element(row).toHaveTextContent("글 1");
		await expect.element(row).toHaveTextContent("JPG");
		await expect.element(row).toHaveTextContent("2400×1600");
	});

	it("09-1 [flow 6·09, 6·10] the list view names a new folder and renames one in place", async () => {
		await ListView.run();
		await expect.element(main().getByRole("link", { name: "Blog Assets" })).toBeVisible();
		await userEvent.click(main().getByRole("button", { name: "더 만들기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).toHaveValue("새 폴더");
		await userEvent.keyboard("표지{Enter}");
		await expect.element(main().getByRole("link", { name: "표지" })).toBeVisible();
		await userEvent.click(main().getByRole("link", { name: "표지" }), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "이름 바꾸기" }));
		await userEvent.fill(page.getByRole("textbox", { name: "폴더 이름" }), "대표");
		await userEvent.keyboard("{Enter}");
		await expect.element(main().getByRole("link", { name: "대표" })).toBeVisible();
	});

	it("09-1 [flow 6·15] [korean] a search reaches the subfolders and can widen to every folder, each result saying where it is", async () => {
		await openAssets();
		await userEvent.click(main().getByRole("button", { name: "검색" }));
		await userEvent.keyboard("cafe");
		await expect.element(tile("cafe-window.jpg")).toBeVisible();
		// The path under the open folder; a file right in it keeps its usual line (components/list.md).
		await expect.element(main().getByText(/^covers · 2000×1333/)).toBeVisible();
		await expect.element(folder("covers")).not.toBeInTheDocument();
		await userEvent.fill(main().getByRole("searchbox"), "top-level");
		await expect.element(tile("top-level-photo.jpg")).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: "모든 폴더" }));
		await expect.element(tile("top-level-photo.jpg")).toBeVisible();
	});

	it("09-1 [flow 6·32, 6·33] the kind menu counts and stays open; a chosen kind is a chip in its place, folders stay to browse, and × takes it off", async () => {
		await openAssets();
		await userEvent.click(main().getByRole("button", { name: "종류" }));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /이미지/ })).toHaveTextContent("3");
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /파일/ }));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /이미지/ })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(tile("notes-scan.pdf")).toBeVisible();
		await expect.element(tile("desk-morning.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "모든 폴더" })).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: "필터 지우기" }));
		await expect.element(tile("desk-morning.jpg")).toBeVisible();
	});

	it("09-1 a sort is a menu with one mark of its own", async () => {
		await openAssets();
		await userEvent.click(main().getByRole("button", { name: "최근 올린순" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "크기순" }));
		await expect.element(main().getByRole("button", { name: "크기순" })).toBeVisible();
	});

	it("09-1 [flow 6·31] with no storage it says so, with the way to connect one and no way to upload", async () => {
		await NoStorage.run();
		await expect.element(main().getByText("미디어 저장소가 없어요")).toBeVisible();
		await expect.element(main().getByRole("link", { name: "연결 방법" })).toBeVisible();
		await expect.element(main().getByRole("button", { name: "올리기" })).not.toBeInTheDocument();
	});
});

describe("uploading", () => {
	it("09-3 [flow 6·01, 6·03] files dropped on the page go up into the open folder and become tiles", async () => {
		await openAssets();
		const area = main().getByText("desk-morning.jpg").element();
		dropFiles(area, [await jpeg("new-photo.jpg")]);
		await expect.element(tile("new-photo.jpg")).toBeVisible();
		await expect.element(main().getByText(/320×180 · 사용 안 함/)).toBeVisible();
	});

	it("09-1 [flow 6·02] files dropped on a folder go into that folder, not the open one", async () => {
		await openAssets();
		dropFiles(folder("covers").element(), [await jpeg("into-covers.jpg")]);
		await expect.element(folder("covers")).toHaveTextContent("2");
		await expect.element(tile("into-covers.jpg")).not.toBeInTheDocument();
		await userEvent.click(folder("covers"));
		await expect.element(tile("into-covers.jpg")).toBeVisible();
	});

	it("09-1 [flow 6·04, 6·35] a file the library does not take stays in place with the reason, and can be taken out", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [named("setup.exe", [0x4d, 0x5a])]);
		await expect.element(main().getByText("이미지 · PDF · ZIP · 텍스트만")).toBeVisible();
		await userEvent.click(main().getByRole("button", { name: "빼기" }));
		await expect.element(main().getByText("setup.exe")).not.toBeInTheDocument();
	});

	it("09-1 [flow 6·04] a picture that will not read says so", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			named("broken.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
		]);
		await expect.element(main().getByText("읽을 수 없는 그림")).toBeVisible();
	});

	it("09-1 [flow 6·04] a file over the limit says how big and offers shrinking only for a picture", async () => {
		await openAssets();
		const big = new Uint8Array(11 * 1024 * 1024);
		big.set(await samplePhoto("#000000", "#ffffff"));
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			new File([big.buffer], "huge.jpg", { type: "image/jpeg" }),
			new File([big.slice().fill(0x25, 0, 1).buffer], "huge.pdf"),
		]);
		await expect.element(main().getByText("11 MB · 10 MB까지")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "줄여서 다시" })).toBeVisible();
	});

	it("09-1 [flow 6·34] a PDF goes up with no picture, its type on the tile", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			new File([new TextEncoder().encode("%PDF-1.7")], "price-list.pdf"),
		]);
		await expect.element(tile("price-list.pdf")).toBeVisible();
		await expect.element(main().getByText(/8 B · 사용 안 함/)).toBeVisible();
	});
});

describe("a file", () => {
	it("09-2 [flow 6·16] opening a file shows its name, folder, measures and uses beside the grid, and no alt text anywhere", async () => {
		await openAssets();
		await userEvent.click(tile("cybersecurity-code.jpg"));
		const panel = page.getByRole("complementary");
		await expect.element(panel.getByRole("textbox", { name: "파일 이름" })).toHaveValue("cybersecurity-code");
		await expect.element(panel.getByText("쓰는 곳 · 1")).toBeVisible();
		await expect.element(panel.getByRole("link", { name: "보안 이야기" })).toBeVisible();
		await expect.element(panel.getByText("대표 이미지 · 본문")).toBeVisible();
		await expect.element(panel.getByText(/대체 텍스트|캡션/)).not.toBeInTheDocument();
	});

	it("[overflow-after-add] the panel stands beside the grid, all of it inside the window, and the grid makes room", async () => {
		await openAssets();
		await userEvent.click(tile("cybersecurity-code.jpg"));
		const panel = page.getByRole("complementary").element().getBoundingClientRect();
		const picked = tile("cybersecurity-code.jpg").element().getBoundingClientRect();
		expect(panel.left).toBeGreaterThanOrEqual(picked.right);
		expect(panel.top).toBeLessThan(picked.bottom);
		expect(panel.right).toBeLessThanOrEqual(window.innerWidth);
		expect(scrollsSideways(main().element())).toEqual([]);
		await userEvent.click(page.getByRole("complementary").getByRole("button", { name: "닫기" }));
		await expect.element(page.getByRole("complementary")).not.toBeInTheDocument();
	});

	it("09-1 a new name is saved with the extension kept, and only after pressing save", async () => {
		await openAssets();
		await userEvent.click(tile("seoul-night.jpg"));
		const panel = page.getByRole("complementary");
		await userEvent.fill(panel.getByRole("textbox", { name: "파일 이름" }), "seoul-at-night");
		await expect.element(tile("seoul-night.jpg")).toBeVisible();
		await userEvent.click(panel.getByRole("button", { name: "저장" }));
		await expect.element(tile("seoul-at-night.jpg")).toBeVisible();
	});

	it("09-1 [flow 6·17] a tile's right-click menu lists where it is used, and moves it to a folder", async () => {
		await openAssets();
		await userEvent.click(tile("desk-morning.jpg"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "쓰는 곳" }));
		await expect.element(page.getByRole("menuitem", { name: /아침 책상/ })).toHaveTextContent("대표 이미지");
		await userEvent.keyboard("{Escape}");
		await userEvent.keyboard("{Escape}");
		await userEvent.click(tile("seoul-night.jpg"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "폴더로" }));
		await userEvent.click(page.getByRole("menuitem", { name: "Blog Assets / covers" }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toHaveTextContent("2");
	});

	it("09-5 [flow 6·18] the panel's menu has replacing and the trash (the file chooser itself is L5's)", async () => {
		await openAssets();
		await userEvent.click(tile("cybersecurity-code.jpg"));
		const panel = page.getByRole("complementary");
		await userEvent.click(panel.getByRole("button", { name: "더 보기" }));
		await expect.element(page.getByRole("menuitem", { name: "파일 바꾸기" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "휴지통으로" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
	});
});

describe("many files at once", () => {
	it("09-1 [flow 6·20, 6·21] picked files show the bar in place of the tools, and go to a folder together", async () => {
		await openAssets();
		await userEvent.click(page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "notes-scan.pdf 고르기" }));
		await expect.element(main().getByText("2개 선택")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "종류" })).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: "폴더로" }));
		await expect
			.element(page.getByRole("menuitem", { name: "최상위" }).or(page.getByRole("menuitem", { name: "맨 위" })))
			.toBeVisible();
		await userEvent.click(page.getByRole("menuitem", { name: "Blog Assets / covers" }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toHaveTextContent("3");
		await expect.element(main().getByRole("button", { name: "종류" })).toBeVisible();
	});

	it("09-1 [dragging] [dropped] a tile dragged onto a folder moves there, and a picked group goes together", async () => {
		await openAssets();
		const source = tile("seoul-night.jpg").element();
		const target = folder("covers").element();
		const dataTransfer = new DataTransfer();
		source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
		for (const type of ["dragenter", "dragover"])
			target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		await expect.element(toast("covers에 올려요")).toBeVisible();
		target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toHaveTextContent("2");
	});

	it("09-1 [overflow-after-add] long file names keep to their tiles: nothing scrolls sideways", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			await jpeg(`${"아주 긴 파일 이름 ".repeat(8)}.jpg`),
			await jpeg(`${"another very long name ".repeat(8)}.jpg`),
		]);
		await expect
			.element(
				main()
					.getByText(/320×180 · 사용 안 함/)
					.first(),
			)
			.toBeVisible();
		expect(scrollsSideways(main().element())).toEqual([]);
	});
});

describe("the trash", () => {
	it("09-4 [flow 6·27] a file nobody uses goes at once, and the toast takes it back", async () => {
		await openAssets();
		await userEvent.click(page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" }));
		await userEvent.click(main().getByRole("button", { name: "휴지통으로" }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await userEvent.click(toast("1개를 휴지통으로 옮겼어요").getByRole("button", { name: "되돌리기" }));
		await expect.element(tile("seoul-night.jpg")).toBeVisible();
	});

	it("09-4 [flow 6·28] of a file in use and one not, the used one stays and the toast shows it", async () => {
		await openAssets();
		await userEvent.click(page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "desk-morning.jpg 고르기" }));
		await userEvent.click(main().getByRole("button", { name: "휴지통으로" }));
		const said = toast("1개를 옮겼고 1개는 쓰이고 있어 남겼어요");
		await expect.element(said).toBeVisible();
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(tile("desk-morning.jpg")).toBeVisible();
		await userEvent.click(said.getByRole("button", { name: "보기" }));
		await expect.element(page.getByRole("complementary").getByText("쓰는 곳 · 1")).toBeVisible();
	});

	it("09-4 a focused tile and Delete: the keyboard's way to the same trash", async () => {
		await openAssets();
		tile("seoul-night.jpg").element().focus();
		await userEvent.keyboard("{Delete}");
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
	});

	it("09-4 [flow 6·11] a folder nobody's files are used from goes with no question, and the toast takes it back", async () => {
		await Top.run();
		await userEvent.click(folder("Wallpapers"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "폴더 지우기" }));
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.element(folder("Wallpapers")).not.toBeInTheDocument();
		await userEvent.click(toast("Wallpapers 폴더를 휴지통으로 옮겼어요").getByRole("button", { name: "되돌리기" }));
		await expect.element(folder("Wallpapers")).toBeVisible();
	});

	it("09-4 [flow 6·12] a folder with a file in use stays, with that file, and the toast opens it", async () => {
		await Top.run();
		await userEvent.click(folder("Blog Assets"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "폴더 지우기" }));
		const said = toast("쓰는 곳이 있어 폴더와 함께 남겼어요");
		await expect.element(said).toBeVisible();
		await userEvent.click(said.getByRole("button", { name: "보기" }));
		await expect.element(heading()).toHaveTextContent("Blog Assets");
		await expect.element(tile("desk-morning.jpg")).toBeVisible();
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
	});
});

describe("the sidebar", () => {
	it("09-1 opening the library shows its folder tree; a row opens that folder and stays picked", async () => {
		await Top.run();
		const tree = page.getByRole("list", { name: "폴더" });
		const row = tree.getByRole("link", { name: /Blog Assets/ });
		await expect.element(row).toBeVisible();
		await userEvent.click(row);
		await expect.element(heading()).toHaveTextContent("Blog Assets");
		await expect.element(row).toHaveAttribute("aria-current", "page");
	});

	it("09-1 T99 a tile dropped on a tree row moves there", async () => {
		await openAssets();
		const tree = page.getByRole("list", { name: "폴더" });
		const source = tile("seoul-night.jpg").element();
		const target = tree.getByRole("link", { name: /Wallpapers/ }).element();
		const dataTransfer = new DataTransfer();
		source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
		for (const type of ["dragenter", "dragover", "drop"])
			target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(tree.getByRole("link", { name: /Wallpapers/ })).toHaveTextContent("1");
	});
});
