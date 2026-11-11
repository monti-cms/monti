import type { ComponentProps } from "react";
import { Add, ColumnInsert, Draggable, TrashCan } from "../../icons";
import {
	Box,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EditorBody,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
} from "../../index";
import { EditorPage, EntryHeader, EntryTitle } from "./editor-notion";

/**
 * Editing a table in the body (T62, 2026-11-06 owner: Notion's way). The table is a light grid, the head row only bolder. With the caret in a cell, a
 * quiet grip sits on the top edge of its column and the left edge of its row; a grip opens that column's or row's menu (`gridMenu`). Under the
 * pointer, a + strip on the right edge adds a column, and one on the bottom edge a row (`gridAdd`).
 */
export type TableToolsState = "grid" | "gridMenu" | "gridAdd";

const HEAD = ["버전", "바뀐 것", "날짜"];
const ROWS = [
	["1.0", "처음 공개", "2024-03-02"],
	["2.0", "편집기 다시 만들기", "2025-11-20"],
	["2.1", "표와 각주", "2026-11-06"],
];

/** The caret, at the end of the cell's text. */
function Caret() {
	// design-allow: the caret is drawn where the engine would put it
	return <span className="ml-px inline-block h-[1.1em] w-px translate-y-[2px] bg-monti-emphasis" />;
}

/** A grip on the table's edge: a small quiet pill with the drag mark; ink while its menu is open. */
function Grip({
	along,
	active = false,
	className,
	...props
}: ComponentProps<"span"> & { along: "column" | "row"; active?: boolean; className: string }) {
	return (
		<span
			{...props}
			// The reference's drawing of the grip: it carries the part's name, as `TableGrip` does on a screen.
			data-slot="table-grip"
			className={`absolute flex items-center justify-center rounded-monti-sm ${
				active ? "bg-monti-emphasis text-monti-on-emphasis" : "bg-monti-muted text-monti-subtle"
			} ${along === "column" ? "h-monti-12 w-monti-20" : "h-monti-20 w-monti-12"} ${className}`}
		>
			<Draggable aria-hidden className={`size-3 ${along === "column" ? "rotate-90" : ""}`} />
		</span>
	);
}

/** Notion's: a light grid; the head row only bolder. */
const GRID =
	"w-full border-collapse [&_td]:border [&_td]:border-monti-muted [&_th]:border [&_th]:border-monti-muted [&_th]:font-semibold";

function GridTable({ state }: { state: TableToolsState }) {
	const menu = state === "gridMenu";
	const column = "-top-monti-6 left-[37%]";
	return (
		<Box position="relative">
			{menu ? (
				<DropdownMenu open modal={false}>
					<DropdownMenuTrigger nativeButton={false} render={<Grip along="column" active className={column} />} />
					<DropdownMenuContent side="bottom" align="start" sideOffset={6}>
						<DropdownMenuItem>
							<ColumnInsert aria-hidden className="rotate-180" />
							왼쪽에 열 넣기
						</DropdownMenuItem>
						<DropdownMenuItem>
							<ColumnInsert aria-hidden />
							오른쪽에 열 넣기
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="danger">
							<TrashCan aria-hidden />열 지우기
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<Grip along="column" className={column} />
			)}
			{menu ? null : <Grip along="row" className="top-[78px] -left-monti-6" />}
			<table className={`${GRID} mb-0!`}>
				<tbody>
					<tr>
						{HEAD.map((name, index) => (
							<th key={name} className={menu && index === 1 ? "bg-monti-selected" : undefined}>
								{name}
							</th>
						))}
					</tr>
					{ROWS.map((row, rowIndex) => (
						<tr key={row[0]}>
							{row.map((cell, index) => (
								<td key={index} className={menu && index === 1 ? "bg-monti-selected" : undefined}>
									{cell}
									{!menu && rowIndex === 1 && index === 1 ? <Caret /> : null}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			{state === "gridAdd" ? (
				// Only under the pointer, at the right edge: the strip that adds a column.
				<span className="absolute top-0 -right-monti-20 bottom-0 flex w-monti-16 items-center justify-center rounded-monti-md bg-monti-muted text-monti-subtle">
					<Add aria-hidden className="size-3.5" />
				</span>
			) : null}
		</Box>
	);
}

export function TableToolsScreen({ state }: { state: TableToolsState }) {
	return (
		<EditorPage
			header={
				<EntryHeader
					address="/posts/changelog"
					status="editing"
					statusLabel="수정 중"
					panel={false}
					panelOpen={false}
				/>
			}
			statusBar={
				<StatusBar>
					<StatusBarCell tone="warning">저장 전 변경사항</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end render={<span />}>
						412자
					</StatusBarCell>
				</StatusBar>
			}
		>
			<EntryTitle>바뀐 것들</EntryTitle>
			<EditorBody>
				<div className="ProseMirror">
					<p>버전마다 무엇이 바뀌었는지 적어 둔다. 지난 판에서 무엇을 덜어냈는지는 아래에 따로 적었다.</p>
					<Box paddingTop={12} paddingBottom={32}>
						<GridTable state={state} />
					</Box>
					<p>다음 버전은 아직 정하지 않았다.</p>
				</div>
			</EditorBody>
		</EditorPage>
	);
}
