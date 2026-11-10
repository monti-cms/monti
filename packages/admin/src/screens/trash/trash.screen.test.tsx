import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as stories from "./trash.stories";

const { Top, InFolder, Searching, ItemPanel, FilePanel, Empty, ByAssistant, TrashedEntry, AskPublished, AskPointedAt } =
	composeStories(stories);

const main = () => page.getByRole("main");
const table = () => main().getByRole("table");
const row = (title: string) => table().getByRole("row").filter({ hasText: title });
const menuOf = async (title: string) => {
	await userEvent.click(row(title).getByRole("button", { name: "행 메뉴" }));
	return page.getByRole("menu");
};
/** The newest toast that says this: earlier tests' toasts may still be on the page, and the newest is first. */
const toast = (text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const dialog = () => page.getByRole("alertdialog");
const sidebarTrash = () => page.getByRole("navigation").getByRole("button", { name: /^휴지통/ });

describe("the trash (doc 11, flow 5)", () => {
	it("11-1 [flow 5·11] one row for each thing thrown away: a folder is one row, each says its kind and its days, in the warning tone under a week", async () => {
		await Top.run();
		await expect.element(row("첫 번째 글")).toHaveTextContent("KO · EN");
		await expect.element(row("첫 번째 글")).toHaveTextContent("/posts/first-post");
		await expect.element(row("시리즈 원고")).toHaveTextContent("글 2");
		await expect.element(row("diagrams")).toHaveTextContent("파일 3 · Blog Assets");
		await expect.element(row("winter-01.jpg")).toHaveTextContent("미디어");
		await expect.element(row("연습장")).toHaveTextContent("메모");
		await expect.element(row("임시")).toHaveTextContent("태그");
		// What the folders hold is not listed beside them.
		await expect.element(table().getByText("시리즈 1: 시작")).not.toBeInTheDocument();
		await expect.element(row("첫 번째 글").getByText("30일 남음")).toBeVisible();
		const days = (title: string) => row(title).element().querySelector("[data-slot=trash-row-left]");
		expect(days("임시")).toHaveClass("text-monti-warning");
		expect(days("옛 소개 글")).not.toHaveClass("text-monti-warning");
		await expect.element(sidebarTrash()).toHaveTextContent("9");
	});

	it("11-1 every row is one height, and a row's actions are all in its ⋯: restore, and delete for good", async () => {
		await Top.run();
		await expect.element(row("임시")).toBeVisible();
		const heights = [...table().element().querySelectorAll("tbody tr")].map(
			(each) => each.getBoundingClientRect().height,
		);
		expect(new Set(heights).size).toBe(1);
		await expect.element(row("옛 소개 글").getByRole("button", { name: "복원" })).not.toBeInTheDocument();
		const menu = await menuOf("옛 소개 글");
		await expect.element(menu.getByRole("menuitem", { name: "복원" })).toBeVisible();
		await expect.element(menu.getByRole("menuitem", { name: "영구 삭제" })).toBeVisible();
	});

	it("11-1 [flow 5·11, 5·17] the kind column filters by kind, with a count for each; several can be on", async () => {
		await Top.run();
		await userEvent.click(table().getByRole("button", { name: "종류" }));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /게시글/ })).toHaveTextContent("5");
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

	it("11-1 [flow 5·14] a search looks inside thrown-away folders and says which folder a row is in", async () => {
		await Searching.run();
		await expect.element(row("시리즈 2: 리액트로 옮기기")).toHaveTextContent("시리즈 원고 폴더 안");
		await expect.element(row("리액트 19 마이그레이션")).toBeVisible();
		await expect.element(row("연습장")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·21] a restored post leaves the trash as a draft, and the toast opens it", async () => {
		await Top.run();
		const menu = await menuOf("옛 소개 글");
		await userEvent.click(menu.getByRole("menuitem", { name: "복원" }));
		await expect.element(toast("초안으로 복원했습니다").getByRole("button", { name: "열기" })).toBeVisible();
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(sidebarTrash()).toHaveTextContent("8");
	});

	it("11-1 [flow 5·22] a translation thrown away before its source says so, and comes back only with the source", async () => {
		await Top.run();
		await expect.element(row("React 19 migration")).toHaveTextContent("원문이 휴지통에 있음");
		const menu = await menuOf("React 19 migration");
		await expect.element(menu.getByRole("menuitem", { name: "복원", exact: true })).not.toBeInTheDocument();
		await userEvent.click(menu.getByRole("menuitem", { name: "원문 복원" }));
		await expect.element(row("React 19 migration")).not.toBeInTheDocument();
		await expect.element(row("리액트 19 마이그레이션")).not.toBeInTheDocument();
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
		await userEvent.click(dialog().getByRole("button", { name: "취소" }));
		await userEvent.click(table().getByRole("button", { name: "복원" }));
		await expect.element(row("옛 소개 글")).not.toBeInTheDocument();
		await expect.element(row("연습장")).not.toBeInTheDocument();
		await expect.element(row("첫 번째 글")).toBeVisible();
	});

	it("11-1 [flow 5·26, 5·28] emptying asks with how many go, and an empty trash is one line with nothing to do", async () => {
		await Top.run();
		await userEvent.click(main().getByRole("button", { name: "비우기" }));
		await expect.element(dialog()).toHaveTextContent("휴지통을 비울까요?");
		await expect.element(dialog()).toHaveTextContent("9개를 영구 삭제합니다.");
		await userEvent.click(dialog().getByRole("button", { name: "비우기" }));
		await expect.element(toast("9개를 영구 삭제했습니다")).toBeVisible();
		await expect.element(main().getByText("휴지통이 비었습니다.")).toBeVisible();
		await expect.element(main().getByRole("button", { name: "비우기" })).not.toBeInTheDocument();
		await expect.element(main().getByRole("button", { name: "검색" })).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·28] a trash that never held anything says so", async () => {
		await Empty.run();
		await expect.element(main().getByText("휴지통이 비었습니다.")).toBeVisible();
		await expect.element(main().getByRole("table")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·19] an item opens beside the list, to read: who points at it, with restore as its one pill", async () => {
		await ItemPanel.run();
		const panel = page.getByRole("complementary", { name: "임시" });
		await expect.element(panel).toHaveTextContent("3일 남음 · 읽기 전용");
		await expect.element(panel).toHaveTextContent("가리키는 글 · 4");
		await expect.element(panel.getByRole("link", { name: "여름 여행기" })).toBeVisible();
		await expect.element(panel.getByRole("textbox")).not.toBeInTheDocument();
		await userEvent.click(panel.getByRole("button", { name: "복원" }));
		await expect.element(toast("복원했습니다")).toBeVisible();
		await expect.element(panel).not.toBeInTheDocument();
		await expect.element(row("임시")).not.toBeInTheDocument();
	});

	it("11-1 [flow 5·20] a file opens beside the list as the library shows it, to read, with no alt text", async () => {
		await FilePanel.run();
		const panel = page.getByRole("complementary", { name: "winter-01.jpg" });
		await expect.element(panel).toHaveTextContent("28일 남음 · 읽기 전용");
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
		await userEvent.click(toast("휴지통으로 옮겼습니다").getByRole("button", { name: "되돌리기" }));
		// Taken back, it is as it was: published.
		await expect.element(row("여름 여행기")).toHaveTextContent("발행됨");
	});

	it("11-2 an item that published entries point at asks first: the site loses it there", async () => {
		await AskPointedAt.run();
		await expect.element(dialog()).toHaveTextContent("발행된 글 3편에서 이 태그가 빠집니다.");
		await userEvent.click(dialog().getByRole("button", { name: "휴지통으로" }));
		await expect.element(row("리액트")).not.toBeInTheDocument();
		await expect.element(toast("휴지통으로 옮겼습니다")).toBeVisible();
	});
});
