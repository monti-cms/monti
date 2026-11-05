import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	LIST_COLUMN_SIZE,
	ListHead,
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "./index";

/**
 * The head row of a list: each column's name is a button that opens its menu (sort | filter values | hide). The sorted column is ink with ↓ or ↑,
 * a filtered one has a dot, and the + at the end lists the columns that are off.
 */
const meta = {
	title: "Patterns/List/ListHead",
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const statusMenu = (
	<>
		<DropdownMenuCheckboxItem box checked closeOnClick={false}>
			발행됨
		</DropdownMenuCheckboxItem>
		<DropdownMenuCheckboxItem box closeOnClick={false}>
			수정 중
		</DropdownMenuCheckboxItem>
		<DropdownMenuCheckboxItem box closeOnClick={false}>
			초안
		</DropdownMenuCheckboxItem>
	</>
);

const dateMenu = (
	<>
		<DropdownMenuRadioGroup value="desc">
			<DropdownMenuRadioItem value="desc">최근부터</DropdownMenuRadioItem>
			<DropdownMenuRadioItem value="asc">오래전부터</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
		<DropdownMenuSeparator />
		<DropdownMenuRadioGroup value="">
			<DropdownMenuRadioItem value="today">오늘</DropdownMenuRadioItem>
			<DropdownMenuRadioItem value="7">최근 7일</DropdownMenuRadioItem>
		</DropdownMenuRadioGroup>
	</>
);

/** A filtered status column, a title sorted by nothing, the date sorted newest first; + offers the columns that are off. */
export const Head: Story = {
	render: () => (
		<Table container="none" layout="fixed" columns={[120, undefined, 140, 48]}>
			<ListHead
				columns={[
					{ id: "status", label: "상태", filtered: true, menu: statusMenu },
					{ id: "title", label: "제목" },
					{ id: "updated", label: "수정한 날", sort: "desc", menu: dateMenu },
				]}
				add={{ label: "열 추가", columns: [{ id: "tags", label: "태그" }], onAdd: () => {} }}
				selectAll={{ state: "none", onChange: () => {}, label: "모두 선택" }}
				moveLabel="열 옮기기"
				onPlace={() => {}}
			/>
			<TableBody>
				<TableRow>
					<TableCell>발행됨</TableCell>
					<TableCell>봄에 쓴 첫 글</TableCell>
					<TableCell tone="muted">10. 28</TableCell>
					<TableCell />
				</TableRow>
			</TableBody>
		</Table>
	),
};

const KIND = {
	status: LIST_COLUMN_SIZE.status,
	summary: LIST_COLUMN_SIZE.many,
	updated: LIST_COLUMN_SIZE.date,
} as const;

/** The head of a list whose columns the admin resizes: the widths live in the story's state, as the screen keeps them per collection. */
function ResizableHead({ start }: { start: Partial<Record<keyof typeof KIND, number>> }) {
	const [widths, setWidths] = React.useState<Partial<Record<keyof typeof KIND, number>>>(start);
	const size = (id: keyof typeof KIND) => widths[id] ?? KIND[id];
	const onResize = (id: string, width: number | null) =>
		setWidths((current) => {
			const { [id as keyof typeof KIND]: _old, ...others } = current;
			return width === null ? others : { ...others, [id]: width };
		});
	return (
		<Table
			container="none"
			layout="fixed"
			columns={[size("status"), undefined, size("summary"), size("updated"), LIST_COLUMN_SIZE.end]}
		>
			<ListHead
				columns={[
					{ id: "status", label: "상태", size: size("status"), kindSize: KIND.status, menu: statusMenu },
					{ id: "title", label: "제목" },
					{ id: "summary", label: "요약", size: size("summary"), kindSize: KIND.summary },
					{
						id: "updated",
						label: "수정일",
						align: "end",
						sort: "desc",
						size: size("updated"),
						kindSize: KIND.updated,
						menu: dateMenu,
					},
				]}
				end={LIST_COLUMN_SIZE.end}
				moveLabel="열 옮기기"
				onPlace={() => {}}
				onResize={onResize}
				resizeLabel={(label) => `${label} 열 너비 조절`}
			/>
			<TableBody>
				<TableRow>
					<TableCell>발행됨</TableCell>
					<TableCell truncate>리액트 19 마이그레이션, 서버 컴포넌트와 액션까지 한 번에 옮긴 기록</TableCell>
					<TableCell tone="subtle" truncate>
						서버 컴포넌트와 액션을 옮기며 겪은 일
					</TableCell>
					<TableCell align="end" tone="muted">
						8. 3
					</TableCell>
					<TableCell />
				</TableRow>
			</TableBody>
		</Table>
	);
}

/**
 * Every column but the title and the end cell has a handle on its right edge, invisible until pointed at or focused. Here the summary column was dragged
 * wider and its handle has the keyboard focus: the accent line inside the column's right edge. ← → step it by 16px (Shift 64), double-click goes back to
 * its kind's width; the title gives up the room.
 */
export const Resizable: Story = {
	render: () => <ResizableHead start={{ summary: 240 }} />,
	play: async ({ canvasElement }) => {
		const handle = within(canvasElement).getByRole("separator", { name: "요약 열 너비 조절" });
		handle.focus();
		await userEvent.keyboard("{ArrowRight}");
		await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", "256"));
	},
};

/** Mid-drag: the pointer holds the date column's handle and has moved it 60px right; the line stays drawn while it is held. */
export const Resizing: Story = {
	render: () => <ResizableHead start={{}} />,
	play: async ({ canvasElement }) => {
		const handle = within(canvasElement).getByRole("separator", { name: "수정일 열 너비 조절" });
		const box = handle.getBoundingClientRect();
		const y = box.top + box.height / 2;
		const at = (type: string, x: number) =>
			handle.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, buttons: 1, clientX: x, clientY: y }));
		at("pointerdown", box.left);
		at("pointermove", box.left + 30);
		at("pointermove", box.left + 60);
		await waitFor(() => expect(handle).toHaveAttribute("aria-valuenow", String(LIST_COLUMN_SIZE.date + 60)));
	},
};
