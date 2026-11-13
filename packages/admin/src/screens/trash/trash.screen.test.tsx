import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	dragPath,
	dropDrag,
	middleOf,
	rowHeights,
	spillingCells,
	wholeUnderPointer,
} from "../../../../../testing/input";
import * as stories from "./trash.stories";

const {
	Top,
	InFolder,
	InUrgentFolder,
	NarrowColumns,
	Searching,
	SearchingInFolder,
	NoMatch,
	PickedRightClick,
	FolderMenu,
	ItemPanel,
	FilePanel,
	Empty,
	ByAssistant,
	TrashedEntry,
	AskPublished,
	AskPointedAt,
} = composeStories(stories);

const main = () => page.getByRole("main");
const table = () => main().getByRole("table");
const row = (title: string) => table().getByRole("row").filter({ hasText: title });
const menuOf = async (title: string) => {
	await userEvent.click(row(title).getByRole("button", { name: "더 보기" }));
	return page.getByRole("menu");
};
/** The newest toast that says this: earlier tests' toasts may still be on the page, and the newest is first. */
const toast = (text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const dialog = () => page.getByRole("alertdialog");
const sidebarTrash = () => page.getByRole("navigation").getByRole("button", { name: /^휴지통/ });

describe("the trash (doc 11, flow 5)", () => {
	it("11-1 [flow 5·11] one row for each thing thrown away, as the lists draw theirs: an entry with its languages, a folder, a file; each says its kind and its days, in the warning tone under a week", async () => {
		await Top.run();
		await expect.element(row("첫 번째 글")).toHaveTextContent("KO +1");
		await expect.element(row("첫 번째 글")).toHaveTextContent("/posts/first-post");
		// An entry is one row whenever its languages got there: the translation thrown away before its source is in its source's row.
		await expect.element(row("리액트 19 마이그레이션")).toHaveTextContent("KO +1");
		await expect.element(table().getByText("React 19 migration")).not.toBeInTheDocument();
		await expect.element(row("시리즈 원고")).toHaveTextContent("글 2");
		await expect.element(row("diagrams")).toHaveTextContent("파일 3 · Blog Assets");
		// What a folder holds and where it was are words, in sans: mono is for an address (tokens.md).
		const note = row("diagrams").element().querySelector<HTMLElement>("[data-slot=row-title-note]");
		expect(note?.textContent).toBe("파일 3 · Blog Assets");
		expect(getComputedStyle(note as HTMLElement).fontFamily).not.toMatch(/mono/i);
		await expect.element(row("winter-01.jpg")).toHaveTextContent("미디어");
		await expect.element(row("연습장")).toHaveTextContent("메모");
		await expect.element(row("임시")).toHaveTextContent("태그");
		// What the folders hold is not listed beside them.
		await expect.element(table().getByText("시리즈 1: 시작")).not.toBeInTheDocument();
		await expect.element(row("첫 번째 글").getByText("30일 남음")).toBeVisible();
		const days = (title: string) => row(title).element().querySelector("[data-slot=trash-row-left]");
		expect(days("임시")).toHaveClass("text-monti-warning");
		expect(days("옛 소개 글")).not.toHaveClass("text-monti-warning");
		await expect.element(sidebarTrash()).toHaveTextContent("8");
	});

	it("11-1 every row is one line, as high as a list's, and a row's actions are all in its ⋯: restore, and delete for good", async () => {
		await Top.run();
		await expect.element(row("임시")).toBeVisible();
		const heights = [...table().element().querySelectorAll("tbody tr")].map(
			(each) => each.getBoundingClientRect().height,
		);
		expect(new Set(heights).size).toBe(1);
		expect(heights[0]).toBeLessThan(50);
		await expect.element(row("옛 소개 글").getByRole("button", { name: "복원" })).not.toBeInTheDocument();
		const menu = await menuOf("옛 소개 글");
		await expect.element(menu.getByRole("menuitem", { name: "복원" })).toBeVisible();
		await expect.element(menu.getByRole("menuitem", { name: "영구 삭제" })).toBeVisible();
	});

	it("11-1 [flow 5·11, 5·17] the kind column filters by kind, with a count for each; several can be on", async () => {
		await Top.run();
		await userEvent.click(table().getByRole("button", { name: "종류" }));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /게시글/ })).toHaveTextContent("4");
		await expect.element(page.getByRole("menuitemcheckbox", { name: /카테고리/ })).toHaveTextContent("0");
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /미디어/ }));
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /태그/ }));
		await expect.element(row("첫 번째 글")).not.toBeInTheDocument();
		await expect.element(row("winter-01.jpg")).toBeVisible();
		await expect.element(row("diagrams")).toBeVisible();
		await expect.element(row("임시")).toBeVisible();
	});

	it("11-1 [flow 5·12, 5·13] a folder opens in place; one entry restored from it brings the folder back, and the rest stay in the trash as rows of their own", async () => {
		await InFolder.run();
		await expect.element(main().getByRole("heading", { name: "시리즈 원고" })).toBeVisible();
		await expect.element(main().getByRole("button", { name: "휴지통 /" })).toBeVisible();
		await expect.element(main().getByRole("button", { name: "폴더 복원" })).toBeVisible();
		// The page head holds pills: a ghost one, as tall as the head's other controls (button.md).
		expect(getComputedStyle(main().getByRole("button", { name: "폴더 복원" }).element()).height).toBe("36px");
		await expect.element(row("시리즈 1: 시작")).toBeVisible();
		// Inside the folder a row does not repeat the folder's days.
		await expect.element(row("시리즈 1: 시작").getByText("30일 남음")).not.toBeInTheDocument();

		const menu = await menuOf("시리즈 1: 시작");
		await userEvent.click(menu.getByRole("menuitem", { name: "복원" }));
		await expect.element(toast("시리즈 원고 폴더와 함께 복원했습니다")).toBeVisible();
		// The folder has left the trash: the trash itself shows, with what the folder still holds there.
		await expect.element(main().getByRole("heading", { name: "휴지통" })).toBeVisible();
		await expect.element(row("시리즈 2: 리액트로 옮기기")).toHaveTextContent("시리즈 원고");
		await expect.element(row("시리즈 1: 시작")).not.toBeInTheDocument();
	});

	it("11-1 its columns work as every table's: the title sorts both ways, the language filters, and a width can be dragged", async () => {
		localStorage.removeItem("monti:trash-columns");
		await Top.run();
		const head = (name: string) => table().getByRole("columnheader", { name });
		const first = () => table().element().querySelector("tbody tr")?.textContent ?? "";
		await userEvent.click(table().getByRole("button", { name: "제목" }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오름차순" }));
		await expect.element(head("제목")).toHaveAttribute("aria-sort", "ascending");
		await expect.poll(first).toContain("diagrams");

		// A row's counted languages are named under the pointer, and written out once the column has the room.
		const languages = row("첫 번째 글").getByText("KO +1");
		await userEvent.hover(languages);
		await expect.poll(() => document.querySelector('[data-slot="tooltip-content"]')?.textContent).toBe("한국어, 영어");
		await userEvent.unhover(languages);
		const width = head("언어").element().getBoundingClientRect().width;
		(page.getByRole("separator", { name: "제목 열 너비 조절" }).element() as HTMLElement).focus();
		await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
		await expect.poll(() => head("언어").element().getBoundingClientRect().width).toBeGreaterThan(width);
		await expect.element(row("첫 번째 글")).toHaveTextContent("KO · EN");

		// By language: the entries with it in the trash. A folder and a file have none.
		await userEvent.click(table().getByRole("button", { name: "언어" }));
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /영어/ }));
		await userEvent.keyboard("{Escape}");
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(row("시리즈 원고")).not.toBeInTheDocument();
		await expect.element(row("첫 번째 글")).toBeVisible();
		await expect.element(row("리액트 19 마이그레이션")).toBeVisible();
		localStorage.removeItem("monti:trash-columns");
	});

	it("11-1 [flow 5·12] a folder's first row goes up, as the lists' does, and is not there while it searches", async () => {
		await SearchingInFolder.run();
		await expect.element(row("시리즈 2: 리액트로 옮기기")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "상위 폴더로" })).not.toBeInTheDocument();

		await InFolder.run();
		await userEvent.click(main().getByRole("button", { name: "상위 폴더로" }));
		await expect.element(main().getByRole("heading", { name: "휴지통" })).toBeVisible();
		await expect.element(row("시리즈 원고")).toBeVisible();
	});

	it("11-1 [flow 5·14] a search looks inside thrown-away folders and says which folder a row is in", async () => {
		await Searching.run();
		await expect.element(row("시리즈 2: 리액트로 옮기기")).toHaveTextContent("시리즈 원고 폴더 안");
		await expect.element(row("리액트 19 마이그레이션")).toBeVisible();
		await expect.element(row("연습장")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·14] inside a folder the search box says where it looks, and looks through the whole trash on request", async () => {
		await SearchingInFolder.run();
		await expect.element(row("시리즈 2: 리액트로 옮기기")).toBeVisible();
		await expect.element(row("리액트 19 마이그레이션")).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: /시리즈 원고/ }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "모든 폴더" }));
		await expect.element(row("리액트 19 마이그레이션")).toBeVisible();
	});

	it("11-1 a search that finds nothing says so, and clears on request", async () => {
		await NoMatch.run();
		await expect.element(table().getByText("맞는 것이 없습니다.")).toBeVisible();
		await userEvent.click(table().getByRole("button", { name: "필터 해제" }));
		await expect.element(row("첫 번째 글")).toBeVisible();
	});

	it("11-1 [flow 5·16] a right click on picked rows starts with how many they are and acts on them all", async () => {
		await PickedRightClick.run();
		const menu = page.getByRole("menu");
		await expect.element(menu).toHaveTextContent("2개 항목");
		await userEvent.click(menu.getByRole("menuitem", { name: "복원" }));
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(row("연습장")).not.toBeInTheDocument();
	});

	it("11-3 [flow 5·12] a folder deleted for good from its own menu says what goes with it", async () => {
		await FolderMenu.run();
		await userEvent.click(page.getByRole("menuitem", { name: "영구 삭제" }));
		await expect.element(dialog()).toHaveTextContent("폴더 안의 것도 함께 삭제합니다. 되돌릴 수 없습니다.");
		await userEvent.click(dialog().getByRole("button", { name: "영구 삭제" }));
		await expect.element(main().getByRole("heading", { name: "휴지통" })).toBeVisible();
		await expect.element(row("시리즈 원고")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·21] a restored post leaves the trash as a draft, and the toast opens it", async () => {
		await Top.run();
		const menu = await menuOf("옛 소개 글");
		await userEvent.click(menu.getByRole("menuitem", { name: "복원" }));
		await expect.element(toast("초안으로 복원했습니다").getByRole("button", { name: "열기" })).toBeVisible();
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(sidebarTrash()).toHaveTextContent("7");
	});

	it("11-3 [flow 5·23] deleting for good asks every time, says which address stays taken, and nothing stops it", async () => {
		await Top.run();
		const menu = await menuOf("옛 소개 글");
		await userEvent.click(menu.getByRole("menuitem", { name: "영구 삭제" }));
		await expect.element(dialog()).toHaveTextContent("영구 삭제할까요?");
		await expect
			.element(dialog())
			.toHaveTextContent("되돌릴 수 없습니다. 주소 /posts/about-old는 다시 쓸 수 없습니다.");
		await userEvent.click(dialog().getByRole("button", { name: "영구 삭제" }));
		await expect.element(toast("영구 삭제했습니다")).toBeVisible();
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();

		// A tag that four entries point at goes the same way: one question, no address to keep.
		const tagMenu = await menuOf("임시");
		await userEvent.click(tagMenu.getByRole("menuitem", { name: "영구 삭제" }));
		await expect.element(dialog()).toHaveTextContent("되돌릴 수 없습니다.");
		await userEvent.click(dialog().getByRole("button", { name: "영구 삭제" }));
		await expect.element(row("임시")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·25] picked rows are restored or deleted from the bar; Delete on a picked row asks about them all", async () => {
		await Top.run();
		await userEvent.click(page.getByRole("checkbox", { name: "옛 소개 글 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "연습장 고르기" }));
		await expect.element(table().getByText("2개 선택")).toBeVisible();
		await expect.element(table().getByRole("button", { name: "복원" })).toBeVisible();
		await userEvent.keyboard("{Delete}");
		await expect.element(dialog()).toHaveTextContent("영구 삭제할까요?");
		// Several rows: the question says how many go, and names no one address.
		await expect.element(dialog()).toHaveTextContent("2개를 영구 삭제합니다. 되돌릴 수 없습니다.");
		await userEvent.click(dialog().getByRole("button", { name: "취소" }));
		await userEvent.click(table().getByRole("button", { name: "복원" }));
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(row("연습장")).not.toBeInTheDocument();
		await expect.element(row("첫 번째 글")).toBeVisible();
	});

	it("11-1 [flow 5·26, 5·28] emptying asks with how many go, and an empty trash is one line with nothing to do", async () => {
		await Top.run();
		expect(getComputedStyle(main().getByRole("button", { name: "비우기" }).element()).height).toBe("36px");
		await userEvent.click(main().getByRole("button", { name: "비우기" }));
		await expect.element(dialog()).toHaveTextContent("휴지통을 비울까요?");
		await expect.element(dialog()).toHaveTextContent("8개를 영구 삭제합니다.");
		await userEvent.click(dialog().getByRole("button", { name: "비우기" }));
		await expect.element(toast("8개를 영구 삭제했습니다")).toBeVisible();
		await expect.element(main().getByText("휴지통이 비었습니다.")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "비우기" })).not.toBeInTheDocument();
		await expect.element(main().getByRole("button", { name: "검색" })).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·28] a trash that never held anything says so", async () => {
		await Empty.run();
		await expect.element(main().getByText("휴지통이 비었습니다.")).toBeVisible();
		await expect.element(main().getByRole("table")).not.toBeInTheDocument();
	});

	it("11-1 a column dragged to its narrowest cuts its value inside the cell, and the cell says it whole", async () => {
		await NarrowColumns.run();
		const kind = row("옛 소개 글").getByRole("cell", { name: "게시글" });
		await expect.element(kind).toBeVisible();
		// The row's link covers the row: the pointer still finds what each cut value says.
		expect(wholeUnderPointer(kind.getByText("게시글").element())).toBe("게시글");
		expect(wholeUnderPointer(row("옛 소개 글").getByText("23일 남음").element())).toBe("23일 남음");
		// No cell's words run over the next column: each is clipped at its own edge.
		expect(spillingCells(table().element())).toEqual([]);
		// What stands after a title is cut first, so it says itself whole too.
		expect(wholeUnderPointer(row("첫 번째 글").getByText("/posts/first-post").element())).toBe("/posts/first-post");
		// A cell that says its value keeps its row as tall as the others (the way up, in a folder, has none).
		expect(rowHeights(table().element())).toHaveLength(1);
		await InFolder.run();
		await expect.element(row("시리즈 1: 시작")).toBeVisible();
		expect(rowHeights(table().element())).toHaveLength(1);
	});

	it("11-1 a press anywhere on a row opens it, on what stands over the row's link too: its languages, its kind, its address", async () => {
		for (const words of ["KO", "게시글", "/posts/about-old"]) {
			await Top.run();
			await userEvent.click(row("옛 소개 글").getByText(words, { exact: true }));
			await expect.poll(() => location.hash).toMatch(/^#\/c\/post\//);
		}
		// What has its own press keeps it: the row's menu opens, and the row does not.
		await Top.run();
		await menuOf("옛 소개 글");
		await expect.element(page.getByRole("menuitem", { name: "복원" })).toBeVisible();
		expect(location.hash).toBe("#/trash");
		await userEvent.keyboard("{Escape}");
	});

	it("11-1 days under a week change their color only: mono in a folder's head, the values' size in a panel", async () => {
		await InUrgentFolder.run();
		const heading = main().getByRole("heading", { name: "시리즈 원고" });
		await expect.element(heading).toBeVisible();
		const days = main().getByText("3일 남음").first().element();
		expect(getComputedStyle(days).fontFamily).toBe(getComputedStyle(days.parentElement as HTMLElement).fontFamily);
		expect(getComputedStyle(days).fontFamily).toMatch(/mono/i);

		await ItemPanel.run();
		const panel = page.getByRole("complementary", { name: "임시" });
		const urgent = panel.getByText("3일 남음").element();
		const other = panel.getByText("태그", { exact: true }).element();
		expect(getComputedStyle(urgent).fontSize).toBe(getComputedStyle(other).fontSize);
	});

	it("11-1 [flow 5·19] an item opens beside the list, to read: who points at it, with restore as its one pill", async () => {
		await ItemPanel.run();
		const panel = page.getByRole("complementary", { name: "임시" });
		await expect.element(panel).toHaveTextContent("남은 날3일 남음");
		await expect.element(panel).toHaveTextContent("가리키는 글 · 4");
		await expect.element(panel.getByRole("link", { name: "여름 여행기" })).toBeVisible();
		// Where an entry is from is words, a size under the entry's name, in the panel's own type.
		const [name, from] = [
			panel.getByRole("link", { name: "여름 여행기" }).element(),
			panel.getByText("게시글", { exact: true }).first().element(),
		];
		expect(getComputedStyle(from).fontSize).toBe("12px");
		expect(getComputedStyle(from).fontFamily).toBe(getComputedStyle(name).fontFamily);
		await expect.element(panel.getByRole("textbox")).not.toBeInTheDocument();
		await userEvent.click(panel.getByRole("button", { name: "복원" }));
		await expect.element(toast("복원했습니다")).toBeVisible();
		await expect.element(panel).not.toBeInTheDocument();
		await expect.element(row("임시")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·20] a file opens beside the list as the library shows it, to read, with no alt text", async () => {
		await FilePanel.run();
		const panel = page.getByRole("complementary", { name: "winter-01.jpg" });
		await expect.element(panel).toHaveTextContent("남은 날28일 남음");
		await expect.element(panel).toHaveTextContent("Blog Assets");
		await expect.element(panel).toHaveTextContent("쓰는 곳 · 0");
		expect(panel.element().textContent).not.toContain("대체 텍스트");
		await userEvent.click(panel.getByRole("button", { name: "더 보기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "영구 삭제" }));
		await userEvent.click(dialog().getByRole("button", { name: "영구 삭제" }));
		await expect.element(row("winter-01.jpg")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·15] what the assistant threw away has its mark before the days", async () => {
		await ByAssistant.run();
		await expect.element(row("여름 여행기").getByRole("img", { name: "어시스턴트가 버림" })).toBeVisible();
		await expect.element(row("첫 번째 글").getByRole("img", { name: "어시스턴트가 버림" })).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·18] an entry in the trash opens read only, says how long it stays, and comes back as a draft where it is", async () => {
		await TrashedEntry.run();
		await expect.element(page.getByText("휴지통에 있는 글입니다")).toBeVisible();
		await expect.element(page.getByText("23일 남음")).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "영구 삭제" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("textbox", { name: "제목" })).toBeDisabled();
		await userEvent.click(page.getByRole("button", { name: "복원" }));
		await expect.element(page.getByText("휴지통에 있는 글입니다")).not.toBeInTheDocument();
		await expect.element(page.getByRole("textbox", { name: "제목" })).toBeEnabled();
		await expect.element(page.getByRole("button", { name: "발행하기" })).toBeVisible();
		// The tag it points at is still in the trash: the field names it and says so (doc 08).
		await expect.element(page.getByText("임시 · 휴지통에 있음")).toBeVisible();
	});
});

