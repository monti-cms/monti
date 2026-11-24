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
	RowCheck,
	Stack,
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

/**
 * 체크 열(`checkColumn`, `RowCheck place="cell"`): 모두 고르기와 행의 체크 상자가 표의 시작 선에 안쪽 여백 없이 선다. 고른 줄과 가리킨 줄의 바탕은
 * 체크 열을 포함해 시작 선부터 깔리고, 그 왼쪽으로 나가는 것은 없다. 다음 열의 글자는 시작 선에서 44px(2026-11-24 소유자 결정).
 */
export const CheckColumn: Story = {
	render: () => (
		<Table container="none" layout="fixed" columns={[LIST_COLUMN_SIZE.check, 120, undefined, LIST_COLUMN_SIZE.end]}>
			<ListHead
				checkColumn
				columns={[
					{ id: "status", label: "상태", menu: statusMenu },
					{ id: "title", label: "제목" },
				]}
				end={LIST_COLUMN_SIZE.end}
				selectAll={{ state: "some", onChange: () => {}, label: "이 페이지 모두 고르기" }}
			/>
			<TableBody>
				<TableRow>
					<TableCell>
						<RowCheck place="cell" checked={false} label="봄에 쓴 첫 글 고르기" />
					</TableCell>
					<TableCell>초안</TableCell>
					<TableCell>봄에 쓴 첫 글</TableCell>
					<TableCell />
				</TableRow>
				<TableRow selected>
					<TableCell>
						<RowCheck place="cell" checked label="여름 메모 고르기" />
					</TableCell>
					<TableCell>발행됨</TableCell>
					<TableCell>여름 메모</TableCell>
					<TableCell />
				</TableRow>
			</TableBody>
		</Table>
	),
};

/**
 * 필터를 끈 열 머리와 켠 열 머리를 위아래로 놓았다. 켠 열의 칩은 칸의 왼쪽 변에서 시작해 칸의 안쪽 여백을 덮고, 칩의 글자("상태", "김하늘")는 끈
 * 쪽의 이름과 같은 x와 y에 선다. 잉크 점은 값 뒤다(2026-11-24 소유자 결정: th 안에서 밀림 없음).
 */
export const FilterOnOff: Story = {
	render: () => (
		<Stack gap={24}>
			{[false, true].map((on) => (
				<Table key={String(on)} container="none" layout="fixed" columns={[128, undefined, 112, LIST_COLUMN_SIZE.end]}>
					<ListHead
						columns={[
							{
								id: "status",
								label: "상태",
								menu: statusMenu,
								filter: on ? { value: "초안", named: true, clearLabel: "상태 필터 지우기" } : undefined,
							},
							{ id: "title", label: "제목" },
							{
								id: "author",
								label: "글쓴이",
								menu: statusMenu,
								filter: on ? { value: "김하늘", clearLabel: "글쓴이 필터 지우기" } : undefined,
							},
						]}
						end={LIST_COLUMN_SIZE.end}
					/>
					<TableBody>
						<TableRow>
							<TableCell>초안</TableCell>
							<TableCell>봄에 쓴 첫 글</TableCell>
							<TableCell tone="muted">김하늘</TableCell>
							<TableCell />
						</TableRow>
					</TableBody>
				</Table>
			))}
		</Stack>
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
