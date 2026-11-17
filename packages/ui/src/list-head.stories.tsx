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
type Id = keyof typeof KIND;

/** The head of a list whose columns the admin resizes: the widths live in the story's state, as the screen keeps them per collection. */
function ResizableHead({ start }: { start: Partial<Record<Id, number>> }) {
	const [widths, setWidths] = React.useState<Partial<Record<Id, number>>>(start);
	const size = (id: keyof typeof KIND) => widths[id] ?? KIND[id];
	const onResize = (changes: Record<string, number | null>) =>
		setWidths((current) =>
			Object.fromEntries(
				Object.entries({ ...current, ...changes }).filter((entry): entry is [string, number] => entry[1] !== null),
			),
		);
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
 * The edge between two columns has a handle inside the right edge of the column on its left, invisible until pointed at or focused. Here the edge
 * between the summary and the date has the keyboard focus and was stepped right once: the summary is 16px wider and the date 16px narrower, the
 * row keeps its width. An edge beside the title widens or narrows the title, which takes the room left.
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
