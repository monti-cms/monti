import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
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
