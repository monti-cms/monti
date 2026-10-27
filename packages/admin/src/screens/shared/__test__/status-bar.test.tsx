import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import {
	type EditorStatus,
	StatusBar,
	type StatusBarContextValue,
	StatusBarItem,
	type StatusItems,
	StatusItemsProvider,
	StatusPopoverHeader,
	StatusPopoverRow,
	useStatusBarContext,
} from "../status-bar";

const { render: renderWithRouter } = createTestRouter();

const failure = (id: string, subscriber: string, lastError: string) => ({
	change: {
		eventId: id,
		kind: "published",
		entryId: "e1",
		collection: "post",
		occurredAt: "2026-10-07T09:00:00.000Z",
		title: "글",
	},
	subscriber,
	state: "failed",
	attempts: 2,
	lastError,
	nextAttemptAt: null,
	lastAttemptAt: "2026-10-07T09:01:00.000Z",
});

let failed = 0;
let failures: ReturnType<typeof failure>[] = [];
const retried = vi.fn();
beforeEach(() => {
	failed = 0;
	failures = [];
	retried.mockReset();
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: string, init?: RequestInit) => {
			if (input === "/api/monti/v1/events/retry" && init?.method === "POST") {
				retried();
				return jsonResponse({ delivered: 1, failed: 0, dead: 0 });
			}
			if (input.startsWith("/api/monti/v1/events"))
				return jsonResponse({ items: failures, total: failures.length, counts: { failed, dead: 0 } });
			throw new Error(`Unexpected fetch: ${input}`);
		}),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const show = (context: StatusBarContextValue, items: StatusItems = {}) =>
	renderWithRouter(
		withSite(
			<StatusItemsProvider items={items}>
				<StatusBar context={context} />
			</StatusItemsProvider>,
		),
	);
const bar = () => within(screen.getByRole("region", { name: "상태" }));
const texts = (element: HTMLElement) => [...element.querySelectorAll("span.truncate")].map((node) => node.textContent);

