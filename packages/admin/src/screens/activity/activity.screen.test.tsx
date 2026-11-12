import type { ActivityList } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { dragPath, dropDrag, middleOf, rowHeights, spillingCells } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import type { Hooks, LogIds } from "./activity.stories";
import * as stories from "./activity.stories";

type Loaded = { site: StorySite; hooks: Hooks; ids: LogIds };
const draw = (story: object) => scene<Loaded>(story, stories.default);

const main = () => page.getByRole("main");
const table = () => main().getByRole("table");
const row = (words: string) => table().getByRole("row").filter({ hasText: words });
const columnName = (name: string) => table().getByRole("button", { name, exact: true });
const menuOf = async (words: string) => {
	await userEvent.click(row(words).getByRole("button", { name: "행 메뉴" }));
	return page.getByRole("menu");
};
/** The newest toast that says this: earlier tests' toasts may still be on the page, and the newest is first. */
const toast = (text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const dialog = () => page.getByRole("alertdialog");
const sidebar = (name: RegExp) => page.getByRole("navigation").getByRole("button", { name });
const sidebarLog = () => sidebar(/^활동 기록/);
const banner = () => page.getByRole("status").filter({ hasText: "전송 실패" });
const panel = () => page.getByRole("complementary");
const rows = () =>
	[...table().element().querySelectorAll("tbody tr")].map((each) => each.querySelector("td")?.textContent ?? "");

const FAILED = '"리액트 19 마이그레이션" 발행';
const ASSISTANT = "이 두 편 요약 채워 줘";

describe("the activity log (doc 13, flow 12)", () => {
	it("13-4 [flow 12·01] the sidebar's count is on the log, which opens unfiltered: one failed row says so, with no banner, and tools counts nothing", async () => {
		await draw({ ...stories.Log, loaders: stories.log("#/trash") }).run();
		await expect.element(sidebarLog()).toHaveTextContent("1");
		await expect.element(sidebar(/^도구/)).not.toHaveTextContent("1");
		await userEvent.click(sidebarLog());
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("활동 기록");
		await expect.element(row(FAILED)).toHaveTextContent("1번 실패");
		// Newest first; what stands after the words says where, and a row from the command line says so.
		expect(rows()[0]).toContain('"고친 글" 저장');
		await expect.element(row('"고친 글" 저장')).toHaveTextContent("post/edited-post");
		await expect.element(row("템플릿 기본 틀 저장")).toHaveTextContent("도구 · 템플릿 · 명령줄");
		// A delivery that arrived says nothing in its cell; the admin's own rows name nobody.
		await expect.element(row('"첫 번째 글" 발행')).not.toHaveTextContent("보냄");
		await expect.element(table().getByText("관리자")).not.toBeInTheDocument();
		await expect.element(banner()).not.toBeInTheDocument();
	});

	it("13-3 the assistant's work is one row for its request, marked ✦ and quoting it, with what it did after it", async () => {
		await draw(stories.Log).run();
		await expect.element(row(ASSISTANT)).toHaveTextContent("“이 두 편 요약 채워 줘. 말투는 그대로.”");
		await expect.element(row(ASSISTANT)).toHaveTextContent('"리액트 19 마이그레이션" 저장 · "첫 번째 글" 저장');
		await expect.element(row(ASSISTANT).getByRole("img", { name: "어시스턴트" })).toBeVisible();
		// Its two writes are one row, not two.
		expect(rows().filter((words) => words.includes('"첫 번째 글" 저장'))).toHaveLength(1);
	});

	it("[flow 12·01b] the delivery column's menu filters to failed rows and stays open; a dot marks the column, and unticking takes it off", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		await userEvent.click(columnName("전송"));
		const failedRow = page.getByRole("menuitemcheckbox", { name: /실패/ });
		// The menu counts rows: one row has a failed delivery.
		await expect.element(failedRow).toHaveTextContent("1");
		await userEvent.click(failedRow);
		await expect.poll(() => location.hash).toBe("#/activity?delivery=failed");
		await expect.poll(() => rows().length).toBe(1);
		await expect.element(failedRow).toBeVisible();
		expect(table().element().querySelector("thead [data-slot=column-dot]")).not.toBeNull();
		await userEvent.click(failedRow);
		await expect.poll(() => rows().length).toBeGreaterThan(5);
		await expect.poll(() => location.hash).toBe("#/activity");
	});

	it("[flow 12·02] [flow 12·02b] a failed row's ⋯ sends its delivery again: on its way the cell says so and the menu offers no second send; arrived, the count is gone and a toast says it", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(row(FAILED)).toHaveTextContent("보내는 중");
		await expect.element((await menuOf(FAILED)).getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		hooks.hold = null;
		arrive();
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(row(FAILED)).not.toHaveTextContent("실패");
		await expect.element(row(FAILED)).not.toHaveTextContent("보내는 중");
		await expect.element(sidebarLog()).not.toHaveTextContent("1");
		expect(hooks.arrived.filter((each) => each.destination === stories.SITE).at(-1)?.event.type).toBe(
			"entry.published",
		);
	});

	it("[flow 12·02b] sent again while filtered to failed, the table has one row that says nothing matches, and its button takes the filter off", async () => {
		await draw(stories.FailedOnly).run();
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(table().getByText("맞는 기록이 없습니다.")).toBeVisible();
		await userEvent.click(table().getByRole("button", { name: "필터 해제" }));
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(row(FAILED)).toBeVisible();
	});

	it("a delivery that fails again stays on its row: the toast says it could not be sent, and the count stays", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		drawn.loaded().hooks.down.add(stories.SITE);
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(toast("보내지 못했습니다")).toBeVisible();
		await expect.element(row(FAILED)).toHaveTextContent("1번 실패");
		await expect.element(sidebarLog()).toHaveTextContent("1");
	});

	it("[flow 12·03] a press on a row opens its details beside the list: when and who, the entry as it was, each receiver's delivery; the row is picked, and × closes it", async () => {
		await draw(stories.Log).run();
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		await expect.poll(() => location.hash).toMatch(/^#\/activity\?open=/);
		await expect.element(panel().getByRole("heading", { name: FAILED })).toBeVisible();
		await expect.element(panel()).toHaveTextContent("한 사람관리자");
		await expect.element(panel()).toHaveTextContent("컬렉션게시글");
		await expect.element(panel()).toHaveTextContent("주소/posts/react-19");
		await expect.element(panel()).toHaveTextContent("전송 · 2");
		await expect.element(panel()).toHaveTextContent(`받는 곳${stories.SITE}`);
		await expect.element(panel()).toHaveTextContent("이벤트entry.published");
		await expect.element(panel()).toHaveTextContent("마지막 오류503 Service Unavailable");
		// The other receiver got it: the panel, which is about this one line, says so.
		await expect.element(panel()).toHaveTextContent("보냄");
		expect(row(FAILED).element().getAttribute("data-selected")).not.toBeNull();
		// The panel covers the corner's ✦.
		await expect.element(page.getByRole("button", { name: "어시스턴트 열기" })).not.toBeInTheDocument();
		// The entry's name opens the entry.
		expect(panel().getByRole("link", { name: "리액트 19 마이그레이션" }).element().getAttribute("href")).toMatch(
			/^#\/c\/post\//,
		);
		await userEvent.click(panel().getByRole("button", { name: "닫기" }));
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(panel()).not.toBeInTheDocument();
	});

	it("the assistant's row open: its request whole, each thing it did, and what it touched", async () => {
		await draw(stories.AssistantPanel).run();
		await expect.element(panel()).toHaveTextContent("요청이 두 편 요약 채워 줘. 말투는 그대로.");
		await expect.element(panel()).toHaveTextContent("한 사람어시스턴트");
		await expect.element(panel()).toHaveTextContent("한 일 · 2");
		await expect.element(panel()).toHaveTextContent("항목 · 2");
		await expect.element(panel().getByRole("link", { name: "첫 번째 글" })).toBeVisible();
	});

	it("[flow 12·04] [flow 12·04b] canceling a delivery asks first; closing changes nothing; canceled, the row and the panel say so, the count is gone and a toast says it", async () => {
		await draw(stories.Panel).run();
		await userEvent.click(panel().getByRole("button", { name: "취소", exact: true }));
		await expect.element(dialog()).toHaveTextContent("이 전송을 취소할까요?");
		await expect.element(dialog()).toHaveTextContent(stories.SITE);
		await userEvent.click(dialog().getByRole("button", { name: "닫기" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(row(FAILED)).toHaveTextContent("1번 실패");
		await userEvent.click(panel().getByRole("button", { name: "취소", exact: true }));
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.element(toast("전송을 취소했습니다")).toBeVisible();
		await expect.element(row(FAILED)).toHaveTextContent("취소됨");
		await expect.element(panel()).toHaveTextContent("취소됨");
		await expect.element(sidebarLog()).not.toHaveTextContent("1");
		// Nothing is left to do with that delivery.
		await expect.element(panel().getByRole("button", { name: "다시 보내기" })).not.toBeInTheDocument();
	});

	it("13-4 [flow 12·05] [flow 12·06] [flow 12·07] three failed deliveries: a banner at the very top says so with the sidebar's number; its 보기 filters to them; sending all again clears the banner and the count and says how many went", async () => {
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		await expect.element(banner()).toHaveTextContent("전송 실패 3건");
		await expect.element(sidebarLog()).toHaveTextContent("3");
		// The banner stands above the page's title, across the page.
		const top = (element: Element) => element.getBoundingClientRect().top;
		expect(top(banner().element())).toBeLessThan(top(page.getByRole("heading", { level: 1 }).element()));
		await userEvent.click(banner().getByRole("button", { name: "보기" }));
		await expect.poll(() => location.hash).toBe("#/activity?delivery=failed");
		await expect.poll(() => rows().length).toBe(3);
		// Filtered to them already: the banner offers no "show".
		await expect.element(banner().getByRole("button", { name: "보기" })).not.toBeInTheDocument();
		const { hooks } = drawn.loaded();
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		await userEvent.click(banner().getByRole("button", { name: "모두 다시 보내기" }));
		// On their way: the banner's button says so in its place and cannot be pressed, and the rows say so.
		await expect.element(banner().getByRole("button", { name: "보내는 중…" })).toBeDisabled();
		await expect.poll(() => rows().every((words) => words !== "")).toBe(true);
		await expect.element(table().getByText("보내는 중").first()).toBeVisible();
		hooks.hold = null;
		arrive();
		await expect.element(toast("3건 보냈습니다")).toBeVisible();
		await expect.element(banner()).not.toBeInTheDocument();
		await expect.element(sidebarLog()).not.toHaveTextContent("3");
	});

	it("13-4 [flow 12·08] one of three fails again: its row is left, alone, so the banner is gone; the toast says how many went and how many did not", async () => {
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		const { hooks, ids } = drawn.loaded();
		await expect.element(banner()).toBeVisible();
		// The site's refresh is back for all but one entry.
		const stubborn = ids.failed[2]?.entry;
		if (stubborn) hooks.refuse.add(stubborn);
		await userEvent.click(banner().getByRole("button", { name: "모두 다시 보내기" }));
		await expect.element(toast("2건 보냈습니다 · 1건 실패")).toBeVisible();
		await expect.element(banner()).not.toBeInTheDocument();
		await expect.element(sidebarLog()).toHaveTextContent("1");
		await expect.element(row('"서울의 밤" 발행')).toHaveTextContent("1번 실패");
	});

	it("[flow 12·09] with the keyboard alone: the first column's menu opens, a kind is ticked with the arrows and Enter, and the rows are that kind's", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		columnName("작업").element().focus();
		await userEvent.keyboard("{Enter}");
		const kinds = page.getByRole("menuitemcheckbox");
		await expect.element(kinds.first()).toBeVisible();
		expect(kinds.elements().map((each) => each.textContent?.replace(/\d+$/, ""))).toEqual([
			"AI 제안",
			"글 저장",
			"글 발행",
			"휴지통",
			"설정",
			"미디어",
		]);
		// Each kind says how many rows it would show.
		await expect.element(page.getByRole("menuitemcheckbox", { name: /글 발행/ })).toHaveTextContent("3");
		// The menu opens on its first row.
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
		await expect.poll(() => location.hash).toBe("#/activity?kind=publish");
		await expect.poll(() => rows().every((words) => words.includes("발행"))).toBe(true);
		// A second kind adds its rows: the values of one column are any-of.
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.poll(() => location.hash).toBe("#/activity?kind=publish%2Ctrash");
		await expect.poll(() => rows().some((words) => words.includes("휴지통으로"))).toBe(true);
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
	});

	it("the time column's menu orders the log either way and filters by day, with the lists' rows", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		const newest = rows()[0];
		await userEvent.click(columnName("시각"));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오래전부터" }));
		await expect.poll(() => location.hash).toBe("#/activity?sort=asc");
		await expect.poll(() => rows().at(-1)).toBe(newest);
		await userEvent.click(columnName("시각"));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오늘" }));
		await expect.poll(() => location.hash).toBe("#/activity?date=today&sort=asc");
		// Yesterday's rows are gone.
		await expect.element(row('"옛 소개 글" 휴지통으로')).not.toBeInTheDocument();
		await expect.element(row(FAILED)).toBeVisible();
	});

	it("the search box finds rows by an entry's title or the words of the assistant's request", async () => {
		await draw(stories.Log).run();
		await userEvent.click(main().getByRole("button", { name: "검색" }));
		await userEvent.keyboard("말투");
		await expect.poll(() => rows().length).toBe(1);
		await expect.element(row(ASSISTANT)).toBeVisible();
		await expect.poll(() => location.hash).toBe(`#/activity?q=${encodeURIComponent("말투")}`);
		await userEvent.clear(main().getByRole("searchbox"));
		await userEvent.keyboard("옛 소개");
		await expect.poll(() => rows().every((words) => words.includes("옛 소개 글"))).toBe(true);
	});

	it("[flow 12·10] 13-5 a site with no receiver: the log has no delivery column, a row's details no deliveries, and nothing is counted", async () => {
		await draw(stories.NoReceivers).run();
		await expect.element(row(FAILED)).toBeVisible();
		await expect.element(columnName("전송")).not.toBeInTheDocument();
		await expect.element(row(FAILED)).not.toHaveTextContent("실패");
		await expect.element(sidebarLog()).not.toHaveTextContent(/\d/);
		await expect.element((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitem", { name: "자세히" }));
		await expect.element(panel()).toHaveTextContent("항목");
		await expect.element(panel()).not.toHaveTextContent("전송");
	});

	it("[flow 12·11] nothing logged yet: one line says so, with no table and no search", async () => {
		await draw(stories.Empty).run();
		await expect.element(main().getByText("아직 기록이 없습니다.")).toBeVisible();
		await expect.element(main().getByRole("table")).not.toBeInTheDocument();
		await expect.element(main().getByRole("button", { name: "검색" })).not.toBeInTheDocument();
	});

	it("search and filters with nothing under them: the column names stay, one row says so, and its button takes them off", async () => {
		await draw(stories.NoMatch).run();
		await expect.element(table().getByText("맞는 기록이 없습니다.")).toBeVisible();
		await expect.element(columnName("작업")).toBeVisible();
		await userEvent.click(table().getByRole("button", { name: "필터 해제" }));
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(row(FAILED)).toBeVisible();
	});

	it("[flow 2·17] a row's ⋯ undoes it without asking: the assistant's work goes back and its row says when; a person's own publish goes off the site", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		const summaryOf = async (id: string) =>
			(await site.db.selectFrom("entries").select("values").where("id", "=", id).executeTakeFirstOrThrow()).values
				.summary;
		expect(await summaryOf(ids.first)).toBe("한 줄 요약");
		// The second post was published since the assistant wrote it: that one stays, and the toast says one did.
		await userEvent.click((await menuOf(ASSISTANT)).getByRole("menuitem", { name: "되돌리기" }));
		await expect.element(row(ASSISTANT)).toHaveTextContent(/되돌림 \d\d:\d\d/);
		await expect.element(toast("그 사이 고쳐진 1개는 그대로 둠")).toBeVisible();
		expect(await summaryOf(ids.first)).toBeUndefined();
		expect(await summaryOf(ids.second)).toBe("한 줄 요약");
		// Undone, it offers no second undo.
		await expect.element((await menuOf(ASSISTANT)).getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");

		// A person's own publish, undone from the log: the site no longer shows the post.
		const published = () =>
			site.db.selectFrom("entry_published").select("entry_id").where("entry_id", "=", ids.second).execute();
		expect(await published()).toHaveLength(1);
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "되돌리기" }));
		await expect.element(row(FAILED)).toHaveTextContent(/되돌림 \d\d:\d\d/);
		expect(await published()).toHaveLength(0);
	});

	it("an undo with nothing left to take back says why, and the row keeps its undo", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		// The post made first was published and written by the assistant since: nothing of its making is left as it was.
		await userEvent.click((await menuOf('"첫 번째 글" 만듦')).getByRole("menuitem", { name: "되돌리기" }));
		await expect.element(toast("그 사이 다시 고쳐졌습니다.")).toBeVisible();
		await expect.element(row('"첫 번째 글" 만듦')).not.toHaveTextContent("되돌림");
		await expect.element((await menuOf('"첫 번째 글" 만듦')).getByRole("menuitem", { name: "되돌리기" })).toBeVisible();
	});

	it("[many] more rows than a page: the range and the pages under the table; page 2 has its own address, and stands where page 1 was read", async () => {
		const drawn = draw(stories.Pages);
		await drawn.run();
		const { site } = drawn.loaded();
		const first = (await site.monti.run("activity.list", {}, { actor: "admin" })) as ActivityList;
		await expect.element(main().getByText(`1–50 / ${first.total}`)).toBeVisible();
		expect(rows()).toHaveLength(50);
		const last = rows().at(-1);
		// New activity arrives before the next page is opened.
		await site.monti.run(
			"entries.create",
			{ collection: "memo", locale: "ko", title: "새 메모", slug: "new-memo" },
			{ actor: "admin" },
		);
		await userEvent.click(main().getByRole("link", { name: "2", exact: true }));
		await expect.poll(() => location.hash).toBe(`#/activity?page=2&as=${first.asOf}`);
		await expect.element(main().getByText(`51–${first.total} / ${first.total}`)).toBeVisible();
		// Page 2 goes on after page 1's last row: the new row did not push that one over.
		expect(rows()).not.toContain(last);
		expect(rows()).toHaveLength(first.total - 50);
	});

	it("[many] every row is one line, as high as a list's; long words are cut in their own cell", async () => {
		await draw(stories.ThreeFailed).run();
		await expect.element(row(FAILED)).toBeVisible();
		expect(rowHeights(table().element())).toHaveLength(1);
		expect(spillingCells(table().element())).toEqual([]);
	});

	it("an address with a search, filters, an order and an open row opens the same screen", async () => {
		await draw({
			...stories.Log,
			loaders: stories.log(
				(ids) => `#/activity?q=${encodeURIComponent("리액트")}&kind=publish&sort=asc&open=${ids.failed[0]?.line}`,
			),
		}).run();
		await expect.poll(() => rows().length).toBe(1);
		await expect.element(row(FAILED)).toBeVisible();
		await expect.element(main().getByRole("searchbox")).toHaveValue("리액트");
		await expect.element(panel().getByRole("heading", { name: FAILED })).toBeVisible();
		expect(table().element().querySelectorAll("thead [data-slot=column-dot]")).toHaveLength(1);
	});

	it("with Tab alone: the search, the column names, a row, its ⋯; Enter on the row opens its details", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		main().getByRole("button", { name: "검색" }).element().focus();
		const reached: string[] = [];
		for (let step = 0; step < 9 && reached.at(-1) !== "행 메뉴"; step++) {
			await userEvent.keyboard("{Tab}");
			reached.push(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "");
		}
		// The column names in their order (each column's edge, which the keyboard can move, is between them), then the first row and its ⋯.
		expect(reached.filter((name) => !name.endsWith("열 너비 조절"))).toEqual([
			"작업",
			"전송",
			"시각",
			'"고친 글" 저장',
			"행 메뉴",
		]);
		row('"고친 글" 저장').getByRole("button").first().element().focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel().getByRole("heading", { name: '"고친 글" 저장' })).toBeVisible();
	});

	it("[dragging] [dropped] a column's edge held and dragged stays under the pointer and moves no other edge; let go, the column keeps its width", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
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
});
