import { OverflowMenuHorizontal } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
} from "./dropdown-menu";
import { IconButton } from "./icon-button";
import { ListHead, type ListHeadColumn } from "./list-head";
import { MenuShortcut } from "./menu-parts";
import { RowActions, RowTitle, Table, TableBody, TableCell, TableRow } from "./table";
import { Text } from "./text";

const SORT_ORDER = ["asc", "desc"] as const;

/**
 * The head row of a list. Every name is a button: pressed (not dragged) it opens that column's menu under the name, with the rows the screen gives it —
 * sort, the values to filter by, hide. The sorted column is in ink with its arrow, a filtered column has a dot, and the + at the end lists the columns
 * that are off. Names drag sideways to move the column, or move with Alt and ← →.
 */
const meta = {
	title: "Patterns/List/List head",
	component: ListHead,
	decorators: [
		(Story) => (
			<div className="w-[880px] pt-monti-4 pb-[320px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ListHead>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

function Rows({ ids }: { ids: readonly string[] }) {
	const cell: Record<string, React.ReactNode> = {
		status: <Text tone="subtle">발행됨</Text>,
		title: <RowTitle title="첫 번째 글" address="/first-post" />,
		tags: <Text tone="subtle">리액트 · 프론트엔드</Text>,
		updatedAt: (
			<Text mono variant="meta" tone="muted">
				10. 01
			</Text>
		),
	};
	return (
		<TableBody>
			<TableRow>
				{ids.map((id) => (
					<TableCell key={id} align={id === "updatedAt" ? "end" : "start"}>
						{cell[id]}
					</TableCell>
				))}
				<TableCell align="end">
					<RowActions>
						<IconButton label="더보기">
							<OverflowMenuHorizontal aria-hidden />
						</IconButton>
					</RowActions>
				</TableCell>
			</TableRow>
		</TableBody>
	);
}

/** A menu in the shape of the admin's: sort (pick one, closes), values (several, stays open), hide. */
function ColumnMenu({ values }: { values?: string[] }) {
	const [order, setOrder] = useState<string>("desc");
	const [on, setOn] = useState<string[]>([]);
	return (
		<>
			<DropdownMenuRadioGroup value={order} onValueChange={setOrder}>
				{SORT_ORDER.map((direction) => (
					<DropdownMenuRadioItem key={direction} value={direction}>
						{direction === "asc" ? "오름차순" : "내림차순"}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
			{values && <DropdownMenuSeparator />}
			{values?.map((value, index) => (
				<DropdownMenuCheckboxItem
					key={value}
					box
					checked={on.includes(value)}
					onCheckedChange={(checked) => setOn(checked ? [...on, value] : on.filter((candidate) => candidate !== value))}
				>
					{value}
					<MenuShortcut>{[101, 3, 41, 3][index]}</MenuShortcut>
				</DropdownMenuCheckboxItem>
			))}
			<DropdownMenuSeparator />
			<DropdownMenuItem>열 숨기기</DropdownMenuItem>
		</>
	);
}

const columns = (patch: Partial<Record<string, Partial<ListHeadColumn>>> = {}): ListHeadColumn[] =>
	[
		{ id: "status", label: "상태", size: 92, menu: <ColumnMenu values={["발행됨", "수정 중", "초안", "보관됨"]} /> },
		{ id: "title", label: "제목", menu: <ColumnMenu /> },
		{ id: "tags", label: "태그", size: 180, menu: <ColumnMenu values={["없음", "리액트", "타입스크립트"]} /> },
		{ id: "updatedAt", label: "수정일", size: 72, align: "end", sort: "desc", menu: <ColumnMenu /> },
	].map((column) => ({ ...column, ...patch[column.id] }) as ListHeadColumn);

function Head({
	cols,
	add = {
		label: "열 추가",
		columns: [
			{ id: "slug", label: "주소" },
			{ id: "createdAt", label: "생성일" },
		],
		onAdd: noop,
	},
	selectAll,
}: {
	cols: ListHeadColumn[];
	add?: Parameters<typeof ListHead>[0]["add"];
	selectAll?: Parameters<typeof ListHead>[0]["selectAll"];
}) {
	return (
		<Table container="none" layout="fixed">
			<ListHead
				columns={cols}
				end={54}
				add={add}
				selectAll={selectAll}
				moveLabel="옆으로 끌거나 Alt와 ←·→로 열을 옮겨요"
				onPlace={noop}
				onStep={noop}
			/>
			<Rows ids={cols.map((column) => column.id)} />
		</Table>
	);
}

/** The names are buttons, the sorted one in ink with ↓, and a + at the end over the ⋯. */
export const Playground: Story = {
	args: { columns: [], moveLabel: "", onPlace: noop, onStep: noop },
	render: () => <Head cols={columns()} />,
};

/** A filtered column has a 5px dot after its name, whether or not it is sorted. */
export const Filtered: Story = {
	args: Playground.args,
	render: () => <Head cols={columns({ status: { filtered: true }, tags: { filtered: true } })} />,
};

/** A press opens the column's menu under its name, the name in ink while it is open. */
export const MenuOpen: Story = {
	args: Playground.args,
	render: () => <Head cols={columns({ status: { filtered: true } })} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "상태" }));
		await within(document.body).findByRole("menu");
	},
};

/** The last columns line the card's right side up with the name's right side, so it stays inside the table. */
export const MenuOpenAtTheEnd: Story = {
	args: Playground.args,
	render: () => <Head cols={columns()} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "수정일" }));
		await within(document.body).findByRole("menu");
	},
};

/** The + lists the columns that are off as plain rows; with none off there is no +. */
export const AddOpen: Story = {
	args: Playground.args,
	render: () => <Head cols={columns()} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "열 추가" }));
		await within(document.body).findByRole("menu");
	},
};

export const NothingToAdd: Story = {
	args: Playground.args,
	render: () => <Head cols={columns()} add={{ label: "열 추가", columns: [], onAdd: noop }} />,
};

/** A column with no menu is a plain name. */
export const PlainName: Story = {
	args: Playground.args,
	render: () => <Head cols={columns({ tags: { menu: undefined } })} />,
};

/** The select-all hangs in the left margin on the rows' line, and shows while the pointer is on the head row. */
export const SelectAll: Story = {
	args: Playground.args,
	decorators: [
		(Story) => (
			<div className="pl-monti-32">
				<Story />
			</div>
		),
	],
	render: () => <Head cols={columns()} selectAll={{ state: "none", onChange: noop, label: "현재 페이지 전체 선택" }} />,
	play: async ({ canvasElement }) => {
		await userEvent.hover(within(canvasElement).getByRole("button", { name: "제목" }));
	},
};

/** A list whose columns are fixed (the trash) gives no `onPlace`: the names do not drag or step, and say nothing about moving. */
export const FixedColumns: Story = {
	args: Playground.args,
	render: () => (
		<Table container="none" layout="fixed" columns={[undefined, 72, 54]}>
			<ListHead
				columns={[
					{ id: "title", label: "제목", menu: <ColumnMenu /> },
					{ id: "deletedAt", label: "버린 날", size: 72, align: "end", sort: "desc", menu: <ColumnMenu /> },
				]}
				end={54}
			/>
		</Table>
	),
};