describe("status bar", () => {
	it("draws a plugin's item in its group, ordered by `order`", () => {
		const Item = ({ label }: { label: string }) => <StatusBarItem title={label}>{label}</StatusBarItem>;
		show(
			{ screen: "tools" },
			{
				late: { align: "start", order: 200, Component: () => <Item label="늦은 항목" /> },
				early: { align: "start", order: 5, Component: () => <Item label="이른 항목" /> },
				right: { align: "end", order: 1, Component: () => <Item label="오른쪽 항목" /> },
			},
		);
		// One row of cells: the start group, the spacer, then the end group.
		const region = screen.getByRole("region", { name: "상태" });
		const children = [...region.children] as HTMLElement[];
		const spacer = children.findIndex((child) => child.dataset.slot === "status-bar-spacer");
		expect(texts(region)).toEqual(["이른 항목", "늦은 항목", "오른쪽 항목"]);
		expect(children.slice(0, spacer).map((child) => child.textContent)).toEqual(["이른 항목", "늦은 항목"]);
		expect(children.slice(spacer + 1).map((child) => child.textContent)).toEqual(["오른쪽 항목"]);
	});

	it("leaves no gap or wrapper for an item that renders nothing", () => {
		show(
			{ screen: "tools" },
			{
				a: { align: "start", order: 1, Component: () => <StatusBarItem title="가">가</StatusBarItem> },
				hidden: { align: "start", order: 2, Component: () => null },
			},
		);
		const region = screen.getByRole("region", { name: "상태" });
		expect(region.querySelectorAll("[data-slot=status-bar-cell]")).toHaveLength(1);
	});

	it("gives an item the screen it is on", () => {
		const Where = () => {
			const { screen: kind, collection } = useStatusBarContext();
			return <StatusBarItem title="위치">{`${kind}:${collection}`}</StatusBarItem>;
		};
		show({ screen: "list", collection: "post" }, { where: { align: "end", order: 1, Component: Where } });
		expect(bar().getByText("list:post")).toBeTruthy();
	});

	it("renders a link, a button or plain text by what the item leads to", () => {
		show(
			{ screen: "tools" },
			{
				link: {
					align: "start",
					order: 1,
					Component: () => (
						<StatusBarItem title="링크" href="/admin/x">
							링크
						</StatusBarItem>
					),
				},
				button: {
					align: "start",
					order: 2,
					Component: () => (
						<StatusBarItem title="버튼" onClick={() => {}}>
							버튼
						</StatusBarItem>
					),
				},
				plain: { align: "start", order: 3, Component: () => <StatusBarItem title="글">글</StatusBarItem> },
			},
		);
		expect(bar().getByRole("link", { name: "링크" })).toBeTruthy();
		expect(bar().getByRole("button", { name: "버튼" })).toBeTruthy();
		expect(bar().queryByRole("link", { name: "글" })).toBeNull();
		expect(bar().queryByRole("button", { name: "글" })).toBeNull();
	});

	it("lists the latest failed deliveries, retries them all and links to the event log", async () => {
		failed = 2;
		failures = [failure("a", "slack", "HTTP 500"), failure("b", "search-index", "timeout")];
		show({ screen: "tools" });
		fireEvent.click(await bar().findByRole("button", { name: /웹훅 2건 실패/ }));
		const popup = within(await screen.findByRole("dialog"));
		expect(await popup.findByText("slack")).toBeTruthy();
		expect(popup.getByText("HTTP 500")).toBeTruthy();
		expect(popup.getByText("search-index")).toBeTruthy();
		expect(popup.getByText("timeout")).toBeTruthy();
		expect(popup.getByRole("link", { name: "이벤트 로그 열기" }).getAttribute("href")).toMatch(/\/events$/);
		fireEvent.click(popup.getByRole("button", { name: /Retry all due|예정된 전달/ }));
		await waitFor(() => expect(retried).toHaveBeenCalledTimes(1));
	});

	it("shows no failed-delivery item when none failed", async () => {
		show({ screen: "tools" });
		await waitFor(() => expect(fetch).toHaveBeenCalled());
		expect(bar().queryByText(/실패/)).toBeNull();
	});

	it("shows no entry count on a list (the page header already has it)", () => {
		show({ screen: "list", collection: "post" });
		expect(bar().queryByText(/^\d+개$/)).toBeNull();
		expect(bar().queryAllByRole("button")).toHaveLength(0);
	});

	describe("popover", () => {
		const Popup = () => (
			<StatusBarItem title="팝업" popover={<StatusPopoverHeader title="제목" />}>
				열기
			</StatusBarItem>
		);
		const showPopup = () => show({ screen: "tools" }, { p: { align: "start", order: 1, Component: Popup } });

		it("opens on click, and Escape closes it with the focus back on the item", async () => {
			showPopup();
			const item = bar().getByRole("button", { name: "열기" });
			expect(screen.queryByRole("dialog")).toBeNull();
			fireEvent.click(item);
			expect(await screen.findByText("제목")).toBeTruthy();
			fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
			expect(document.activeElement).toBe(item);
		});

		it("opens from the keyboard with Enter", async () => {
			showPopup();
			const item = bar().getByRole("button", { name: "열기" });
			item.focus();
			// A browser turns an Enter that nobody prevented into a click on a button; jsdom does not, so the test does the same.
			if (fireEvent.keyDown(item, { key: "Enter" })) fireEvent.click(item);
			expect(await screen.findByText("제목")).toBeTruthy();
		});

		it("closes when a row is chosen", async () => {
			const chosen = vi.fn();
			show(
				{ screen: "tools" },
				{
					p: {
						align: "end",
						order: 1,
						Component: () => (
							<StatusBarItem title="팝업" popover={<StatusPopoverRow label="행" value="값" onClick={chosen} />}>
								열기
							</StatusBarItem>
						),
					},
				},
			);
			fireEvent.click(bar().getByRole("button", { name: "열기" }));
			fireEvent.click(await screen.findByRole("button", { name: /행/ }));
			expect(chosen).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		});
	});

	describe("editor popups", () => {
		const editor = (over: Partial<EditorStatus> = {}): EditorStatus => ({
			saveStatus: "saved",
			savedAt: Date.parse("2026-10-07T09:00:00.000Z"),
			statusLabel: "초안",
			charCount: 1200,
			readingMinutes: 2,
			bodyStats: { charsWithSpaces: 1500, words: 300, paragraphs: 12, headings: 3 },
			backupAvailable: true,
			recovery: null,
			translations: null,
			save: () => {},
			publishReadiness: null,
			textIssues: null,
			...over,
		});
		const showEditor = (over: Partial<EditorStatus> = {}, locale = "ko") =>
			show({ screen: "entry", collection: "post", entryId: "e1", locale, editor: editor(over) });
		const open = async (name: RegExp | string) => {
			fireEvent.click(bar().getByRole("button", { name }));
			return within(await screen.findByRole("dialog"));
		};

		it("offers Save now while there are unsaved changes", async () => {
			const save = vi.fn();
			showEditor({ saveStatus: "dirty", save });
			const popup = await open(/저장 전 변경사항/);
			expect(popup.getByText("초안")).toBeTruthy();
			expect(popup.getByText("마지막 저장")).toBeTruthy();
			fireEvent.click(popup.getByRole("button", { name: "지금 저장" }));
			expect(save).toHaveBeenCalledTimes(1);
			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		});

		it("offers Retry after a failed save, and nothing to do once saved", async () => {
			const save = vi.fn();
			showEditor({ saveStatus: "failed", save });
			const popup = await open(/저장 실패/);
			fireEvent.click(popup.getByRole("button", { name: "다시 시도" }));
			expect(save).toHaveBeenCalledTimes(1);
			cleanup();
			showEditor({ saveStatus: "saved" });
			const saved = await open(/저장됨/);
			expect(saved.queryByRole("button")).toBeNull();
		});

		it("offers to sign in again in a new tab when the session expired", async () => {
			showEditor({ saveStatus: "session-expired" });
			const popup = await open(/세션 만료/);
			const link = popup.getByRole("link", { name: "로그인" });
			expect(link.getAttribute("href")).toMatch(/\/login$/);
			expect(link.getAttribute("target")).toBe("_blank");
		});

		it("restores or discards the browser copy when one is offered", async () => {
			const restore = vi.fn();
			const discard = vi.fn();
			showEditor({ recovery: { restore, discard } });
			const popup = await open(/저장됨/);
			fireEvent.click(popup.getByRole("button", { name: "브라우저 사본 복원" }));
			expect(restore).toHaveBeenCalledTimes(1);
			expect(discard).not.toHaveBeenCalled();
		});

		it("lists the translations of the entry with a link to each other language", async () => {
			showEditor({
				translations: [
					{ id: "e1", locale: "ko", status: "draft", current: true },
					{ id: "e2", locale: "en", status: "published", current: false },
				],
			});
			const popup = await open(/^ko$/);
			const links = popup.getAllByRole("link");
			expect(links).toHaveLength(1);
			expect(links[0]?.getAttribute("href")).toMatch(/e2/);
		});

		it("shows the locale as plain text when the entry has no translations", () => {
			showEditor({ translations: null });
			expect(bar().queryByRole("button", { name: /^ko$/ })).toBeNull();
			expect(bar().getByText("ko")).toBeTruthy();
		});

		it("shows the extra counts of the body and the reading-time rule", async () => {
			showEditor();
			const popup = await open(/1,200/);
			for (const [label, value] of [
				["글자 수 (공백 제외)", "1,200"],
				["글자 수 (공백 포함)", "1,500"],
				["단어", "300"],
				["문단", "12"],
				["제목", "3"],
			] as const) {
				const row = popup.getByText(label).parentElement as HTMLElement;
				expect(within(row).getByText(value)).toBeTruthy();
			}
			expect(popup.getByText(/분당 약 500자/)).toBeTruthy();
		});

		describe("publish readiness item", () => {
			const readiness = (over: Partial<NonNullable<EditorStatus["publishReadiness"]>> = {}) => ({
				result: { issues: [], warnings: [] },
				checking: false,
				stale: false,
				recheck: () => {},
				focus: () => {},
				...over,
			});

			it("is absent when the editor has no readiness (trashed, unsaved) or no answer yet", () => {
				showEditor({ publishReadiness: null });
				expect(bar().queryByRole("button", { name: /발행/ })).toBeNull();
				cleanup();
				showEditor({ publishReadiness: readiness({ result: null }) });
				expect(bar().queryByRole("button", { name: /발행/ })).toBeNull();
			});

			it("words a problem the dictionary knows as a to-do and one it does not know with the server's text", async () => {
				const focus = vi.fn();
				showEditor({
					publishReadiness: readiness({
						focus,
						result: {
							issues: [
								{ code: "missing_image_alt", text: "서버 문구", path: "body", position: { blockId: "b1" } },
								{ code: "plugin_rule", text: "플러그인이 막았어요", path: "summary", where: "summary" },
							],
							warnings: [],
						},
					}),
				});
				const popup = await open(/^발행 전 2/);
				fireEvent.click(popup.getByRole("button", { name: /플러그인이 막았어요/ }));
				expect(focus).toHaveBeenCalledWith(expect.objectContaining({ code: "plugin_rule" }));
				await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
				const again = await open(/^발행 전 2/);
				expect(again.getByRole("button", { name: "이미지에 설명(alt)이 필요해요" })).toBeTruthy();
				expect(again.queryByText("서버 문구")).toBeNull();
			});

			it("names the thing a problem is about", async () => {
				showEditor({
					publishReadiness: readiness({
						result: { issues: [{ code: "code_ref_broken", text: "x", message: "foo", path: "body" }], warnings: [] },
					}),
				});
				const popup = await open(/^발행 전 1/);
				expect(popup.getByRole("button", { name: /코드 링크 `foo`/ })).toBeTruthy();
			});

			it("shows the checking state with no to-do rows, and the stale hint beside an old answer", async () => {
				showEditor({ publishReadiness: readiness({ checking: true, result: null }) });
				expect(bar().getByRole("button", { name: "검사 중…" })).toBeTruthy();
				cleanup();
				showEditor({ publishReadiness: readiness({ stale: true }) });
				const popup = await open(/^발행 준비됨/);
				expect(popup.getByText("(저장 후 다시 검사)")).toBeTruthy();
			});
		});
	});
});
