import type { ActivityList } from "@monti-cms/core";
import { toast as toasts } from "@monti-cms/ui";
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
/** Whether the newest toast, whatever it says, is an error: its pill stands on the danger ground, not on ink. */
const newestIsError = () =>
	document
		.querySelector("[data-sonner-toast] [data-slot=toast] > div")
		?.classList.contains("bg-monti-danger-emphasis") ?? false;
/** An answer that waits until the test lets it go. */
const held = () => {
	let letGo = () => {};
	const until = new Promise<void>((resolve) => {
		letGo = resolve;
	});
	return { until, letGo };
};
/** A row's ⋯ › "되돌리기", and "되돌리기" in the question it asks. */
const undoFromMenu = async (words: string) => {
	await userEvent.click((await menuOf(words)).getByRole("menuitem", { name: "되돌리기" }));
	await expect.element(dialog()).toHaveTextContent("되돌릴까요?");
	await userEvent.click(dialog().getByRole("button", { name: "되돌리기" }));
};
const sidebar = (name: RegExp) => page.getByRole("navigation").getByRole("button", { name });
const sidebarLog = () => sidebar(/^활동 기록/);
const banner = () => page.getByRole("status").filter({ hasText: /전송 \d+건 실패/ });
const panel = () => page.getByRole("complementary");
/** What each row's delivery cell says, top to bottom. */
const deliveryCells = () =>
	[...table().element().querySelectorAll("tbody tr")].map((each) => each.querySelectorAll("td")[1]?.textContent ?? "");
/** What one row's delivery cell says. */
const deliveryOf = (words: string) => row(words).element().querySelectorAll("td")[1]?.textContent ?? "";
/** Tab until the keyboard's focus is on it: a control reached as a person on the keyboard reaches it. */
const tabTo = async (target: () => Element) => {
	for (let presses = 0; presses < 120 && document.activeElement !== target(); presses++) await userEvent.tab();
	expect(document.activeElement).toBe(target());
};
const rows = () =>
	[...table().element().querySelectorAll("tbody tr")].map((each) => each.querySelector("td")?.textContent ?? "");

const FAILED = '"리액트 19 마이그레이션" 발행';
const ASSISTANT = "이 두 편 요약 채워 줘";

