import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Banner } from "../banner";
import { EntryStatus } from "../entry-status";
import { PageHeader } from "../page-header";
import { StatusBar, StatusBarCell, StatusBarPluginCell } from "../status-bar";
import { StatusBarList } from "../status-bar-list";
import { TodoDone, TodoItem } from "../todo-item";

afterEach(cleanup);

describe("PageHeader", () => {
	it("makes the title the page's first heading", () => {
		render(
			<PageHeader title="게시글" meta="/posts/:slug">
				<button type="button">새 글</button>
			</PageHeader>,
		);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("게시글");
	});
});

describe("Banner", () => {
	it("is announced as a status", () => {
		render(
			<Banner title="원문이 바뀌었어요" meta="10. 26">
				<button type="button">비교</button>
			</Banner>,
		);
		expect(screen.getByRole("status").textContent).toContain("원문이 바뀌었어요");
	});
});

describe("EntryStatus", () => {
	it("hides the mark from screen readers, so the name is what is read", () => {
		render(<EntryStatus status="draft">초안</EntryStatus>);
		const status = screen.getByText("초안");
		const mark = status.querySelector("[data-slot=entry-status-mark]");
		expect(mark?.getAttribute("aria-hidden")).toBe("true");
		// The name is the text; the mark carries nothing a screen reader would read twice.
		expect(mark?.textContent).toBe("");
	});
});

describe("StatusBar", () => {
	it("runs a row's action", async () => {
		const onAction = vi.fn();
		render(
			<StatusBarList trigger={<button type="button">고칠 것 2</button>} label="고칠 것" count={2} defaultOpen>
				<TodoItem blocking title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={onAction} />
				<TodoDone>요약 확인함</TodoDone>
			</StatusBarList>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "이동" }));
		expect(onAction).toHaveBeenCalledOnce();
	});
});

describe("StatusBarPluginCell", () => {
	it("runs each finding's action and the list's two actions", async () => {
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
		expect(screen.getByText("Blocks publishing")).toBeInTheDocument();
		rerender(<TodoItem title="제목이 비어 있어요" />);
		expect(screen.queryByText("Blocks publishing")).toBeNull();
	});

	it("is not a button for the whole row unless it goes somewhere", () => {
		render(<TodoItem title="제목이 비어 있어요" detail="제목" actionLabel="이동" onAction={() => {}} />);
		expect(screen.getAllByRole("button")).toHaveLength(1);
	});

	// A box around the action would be the focus ring of a popover that moved focus there.
	it("an opening list puts focus on its card, not on the first action", async () => {
		render(
			<StatusBarList defaultOpen label="할 일" count={1} trigger={<StatusBarCell>할 일 1</StatusBarCell>}>
				<TodoItem blocking title="제목이 비어 있어요" actionLabel="이동" onAction={() => {}} />
			</StatusBarList>,
		);
		const action = await screen.findByRole("button", { name: "이동" });
		await waitFor(() => expect(document.activeElement).not.toBe(action));
		expect(document.activeElement?.getAttribute("data-slot")).toBe("status-bar-list");
	});
});
