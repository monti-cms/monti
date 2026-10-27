import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkBar } from "../bulk-bar";
import { DropArea } from "../drop-area";
import { DropdownMenuItem } from "../dropdown-menu";
import { Empty, EmptyStep } from "../empty";
import { PageToolbar } from "../page-header";
import { RenameField } from "../rename-field";
import { RowActions, RowCheck, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { FolderTile, Tile } from "../tile";

afterEach(cleanup);

describe("list rows", () => {
	it("marks a picked row, and a row the assistant picked", () => {
		render(
			<Table>
				<TableBody>
					<TableRow data-testid="plain">
						<TableCell>a</TableCell>
					</TableRow>
					<TableRow data-testid="picked" selected>
						<TableCell>b</TableCell>
					</TableRow>
					<TableRow data-testid="proposed" selected proposal>
						<TableCell>c</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		expect(screen.getByTestId("plain").hasAttribute("data-selected")).toBe(false);
		expect(screen.getByTestId("picked").getAttribute("data-selected")).toBe("true");
		expect(screen.getByTestId("picked").hasAttribute("data-proposal")).toBe(false);
		expect(screen.getByTestId("proposed").getAttribute("data-proposal")).toBe("true");
	});

	it("hangs the check outside the row, reports a change, and keeps the title over its address", () => {
		const onCheckedChange = vi.fn();
		render(
			<Table container="none">
				<TableBody>
					<TableRow>
						<TableCell>
							<RowCheck checked={false} onCheckedChange={onCheckedChange} label="첫 글 선택" />
							<RowTitle title="첫 글" address="/first-post" />
							<RowActions data-testid="actions">⋯</RowActions>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		expect(document.querySelector("[data-slot=row-check]")?.className).toContain("-left-[26px]");
		fireEvent.click(screen.getByRole("checkbox", { name: "첫 글 선택" }));
		expect(onCheckedChange).toHaveBeenCalledWith(true);
		expect(screen.getByText("/first-post").className).toContain("font-mono");
		expect(screen.getByTestId("actions").className).toContain("group-hover/row:opacity-100");
	});
});

describe("PageToolbar and BulkBar", () => {
	it("shows the select-all as mixed while some are picked and picks the page when pressed", () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<PageToolbar inset selectAll={{ state: "some", onChange, label: "모두 선택" }}>
				탭
			</PageToolbar>,
		);
		const check = screen.getByRole("checkbox", { name: "모두 선택" });
		expect(check.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(check);
		expect(onChange).toHaveBeenCalledWith(true);
		rerender(
			<PageToolbar inset selectAll={{ state: "all", onChange, label: "모두 선택" }}>
				탭
			</PageToolbar>,
		);
		expect(screen.getByRole("checkbox", { name: "모두 선택" }).getAttribute("aria-checked")).toBe("true");
		rerender(
			<PageToolbar inset selectAll={{ state: "none", onChange, label: "모두 선택" }}>
				탭
			</PageToolbar>,
		);
		expect(document.querySelector("[data-slot=select-all]")?.className).toContain("opacity-0");
	});

	it("lists the count, the request, the two actions, the rest in ⋯ and the way to let go", async () => {
		const onRequest = vi.fn();
		const onClear = vi.fn();
		const onTrash = vi.fn();
		render(
			<BulkBar
				label="2개 선택"
				request={{ label: "요청", onClick: onRequest }}
				more={{
					label: "더 보기",
					children: (
						<DropdownMenuItem variant="danger" onClick={onTrash}>
							휴지통으로
						</DropdownMenuItem>
					),
				}}
				clearLabel="선택 해제"
				onClear={onClear}
			>
				<button type="button">발행</button>
				<button type="button">폴더로</button>
			</BulkBar>,
		);
		expect(screen.getByRole("toolbar", { name: "2개 선택" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "요청" }));
		expect(onRequest).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
		expect(onClear).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: "휴지통으로" }));
		expect(onTrash).toHaveBeenCalledOnce();
	});
});

