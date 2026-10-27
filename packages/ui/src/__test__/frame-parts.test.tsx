import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Banner } from "../banner";
import { EntryStatus } from "../entry-status";
import { PageHeader, PageToolbar, PageToolbarEnd } from "../page-header";
import { SheetList } from "../sheet-list";
import { StatusBar, StatusBarCell, StatusBarPluginCell, StatusBarSpacer } from "../status-bar";
import { TodoItem } from "../todo-item";

afterEach(cleanup);

describe("PageHeader", () => {
	it("makes the title the page's first heading, and puts the address and the actions beside it", () => {
		render(
			<PageHeader title="게시글" meta="/posts/:slug">
				<button type="button">새 글</button>
			</PageHeader>,
		);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("게시글");
		expect(screen.getByText("/posts/:slug").className).toContain("font-mono");
		expect(screen.getByRole("button", { name: "새 글" }).parentElement?.className).toContain("ml-auto");
	});

	it("leaves out the address and the actions when there are none", () => {
		render(<PageHeader title="설정" />);
		expect(screen.getByRole("banner").children).toHaveLength(1);
	});
});

describe("PageToolbar", () => {
	it("keeps its right group at the end, and goes 12px inside only over a table", () => {
		const { rerender } = render(
			<PageToolbar data-testid="bar">
				탭<PageToolbarEnd>필터</PageToolbarEnd>
			</PageToolbar>,
		);
		expect(screen.getByText("필터").className).toContain("ml-auto");
		expect(screen.getByTestId("bar").className).not.toContain("px-monti-12");
		rerender(
			<PageToolbar data-testid="bar" inset>
				탭
			</PageToolbar>,
		);
		expect(screen.getByTestId("bar").className).toContain("px-monti-12");
	});
});

describe("Banner", () => {
	it("announces its sentence with the detail and the actions", () => {
		render(
			<Banner title="원문이 바뀌었어요" meta="10. 26">
				<button type="button">비교</button>
			</Banner>,
		);
		const banner = screen.getByRole("status");
		expect(banner.textContent).toContain("원문이 바뀌었어요");
		expect(banner.textContent).toContain("10. 26");
		expect(screen.getByRole("button", { name: "비교" })).toBeTruthy();
	});
});

describe("EntryStatus", () => {
	it("draws a mark of each status and hides it from screen readers, so the name is what is read", () => {
		render(<EntryStatus status="draft">초안</EntryStatus>);
		const status = screen.getByText("초안");
		expect(status.getAttribute("data-status")).toBe("draft");
		const mark = status.querySelector("[data-slot=entry-status-mark]");
		expect(mark?.getAttribute("aria-hidden")).toBe("true");
		// A draft is an empty ring and an archived entry a bar: the shape, not only the color, says which.
		expect(mark?.className).toContain("border-[1.5px]");
		cleanup();
		render(<EntryStatus status="archived">보관됨</EntryStatus>);
		expect(document.querySelector("[data-slot=entry-status-mark]")?.className).toContain("h-0.5");
	});

	it("follows the surrounding text color on a dark pill", () => {
		render(
			<EntryStatus status="published" ink>
				발행됨
			</EntryStatus>,
		);
		expect(screen.getByText("발행됨").className).not.toContain("text-monti-success");
	});
});

describe("StatusBar", () => {
	it("is drawn only while it has a cell", () => {
		const { container } = render(<StatusBar aria-label="상태" />);
		// Hidden by default, shown by the presence of a cell: the rule is in its classes, so check that a cell is what turns it on.
		expect(container.querySelector("section")?.className).toContain("hidden");
		expect(container.querySelector("section")?.className).toContain("has-[[data-slot=status-bar-cell]]:flex");
	});

	it("draws a cell as a button, or as what it is given, with a dot when something needs attention", () => {
		render(
			<StatusBar aria-label="상태">
				<StatusBarCell tone="danger">할 일 1</StatusBarCell>
				<StatusBarSpacer />
				<StatusBarCell end render={<span />}>
					1,240자
				</StatusBarCell>
			</StatusBar>,
		);
		const todo = screen.getByRole("button", { name: "할 일 1" });
		expect(todo.querySelector("[data-slot=status-bar-dot]")).toBeTruthy();
		expect(todo.className).toContain("text-monti-danger");
		const count = screen.getByText("1,240자");
		expect(count.tagName).toBe("SPAN");
		expect(count.getAttribute("data-slot")).toBe("status-bar-cell");
		expect(count.querySelector("[data-slot=status-bar-dot]")).toBeNull();
	});
});

describe("StatusBarPluginCell", () => {
	it("shows its name and count, lists each finding with its action, and runs the list's two actions", async () => {
		const onFix = vi.fn();
		const onFixAll = vi.fn();
		const onSettings = vi.fn();
		const onOpen = vi.fn();
		render(
			<StatusBar aria-label="상태">
				<StatusBarPluginCell
					label="맞춤법"
					defaultOpen
					findings={[
						{ id: "a", title: "됬다 → 됐다", detail: "둘째 문단", actionLabel: "고치기", onAction: onFix, onOpen },
						{ id: "b", title: "안되 → 안 돼", blocking: true },
					]}
					settings={{ label: "설정", onClick: onSettings }}
					fixAll={{ label: "모두 고치기", onClick: onFixAll }}
				/>
			</StatusBar>,
		);
		const cell = screen.getByRole("button", { name: "맞춤법 2" });
		expect(cell.className).toContain("text-monti-danger");
		expect(cell.getAttribute("data-slot")).toBe("status-bar-cell");
		await screen.findByText("됬다 → 됐다");
		fireEvent.click(screen.getByRole("button", { name: "고치기" }));
		expect(onFix).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: /됬다/ }));
		expect(onOpen).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		fireEvent.click(screen.getByRole("button", { name: "모두 고치기" }));
		expect(onSettings).toHaveBeenCalledOnce();
		expect(onFixAll).toHaveBeenCalledOnce();
	});
});

describe("TodoItem", () => {
	it("says in words that a row blocks publishing, not by the red ring alone", () => {
		const { rerender } = render(<TodoItem blocking title="제목이 비어 있어요" />);
		expect(screen.getByText("Blocks publishing")).toBeTruthy();
		rerender(<TodoItem title="제목이 비어 있어요" />);
		expect(screen.queryByText("Blocks publishing")).toBeNull();
	});

	it("is not a button for the whole row unless it goes somewhere", () => {
		render(<TodoItem title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={() => {}} />);
		expect(screen.getAllByRole("button")).toHaveLength(1);
	});

	// The design's `.act` has no border and no background: plain muted text. A box around it is the focus ring of a popover that moved focus there.
	it("is plain text with no box, and an opening list does not put focus on it", async () => {
		render(
			<SheetList defaultOpen label="할 일" count={1} trigger={<StatusBarCell>할 일 1</StatusBarCell>}>
				<TodoItem blocking title="제목이 비어 있어요" actionLabel="이동" onAction={() => {}} />
			</SheetList>,
		);
		const action = await screen.findByRole("button", { name: "이동" });
		expect(action.className).toContain("border-0");
		expect(action.className).toContain("bg-transparent");
		await waitFor(() => expect(document.activeElement).not.toBe(action));
		expect(document.activeElement?.getAttribute("data-slot")).toBe("sheet-list");
	});
});