describe("the activity log (doc 13, flow 12)", () => {
	it("13-4 [flow 12·01] the sidebar's count is on the log, which opens unfiltered: one failed row says so, the banner at the top says the same number, and tools counts nothing", async () => {
		await draw({ ...stories.Log, loaders: stories.log("#/trash") }).run();
		await expect.element(sidebarLog()).toHaveTextContent("1");
		await expect.element(sidebar(/^도구/)).not.toHaveTextContent("1");
		await userEvent.click(sidebarLog());
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent("활동 기록");
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		// Newest first; what stands after the words says where, and a row from the command line says so.
		expect(rows()[0]).toContain('"고친 글" 저장');
		await expect.element(row('"고친 글" 저장')).toHaveTextContent("post/edited-post");
		await expect.element(row("템플릿 기본 틀 저장")).toHaveTextContent("도구 · 템플릿 · 명령줄");
		// The admin's own rows name nobody.
		await expect.element(table().getByText("관리자")).not.toBeInTheDocument();
		// One failed delivery is enough for the banner: it counts deliveries, as the sidebar does, and offers to send that one again.
		await expect.element(banner()).toHaveTextContent("전송 1건 실패");
		await expect.element(banner().getByRole("button", { name: "다시 보내기" })).toBeVisible();
		await expect.element(banner().getByRole("button", { name: "보기" })).toBeVisible();
		await expect.element(banner().getByRole("button", { name: "모두 다시 보내기" })).not.toBeInTheDocument();
	});

	it("13-3 the assistant's work is one row for its request, marked ✦ and quoting it, with what it did after it", async () => {
		await draw(stories.Log).run();
		await expect.element(row(ASSISTANT)).toHaveTextContent("“이 두 편 요약 채워 줘. 말투는 그대로.”");
		await expect.element(row(ASSISTANT)).toHaveTextContent('"리액트 19 마이그레이션" 저장 · "첫 번째 글" 저장');
		await expect.element(row(ASSISTANT).getByRole("img", { name: "어시스턴트" })).toBeVisible();
		// The mark leads the line and the words stand on it: neither is pushed out of the row's one line.
		const line = row(ASSISTANT).element().getBoundingClientRect();
		const mark = row(ASSISTANT).getByRole("img", { name: "어시스턴트" }).element().getBoundingClientRect();
		const words = row(ASSISTANT)
			.getByRole("link", { name: /이 두 편 요약/ })
			.element();
		const [first] = words.getClientRects();
		if (!first) throw new Error("the request has no line");
		expect(first.top).toBeGreaterThanOrEqual(line.top);
		expect(first.bottom).toBeLessThanOrEqual(line.bottom);
		expect(mark.right).toBeLessThanOrEqual(first.left);
		expect(Math.abs((mark.top + mark.bottom) / 2 - (first.top + first.bottom) / 2)).toBeLessThanOrEqual(2);
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
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록$/);
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
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		await expect.element(sidebarLog()).toHaveTextContent("1");
	});

	it("[flow 12·03] a press on a row opens its details beside the list: when, the entry as it was, each receiver's delivery by its name; the row is picked, and × closes it", async () => {
		await draw(stories.Log).run();
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		await expect.poll(() => location.hash).toMatch(/^#\/activity\?open=/);
		await expect.element(panel().getByRole("heading", { name: FAILED })).toBeVisible();
		// One person uses the admin: the panel does not say who. Its first group has no heading, and the line's own id is not shown.
		await expect.element(panel()).not.toHaveTextContent("한 사람");
		await expect.element(panel()).not.toHaveTextContent("관리자");
		expect(
			panel()
				.getByRole("heading", { level: 3 })
				.elements()
				.map((each) => each.textContent),
		).toEqual(["항목", "전송 · 2"]);
		await expect.element(panel()).toHaveTextContent("컬렉션게시글");
		await expect.element(panel()).toHaveTextContent("주소/posts/react-19");
		await expect.element(panel()).toHaveTextContent("전송 · 2");
		// A receiver is named as a person reads it, never by what it is stored under.
		await expect.element(panel()).toHaveTextContent("받는 곳사이트 캐시");
		await expect.element(panel()).toHaveTextContent("받는 곳search.example.dev");
		await expect.element(panel()).not.toHaveTextContent("plugin:next");
		await expect.element(panel()).not.toHaveTextContent("webhook:");
		await expect.element(panel()).toHaveTextContent("이벤트entry.published");
		// Why it failed is the receiver's answer as it came; the next try says its day too; the id is the one the receiver got.
		await expect.element(panel()).toHaveTextContent("마지막 오류503 Service Unavailable");
		await expect.element(panel()).toHaveTextContent(/다음 시도\d\d\. \d\d \d\d:\d\d/);
		await expect.element(panel()).toHaveTextContent(/이벤트 ID[0-9a-f-]{36}/);
		// The line's own id is nothing a person uses: it is not shown.
		expect(panel().element().textContent).not.toContain(new URLSearchParams(location.hash.split("?")[1]).get("open"));
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
		await expect.element(panel()).toHaveTextContent("한 일 · 2");
		await expect.element(panel()).toHaveTextContent("항목 · 2");
		await expect.element(panel().getByRole("link", { name: "첫 번째 글" })).toBeVisible();
	});

	it("[flow 12·04] [flow 12·04b] canceling a delivery asks first; closing changes nothing; canceled, the row and the panel say so, the count is gone and a toast says it", async () => {
		await draw(stories.Panel).run();
		await userEvent.click(panel().getByRole("button", { name: "취소", exact: true }));
		await expect.element(dialog()).toHaveTextContent("이 전송을 취소할까요?");
		await expect.element(dialog()).toHaveTextContent("사이트 캐시");
		await expect.element(dialog()).not.toHaveTextContent(stories.SITE);
		await userEvent.click(dialog().getByRole("button", { name: "닫기" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		await userEvent.click(panel().getByRole("button", { name: "취소", exact: true }));
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.element(toast("전송을 취소했습니다")).toBeVisible();
		await expect.element(row(FAILED)).toHaveTextContent("취소됨");
		await expect.element(panel()).toHaveTextContent("취소됨");
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록$/);
		// Nothing is left to do with that delivery.
		await expect.element(panel().getByRole("button", { name: "다시 보내기" })).not.toBeInTheDocument();
	});

	it("13-4 [flow 12·05] [flow 12·06] [flow 12·07] three failed deliveries: a banner at the very top says so with the sidebar's number; its 보기 filters to them; sending all again clears the banner and the count and says how many went", async () => {
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		await expect.element(banner()).toHaveTextContent("전송 3건 실패");
		await expect.element(sidebarLog()).toHaveTextContent("3");
		// The banner stands above the page's title, across the page.
		const top = (element: Element) => element.getBoundingClientRect().top;
		expect(top(banner().element())).toBeLessThan(top(page.getByRole("heading", { level: 1 }).element()));
		// Its sentence is one line where the page is 868px wide too.
		const high = banner().element().getBoundingClientRect().height;
		await page.viewport(1100, 900);
		expect(Math.round(banner().element().getBoundingClientRect().width)).toBe(868);
		expect(banner().element().getBoundingClientRect().height).toBe(high);
		expect(banner().element().scrollWidth).toBeLessThanOrEqual(banner().element().clientWidth);
		await page.viewport(1440, 900);
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
		// Every failed row says it is on its way (12·06), not only the first.
		await expect.poll(() => deliveryCells()).toEqual(["보내는 중", "보내는 중", "보내는 중"]);
		hooks.hold = null;
		arrive();
		await expect.element(toast("3건 보냈습니다")).toBeVisible();
		await expect.element(banner()).not.toBeInTheDocument();
		// No number at all is left on the sidebar's row.
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록$/);
	});

	it("13-4 [flow 12·08] one of three fails again: its row is left, and the banner counts that one; the toast says how many went and how many did not", async () => {
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		const { hooks, ids } = drawn.loaded();
		await expect.element(banner()).toBeVisible();
		// The site's refresh is back for all but one entry.
		const stubborn = ids.failed[2]?.entry;
		if (stubborn) hooks.refuse.add(stubborn);
		await userEvent.click(banner().getByRole("button", { name: "모두 다시 보내기" }));
		await expect.element(toast("2건 보냈습니다 · 1건 실패")).toBeVisible();
		await expect.element(banner()).toHaveTextContent("전송 1건 실패");
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록1$/);
		expect(deliveryCells().filter((words) => words !== "보냄" && words !== "")).toEqual(["실패"]);
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
			"가져오기",
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

	it("[flow 2·17] a row's ⋯ undoes it once the question is answered: the assistant's work goes back and its row says when; a person's own publish goes off the site", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		const summaryOf = async (id: string) =>
			(await site.db.selectFrom("entries").select("values").where("id", "=", id).executeTakeFirstOrThrow()).values
				.summary;
		expect(await summaryOf(ids.first)).toBe("한 줄 요약");
		// The second post was published since the assistant wrote it: that one stays, and the toast says one did.
		await undoFromMenu(ASSISTANT);
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
		await undoFromMenu(FAILED);
		await expect.element(row(FAILED)).toHaveTextContent(/되돌림 \d\d:\d\d/);
		expect(await published()).toHaveLength(0);
	});

	it("an undo with nothing left to take back says why, and the row keeps its undo", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		// The post made first was published and written by the assistant since: nothing of its making is left as it was.
		await userEvent.click((await menuOf('"첫 번째 글" 만듦')).getByRole("menuitem", { name: "되돌리기" }));
		// The reason stands in place of the question: nobody is asked about an undo that cannot happen.
		await expect.element(toast("그 사이 다시 고쳐졌습니다.")).toBeVisible();
		await expect.element(dialog()).not.toBeInTheDocument();
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
		// The address says where the browsing stands and the page it came from: its number, its first and last lines' places, the count, and
		// the mark of what that page was read under.
		await expect
			.poll(() => location.hash)
			.toMatch(
				new RegExp(
					`^#/activity\\?page=2&as=${first.asOf}&from=1\\.${first.first}\\.${first.last}\\.${first.total}\\.[0-9a-z]+$`,
				),
			);
		await expect.element(main().getByText(`51–${first.total} / ${first.total}`)).toBeVisible();
		// Page 2 goes on after page 1's last row: the new row did not push that one over.
		expect(rows()).not.toContain(last);
		expect(rows()).toHaveLength(first.total - 50);
		// Back at page 1 a new browsing begins: it counts the row that arrived.
		await userEvent.click(main().getByRole("link", { name: "1", exact: true }));
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(main().getByText(`1–50 / ${first.total + 1}`)).toBeVisible();
	});

	it("[many] every row is one line, as high as a list's; long words are cut in their own cell", async () => {
		await draw(stories.ThreeFailed).run();
		await expect.element(row(FAILED)).toBeVisible();
		expect(rowHeights(table().element())).toHaveLength(1);
		expect(spillingCells(table().element())).toEqual([]);
		// As the log opens, the time is whole in its column: the day and the hour, not "11. 12 21:…".
		const times = [...table().element().querySelectorAll("tbody td")].filter((cell) =>
			/^\d\d\. \d\d \d\d:\d\d$/.test(cell.textContent ?? ""),
		);
		expect(times.length).toBeGreaterThan(3);
		expect(times.filter((cell) => cell.scrollWidth > cell.clientWidth)).toEqual([]);
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
		(row('"고친 글" 저장').getByRole("link").element() as HTMLElement).focus();
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
	it("13-4 one publish two receivers did not get: the sidebar, the banner and the delivery column's menu all count three deliveries, on two rows", async () => {
		await draw(stories.TwoOnOneRow).run();
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록3$/);
		await expect.element(banner()).toHaveTextContent("전송 3건 실패");
		await userEvent.click(columnName("전송"));
		await expect.element(page.getByRole("menuitemcheckbox", { name: /^실패/ })).toHaveTextContent(/^실패3$/);
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /^실패/ }));
		await expect.poll(() => rows().length).toBe(2);
		await userEvent.keyboard("{Escape}");
		// The row both are on says how many deliveries failed, the number the sidebar and the banner count; the other says only that it failed.
		expect(deliveryOf('"두 곳에 못 간 글" 발행')).toBe("2건 실패");
		expect(deliveryOf(FAILED)).toBe("실패");
		// The row both are on names each receiver.
		await userEvent.click(row('"두 곳에 못 간 글" 발행').getByText("post/two-failed"));
		await expect.element(panel()).toHaveTextContent("받는 곳사이트 캐시");
		await expect.element(panel()).toHaveTextContent("받는 곳search.example.dev");
	});

	it("the banner's 보기 shows exactly what it counts: the failed filter alone, with the search and the other filters taken off", async () => {
		await draw({
			...stories.ThreeFailed,
			loaders: stories.log("#/activity?q=서울&kind=publish&date=today", { failures: 3 }),
		}).run();
		await expect.poll(() => rows().length).toBe(1);
		await userEvent.click(banner().getByRole("button", { name: "보기" }));
		await expect.poll(() => location.hash).toBe("#/activity?delivery=failed");
		await expect.poll(() => rows().length).toBe(3);
	});

	it("while one send runs, no other can be started: the banner's button says so and cannot be pressed, and another row's send is off", async () => {
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		const { hooks } = drawn.loaded();
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		await userEvent.click((await menuOf('"서울의 밤" 발행')).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(row('"서울의 밤" 발행')).toHaveTextContent("보내는 중");
		await expect.element(banner().getByRole("button", { name: "보내는 중…" })).toBeDisabled();
		const other = (await menuOf('"가을 사진 정리" 발행')).getByRole("menuitem", { name: "다시 보내기" });
		await expect.element(other).toHaveAttribute("aria-disabled", "true");
		await userEvent.keyboard("{Escape}");
		hooks.hold = null;
		arrive();
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(banner().getByRole("button", { name: "모두 다시 보내기" })).toBeEnabled();
	});

	it("a send that runs somewhere else (another tab, before a reload) shows here too: the banner's button and the failed rows say so, and none can be sent again", async () => {
		await draw({
			...stories.ThreeFailed,
			loaders: stories.log("#/activity", {
				failures: 3,
				also: async (site) => {
					await site.db
						.updateTable("monti_delivery")
						.set({ held_by: "another tab", sending_until: new Date(Date.now() + 60_000) })
						.where("state", "=", "failed")
						.execute();
				},
			}),
		}).run();
		await expect.element(banner().getByRole("button", { name: "보내는 중…" })).toBeDisabled();
		await expect.poll(() => deliveryCells().filter((words) => words === "보내는 중")).toHaveLength(3);
		await expect.element((await menuOf(FAILED)).getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).not.toBeInTheDocument();
	});

	it("an undo another tab already made is refused: the toast says why, and the row reads again and offers no undo", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		await expect.element(row(FAILED)).toBeVisible();
		// Behind the screen's back.
		await site.monti.run("activity.undo", { id: ids.failed[0]?.line }, { actor: "admin" });
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "되돌리기" }));
		await expect.element(page.getByRole("listitem").first()).toBeVisible();
		await expect.element(row(FAILED)).toHaveTextContent(/되돌림 \d\d:\d\d/);
		await expect.element((await menuOf(FAILED)).getByRole("menuitem", { name: "자세히" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).not.toBeInTheDocument();
	});

	it("a send refused because the delivery was canceled meanwhile says so, and the row reads again", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		const failed = await site.db
			.selectFrom("monti_delivery")
			.select("id")
			.where("activity_id", "=", ids.failed[0]?.line ?? "")
			.where("state", "=", "failed")
			.executeTakeFirstOrThrow();
		await site.monti.run("deliveries.cancel", { id: failed.id }, { actor: "admin" });
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(row(FAILED)).toHaveTextContent("취소됨");
	});

	it("an address that opens a line that is not there: the line leaves the address, nothing is beside the list, and the corner's ✦ stays", async () => {
		await draw({ ...stories.Log, loaders: stories.log("#/activity?open=no-such-line") }).run();
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(panel()).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "어시스턴트 열기" })).toBeVisible();
	});

	it("the sidebar's count follows a delivery that failed with no write of this admin's: when the window is come back to, and when the log opens", async () => {
		const drawn = draw({ ...stories.Log, loaders: stories.log("#/trash") });
		await drawn.run();
		const { site, hooks } = drawn.loaded();
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록1$/);
		const fail = async (title: string, slug: string) => {
			const made = (await site.monti.run(
				"entries.create",
				{ collection: "post", locale: "ko", title, slug },
				{ actor: "admin" },
			)) as { output: { id: string } };
			hooks.down.add(stories.SITE);
			await site.monti.run("entries.publish", { ids: [made.output.id] }, { actor: "admin" });
			hooks.down.clear();
		};
		// A delivery fails behind the screen: nothing told the frame.
		await fail("뒤에서 실패한 글", "behind-1");
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록1$/);
		window.dispatchEvent(new Event("focus"));
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록2$/);
		await fail("또 실패한 글", "behind-2");
		await userEvent.click(sidebarLog());
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록3$/);
		await expect.element(banner()).toHaveTextContent("전송 3건 실패");
	});

	it("a time's cell says the same day and hour when pointed at, in the lists' own form", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		const cell = row(FAILED).element().querySelectorAll("td")[2];
		expect(cell?.textContent).toMatch(/^\d\d\. \d\d \d\d:\d\d$/);
		expect(cell?.getAttribute("title")).toBe(cell?.textContent);
	});
	it("[flow 12·03] the details closed with the keyboard give focus back to the row that opened them", async () => {
		await draw(stories.Log).run();
		const link = row(FAILED).getByRole("link");
		await expect.element(link).toBeVisible();
		(link.element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel().getByRole("heading", { name: FAILED })).toBeVisible();
		(panel().getByRole("button", { name: "닫기" }).element() as HTMLElement).focus();
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).not.toBeInTheDocument();
		await expect.element(link).toHaveFocus();
	});
	it("the delivery cell's three ends side by side: went through says so in quiet words, failed has its mark, and a write that told nobody leaves it empty", async () => {
		await draw(stories.Log).run();
		await expect.element(row(FAILED)).toBeVisible();
		const cellOf = (words: string) => row(words).element().querySelectorAll("td")[1] as HTMLElement;
		// Every delivery of the line went: the word, with no status mark before it and in the table's faint tone.
		const sent = cellOf('"첫 번째 글" 발행');
		expect(sent.textContent).toBe("보냄");
		expect(sent.querySelector("[data-slot=entry-status]")).toBeNull();
		// As quiet as the lists' quietest cells: smaller than the row's title, and not in ink.
		const word = getComputedStyle(sent.firstElementChild as Element);
		const title = getComputedStyle(row('"첫 번째 글" 발행').getByRole("button").first().element());
		expect(Number.parseFloat(word.fontSize)).toBeLessThan(Number.parseFloat(title.fontSize));
		expect(word.color).not.toBe(title.color);
		// One did not: the red mark and the one word. How many times it was tried is the panel's to say.
		const failed = cellOf(FAILED);
		expect(failed.textContent).toBe("실패");
		expect(failed.querySelector("[data-slot=entry-status]")).not.toBeNull();
		expect(getComputedStyle(sent.firstElementChild as Element).color).not.toBe(
			getComputedStyle(failed.querySelector("[data-slot=entry-status]") as Element).color,
		);
		// A write that tells no receiver (a template saved from the command line): nothing was to be sent, and the cell says nothing.
		expect(cellOf("템플릿 기본 틀 저장").textContent).toBe("");
		// The side panel says the same word for a delivery that went.
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		await expect.element(panel()).toHaveTextContent("상태보냄");
	});
	it("the log's 되돌리기 asks once, with what the row cannot show: only that it cannot be redone, that what the line made is deleted for good, or that published posts lose an item", async () => {
		// The toasts of the tests before this one stay on the page (a test's toasts do not time out) and would stand over the question.
		toasts.dismiss();
		const drawn = draw(stories.ItemRestored);
		await drawn.run();
		const { site } = drawn.loaded();
		const ask = async (words: string) =>
			userEvent.click((await menuOf(words)).getByRole("menuitem", { name: "되돌리기" }));
		const confirm = () => dialog().getByRole("button", { name: "되돌리기" });

		// A save: nothing is lost that the row does not say, so only that an undo cannot be redone.
		await ask('"고친 글" 저장');
		await expect.element(dialog()).toHaveTextContent("되돌릴까요?");
		await expect.element(dialog()).toHaveTextContent("되돌리면 다시 돌릴 수 없습니다.");
		const ground = () => getComputedStyle(confirm().element()).backgroundColor;
		const plain = ground();
		// Closed without undoing: nothing changed, and focus is back on the row's ⋯.
		await userEvent.click(dialog().getByRole("button", { name: "취소" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(row('"고친 글" 저장')).not.toHaveTextContent("되돌림");
		await expect.element(row('"고친 글" 저장').getByRole("button", { name: "행 메뉴" })).toHaveFocus();

		// A create: its undo deletes what was made, for good. The confirming button is the dangerous one, as "영구 삭제" has it.
		await ask("Blog Assets 폴더 만듦");
		await expect.element(dialog()).toHaveTextContent("이 작업으로 만든 것을 영구 삭제합니다.");
		expect(ground()).not.toBe(plain);
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(await site.db.selectFrom("folders").select("id").where("name", "=", "Blog Assets").execute()).toHaveLength(
			1,
		);

		// A restore of a category a published post points at: the undo throws it away again, in the words throwing it away by hand says.
		await ask('"개발" 복원');
		await expect.element(dialog()).toHaveTextContent("발행된 글 1편에서 이 카테고리가 빠집니다.");
		expect(ground()).toBe(plain);
		await userEvent.click(confirm());
		await expect.element(row('"개발" 복원')).toHaveTextContent(/되돌림 \d\d:\d\d/);
		const item = await site.db
			.selectFrom("entries")
			.select("trashed_at")
			.where("collection", "=", "category")
			.executeTakeFirstOrThrow();
		expect(item.trashed_at).not.toBeNull();
	});
	it("a line whose one delivery failed three times says 실패 in its cell, and its three tries beside that delivery in the panel", async () => {
		await draw(stories.FailedThrice).run();
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		// The count of tries is the panel's to say, on that delivery's own row.
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		await expect.element(panel()).toHaveTextContent("상태3번 실패");
		expect(deliveryOf(FAILED)).toBe("실패");
	});
	it("the banner's 다시 보내기 pressed with the keyboard: sent, the banner goes and the focus it held goes to the list; with none failed there is no banner", async () => {
		toasts.dismiss();
		await draw(stories.Log).run();
		await expect.element(banner()).toHaveTextContent("전송 1건 실패");
		await tabTo(() => banner().getByRole("button", { name: "다시 보내기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
		// Nothing is failed any more: no banner, and no number on the sidebar's row.
		await expect.element(banner()).not.toBeInTheDocument();
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록$/);
		// The focus is on the list's first row, not on the page.
		await expect.element(row('"고친 글" 저장').getByRole("link")).toHaveFocus();
	});

	it("the banner's 다시 보내기 pressed with the pointer moves no focus", async () => {
		toasts.dismiss();
		await draw(stories.Log).run();
		await userEvent.click(banner().getByRole("button", { name: "다시 보내기" }));
		await expect.element(banner()).not.toBeInTheDocument();
		await expect.element(toast("보냈습니다")).toBeVisible();
		// Nowhere: the button the pointer pressed went with the banner, and nothing was given its focus (not the list, not the search).
		expect(document.activeElement).toBe(document.body);
	});

	it("in the panel, 되돌리기 from the head's ⋯ confirmed with the pointer: the ⋯ goes, and no focus is moved to the head's ×", async () => {
		toasts.dismiss();
		await draw(stories.Log).run();
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		const more = () => panel().getByRole("button", { name: "더 보기" });
		await userEvent.click(more());
		await userEvent.click(page.getByRole("menuitem", { name: "되돌리기" }));
		await expect.element(dialog()).toHaveTextContent("되돌릴까요?");
		await userEvent.click(dialog().getByRole("button", { name: "되돌리기" }));
		await expect.element(row('"고친 글" 저장')).toHaveTextContent(/되돌림 \d\d:\d\d/);
		await expect.element(more()).not.toBeInTheDocument();
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(document.activeElement).toBe(document.body);
	});

	it("the banner's 보기 pressed with the keyboard goes once the list is filtered, and its focus goes to the delivery column's name, where that filter is", async () => {
		toasts.dismiss();
		await draw(stories.ThreeFailed).run();
		await tabTo(() => banner().getByRole("button", { name: "보기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => rows().length).toBe(3);
		await expect.element(banner().getByRole("button", { name: "보기" })).not.toBeInTheDocument();
		await expect.element(columnName("전송")).toHaveFocus();
	});

	it("a row's 다시 보내기 from its ⋯ with the keyboard, in a list of failed rows only: the row goes, and the focus goes to what the list offers in its place", async () => {
		toasts.dismiss();
		const drawn = draw(stories.FailedOnly);
		await drawn.run();
		const { hooks } = drawn.loaded();
		// The receiver takes a moment, as one over a network does: the menu has closed and given its focus back to the ⋯ before the row goes.
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		const more = () => row(FAILED).getByRole("button", { name: "행 메뉴" });
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.element(more()).toHaveFocus();
		hooks.hold = null;
		arrive();
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(table().getByText("맞는 기록이 없습니다.")).toBeVisible();
		await expect.element(table().getByRole("button", { name: "필터 해제" })).toHaveFocus();
	});

	it("a row's 다시 보내기 from its ⋯ with the keyboard, with failed rows after it: the row goes, and the focus goes to the row that follows", async () => {
		toasts.dismiss();
		const drawn = draw(stories.ThreeFailed);
		await drawn.run();
		const { hooks } = drawn.loaded();
		await userEvent.click(banner().getByRole("button", { name: "보기" }));
		await expect.poll(() => rows().length).toBe(3);
		const [first, second] = [...table().element().querySelectorAll("tbody tr")];
		if (!first || !second) throw new Error("No two failed rows.");
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		const more = () => first.querySelector<HTMLElement>('button[aria-label="행 메뉴"]') as HTMLElement;
		await tabTo(more);
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.poll(() => document.activeElement).toBe(more());
		hooks.hold = null;
		arrive();
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.poll(() => rows().length).toBe(2);
		// The banner stays for the two left; the focus is in the row that stood under the one that went.
		await expect.element(banner()).toHaveTextContent("전송 2건 실패");
		await expect.poll(() => second.contains(document.activeElement)).toBe(true);
	});

	it("in the panel, a delivery's 다시 보내기 and its 취소 pressed with the keyboard go once used, and the focus goes to that delivery, whose state says how it came out", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { hooks } = drawn.loaded();
		await expect.element(panel()).toHaveTextContent(/상태실패/);
		// It fails again: the button was at work meanwhile, and is as it was after the try, with its focus.
		hooks.down.add(stories.SITE);
		await tabTo(() => panel().getByRole("button", { name: "다시 보내기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(toast("보내지 못했습니다")).toBeVisible();
		hooks.down.clear();
		// Canceled with the keyboard, through the question: both buttons go, and the focus is on the delivery.
		await tabTo(() => panel().getByRole("button", { name: "취소", exact: true }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog()).toHaveTextContent("이 전송을 취소할까요?");
		await tabTo(() => dialog().getByRole("button", { name: "취소하기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toHaveTextContent("취소됨");
		// On the delivery itself, in the panel: the question gave its focus there, not back to a button that is gone.
		await expect.poll(() => document.activeElement?.getAttribute("data-delivery") ?? null).not.toBeNull();
		expect(document.activeElement?.textContent).toContain("받는 곳사이트 캐시");
		expect(document.activeElement?.textContent).toContain("취소됨");
		expect(panel().element().contains(document.activeElement)).toBe(true);
	});

	it("in the panel, the head's ⋯ goes when nothing is left to do with the line, and the focus it held goes to the next control of the head", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { site, ids, hooks } = drawn.loaded();
		// The line is undone already, behind the screen: what is left to do is to send its failed delivery again.
		await site.monti.run("activity.undo", { id: ids.failed[0]?.line }, { actor: "admin" });
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		const more = () => panel().getByRole("button", { name: "더 보기" });
		await expect.element(more()).toBeVisible();
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).not.toBeInTheDocument();
		// The receiver takes a moment: the menu has given its focus back to the ⋯ before the ⋯ goes.
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		await userEvent.keyboard("{Enter}");
		await expect.element(more()).toHaveFocus();
		hooks.hold = null;
		arrive();
		await expect.element(more()).not.toBeInTheDocument();
		await expect.element(panel().getByRole("button", { name: "닫기" })).toHaveFocus();
	});

	it("in the panel, 되돌리기 from the head's ⋯ confirmed with the keyboard: with nothing left to do the ⋯ goes, and the question gives its focus to the head's ×", async () => {
		toasts.dismiss();
		await draw(stories.Log).run();
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		const more = () => panel().getByRole("button", { name: "더 보기" });
		await expect.element(more()).toBeVisible();
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog()).toHaveTextContent("되돌릴까요?");
		await tabTo(() => dialog().getByRole("button", { name: "되돌리기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(row('"고친 글" 저장')).toHaveTextContent(/되돌림 \d\d:\d\d/);
		await expect.element(more()).not.toBeInTheDocument();
		await expect.element(panel().getByRole("button", { name: "닫기" })).toHaveFocus();
	});
	it("a delivery's 취소 on its way works and cannot be pressed again: one cancel is sent", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { hooks } = drawn.loaded();
		const answer = held();
		hooks.slow.set("deliveries.cancel", answer.until);
		const cancel = () => panel().getByRole("button", { name: "취소", exact: true });
		await userEvent.click(cancel());
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		// The answer is not in: the delivery still says failed, and its "cancel" is at work.
		await expect.element(cancel()).toHaveAttribute("aria-busy", "true");
		await expect.element(panel()).toHaveTextContent(/상태실패/);
		await userEvent.click(cancel(), { force: true });
		await expect.element(dialog()).not.toBeInTheDocument();
		hooks.slow.clear();
		answer.letGo();
		await expect.element(toast("전송을 취소했습니다")).toBeVisible();
		await expect.element(panel()).toHaveTextContent("취소됨");
		expect(hooks.calls.filter((name) => name === "deliveries.cancel")).toHaveLength(1);
	});

	it("a cancel refused because the delivery went by itself meanwhile says so, and the panel, the row and the banner read again", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		await expect.element(banner()).toHaveTextContent("전송 1건 실패");
		await expect.element(panel()).toHaveTextContent(/상태실패/);
		// Behind the screen's back: it was sent again, and arrived.
		const failed = await site.db
			.selectFrom("monti_delivery")
			.select("id")
			.where("activity_id", "=", ids.failed[0]?.line ?? "")
			.where("state", "=", "failed")
			.executeTakeFirstOrThrow();
		await site.monti.run("deliveries.retry", { ids: [failed.id] }, { actor: "admin" });
		await userEvent.click(panel().getByRole("button", { name: "취소", exact: true }));
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.poll(newestIsError).toBe(true);
		// Everything that showed the failure reads again: nothing is failed, and nothing is left to cancel.
		await expect.element(banner()).not.toBeInTheDocument();
		await expect.poll(() => deliveryOf(FAILED)).toBe("보냄");
		await expect.element(panel()).not.toHaveTextContent(/상태실패/);
		await expect.element(panel().getByRole("button", { name: "취소", exact: true })).not.toBeInTheDocument();
	});

	it("a lost answer to 되돌리기 (the read of what it would do): an error toast and no question; the row's ⋯ keeps the focus and asks again", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		hooks.lose.add("activity.undoPlan");
		const more = () => row('"고친 글" 저장').getByRole("button", { name: "행 메뉴" });
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.poll(newestIsError).toBe(true);
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(row('"고친 글" 저장')).not.toHaveTextContent("되돌림");
		await expect.element(more()).toHaveFocus();
		// The network is back: the same press asks the question.
		hooks.lose.clear();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.element(dialog()).toHaveTextContent("되돌릴까요?");
		await userEvent.keyboard("{Escape}");
	});

	it("a lost answer to 다시 보내기: an error toast; the row still says failed, nothing says it is on its way, and its ⋯ keeps the focus and sends again", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		const more = () => row(FAILED).getByRole("button", { name: "행 메뉴" });
		await tabTo(() => more().element());
		// The network drops the call: no answer comes at all. It carries words of its own ("no answer"), and is an error all the same.
		hooks.drop.add("deliveries.retry");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.poll(newestIsError).toBe(true);
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		await expect.element(more()).toHaveFocus();
		toasts.dismiss();
		await expect.poll(newestIsError).toBe(false);
		// The server fails and says nothing: the same.
		hooks.drop.clear();
		hooks.lose.add("deliveries.retry");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.poll(newestIsError).toBe(true);
		await expect.poll(() => deliveryOf(FAILED)).toBe("실패");
		await expect.element(banner()).toHaveTextContent("전송 1건 실패");
		await expect.element(banner().getByRole("button", { name: "다시 보내기" })).not.toHaveAttribute("aria-busy");
		await expect.element(more()).toHaveFocus();
		hooks.lose.clear();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
	});

	it("a lost answer to a delivery's 취소: an error toast; the delivery still says failed, and its 취소 keeps the focus and can be pressed again", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { hooks } = drawn.loaded();
		hooks.lose.add("deliveries.cancel");
		const cancel = () => panel().getByRole("button", { name: "취소", exact: true });
		await tabTo(() => cancel().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog()).toHaveTextContent("이 전송을 취소할까요?");
		await tabTo(() => dialog().getByRole("button", { name: "취소하기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.poll(newestIsError).toBe(true);
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(panel()).toHaveTextContent(/상태실패/);
		await expect.element(cancel()).not.toHaveAttribute("aria-busy");
		await expect.element(cancel()).toHaveFocus();
		hooks.lose.clear();
		await userEvent.keyboard("{Enter}");
		await expect.element(dialog()).toHaveTextContent("이 전송을 취소할까요?");
		await userEvent.keyboard("{Escape}");
	});

	it("the undo's question is not asked when what it would do to published posts cannot be read: the toast says the read failed", async () => {
		toasts.dismiss();
		const drawn = draw(stories.ItemRestored);
		await drawn.run();
		const { hooks } = drawn.loaded();
		hooks.lose.add("trash.checkMove");
		await userEvent.click((await menuOf('"개발" 복원')).getByRole("menuitem", { name: "되돌리기" }));
		await expect.poll(newestIsError).toBe(true);
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(row('"개발" 복원')).not.toHaveTextContent("되돌림");
	});

	it("an undo that deletes what the line made and takes an item out of published posts says both, with the dangerous button", async () => {
		toasts.dismiss();
		const drawn = draw(stories.ItemRestored);
		await drawn.run();
		const { site } = drawn.loaded();
		// One request of the assistant's that made a memo and restored the category a published post points at.
		const item = await site.db
			.selectFrom("entries")
			.select("id")
			.where("collection", "=", "category")
			.executeTakeFirstOrThrow();
		const rows = [{ kind: "entry", id: item.id }];
		await site.monti.run("trash.move", { rows }, { actor: "admin" });
		const proposal = await site.monti.proposals.create("conversation-2", "메모 하나 만들고 개발 카테고리 살려 줘");
		await site.monti.proposals.add(proposal, "entries.create", {
			collection: "memo",
			locale: "ko",
			title: "새 메모",
			slug: "new-memo",
		});
		await site.monti.proposals.add(proposal, "trash.restore", { rows });
		await site.monti.proposals.apply(proposal);
		location.hash = "#/activity?kind=assistant";
		const words = "메모 하나 만들고 개발 카테고리 살려 줘";
		await expect.element(row(words)).toBeVisible();
		await userEvent.click((await menuOf(words)).getByRole("menuitem", { name: "되돌리기" }));
		await expect
			.element(dialog())
			.toHaveTextContent("이 작업으로 만든 것을 영구 삭제합니다. 발행된 글 1편에서 이 카테고리가 빠집니다.");
		// The dangerous button: its ground is not the plain one's.
		const confirm = dialog().getByRole("button", { name: "되돌리기" });
		expect(confirm.element().getAttribute("data-variant") ?? confirm.element().className).toMatch(/danger/);
		await userEvent.keyboard("{Escape}");
	});

	it("in the panel, the head's ⋯ stays while 되돌리기 reads what it would do, and a read that fails leaves the ⋯ with its focus", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		const more = () => panel().getByRole("button", { name: "더 보기" });
		await expect.element(more()).toBeVisible();
		const answer = held();
		hooks.slow.set("activity.undoPlan", answer.until);
		hooks.lose.add("activity.undoPlan");
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "되돌리기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
		// The read is on its way: the ⋯ is where it was, with the focus the menu gave back to it.
		await expect.element(more()).toHaveFocus();
		hooks.slow.clear();
		answer.letGo();
		await expect.poll(newestIsError).toBe(true);
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(more()).toHaveFocus();
	});

	it("[many] a page link pressed before a new filter's answer is in carries nothing of the old answer: no place, no count, no boundary", async () => {
		const drawn = draw(stories.Pages);
		await drawn.run();
		const { hooks } = drawn.loaded();
		const second = () => main().getByRole("link", { name: "2", exact: true }).element().getAttribute("href");
		// As it was read: page 2 is reached from this page's place.
		await expect.poll(second).toMatch(/^#\/activity\?page=2&as=\d+&from=1\.\d+\.\d+\.\d+\.[0-9a-z]+$/);
		// A new order is asked for and its answer is on its way: the rows on screen are still the old answer's.
		const answer = held();
		hooks.slow.set("activity.list", answer.until);
		location.hash = "#/activity?sort=asc";
		await expect.poll(second).toBe("#/activity?sort=asc&page=2");
		hooks.slow.clear();
		answer.letGo();
		// Answered: the links stand on the new answer.
		await expect.poll(second).toMatch(/^#\/activity\?sort=asc&page=2&as=\d+&from=1\.\d+\.\d+\.\d+\.[0-9a-z]+$/);
	});
	it("a row's 다시 보내기 from its ⋯ with the keyboard, answered at once: the row is gone before its menu has closed, and the menu gives the focus to what the list offers in its place", async () => {
		toasts.dismiss();
		await draw(stories.FailedOnly).run();
		await tabTo(() => row(FAILED).getByRole("button", { name: "행 메뉴" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(table().getByRole("button", { name: "필터 해제" })).toHaveFocus();
	});

	it("a row's 다시 보내기 answered at once, with failed rows after it: the menu gives the focus to the row that took its place", async () => {
		toasts.dismiss();
		await draw(stories.ThreeFailed).run();
		await userEvent.click(banner().getByRole("button", { name: "보기" }));
		await expect.poll(() => rows().length).toBe(3);
		const [first, second] = [...table().element().querySelectorAll("tbody tr")];
		if (!first || !second) throw new Error("No two failed rows.");
		await tabTo(() => first.querySelector<HTMLElement>('button[aria-label="행 메뉴"]') as HTMLElement);
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.poll(() => rows().length).toBe(2);
		await expect.poll(() => second.contains(document.activeElement)).toBe(true);
		expect(document.activeElement?.getAttribute("data-slot")).toBe("row-link");
	});

	it("a row's 다시 보내기 answered at once, pressed with the pointer: the row goes and no focus is moved", async () => {
		toasts.dismiss();
		await draw(stories.FailedOnly).run();
		await userEvent.click((await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" }));
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(table().getByText("맞는 기록이 없습니다.")).toBeVisible();
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
		expect(document.activeElement).toBe(document.body);
	});

	it("in the panel, the head's ⋯ › 다시 보내기 answered at once as the last thing to do: the ⋯ is gone before its menu has closed, and the menu gives the focus to the head's ×", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { site, ids } = drawn.loaded();
		await site.monti.run("activity.undo", { id: ids.failed[0]?.line }, { actor: "admin" });
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		await userEvent.click(row(FAILED).getByText("post/react-19"));
		const more = () => panel().getByRole("button", { name: "더 보기" });
		await expect.element(more()).toBeVisible();
		await tabTo(() => more().element());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		await userEvent.keyboard("{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(more()).not.toBeInTheDocument();
		await expect.element(panel().getByRole("button", { name: "닫기" })).toHaveFocus();
	});

	it("in the panel, a lost answer to a delivery's 다시 보내기: an error toast, and the button is as it was, with its focus, and sends again", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Panel);
		await drawn.run();
		const { hooks } = drawn.loaded();
		hooks.lose.add("deliveries.retry");
		const send = () => panel().getByRole("button", { name: "다시 보내기" });
		await tabTo(() => send().element());
		await userEvent.keyboard("{Enter}");
		await expect.poll(newestIsError).toBe(true);
		await expect.element(panel()).toHaveTextContent(/상태실패/);
		await expect.element(send()).not.toHaveAttribute("aria-busy");
		await expect.element(send()).toHaveFocus();
		// The network is back: Enter on the same button sends it, and the focus goes to the delivery once its buttons are gone.
		hooks.lose.clear();
		toasts.dismiss();
		await userEvent.keyboard("{Enter}");
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.poll(() => document.activeElement?.getAttribute("data-delivery") ?? null).not.toBeNull();
	});

	it("[flow 12·03] the details opened from the third row and closed with × by keyboard, after Tab went past the rows under it: focus is back on the third row", async () => {
		await draw(stories.Log).run();
		const link = () =>
			[...table().element().querySelectorAll<HTMLElement>("tbody [data-slot=row-link]")][2] as HTMLElement;
		await tabTo(link);
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).toBeVisible();
		await tabTo(() => panel().getByRole("button", { name: "닫기" }).element());
		await userEvent.keyboard("{Enter}");
		await expect.element(panel()).not.toBeInTheDocument();
		expect(document.activeElement).toBe(link());
	});
	it("[many] scrolled to its end, the page keeps its 40px under the page links: the last control is not at the scroll's edge, beside an open panel too", async () => {
		await draw(stories.Pages).run();
		const link = () => main().getByRole("link", { name: "2", exact: true }).element();
		await expect.element(main().getByRole("link", { name: "2", exact: true })).toBeVisible();
		/** How far the page links stand over the end of the box the page scrolls in, once it is scrolled to its end. */
		const under = () => {
			let box: HTMLElement | null = link().parentElement;
			while (box && !(getComputedStyle(box).overflowY === "auto" && box.scrollHeight > box.clientHeight))
				box = box.parentElement;
			if (!box) return null;
			box.scrollTop = box.scrollHeight;
			return Math.round(box.getBoundingClientRect().bottom - link().getBoundingClientRect().bottom);
		};
		expect(under()).toBe(40);
		await userEvent.click(row('"고친 글" 저장').getByText("post/edited-post"));
		await expect.element(panel()).toBeVisible();
		expect(under()).toBe(40);
	});

	it("a row's title is a link with the address that opens its details, as every list's title is", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { ids } = drawn.loaded();
		const title = row(FAILED).getByRole("link");
		await expect.element(title).toHaveAttribute("href", `#/activity?open=${ids.failed[0]?.line}`);
		// The address keeps what the list is looked at by.
		location.hash = "#/activity?delivery=failed";
		await expect.poll(() => rows().length).toBe(1);
		await expect.element(title).toHaveAttribute("href", `#/activity?delivery=failed&open=${ids.failed[0]?.line}`);
		await userEvent.click(title);
		await expect.element(panel().getByRole("heading", { name: FAILED })).toBeVisible();
	});

	it("a row's 다시 보내기 from the menu opened on the row with the keyboard (Shift+F10), in a list of failed rows only: the row goes, and the focus goes to what the list offers in its place", async () => {
		toasts.dismiss();
		const drawn = draw(stories.FailedOnly);
		await drawn.run();
		const { hooks } = drawn.loaded();
		let arrive = () => {};
		hooks.hold = new Promise((resolve) => {
			arrive = resolve;
		});
		const title = () => row(FAILED).getByRole("link");
		await tabTo(() => title().element());
		// The keyboard's own way to a context menu: the menu opens on the row the focus is in, not on its ⋯.
		title()
			.element()
			.dispatchEvent(
				new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0 }),
			);
		await expect.element(page.getByRole("menuitem", { name: "다시 보내기" })).toBeVisible();
		const sendAgain = () => page.getByRole("menuitem", { name: "다시 보내기" }).element();
		for (let presses = 0; presses < 4 && document.activeElement !== sendAgain(); presses++)
			await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(sendAgain());
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
		hooks.hold = null;
		arrive();
		await expect.element(toast("보냈습니다")).toBeVisible();
		await expect.element(table().getByText("맞는 기록이 없습니다.")).toBeVisible();
		await expect.element(table().getByRole("button", { name: "필터 해제" })).toHaveFocus();
	});

	it("필터 해제 pressed with the keyboard goes with its row once the list has rows again, and the focus goes to the list's first row", async () => {
		await draw(stories.NoMatch).run();
		const clear = () => table().getByRole("button", { name: "필터 해제" });
		await expect.element(clear()).toBeVisible();
		await tabTo(() => clear().element());
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => location.hash).toBe("#/activity");
		await expect.element(row('"고친 글" 저장').getByRole("link")).toHaveFocus();
	});

	it("필터 해제 pressed with the pointer moves no focus", async () => {
		await draw(stories.NoMatch).run();
		await userEvent.click(table().getByRole("button", { name: "필터 해제" }));
		await expect.element(row(FAILED)).toBeVisible();
		expect(row('"고친 글" 저장').getByRole("link").element()).not.toBe(document.activeElement);
	});

	it("a read made again that fails leaves the rows and says so in a banner over them; read again, the banner goes", async () => {
		const drawn = draw(stories.Log);
		await drawn.run();
		const { site, hooks } = drawn.loaded();
		await expect.element(row(FAILED)).toBeVisible();
		const failedToRead = () => page.getByRole("status").filter({ hasText: "기록을 불러오지 못했습니다" });
		await expect.element(failedToRead()).not.toBeInTheDocument();
		// Something is written elsewhere and the log reads again: that read gets no answer.
		hooks.lose.add("activity.list");
		await site.monti.run(
			"entries.create",
			{ collection: "post", locale: "ko", title: "그 사이 쓴 글", slug: "meanwhile" },
			{ actor: "admin" },
		);
		window.dispatchEvent(new Event("focus"));
		await userEvent.click(columnName("시각"));
		await userEvent.click(page.getByRole("menuitemradio", { name: "오래전부터" }));
		await expect.element(failedToRead()).toBeVisible();
		// The rows read before are still there, under the banner.
		await expect.element(row(FAILED)).toBeVisible();
		hooks.lose.clear();
		await userEvent.click(failedToRead().getByRole("button", { name: "다시 시도" }));
		await expect.element(failedToRead()).not.toBeInTheDocument();
		await expect.element(row('"그 사이 쓴 글" 만듦')).toBeVisible();
	});

	it("while an undo runs, a row's ⋯ keeps 되돌리기 and it cannot be pressed, as in the panel's ⋯", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		const answer = held();
		hooks.slow.set("activity.undo", answer.until);
		await undoFromMenu('"고친 글" 저장');
		const item = (await menuOf("템플릿 기본 틀 저장")).getByRole("menuitem", { name: "되돌리기" });
		await expect.element(item).toHaveAttribute("aria-disabled", "true");
		await userEvent.keyboard("{Escape}");
		hooks.slow.clear();
		answer.letGo();
		await expect.element(row('"고친 글" 저장')).toHaveTextContent(/되돌림 \d\d:\d\d/);
	});

	it("a second delivery's 취소 confirmed while the first is on its way is sent when that one has answered: both are canceled", async () => {
		toasts.dismiss();
		const drawn = draw(stories.TwoOnOneRow);
		await drawn.run();
		const { hooks } = drawn.loaded();
		await userEvent.click(row('"두 곳에 못 간 글" 발행').getByText("post/two-failed"));
		await expect.element(panel()).toHaveTextContent("받는 곳search.example.dev");
		const answer = held();
		hooks.slow.set("deliveries.cancel", answer.until);
		const cancels = () => panel().getByRole("button", { name: "취소", exact: true });
		await userEvent.click(cancels().first());
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(cancels().first()).toHaveAttribute("aria-busy", "true");
		// The other delivery's cancel is confirmed too: it is at work as well, and nothing is dropped.
		await userEvent.click(cancels().nth(1));
		await userEvent.click(dialog().getByRole("button", { name: "취소하기" }));
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(cancels().nth(1)).toHaveAttribute("aria-busy", "true");
		// One at a time: the second is not sent before the first has answered.
		expect(hooks.calls.filter((name) => name === "deliveries.cancel")).toHaveLength(1);
		hooks.slow.clear();
		answer.letGo();
		await expect.poll(() => hooks.calls.filter((name) => name === "deliveries.cancel")).toHaveLength(2);
		await expect.element(cancels()).not.toBeInTheDocument();
		await expect.poll(() => (panel().element().textContent ?? "").match(/취소됨/g)?.length).toBe(2);
	});

	it("the sidebar's count follows a delivery that fails after the counts were read, on another screen: the frame reads again while one is on its way", async () => {
		const drawn = draw({ ...stories.Log, loaders: stories.log("#/trash") });
		await drawn.run();
		const { site, hooks } = drawn.loaded();
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록1$/);
		const made = (await site.monti.run(
			"entries.create",
			{ collection: "post", locale: "ko", title: "늦게 실패한 글", slug: "late-failure" },
			{ actor: "admin" },
		)) as { output: { id: string } };
		// The receiver is down and slow to say so: the write of this admin's answers first, with its delivery still on its way.
		const answer = held();
		hooks.hold = answer.until;
		hooks.down.add(stories.SITE);
		const publishing = site.monti.run("entries.publish", { ids: [made.output.id] }, { actor: "admin" });
		// The frame reads its counts once (as after a write of this admin's own): the delivery is on its way, and nothing is failed yet.
		window.dispatchEvent(new Event("focus"));
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록1$/);
		hooks.hold = null;
		answer.letGo();
		await publishing;
		hooks.down.clear();
		// Nothing is pressed and the window is not come back to: the frame looked again while the delivery was on its way.
		await expect.element(sidebarLog()).toHaveTextContent(/^활동 기록2$/);
	});

	it("다시 보내기 pressed twice in a row's menu sends once, and the second press does not land on the row under the closing menu", async () => {
		toasts.dismiss();
		const drawn = draw(stories.Log);
		await drawn.run();
		const { hooks } = drawn.loaded();
		const item = (await menuOf(FAILED)).getByRole("menuitem", { name: "다시 보내기" });
		await userEvent.dblClick(item);
		await expect.element(toast("보냈습니다")).toBeVisible();
		expect(hooks.calls.filter((name) => name === "deliveries.retry")).toHaveLength(1);
		// The menu stood over other rows: none of them was opened beside the list.
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
		expect(location.hash).toBe("#/activity");
		await expect.element(panel()).not.toBeInTheDocument();
	});
});
