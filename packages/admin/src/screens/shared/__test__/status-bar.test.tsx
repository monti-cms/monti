import { StatusBarPluginCell } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import {
	StatusBar,
	type StatusBarContextValue,
	type StatusBarProps,
	StatusCellsProvider,
	useStatusBarContext,
} from "../status-bar";

const { render: renderWithRouter } = createTestRouter();
afterEach(cleanup);

const missing = { code: "missing_field", path: "title", message: "제목", text: "서버 문구", where: "title" };
const noAlt = { code: "missing_image_alt", path: "body", position: { blockId: "b1" }, text: "서버 문구" };

const context = (over: Partial<StatusBarContextValue> = {}): StatusBarContextValue => ({
	collection: "post",
	entryId: "e1",
	locale: "ko",
	textIssues: null,
	...over,
});

const props = (over: Partial<StatusBarProps> = {}): StatusBarProps => ({
	save: { status: "saved", savedAt: null, backupAvailable: true, onSave: () => {} },
	todo: null,
	chars: 1240,
	context: context(),
	...over,
});

const show = (barProps: StatusBarProps, cells: Record<string, () => React.ReactNode> = {}) =>
	renderWithRouter(
		withSite(
			<StatusCellsProvider cells={cells}>
				<StatusBar {...barProps} />
			</StatusCellsProvider>,
		),
	);
const bar = () => within(screen.getByRole("region", { name: "상태" }));

describe("save cell (flow 1 step 09)", () => {
	it("saves from the cell while there are unsaved changes", () => {
		const onSave = vi.fn();
		show(props({ save: { status: "dirty", savedAt: null, backupAvailable: true, onSave } }));
		fireEvent.click(bar().getByRole("button", { name: "저장 전 변경사항" }));
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("offers another try after a failed save", () => {
		const onSave = vi.fn();
		show(props({ save: { status: "failed", savedAt: null, backupAvailable: true, onSave } }));
		fireEvent.click(bar().getByRole("button", { name: "저장 실패 · 다시 시도" }));
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("says saved with the time, and has nothing to press", () => {
		show(
			props({
				save: {
					status: "saved",
					savedAt: Date.parse("2026-10-07T01:42:00.000Z"),
					backupAvailable: true,
					onSave: () => {},
				},
			}),
		);
		expect(bar().getByText(/^저장됨 /)).toBeTruthy();
		expect(bar().queryByRole("button", { name: /저장됨/ })).toBeNull();
	});

	it("leads to signing in, in a new tab, when the session expired", () => {
		show(props({ save: { status: "session-expired", savedAt: null, backupAvailable: true, onSave: () => {} } }));
		const link = bar().getByRole("link", { name: "세션 만료 · 로그인" });
		expect(link.getAttribute("href")).toContain("/login");
		expect(link.getAttribute("target")).toBe("_blank");
	});

	it("says in the tooltip when the browser keeps no backup", () => {
		show(props({ save: { status: "dirty", savedAt: null, backupAvailable: false, onSave: () => {} } }));
		expect(bar().getByRole("button", { name: "저장 전 변경사항" }).getAttribute("title")).toContain("복구 불가");
	});

	it("shows the character count as plain text at the end", () => {
		show(props({ chars: 1240 }));
		expect(bar().getByText("1,240자")).toBeTruthy();
		expect(bar().queryByRole("button", { name: /1,240/ })).toBeNull();
	});
});

describe("to-do cell (flow 1 steps 10 to 13)", () => {
	const todo = (over: Partial<NonNullable<StatusBarProps["todo"]>> = {}): NonNullable<StatusBarProps["todo"]> => ({
		issues: [missing, noAlt],
		done: ["주소", "대표 이미지"],
		focus: () => {},
		...over,
	});

	it("counts what is left and lists each problem as a row that goes to its place", async () => {
		const focus = vi.fn();
		show(props({ todo: todo({ focus }) }));
		fireEvent.click(bar().getByRole("button", { name: "할 일 2" }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText("발행 전에 고칠 것")).toBeTruthy();
		expect(list.getByText("이미지에 설명(alt)이 필요해요")).toBeTruthy();
		fireEvent.click(list.getByRole("button", { name: /제목을 입력해 주세요/ }));
		expect(focus).toHaveBeenCalledWith(expect.objectContaining({ path: "title" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("shows what is already right under the rows", async () => {
		show(props({ todo: todo() }));
		fireEvent.click(bar().getByRole("button", { name: "할 일 2" }));
		expect(within(await screen.findByRole("dialog")).getByText("주소 · 대표 이미지")).toBeTruthy();
	});

	it("says nothing is left to do, and the list then holds only what is right", async () => {
		show(props({ todo: todo({ issues: [], done: ["제목"] }) }));
		fireEvent.click(bar().getByRole("button", { name: "할 일 없음" }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText("제목")).toBeTruthy();
		expect(list.queryByRole("button")).toBeNull();
	});

	it("is not there when the entry cannot be checked", () => {
		show(props({ todo: null }));
		expect(bar().queryByRole("button", { name: /할 일/ })).toBeNull();
	});

	it("can be opened from outside, as a refused publish does", async () => {
		show(props({ todo: todo({ open: true, onOpenChange: () => {} }) }));
		expect(await screen.findByRole("dialog")).toBeTruthy();
	});
});

describe("plugin cell slot (flow 1 step 06, flow 3)", () => {
	const finding = (id: string, title: string) => ({
		id,
		title,
		detail: "문단 1",
		actionLabel: "고치기",
		onAction: () => {},
	});
	const SpellCell = () => (
		<StatusBarPluginCell
			label="맞춤법"
			findings={[finding("1", "몇일 → 며칠"), finding("2", "안되요 → 안 돼요")]}
			settings={{ label: "설정", onClick: () => {} }}
			fixAll={{ label: "모두 고치기", onClick: () => {} }}
		/>
	);

	it("draws the plugin's cell after the to-do cell, and its rows, settings and fix all open from it", async () => {
		show(props({ todo: { issues: [missing], done: [], focus: () => {} } }), { spelling: SpellCell });
		const names = bar()
			.getAllByRole("button")
			.map((button) => button.textContent);
		expect(names).toEqual(["할 일 1", "맞춤법 2"]);
		fireEvent.click(bar().getByRole("button", { name: "맞춤법 2" }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getAllByRole("button", { name: "고치기" })).toHaveLength(2);
		expect(list.getByRole("button", { name: "설정" })).toBeTruthy();
		expect(list.getByRole("button", { name: "모두 고치기" })).toBeTruthy();
	});

	it("draws no cell for a plugin that has nothing to show", () => {
		show(props(), { quiet: () => null });
		expect(bar().queryByRole("button", { name: /맞춤법/ })).toBeNull();
	});

	it("tells the plugin where it is: the language of the entry and the text findings", () => {
		const Where = () => {
			const { locale, collection, textIssues } = useStatusBarContext();
			return locale === "ko" ? (
				<StatusBarPluginCell label="검사" findings={[finding("1", `${collection}:${textIssues?.count}`)]} />
			) : null;
		};
		const issues = { count: 3, items: [], fixAll: null };
		show(props({ context: context({ locale: "ko", textIssues: issues }) }), { where: Where });
		expect(bar().getByRole("button", { name: "검사 1" })).toBeTruthy();
		cleanup();
		show(props({ context: context({ locale: "en", textIssues: issues }) }), { where: Where });
		expect(bar().queryByRole("button", { name: /검사/ })).toBeNull();
	});
});
