import { StatusBarPluginCell } from "@monti-cms/ui";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { screensMessages } from "../../messages";
import {
	StatusBar,
	type StatusBarContextValue,
	type StatusBarProps,
	StatusCellsProvider,
	useStatusBarContext,
} from "../status-bar";
import { statusBarMessages } from "../status-bar.messages";

const tStatusBar = testSite.createTranslator(statusBarMessages);
const tScreens = testSite.createTranslator(screensMessages);

const { render: renderWithRouter } = createTestRouter();
afterEach(cleanup);

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
const bar = () => within(screen.getByRole("region", { name: tStatusBar("label") }));

describe("save cell (flow 1 step 09)", () => {
	it("saves from the cell while there are unsaved changes", () => {
		const onSave = vi.fn();
		show(props({ save: { status: "dirty", savedAt: null, backupAvailable: true, onSave } }));
		fireEvent.click(bar().getByRole("button", { name: tStatusBar("save.dirty") }));
		expect(onSave).toHaveBeenCalledTimes(1);
	});

	it("leads to signing in, in a new tab, when the session expired", () => {
		show(props({ save: { status: "session-expired", savedAt: null, backupAvailable: true, onSave: () => {} } }));
		const link = bar().getByRole("link", { name: tStatusBar("save.session-expired") });
		expect(link.getAttribute("href")).toContain("/login");
		expect(link.getAttribute("target")).toBe("_blank");
	});
});

describe("to-do cell (flow 1 steps 10 to 13)", () => {
	const row = (key: string, title: string, detail?: string, onOpen?: () => void) => ({
		key,
		title,
		detail,
		doneLabel: undefined,
		onOpen,
	});
	const todo = (over: Partial<NonNullable<StatusBarProps["todo"]>> = {}): NonNullable<StatusBarProps["todo"]> => ({
		rows: [row("a", "요약 쓰기", "요약 · 비어 있음"), row("b", "대체 텍스트 없는 이미지 2개", "대표 이미지 · 본문 1")],
		done: ["제목 · 주소 · 대표 이미지"],
		...over,
	});

	it("counts the rows, and a row goes to its place when pressed", async () => {
		const onOpen = vi.fn();
		show(props({ todo: todo({ rows: [row("a", "요약 쓰기", "요약 · 비어 있음", onOpen), row("b", "이미지")] }) }));
		fireEvent.click(bar().getByRole("button", { name: "할 일 2" }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText(tStatusBar("todo.title"))).toBeInTheDocument();
		fireEvent.click(list.getByRole("button", { name: /요약 쓰기/ }));
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it("says nothing is left to do, and the list then holds only the check rows", async () => {
		show(props({ todo: todo({ rows: [], done: ["요약", "이미지 대체 텍스트 2개", "제목 · 주소"] }) }));
		fireEvent.click(bar().getByRole("button", { name: tStatusBar("todo.none") }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getByText("요약")).toBeInTheDocument();
		expect(list.getByText("이미지 대체 텍스트 2개")).toBeInTheDocument();
		expect(list.queryByRole("button")).toBeNull();
	});

	it("can be opened from outside, as a refused publish does", async () => {
		show(props({ todo: todo({ open: true, onOpenChange: () => {} }) }));
		expect(await screen.findByRole("dialog")).toBeInTheDocument();
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
		show(
			props({
				todo: {
					rows: [{ key: "a", title: "요약 쓰기", detail: undefined, doneLabel: undefined, onOpen: undefined }],
					done: [],
				},
			}),
			{
				spelling: SpellCell,
			},
		);
		const names = bar()
			.getAllByRole("button")
			.map((button) => button.textContent);
		expect(names).toEqual(["할 일 1", "맞춤법 2"]);
		fireEvent.click(bar().getByRole("button", { name: "맞춤법 2" }));
		const list = within(await screen.findByRole("dialog"));
		expect(list.getAllByRole("button", { name: "고치기" })).toHaveLength(2);
		expect(list.getByRole("button", { name: tScreens("sidebar.settings") })).toBeInTheDocument();
		expect(list.getByRole("button", { name: "모두 고치기" })).toBeInTheDocument();
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
		expect(bar().getByRole("button", { name: "검사 1" })).toBeInTheDocument();
		cleanup();
		show(props({ context: context({ locale: "en", textIssues: issues }) }), { where: Where });
		expect(bar().queryByRole("button", { name: /검사/ })).toBeNull();
	});
});
