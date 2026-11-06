import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { scrollsSideways } from "../../../../../testing/input";
import * as list from "./list.stories";

const { Main, Categories, Empty } = composeStories(list);

const main = () => page.getByRole("main");
const table = () => main().getByRole("table");
const row = (title: string) =>
	table()
		.getByRole("row")
		.filter({ has: page.getByRole("link", { name: title, exact: true }) });
const folderLink = (name: string) => table().getByRole("link", { name, exact: true });
const sidebarFolders = () => page.getByRole("list", { name: "폴더" });
const heading = () => main().getByRole("heading", { level: 1 });

async function newFolder(name: string) {
	await userEvent.click(page.getByRole("button", { name: "더 만들기" }));
	await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
	const field = page.getByRole("textbox", { name: "폴더 이름" });
	await expect.element(field).toHaveValue("새 폴더");
	// The new folder's row is the first of the rows while it is named.
	const first = (await table().getByRole("row").all())[1]?.element();
	expect(first?.contains(field.element())).toBe(true);
	await userEvent.keyboard(`${name}{Enter}`);
	await expect.element(folderLink(name)).toBeVisible();
}

/** A row's right-click menu, opened over its title as a person does. */
async function rowMenu(title: string) {
	await userEvent.click(table().getByText(title, { exact: true }), { button: "right" });
	return page.getByRole("menu");
}

async function moveToFolder(title: string, folder: string) {
	const menu = await rowMenu(title);
	await userEvent.click(menu.getByRole("menuitem", { name: "폴더로" }));
	await userEvent.click(page.getByRole("menuitem", { name: folder }));
	await expect.element(row(title)).not.toBeInTheDocument();
}

