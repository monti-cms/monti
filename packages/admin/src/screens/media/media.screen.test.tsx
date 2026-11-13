import { toast as toastApi } from "@monti-cms/ui";
import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scrollsSideways, spillingCells, wholeUnderPointer } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import * as media from "./media.stories";
import { samplePhoto } from "./media.stories";

const {
	Top,
	NoStorage,
	ListView,
	ListViewNarrowColumns,
	FilePanel,
	FilePanelManyUses,
	SearchingInFolder,
	KindChosenInFolder,
} = composeStories(media);

const main = () => page.getByRole("main");
const heading = () => main().getByRole("heading", { level: 1 });
const tile = (name: string) => main().getByRole("button", { name: new RegExp(name) });
const folder = (name: string) => main().getByRole("button", { name: new RegExp(`^${name}`) });
/** The newest toast that says this: earlier tests' toasts may still be on the page, and the newest is first. */
const toast = (text: string) => page.getByRole("listitem").filter({ hasText: text }).first();

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

describe("the assistant's proposals for a file (doc 10, item 17; T108)", () => {
	it("10-1 the bubble counts only what the panel draws: the proposed name, not the proposed move; taken and saved, the name is the file's and the move still waits", async () => {
		let site: StorySite | undefined;
		const [load] = media.FilePanelProposedName.loaders as [() => Promise<{ site: StorySite }>];
		await composeStory(
			{
				...media.FilePanelProposedName,
				loaders: [
					async () => {
						const loaded = await load();
						site = loaded.site;
						return loaded;
					},
				],
			},
			media.default,
		).run();
		const panel = page.getByRole("complementary");
		const name = panel.getByRole("textbox", { name: "파일 이름" });
		// One proposal to walk, though two wait for this file.
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "모두 받기" }));
		await expect.element(name).toHaveValue("code-on-screen");
		await expect.element(page.getByRole("button", { name: "모두 받기" })).not.toBeInTheDocument();
		await userEvent.click(panel.getByRole("button", { name: "저장" }));
		await expect.element(tile("code-on-screen.jpg")).toBeVisible();
		const made = site as StorySite;
		const states = await made.db
			.selectFrom("monti_proposal_item")
			.select(["operation", "state"])
			.orderBy("position")
			.execute();
		expect(states).toEqual([
			{ operation: "media.update", state: "applied" },
			{ operation: "media.moveToFolder", state: "pending" },
		]);
		// The move that waits draws no bubble here.
		await expect.element(page.getByText("1 / 1")).not.toBeInTheDocument();
	});
});

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

	it('09-1 [flow 6·16] a file\'s right-click menu says "상세": its panel opens beside the grid, on the same screen', async () => {
		await Top.run();
		await userEvent.click(tile("top-level-photo.jpg"), { button: "right" });
		await expect.element(page.getByRole("menuitem", { name: "열기" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitem", { name: "상세" }));
		await expect.element(page.getByRole("complementary").getByRole("textbox", { name: "파일 이름" })).toBeVisible();
		await expect.element(heading()).toHaveTextContent("미디어");
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

	it("09-1 T113 [flow 6·14] the list view is the post table: its column names are the one row under the title, as wide as its line, and say what it is sorted by", async () => {
		await ListView.run();
		const table = main().getByRole("table");
		for (const name of ["이름", "사용", "종류", "크기", "치수", "올린 날"])
			await expect.element(table.getByRole("columnheader", { name })).toBeVisible();
		await expect
			.element(table.getByRole("columnheader", { name: "올린 날" }))
			.toHaveAttribute("aria-sort", "descending");
		// No filter row over it (2026-11-10, owner): the filters and the order are the columns' menus.
		expect(main().element().querySelector("[data-slot=page-toolbar]")).toBeNull();
		const line = main().element().querySelector("[data-slot=page-header]")?.getBoundingClientRect();
		const box = table.element().getBoundingClientRect();
		expect(Math.round(box.top)).toBe(Math.round(line?.bottom ?? 0));
		expect(box.left).toBe(line?.left);
		expect(box.right).toBe(line?.right);
	});

	it("09-1 T113 in the list view a column's menu filters and sorts: 종류 and 사용 tick values, 크기 orders by size", async () => {
		await ListView.run();
		const table = main().getByRole("table");
		const kind = table.getByRole("button", { name: "종류" });
		await userEvent.click(kind);
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /파일/ }));
		await userEvent.keyboard("{Escape}");
		await expect.element(main().getByRole("link", { name: "top-level-photo.jpg" })).not.toBeInTheDocument();
		await userEvent.click(kind);
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /파일/ }));
		await userEvent.keyboard("{Escape}");
		await expect.element(main().getByRole("link", { name: "top-level-photo.jpg" })).toBeVisible();
		await userEvent.click(table.getByRole("button", { name: "크기" }));
		// A column's menu sorts both ways, in the words every table uses.
		await userEvent.click(page.getByRole("menuitemradio", { name: "내림차순" }));
		await expect.element(table.getByRole("columnheader", { name: "크기" })).toHaveAttribute("aria-sort", "descending");
		await userEvent.click(table.getByRole("button", { name: "크기" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오름차순" }));
		await expect.element(table.getByRole("columnheader", { name: "크기" })).toHaveAttribute("aria-sort", "ascending");
		await userEvent.click(table.getByRole("button", { name: "올린 날" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오래전부터" }));
		await expect
			.element(table.getByRole("columnheader", { name: "올린 날" }))
			.toHaveAttribute("aria-sort", "ascending");
	});

	it("09-1 T113 [keys-move] a column's edge moves width between its two columns, and the width is still there next time", async () => {
		localStorage.removeItem("monti:media-columns");
		await ListView.run();
		const head = (name: string) => main().getByRole("table").getByRole("columnheader", { name });
		const width = (name: string) => head(name).element().getBoundingClientRect().width;
		await expect.element(head("크기")).toBeVisible();
		const [size, measure] = [width("크기"), width("치수")];
		(page.getByRole("separator", { name: "크기 열 너비 조절" }).element() as HTMLElement).focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect.poll(() => width("크기")).toBeGreaterThan(size);
		const widened = width("크기");
		expect(widened + width("치수")).toBe(size + measure);
		await ListView.run();
		await expect.element(head("크기")).toBeVisible();
		expect(width("크기")).toBe(widened);
		localStorage.removeItem("monti:media-columns");
	});

	it("09-1 T113 [reach] a row's check shows under the pointer; picking puts the bulk bar in the head's place, the one row under the title", async () => {
		await ListView.run();
		const row = main().getByRole("row").filter({ hasText: "top-level-photo.jpg" });
		const check = row.getByRole("checkbox");
		await userEvent.hover(row);
		await expect.element(check).toBeVisible();
		await userEvent.click(check);
		const bar = main().getByRole("toolbar", { name: "1개 선택" });
		await expect.element(bar).toBeVisible();
		await expect.element(main().getByRole("table").getByRole("columnheader", { name: "사용" })).not.toBeInTheDocument();
		// One row under the title: no filter row stands over the picks.
		expect(main().element().querySelector("[data-slot=page-toolbar]")).toBeNull();
		await expect.element(row).toHaveAttribute("aria-selected", "true");
		await userEvent.click(bar.getByRole("button", { name: "선택 해제" }));
		await expect.element(main().getByRole("table").getByRole("columnheader", { name: "사용" })).toBeVisible();
	});

	it("09-1 T113 with a file open beside it the list keeps a name that can be read: name and date, the panel saying the rest", async () => {
		await ListView.run();
		await userEvent.click(main().getByRole("link", { name: "top-level-photo.jpg" }));
		await expect.element(page.getByRole("complementary").getByRole("textbox", { name: "파일 이름" })).toBeVisible();
		const table = main().getByRole("table");
		await expect.element(table.getByRole("columnheader", { name: "사용" })).not.toBeInTheDocument();
		const name = table.getByRole("columnheader", { name: "이름" }).element().getBoundingClientRect();
		expect(name.width).toBeGreaterThan(120);
		expect(scrollsSideways(main().element())).toEqual([]);
		// The name's menu holds what the columns that stepped aside held, in every column menu's order: the orders, then the filters.
		await userEvent.click(table.getByRole("button", { name: "이름" }));
		const rows = [...page.getByRole("menu").element().querySelectorAll("[role^=menuitem]")];
		const kinds = rows.map((each) => each.getAttribute("role"));
		expect(kinds.lastIndexOf("menuitemradio")).toBeLessThan(kinds.indexOf("menuitemcheckbox"));
		await userEvent.keyboard("{Escape}");
	});

	it("09-1 T113 a column dragged to its narrowest cuts its value inside the cell, and the cell says it whole", async () => {
		await ListViewNarrowColumns.run();
		const row = main().getByRole("row").filter({ hasText: "top-level-photo.jpg" });
		await expect.element(row).toBeVisible();
		// Use, type, size, dimensions and the day: each clips at its own edge, whatever it holds, and the pointer finds what it says.
		const cells = [...row.element().querySelectorAll("td")].slice(1, 6);
		expect(cells.map((cell) => getComputedStyle(cell).overflowX)).toEqual(cells.map(() => "hidden"));
		expect(cells.map((cell) => wholeUnderPointer(cell.firstElementChild ?? cell))).toEqual(
			cells.map((cell) => cell.textContent),
		);
		expect(spillingCells(main().getByRole("table").element())).toEqual([]);
	});

	it("09-1 T113 going into a folder from its row lets go of what was picked", async () => {
		await ListView.run();
		const row = main().getByRole("row").filter({ hasText: "top-level-photo.jpg" });
		await userEvent.hover(row);
		await userEvent.click(row.getByRole("checkbox"));
		await expect.element(main().getByRole("toolbar", { name: "1개 선택" })).toBeVisible();
		await userEvent.click(main().getByRole("link", { name: "Blog Assets" }));
		await expect.element(main().getByText("desk-morning.jpg")).toBeVisible();
		await expect.element(main().getByRole("toolbar", { name: "1개 선택" })).not.toBeInTheDocument();
	});

	it("09-1 a very long name ends in … in the list view: the row's other columns stay on the page", async () => {
		await ListView.run();
		const name = `${"아주 긴 한글 파일 이름 ".repeat(20)}.txt`;
		dropFiles(main().getByText("top-level-photo.jpg").element(), [
			named(name, [...new TextEncoder().encode("긴 이름")], "text/plain"),
		]);
		const row = main().getByRole("row").filter({ hasText: "아주 긴 한글" });
		await expect.element(row).toHaveTextContent("TXT");
		expect(scrollsSideways(main().element())).toEqual([]);
		const type = row.getByText("TXT", { exact: true }).element().getBoundingClientRect();
		expect(type.right).toBeLessThanOrEqual(main().element().getBoundingClientRect().right);
	});

	it("09-1 [flow 6·16] the panel's fields start on one line: a file's name is not set further in than its folder", async () => {
		await FilePanel.run();
		const panel = page.getByRole("complementary");
		await expect.element(panel.getByRole("textbox", { name: "파일 이름" })).toBeVisible();
		const name = panel.getByRole("textbox", { name: "파일 이름" }).element().getBoundingClientRect();
		const folderField = panel.getByRole("combobox", { name: "폴더" }).element().getBoundingClientRect();
		const label = panel.getByText("파일 이름", { exact: true }).element().getBoundingClientRect();
		expect(name.left).toBe(folderField.left);
		expect(name.left).toBe(label.left);
	});

	it("09-1 [flow 6·16] a file used in many places: a long title is cut and its row stays one line, its places whole", async () => {
		await FilePanelManyUses.run();
		const panel = page.getByRole("complementary");
		const rowOf = (name: RegExp) => panel.getByRole("link", { name }).element().parentElement as HTMLElement;
		await expect.element(panel.getByRole("link", { name: /봄맞이/ })).toBeVisible();
		const long = rowOf(/봄맞이/);
		expect(long.offsetHeight).toBe(rowOf(/새벽 코딩/).offsetHeight);
		expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth);
		const places = long.lastElementChild?.getBoundingClientRect();
		expect(places?.right).toBeLessThanOrEqual(panel.element().getBoundingClientRect().right);
		expect(long.lastElementChild?.textContent).toContain("본문");
	});

	it("09-1 [flow 6·16] a file's address is in the panel's ⋯, not beside its picture", async () => {
		await FilePanel.run();
		const panel = page.getByRole("complementary");
		await expect.element(panel.getByRole("textbox", { name: "파일 이름" })).toBeVisible();
		expect(panel.getByRole("button", { name: "주소 복사" }).elements()).toHaveLength(0);
		await userEvent.click(panel.getByRole("button", { name: "더 보기" }));
		await expect.element(page.getByRole("menuitem", { name: "주소 복사" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "새 탭에서 열기" })).toBeVisible();
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
		await userEvent.click(main().getByRole("link", { name: "대표" }), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "이름 바꾸기" }));
		await userEvent.fill(page.getByRole("textbox", { name: "폴더 이름" }), "아주 긴 폴더 이름 ".repeat(20).trim());
		await userEvent.keyboard("{Enter}");
		await expect.element(main().getByRole("link", { name: /아주 긴 폴더 이름/ })).toBeVisible();
		expect(scrollsSideways(main().element())).toEqual([]);
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
		// The chip in the search box says where it looks (2026-11-10, owner: no row of its own).
		await userEvent.click(main().getByRole("button", { name: "Blog Assets, 찾을 곳" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "모든 폴더" }));
		await expect.element(tile("top-level-photo.jpg")).toBeVisible();
	});

	it("09-1 T113 [flow 6·32, 6·33] the kind menu counts and stays open; a chosen kind leaves a dot on its button, folders give way, and unticking takes it off", async () => {
		await openAssets();
		const kind = main().getByRole("button", { name: "종류" });
		await userEvent.click(kind);
		// What picking it would find: three here and one in the folder under it.
		await expect.element(page.getByRole("menuitemcheckbox", { name: /이미지/ })).toHaveTextContent("4");
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /파일/ }));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /이미지/ })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(tile("notes-scan.pdf")).toBeVisible();
		await expect.element(tile("desk-morning.jpg")).not.toBeInTheDocument();
		expect(kind.element().querySelector("[data-slot=filter-dot]")).not.toBeNull();
		// A filter looks for files as a search does: no folders. It looks in this folder: every folder is the search box's choice.
		await expect.element(folder("covers")).not.toBeInTheDocument();
		await expect.element(main().getByText("모든 폴더")).not.toBeInTheDocument();
		await userEvent.click(kind);
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /파일/ }));
		await userEvent.keyboard("{Escape}");
		await expect.element(tile("desk-morning.jpg")).toBeVisible();
		expect(kind.element().querySelector("[data-slot=filter-dot]")).toBeNull();
		await expect.element(folder("covers")).toBeVisible();
	});

	it("07-2 the stories of looking inside a folder: a search's chip says where it looks; a filter has none", async () => {
		await SearchingInFolder.run();
		await expect.element(main().getByRole("button", { name: "Blog Assets, 찾을 곳" })).toBeVisible();
		await KindChosenInFolder.run();
		await expect.element(main().getByRole("button", { name: /찾을 곳$/ })).not.toBeInTheDocument();
	});

	it("09-1 the grid's order is one menu: what it is ordered by, then which way", async () => {
		await openAssets();
		await userEvent.click(main().getByRole("button", { name: "올린 날 · 최근부터" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "크기" }));
		await expect.element(main().getByRole("button", { name: "크기 · 내림차순" })).toBeVisible();
		await userEvent.click(main().getByRole("button", { name: "크기 · 내림차순" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오름차순" }));
		await expect.element(main().getByRole("button", { name: "크기 · 오름차순" })).toBeVisible();
	});

	it("09-1 [flow 6·31] with no storage it says so, with the way to connect one and no way to upload", async () => {
		await NoStorage.run();
		await expect.element(main().getByText("미디어 저장소가 없습니다")).toBeVisible();
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

	it("09-1 [flow 6·04, 6·35] a file the library does not take is refused at once: a toast says why, and it takes no place", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [named("setup.exe", [0x4d, 0x5a])]);
		await expect.element(page.getByText("setup.exe · 지원하지 않는 형식")).toBeVisible();
		await expect.element(main().getByText("setup.exe")).not.toBeInTheDocument();
	});

	it("09-1 [flow 6·04] a picture that will not read shows only once it is read, and then leaves the grid", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			named("broken.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]),
		]);
		await expect.element(page.getByText("broken.png · 읽을 수 없는 파일")).toBeVisible();
		await expect.element(main().getByText("broken.png")).not.toBeInTheDocument();
	});

	it("09-1 [flow 6·04] a file over the limit is refused, and what came with it still goes up", async () => {
		await openAssets();
		const big = new Uint8Array(11 * 1024 * 1024);
		big.set(await samplePhoto("#000000", "#ffffff"));
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			new File([big.buffer], "huge.jpg", { type: "image/jpeg" }),
			await jpeg("fits.jpg"),
		]);
		await expect.element(page.getByText("huge.jpg · 10 MB 초과")).toBeVisible();
		await expect.element(main().getByText("huge.jpg")).not.toBeInTheDocument();
		await expect.element(tile("fits.jpg")).toBeVisible();
	});

	it("09-1 [flow 6·03] files refused for one reason are one toast, an iPhone's HEIC photo among them", async () => {
		await openAssets();
		dropFiles(main().getByText("desk-morning.jpg").element(), [
			named("photo.heic", [0, 0, 0, 24, ...new TextEncoder().encode("ftypheic"), 0, 0, 0, 0]),
			named("setup.exe", [0x4d, 0x5a]),
			named("clip.mov", [0, 0, 0, 0]),
		]);
		await expect.element(page.getByText("photo.heic 외 2개 · 지원하지 않는 형식")).toBeVisible();
	});

	it("09-1 T109 a file the library turns down once it is up (its folder is gone) leaves its place, and a toast says why: nothing is left to try again", async () => {
		const [load] = media.Top.loaders as [() => Promise<{ site: StorySite }>];
		const story = composeStory(
			{
				...media.Top,
				loaders: [
					async () => {
						const loaded = await load();
						const { transport } = loaded.site;
						loaded.site.transport = async (name, input, options) =>
							name === "media.upload"
								? {
										status: 422,
										body: { error: "check-failed", reason: { key: "folders.unknown", values: { id: "gone" } } },
									}
								: transport(name, input, options);
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		await expect.element(folder("Blog Assets")).toBeVisible();
		dropFiles(folder("Blog Assets").element(), [await jpeg("late.jpg")]);
		dropFiles(main().getByText("top-level-photo.jpg").element(), [await jpeg("here.jpg")]);
		await expect.element(toast("late.jpg · 지워진 폴더")).toBeVisible();
		await expect.element(toast("here.jpg · 지워진 폴더")).toBeVisible();
		await expect.element(main().getByText("here.jpg")).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "다시 올리기" })).not.toBeInTheDocument();
		// Five at once: three go up together, and the two still waiting leave with the first one told, in its toast.
		toastApi.dismiss();
		const said = vi.spyOn(toastApi, "error");
		dropFiles(
			main().getByText("top-level-photo.jpg").element(),
			await Promise.all(["1", "2", "3", "4", "5"].map((n) => jpeg(`many-${n}.jpg`))),
		);
		// What the toasts were asked to say: one for each of the three that were going up, and the first of them names the two that never started.
		await expect.poll(() => said.mock.calls.length).toBe(3);
		const texts = said.mock.calls.map(([text]) => String(text));
		expect(texts.filter((text) => /^many-\d\.jpg 외 2개 · 지워진 폴더$/.test(text))).toHaveLength(1);
		expect(texts.filter((text) => /^many-\d\.jpg · 지워진 폴더$/.test(text))).toHaveLength(2);
		said.mockRestore();
		await expect.element(main().getByText(/many-\d\.jpg/)).not.toBeInTheDocument();
		// An error's toast stays until it is closed: these two would lie over the tiles the next tests point at.
		toastApi.dismiss();
	});

	it("09-1 T109 any other answer of the library is still 'try again': bytes that are no longer there go up anew", async () => {
		const [load] = media.Top.loaders as [() => Promise<{ site: StorySite }>];
		let refused = 0;
		const story = composeStory(
			{
				...media.Top,
				loaders: [
					async () => {
						const loaded = await load();
						const { transport } = loaded.site;
						loaded.site.transport = async (name, input, options) =>
							name === "media.upload" && refused++ === 0
								? {
										status: 422,
										body: { error: "check-failed", reason: { key: "media.unknownKey", values: { key: "gone" } } },
									}
								: transport(name, input, options);
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		await expect.element(folder("Blog Assets")).toBeVisible();
		dropFiles(main().getByText("top-level-photo.jpg").element(), [await jpeg("again.jpg")]);
		const retry = main().getByRole("button", { name: "다시 올리기" });
		await expect.element(retry).toBeVisible();
		await userEvent.click(retry);
		await expect.element(main().getByText(/320×180 · 사용 안 함/)).toBeVisible();
		await expect.element(main().getByRole("button", { name: "다시 올리기" })).not.toBeInTheDocument();
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
		// The places are words: sans, as the row's name (tokens.md), not a key's mono.
		const places = page
			.getByRole("menuitem", { name: /아침 책상/ })
			.element()
			.querySelector<HTMLElement>("[data-slot=menu-value]");
		expect(places?.textContent).toBe("대표 이미지");
		expect(page.getByRole("menuitem", { name: "쓰는 곳" }).element().querySelector("svg")).not.toBeNull();
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
		// One menu, one way: every row has its icon (menu.md).
		for (const name of ["새 탭에서 열기", "주소 복사", "파일 바꾸기", "ID 복사", "휴지통으로"])
			expect(page.getByRole("menuitem", { name }).element().querySelector("svg")).not.toBeNull();
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
		await expect.element(page.getByRole("menuitem", { name: "최상위" })).toBeVisible();
		await userEvent.click(page.getByRole("menuitem", { name: "Blog Assets / covers" }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toHaveTextContent("3");
		await expect.element(main().getByRole("button", { name: "종류" })).toBeVisible();
	});

	it("09-1 [dragging] [dropped] a tile dragged onto a folder moves there, and a picked group goes together", async () => {
		await openAssets();
		const source = tile("seoul-night.jpg").element();
		const target = folder("covers").element();
		const hint = vi.spyOn(toastApi, "dropHint");
		const dataTransfer = new DataTransfer();
		source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
		for (const type of ["dragenter", "dragover"])
			target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		// The folder is marked as where the tile goes. The hint at the bottom is for files going up, and a move is not that: it is never asked for.
		await expect.element(folder("covers")).toHaveAttribute("data-drop-target");
		target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(folder("covers")).toHaveTextContent("2");
		expect(hint).not.toHaveBeenCalled();
		hint.mockRestore();
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
		await userEvent.click(toast("휴지통으로 옮겼습니다").getByRole("button", { name: "되돌리기" }));
		await expect.element(tile("seoul-night.jpg")).toBeVisible();
	});

	it("09-4 [flow 6·28] of a file in use and one not, the used one stays and the toast shows it", async () => {
		await openAssets();
		await userEvent.click(page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "desk-morning.jpg 고르기" }));
		await userEvent.click(main().getByRole("button", { name: "휴지통으로" }));
		const said = toast("1개를 옮겼고 1개는 쓰는 곳이 있어 남겼습니다");
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

	it("09-4 Delete takes what is picked and still there: a pick already gone does not refuse the rest", async () => {
		await openAssets();
		await userEvent.click(page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "notes-scan.pdf 고르기" }));
		await userEvent.click(tile("notes-scan.pdf"));
		await userEvent.click(page.getByRole("complementary").getByRole("button", { name: "더 보기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "휴지통으로" }));
		await expect.element(tile("notes-scan.pdf")).not.toBeInTheDocument();
		tile("seoul-night.jpg").element().focus();
		await userEvent.keyboard("{Delete}");
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
	});

	it("09-4 Delete with a tile's check focused: picked is picked, so the same trash", async () => {
		await openAssets();
		const check = page.getByRole("checkbox", { name: "seoul-night.jpg 고르기" });
		await userEvent.click(check);
		await expect.element(check).toHaveFocus();
		await userEvent.keyboard("{Delete}");
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
	});

	it("09-4 Delete in a tile's own menu is not a tile's Delete: the menu stays, and so does the file", async () => {
		await openAssets();
		await userEvent.hover(tile("seoul-night.jpg"));
		await userEvent.click(page.getByRole("button", { name: "더 보기" }).first());
		const menu = page.getByRole("menu");
		await expect.element(menu).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Delete}");
		await expect.element(menu).toBeVisible();
		await expect.element(tile("seoul-night.jpg")).toBeVisible();
	});

	it("09-4 [flow 6·11] a folder nobody's files are used from goes with no question, and the toast takes it back", async () => {
		await Top.run();
		await userEvent.click(folder("Wallpapers"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "폴더 지우기" }));
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.element(folder("Wallpapers")).not.toBeInTheDocument();
		await userEvent.click(toast("휴지통으로 옮겼습니다").getByRole("button", { name: "되돌리기" }));
		await expect.element(folder("Wallpapers")).toBeVisible();
	});

	it("09-4 [flow 6·12] a folder with a file in use stays, with that file, and the toast opens it", async () => {
		await Top.run();
		await userEvent.click(folder("Blog Assets"), { button: "right" });
		await userEvent.click(page.getByRole("menuitem", { name: "폴더 지우기" }));
		const said = toast("쓰는 곳이 있어 폴더와 함께 남겼습니다");
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
		const hint = vi.spyOn(toastApi, "dropHint");
		const dataTransfer = new DataTransfer();
		source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
		const fire = (type: string) =>
			target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		fire("dragenter");
		fire("dragover");
		// The row is marked, and nothing says "올리기": a move is not an upload, so the hint is never asked for.
		await expect.element(tree.getByRole("link", { name: /Wallpapers/ })).toHaveAttribute("data-droptarget");
		fire("drop");
		await expect.element(tile("seoul-night.jpg")).not.toBeInTheDocument();
		await expect.element(tree.getByRole("link", { name: /Wallpapers/ })).toHaveTextContent("1");
		expect(hint).not.toHaveBeenCalled();
		hint.mockRestore();
	});

	it("09-1 T106 files from outside dropped on a tree row go up into that folder, and the hint names it while they are over it", async () => {
		await openAssets();
		const row = page.getByRole("list", { name: "폴더" }).getByRole("link", { name: /Wallpapers/ });
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(await jpeg("to-wallpapers.jpg"));
		const fire = (type: string) =>
			row.element().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		fire("dragenter");
		fire("dragover");
		await expect.element(page.getByText("Wallpapers에 올리기")).toBeVisible();
		fire("drop");
		await expect.element(row).toHaveTextContent("1");
		// Not into the folder that is open.
		await expect.element(tile("to-wallpapers.jpg")).not.toBeInTheDocument();
		await userEvent.click(row);
		await expect.element(tile("to-wallpapers.jpg")).toBeVisible();
	});

	it("09-1 T106 with no storage nothing can go up, so a tree row takes no files and no hint says it would", async () => {
		const [load] = media.NoStorage.loaders as [() => Promise<{ site: StorySite }>];
		const story = composeStory(
			{
				...media.NoStorage,
				loaders: [
					async () => {
						const loaded = await load();
						await media.run(loaded.site.monti, "folders.create", {
							scope: "media",
							parentId: null,
							name: "Old photos",
						});
						return loaded;
					},
				],
			},
			media.default,
		);
		await story.run();
		const row = page.getByRole("list", { name: "폴더" }).getByRole("link", { name: /Old photos/ });
		await expect.element(row).toBeVisible();
		// The library has answered that it has no storage: until it does, nobody knows.
		await expect.element(main().getByText("미디어 저장소가 없습니다")).toBeVisible();
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(await jpeg("nowhere.jpg"));
		// A row that takes a drag keeps it to itself (it stops there); one that does not lets it go on up the page. That is known the moment the drag is over it.
		let passedOn = 0;
		const count = () => passedOn++;
		window.addEventListener("dragover", count);
		for (const type of ["dragenter", "dragover"])
			row.element().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		window.removeEventListener("dragover", count);
		expect(passedOn).toBe(1);
		await expect.element(row).not.toHaveAttribute("data-droptarget");
		await expect.element(page.getByText("Old photos에 올리기")).not.toBeInTheDocument();
	});

	it("09-1 T106 in the list view a folder's row takes files too: it is marked while they are over it, and they go into it, not the open folder", async () => {
		await ListView.run();
		const row = main().getByRole("row", { name: /Blog Assets/ });
		await expect.element(row).toBeVisible();
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(await jpeg("to-assets.jpg"));
		const fire = (type: string) =>
			row.element().dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
		fire("dragenter");
		fire("dragover");
		await expect.element(row).toHaveAttribute("data-drop-target");
		await expect.element(page.getByText("Blog Assets에 올리기")).toBeVisible();
		const before = Number(row.element().textContent?.match(/\d+/)?.[0]);
		fire("drop");
		await expect.element(row).not.toHaveAttribute("data-drop-target");
		await expect.poll(() => Number(row.element().textContent?.match(/\d+/)?.[0])).toBe(before + 1);
		await expect.element(main().getByText("to-assets.jpg")).not.toBeInTheDocument();
	});
});

describe("the library's states (components/list.md)", () => {
	/** The library at an address, after `also` changed what the site holds; `uploader` stands in for the site's when given. */
	const at = (
		hash: string,
		also: (site: StorySite) => Promise<void>,
		uploader?: (real: StorySite["uploader"]) => StorySite["uploader"],
	) => {
		const [load] = media.library(hash) as [() => Promise<{ site: StorySite }>];
		return composeStory(
			{
				loaders: [
					async () => {
						const loaded = await load();
						await also(loaded.site);
						if (uploader) loaded.site.uploader = uploader(loaded.site.uploader);
						return loaded;
					},
				],
			},
			media.default,
		).run();
	};

	it("a library with nothing in it is the lists' empty state, in the grid and in the list", async () => {
		const clear = async ({ db }: StorySite) => {
			await db.deleteFrom("media").execute();
			await db.deleteFrom("folders").execute();
		};
		await at("#/media", clear);
		await expect.element(main().getByText("아직 파일이 없습니다.")).toBeVisible();
		expect(main().getByText("아직 파일이 없습니다.").element().closest("[data-slot=empty]")).not.toBeNull();
		await at("#/media?view=list", clear);
		await expect.element(main().getByText("아직 파일이 없습니다.")).toBeVisible();
		expect(main().getByText("아직 파일이 없습니다.").element().closest("[data-slot=empty]")).not.toBeNull();
		// In place of the column names and the table, as the trash's empty state.
		expect(main().getByRole("columnheader").elements()).toHaveLength(0);
	});

	it("a search that finds nothing in the list says so in the table, and its button takes the search off", async () => {
		await at("#/media?view=list&q=없는파일", async () => {});
		await expect.element(main().getByText("맞는 파일이 없습니다.")).toBeVisible();
		await userEvent.click(main().getByRole("button", { name: "필터 해제" }));
		await expect.element(main().getByText("맞는 파일이 없습니다.")).not.toBeInTheDocument();
	});

	it("more files than a page: under them the range shown and the pages, as under every table", async () => {
		await at("#/media", async ({ db }) => {
			const one = await db.selectFrom("media").selectAll().where("trashed_at", "is", null).executeTakeFirstOrThrow();
			const copies = Array.from({ length: 100 }, (_, n) => ({
				...one,
				id: `copy-${n}`,
				name: `copy-${n}.jpg`,
				folder_id: null,
				original_key: `copy-${n}-original`,
				web_key: one.web_key === null ? null : `copy-${n}-web`,
			}));
			await db.insertInto("media").values(copies).execute();
		});
		await expect.element(main().getByText(/^1–100 \/ \d+$/)).toBeVisible();
		// The range and the pages stand on one row, as the trash's and the log's do.
		const range = main()
			.getByText(/^1–100 \/ \d+$/)
			.element();
		expect(range.closest("[data-slot=list-footer]")?.querySelector('a[href*="page=2"]')).not.toBeNull();
	});

	it("replacing a file: while it goes up the pill says so, and pressing again does nothing", async () => {
		let letGo = () => {};
		const held = new Promise<void>((resolve) => {
			letGo = resolve;
		});
		await at(
			"#/media",
			async () => {},
			(real) => async (file, options) => {
				await held;
				return real(file, options);
			},
		);
		await openFolderAssets();
		await userEvent.click(tile("cybersecurity-code.jpg"));
		const chosen = await jpeg("new-code.jpg");
		const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
			const files = new DataTransfer();
			files.items.add(chosen);
			Object.defineProperty(this, "files", { value: files.files });
			this.dispatchEvent(new Event("change"));
		});
		try {
			await userEvent.click(page.getByRole("complementary").getByRole("button", { name: "더 보기" }));
			await userEvent.click(page.getByRole("menuitem", { name: "파일 바꾸기" }));
		} finally {
			click.mockRestore();
		}
		const question = page.getByRole("alertdialog");
		await userEvent.click(question.getByRole("button", { name: "바꾸기" }));
		const going = question.getByRole("button", { name: "올리는 중…" });
		await expect.element(going).toBeVisible();
		await expect.element(going).toHaveAttribute("aria-busy", "true");
		letGo();
		await expect.element(question).not.toBeInTheDocument();
	});
});

async function openFolderAssets() {
	await userEvent.click(folder("Blog Assets"));
	await expect.element(heading()).toHaveTextContent("Blog Assets");
}
