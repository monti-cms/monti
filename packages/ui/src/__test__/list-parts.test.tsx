import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BulkBar } from "../bulk-bar";
import { DropdownMenuItem } from "../dropdown-menu";
import { Empty, EmptyStep } from "../empty";
import { RenameField } from "../rename-field";
import { RowActions, RowCheck, RowTitle, Table, TableBody, TableCell, TableRow } from "../table";
import { FolderTile, Tile } from "../tile";

afterEach(cleanup);

describe("list rows", () => {
	it("reports a change of the row check", () => {
		const onCheckedChange = vi.fn();
		render(
			<Table container="none">
				<TableBody>
					<TableRow>
						<TableCell>
							<RowCheck checked={false} onCheckedChange={onCheckedChange} label="첫 글 선택" />
							<RowTitle title="첫 글" address="/first-post" />
							<RowActions>⋯</RowActions>
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		fireEvent.click(screen.getByRole("checkbox", { name: "첫 글 선택" }));
		expect(onCheckedChange).toHaveBeenCalledWith(true);
	});
});

describe("BulkBar", () => {
	const inTable = (bar: React.ReactNode) => render(<table>{bar}</table>);

	it("shows the select-all as mixed while some are picked and picks the page when pressed", () => {
		const onChange = vi.fn();
		const bar = (state: "none" | "some" | "all") => (
			<BulkBar
				label="2개 선택"
				colSpan={3}
				selectAll={{ state, onChange, label: "모두 선택" }}
				clearLabel="선택 해제"
				onClear={() => {}}
			/>
		);
		const { rerender } = render(<table>{bar("some")}</table>);
		const check = screen.getByRole("checkbox", { name: "모두 선택" });
		expect(check.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(check);
		expect(onChange).toHaveBeenCalledWith(true);
		rerender(<table>{bar("all")}</table>);
		expect(screen.getByRole("checkbox", { name: "모두 선택" }).getAttribute("aria-checked")).toBe("true");
	});

	it("lists the count, the request, the two actions, the rest in ⋯ and the way to let go", async () => {
		const onRequest = vi.fn();
		const onClear = vi.fn();
		const onTrash = vi.fn();
		inTable(
			<BulkBar
				colSpan={3}
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

	it("runs the action of a failed upload", () => {
		const retry = vi.fn();
		render(
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
	});

	it("adds a check that reports a change", () => {
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
		fireEvent.click(screen.getByRole("checkbox", { name: "a.jpg 선택" }));
		expect(onSelectedChange).toHaveBeenCalledWith(true);
	});
});

describe("FolderTile", () => {
	it("keeps the ⋯ beside the folder button, not inside it", () => {
		render(<FolderTile name="covers" count={6} action={<button type="button">more</button>} />);
		const folder = screen.getByRole("button", { name: /^covers\s*6/ });
		const action = screen.getByRole("button", { name: "more" });
		expect(folder.contains(action)).toBe(false);
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
	it("makes a step with an address a link, and one without a button", () => {
		render(
			<Empty title="아직 글이 없어요." description="어디서부터 시작할까요?">
				<EmptyStep number="01">첫 글 쓰기</EmptyStep>
				<EmptyStep href="/data">쓰던 글 가져오기</EmptyStep>
			</Empty>,
		);
		expect(screen.getByRole("button", { name: /첫 글 쓰기/ })).toBeTruthy();
		expect(screen.getByRole("link", { name: /쓰던 글 가져오기/ }).getAttribute("href")).toBe("/data");
	});
});