describe("into the trash (doc 11, principle 2)", () => {
	it("11-2 [flow 5·10] a published entry asks first, saying what leaves the site and which translation goes along; the toast takes it back", async () => {
		await AskPublished.run();
		await expect.element(dialog()).toHaveTextContent("휴지통으로 옮길까요?");
		await expect.element(dialog()).toHaveTextContent("‘여름 여행기’의 공개가 끝납니다. 영어 번역도 함께 옮깁니다.");
		await userEvent.click(dialog().getByRole("button", { name: "휴지통으로" }));
		await expect.element(row("여름 여행기")).not.toBeInTheDocument();
		// The first question is gone, fade and all, before the undo is pressed: while it fades it is still a question window in the page, and
		// "the undo asks nothing" read at that moment found it.
		await expect.element(dialog()).not.toBeInTheDocument();
		await userEvent.click(toast("휴지통으로 옮겼습니다").getByRole("button", { name: "되돌리기" }));
		// Taken back, it is as it was: published.
		await expect.element(row("여름 여행기")).toHaveTextContent("발행됨");
		// A toast's undo takes back what was done a moment ago: it ran at once and asked nothing (only the activity log's undo asks).
		expect(document.querySelector("[role=alertdialog]")).toBeNull();
	});

	it("11-2 an item that published entries point at asks first: the site loses it there", async () => {
		await AskPointedAt.run();
		await expect.element(dialog()).toHaveTextContent("발행된 글 3편에서 이 태그가 빠집니다.");
		await userEvent.click(dialog().getByRole("button", { name: "휴지통으로" }));
		await expect.element(row("리액트")).not.toBeInTheDocument();
		await expect.element(toast("휴지통으로 옮겼습니다")).toBeVisible();
	});

	it("[dragging] [dropped] a column's edge held and dragged stays under the pointer and moves no other edge; let go, the column keeps its width", async () => {
		await Top.run();
		await expect.element(row("첫 번째 글")).toBeVisible();
		// The language column comes with the schema's read, after the rows': the edges are measured once every column is there.
		await expect.element(table().getByRole("columnheader", { name: "언어" })).toBeVisible();
		const heads = () =>
			[...table().element().querySelectorAll("th")].map((th) => Math.round(th.getBoundingClientRect().right));
		const edge = table().getByRole("separator").first().element();
		const at = [...table().element().querySelectorAll("th")].findIndex((th) => th.contains(edge));
		const before = heads();
		const from = middleOf(edge);
		await dragPath([from, { x: from.x - 40, y: from.y }], { hold: true });
		const moved = before.map((right, index) => (index === at ? right - 40 : right));
		await expect.poll(heads).toEqual(moved);
		await dropDrag();
		await expect.poll(heads).toEqual(moved);
	});

	it("영구 삭제 confirmed with the keyboard takes its row away, and the focus goes to the row after it, not to the page; with a pointer nothing is moved", async () => {
		await Top.run();
		await expect.element(row("옛 소개 글")).toBeVisible();
		const lines = () => [...table().element().querySelectorAll<HTMLElement>("tbody tr")];
		const at = lines().findIndex((line) => line.textContent?.includes("옛 소개 글"));
		const after = lines()[at + 1];
		if (!after) throw new Error("no row after it");
		const more = () => row("옛 소개 글").getByRole("button", { name: "더 보기" }).element() as HTMLElement;
		for (let presses = 0; presses < 80 && document.activeElement !== more(); presses++) await userEvent.tab();
		expect(document.activeElement).toBe(more());
		await userEvent.keyboard("{Enter}");
		const purge = () => page.getByRole("menuitem", { name: "영구 삭제" }).element();
		await expect.element(page.getByRole("menuitem", { name: "영구 삭제" })).toBeVisible();
		for (let presses = 0; presses < 6 && document.activeElement !== purge(); presses++)
			await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog()).toHaveTextContent("영구 삭제할까요?");
		const confirm = () => dialog().getByRole("button", { name: "영구 삭제" }).element();
		for (let presses = 0; presses < 4 && document.activeElement !== confirm(); presses++) await userEvent.tab();
		expect(document.activeElement).toBe(confirm());
		await userEvent.keyboard("{Enter}");
		await expect.element(toast("영구 삭제했습니다")).toBeVisible();
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.poll(() => after.contains(document.activeElement)).toBe(true);

		// With a pointer: the row goes, and nothing takes the focus.
		const next = after.textContent ?? "";
		await userEvent.click(after.querySelector('button[aria-label="더 보기"]') as HTMLElement);
		await userEvent.click(page.getByRole("menuitem", { name: "영구 삭제" }));
		await userEvent.click(dialog().getByRole("button", { name: "영구 삭제" }));
		await expect.poll(() => lines().some((line) => line.textContent === next)).toBe(false);
		expect(table().element().contains(document.activeElement)).toBe(false);
	});

	it("복원 from a row's ⋯ with the keyboard takes its row away, and the focus goes to the row after it", async () => {
		await Top.run();
		await expect.element(row("옛 소개 글")).toBeVisible();
		const lines = () => [...table().element().querySelectorAll<HTMLElement>("tbody tr")];
		const after = lines()[lines().findIndex((line) => line.textContent?.includes("옛 소개 글")) + 1];
		if (!after) throw new Error("no row after it");
		const more = () => row("옛 소개 글").getByRole("button", { name: "더 보기" }).element() as HTMLElement;
		for (let presses = 0; presses < 80 && document.activeElement !== more(); presses++) await userEvent.tab();
		await userEvent.keyboard("{Enter}");
		const restore = () => page.getByRole("menuitem", { name: "복원" }).element();
		await expect.element(page.getByRole("menuitem", { name: "복원" })).toBeVisible();
		for (let presses = 0; presses < 6 && document.activeElement !== restore(); presses++)
			await userEvent.keyboard("{ArrowDown}");
		await userEvent.keyboard("{Enter}");
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.poll(() => after.contains(document.activeElement)).toBe(true);
	});

	it("복원 from the menu opened on a row with the keyboard (Shift+F10) takes its row away, and the focus goes to the row after it", async () => {
		await Top.run();
		await expect.element(row("옛 소개 글")).toBeVisible();
		const lines = () => [...table().element().querySelectorAll<HTMLElement>("tbody tr")];
		const after = lines()[lines().findIndex((line) => line.textContent?.includes("옛 소개 글")) + 1];
		if (!after) throw new Error("no row after it");
		const title = () => row("옛 소개 글").element().querySelector<HTMLElement>("[data-slot=row-link]") as HTMLElement;
		for (let presses = 0; presses < 80 && document.activeElement !== title(); presses++) await userEvent.tab();
		expect(document.activeElement).toBe(title());
		title().dispatchEvent(
			new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }),
		);
		const restore = () => page.getByRole("menuitem", { name: "복원" }).element();
		await expect.element(page.getByRole("menuitem", { name: "복원" })).toBeVisible();
		for (let presses = 0; presses < 6 && document.activeElement !== restore(); presses++)
			await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(restore());
		await userEvent.keyboard("{Enter}");
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.poll(() => after.contains(document.activeElement)).toBe(true);
	});
});