describe("Tile", () => {
	const preview = <span>미리보기</span>;

	it("shows the progress of an upload, and what can be done about a failed one", () => {
		const retry = vi.fn();
		const { rerender } = render(
			<Tile preview={preview} title="hero.png" detail="올리는 중 · 64%" status="uploading" progress={64} />,
		);
		expect(document.querySelector("[data-status=uploading] [style]")?.getAttribute("style")).toContain("64%");
		rerender(
			<Tile
				preview={preview}
				title="panorama.jpg"
				detail="14 MB"
				status="failed"
				actions={[{ label: "줄여서 다시", onClick: retry, primary: true }]}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "줄여서 다시" }));
		expect(retry).toHaveBeenCalledOnce();
		expect(screen.getByText("14 MB").className).toContain("text-monti-danger");
	});

	it("adds a check that reports a change, and puts the suggestion in the detail's place", () => {
		const onSelectedChange = vi.fn();
		render(
			<Tile
				preview={preview}
				title="a.jpg"
				detail="2400×1600"
				proposal="아침 책상"
				onSelectedChange={onSelectedChange}
				selectLabel="a.jpg 선택"
			/>,
		);
		expect(screen.queryByText("2400×1600")).toBeNull();
		expect(screen.getByText("아침 책상").className).toContain("bg-monti-proposal-muted");
		fireEvent.click(screen.getByRole("checkbox", { name: "a.jpg 선택" }));
		expect(onSelectedChange).toHaveBeenCalledWith(true);
	});

	it("marks the folder files are dragged over", () => {
		render(<FolderTile name="covers" count={6} dropTarget />);
		const folder = screen.getByRole("button", { name: /covers/ });
		expect(folder.getAttribute("data-drop-target")).toBe("true");
		expect(folder.className).toContain("bg-monti-selected");
	});
});

describe("DropArea", () => {
	it("covers the area only while files are over it", () => {
		const { rerender } = render(<DropArea>tiles</DropArea>);
		expect(document.querySelector("[data-slot=drop-area-overlay]")).toBeNull();
		rerender(<DropArea over>tiles</DropArea>);
		const overlay = document.querySelector("[data-slot=drop-area-overlay]");
		expect(overlay?.className).toContain("mix-blend-multiply");
		expect(overlay?.className).toContain("monti-dark:mix-blend-screen");
	});
});

describe("RenameField", () => {
	it("opens with the name selected, keeps it once on Enter, and drops it on Escape", async () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		render(
			<RenameField
				value="새 폴더"
				onValueChange={() => {}}
				onCommit={onCommit}
				onCancel={onCancel}
				label="폴더 이름"
			/>,
		);
		const field = screen.getByRole("textbox", { name: "폴더 이름" }) as HTMLInputElement;
		await waitFor(() => expect(document.activeElement).toBe(field));
		expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
		fireEvent.keyDown(field, { key: "Enter" });
		fireEvent.blur(field);
		expect(onCommit).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
	});

	it("cancels on Escape without keeping the name when it loses focus afterwards", () => {
		const onCommit = vi.fn();
		const onCancel = vi.fn();
		render(
			<RenameField value="x" onValueChange={() => {}} onCommit={onCommit} onCancel={onCancel} label="폴더 이름" />,
		);
		const field = screen.getByRole("textbox", { name: "폴더 이름" });
		fireEvent.keyDown(field, { key: "Escape" });
		fireEvent.blur(field);
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onCommit).not.toHaveBeenCalled();
	});
});

describe("Empty", () => {
	it("lists what can be done as steps, numbered only when given, and a step can be a link", () => {
		render(
			<Empty title="아직 글이 없어요." description="어디서부터 시작할까요?">
				<EmptyStep number="01">첫 글 쓰기</EmptyStep>
				<EmptyStep href="/data">쓰던 글 가져오기</EmptyStep>
			</Empty>,
		);
		expect(screen.getByRole("button", { name: /첫 글 쓰기/ }).textContent).toContain("01");
		const link = screen.getByRole("link", { name: /쓰던 글 가져오기/ });
		expect(link.getAttribute("href")).toBe("/data");
		expect(link.textContent).not.toMatch(/\d\d/);
	});
});