describe("folders in the list", () => {
	it("07-2 [flow 5·01] '새 폴더' in the pill's menu puts a new folder row on top, its name picked; typing replaces it, Enter keeps it", async () => {
		await Main.run();
		await newFolder("2024");
		await expect.element(sidebarFolders().getByRole("link", { name: /2024/ })).toBeVisible();
	});

	it("[line-start] '새 폴더' in a collection with no posts yet still makes a folder row to name", async () => {
		await Empty.run();
		await expect.element(main().getByText("아직 메모가 없어요.")).toBeVisible();
		await newFolder("아이디어");
		await expect.element(main().getByText("아직 메모가 없어요.")).not.toBeInTheDocument();
	});

	it("[flow 5·01] Esc in the new folder's name drops the folder", async () => {
		await Main.run();
		await userEvent.click(page.getByRole("button", { name: "더 만들기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "새 폴더" }));
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("textbox", { name: "폴더 이름" })).not.toBeInTheDocument();
		await expect.element(folderLink("새 폴더")).not.toBeInTheDocument();
	});

	it("07-2 [flow 5·02] a folder opens to its own rows under its path and '상위 폴더로'; both go back up", async () => {
		await Main.run();
		await userEvent.click(folderLink("시리즈 원고"));
		await expect.element(heading()).toHaveTextContent("시리즈 원고");
		await expect.element(row("지난 글 1")).toBeVisible();
		await expect.element(row("발행 후 고친 글")).not.toBeInTheDocument();
		await userEvent.click(table().getByRole("link", { name: "상위 폴더로" }));
		await expect.element(heading()).toHaveTextContent("게시글");
		await userEvent.click(folderLink("시리즈 원고"));
		await userEvent.click(main().getByRole("button", { name: "게시글 /" }));
		await expect.element(heading()).toHaveTextContent("게시글");
		await expect.element(folderLink("시리즈 원고")).toBeVisible();
	});

	it("07-2 [flow 5·03] a search in a folder looks in it first; '모든 폴더' widens it to the collection", async () => {
		await Main.run();
		await userEvent.click(folderLink("시리즈 원고"));
		await userEvent.click(main().getByRole("button", { name: "검색" }));
		await userEvent.keyboard("지난 글 1");
		await expect.element(row("지난 글 1")).toBeVisible();
		await expect.element(row("지난 글 10")).not.toBeInTheDocument();
		await userEvent.click(main().getByRole("button", { name: "모든 폴더" }));
		await expect.element(row("지난 글 10")).toBeVisible();
	});

	it("07-2 [flow 5·04] a folder row's right-click menu renames it in place and moves it into another folder", async () => {
		await Main.run();
		await newFolder("연재");
		const menu = await rowMenu("시리즈 원고");
		await userEvent.click(menu.getByRole("menuitem", { name: "이름 바꾸기" }));
		await userEvent.fill(page.getByRole("textbox", { name: "폴더 이름" }), "시리즈");
		await userEvent.keyboard("{Enter}");
		await expect.element(folderLink("시리즈")).toBeVisible();
		const again = await rowMenu("시리즈");
		await userEvent.click(again.getByRole("menuitem", { name: "옮기기" }));
		await userEvent.click(page.getByRole("menuitem", { name: "연재" }));
		await expect.element(folderLink("시리즈")).not.toBeInTheDocument();
		await userEvent.click(folderLink("연재"));
		await expect.element(folderLink("시리즈")).toBeVisible();
	});

	it("07-2 [flow 5·05] removing a folder with a published post asks first and says how many go off the site", async () => {
		await Main.run();
		await moveToFolder("첫 번째 글", "시리즈 원고");
		const menu = await rowMenu("시리즈 원고");
		await userEvent.click(menu.getByRole("menuitem", { name: "폴더 지우기" }));
		const dialog = page.getByRole("alertdialog");
		await expect.element(dialog).toHaveTextContent("글 3편");
		await expect.element(dialog).toHaveTextContent("1편은 사이트에서 내려가요");
		await userEvent.click(dialog.getByRole("button", { name: "휴지통으로" }));
		await expect.element(folderLink("시리즈 원고")).not.toBeInTheDocument();
		await expect.element(sidebarFolders()).not.toBeInTheDocument();
	});

	it("07-2 [flow 5·06] a folder of drafts goes to the trash without asking; the toast's undo brings it back", async () => {
		await Main.run();
		await newFolder("임시");
		await moveToFolder("가을 사진 정리", "임시");
		const menu = await rowMenu("임시");
		await userEvent.click(menu.getByRole("menuitem", { name: "폴더 지우기" }));
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		await expect.element(folderLink("임시")).not.toBeInTheDocument();
		// This removal's toast (an earlier test's toast may still be on the page).
		const toast = page.getByRole("listitem").filter({ hasText: "임시 폴더를 휴지통으로 옮겼어요" });
		await userEvent.click(toast.getByRole("button", { name: "되돌리기" }));
		await expect.element(folderLink("임시")).toBeVisible();
		await userEvent.click(folderLink("임시"));
		await expect.element(row("가을 사진 정리")).toBeVisible();
	});

	it("07-2 [flow 5·07] a row's '폴더로 ▸' moves its post into a folder", async () => {
		await Main.run();
		await moveToFolder("가을 사진 정리", "시리즈 원고");
		await expect.element(row("시리즈 원고")).toHaveTextContent("글 3");
		await userEvent.click(folderLink("시리즈 원고"));
		await expect.element(row("가을 사진 정리")).toBeVisible();
	});

	it("07-2 [flow 5·08] picked rows move together from the bulk bar's '폴더로'", async () => {
		await Main.run();
		await userEvent.click(page.getByRole("checkbox", { name: "발행 후 고친 글 고르기" }));
		await userEvent.click(page.getByRole("checkbox", { name: "가을 사진 정리 고르기" }));
		await userEvent.click(main().getByRole("button", { name: "폴더로" }));
		await userEvent.click(page.getByRole("menuitem", { name: "시리즈 원고" }));
		await expect.element(row("발행 후 고친 글")).not.toBeInTheDocument();
		await expect.element(row("가을 사진 정리")).not.toBeInTheDocument();
		await expect.element(row("시리즈 원고")).toHaveTextContent("글 4");
	});

	it("[overflow-after-add] folders with long names: the list and the sidebar still fit, nothing scrolls sideways", async () => {
		await Main.run();
		for (let at = 1; at <= 3; at++)
			await newFolder(`아주 긴 이름을 가진 정리용 폴더 ${at}번, 오래된 시리즈 원고와 초안 모음`);
		expect(scrollsSideways(table().element())).toEqual([]);
		expect(scrollsSideways(sidebarFolders().element())).toEqual([]);
	});
});

describe("folders in the sidebar", () => {
	it("07-2 the open collection shows its folder tree; a row opens that folder and stays picked while it is open", async () => {
		await Main.run();
		const folder = sidebarFolders().getByRole("link", { name: /시리즈 원고/ });
		await expect.element(folder).toHaveTextContent("2");
		await userEvent.click(folder);
		await expect.element(heading()).toHaveTextContent("시리즈 원고");
		await expect.element(folder).toHaveAttribute("aria-current", "page");
	});

	it("a collection that does not use folders has no tree and no '새 폴더'", async () => {
		await Categories.run();
		await expect.element(table().getByText("일상")).toBeVisible();
		await expect.element(sidebarFolders()).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("button", { name: "더 만들기" }));
		await expect.element(page.getByRole("menuitem", { name: "템플릿으로 쓰기" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "새 폴더" })).not.toBeInTheDocument();
	});
});
