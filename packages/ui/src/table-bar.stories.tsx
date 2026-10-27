import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DropdownMenuItem, DropdownMenuSeparator } from "./dropdown-menu";
import { MenuShortcut } from "./menu-parts";
import { RowCheck, RowTitle, Table, TableBody, TableCell, TableRow } from "./table";
import { BulkBar, type SelectAllState, TableBar } from "./table-bar";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { TextButton } from "./text-button";

const ROWS = [
	{ title: "발행 후 고친 글", address: "/edited-post" },
	{ title: "첫 번째 글", address: "/first-post" },
	{ title: "여름 여행 기록", address: "/summer-trip" },
];

/**
 * The row above a list. It is as wide as the rows' content (12px inside), so the first letters line up, and it carries the select-all in the
 * left margin: hidden while nothing is picked (point at the bar), a bar while only some rows of the page are picked, a ✓ for all of them. Once rows
 * are picked it becomes the bulk bar.
 */
const meta = { title: "List/Bulk bar", component: TableBar } satisfies Meta<typeof TableBar>;
export default meta;
type Story = StoryObj<typeof meta>;

function List({ initial }: { initial: number[] }) {
	const [picked, setPicked] = useState(new Set(initial));
	const state: SelectAllState = picked.size === 0 ? "none" : picked.size === ROWS.length ? "all" : "some";
	const selectAll = {
		state,
		label: "모두 선택",
		onChange: (all: boolean) => setPicked(new Set(all ? ROWS.map((_, index) => index) : [])),
	};
	const toggle = (index: number) =>
		setPicked((now) => {
			const next = new Set(now);
			if (!next.delete(index)) next.add(index);
			return next;
		});
	return (
		<div className="max-w-2xl px-monti-32">
			{picked.size === 0 ? (
				<TableBar selectAll={selectAll} className="border-monti-muted border-b">
					<Tabs value="all">
						<TabsList variant="bar">
							<TabsTrigger value="all">전체</TabsTrigger>
							<TabsTrigger value="published">발행됨</TabsTrigger>
						</TabsList>
					</Tabs>
				</TableBar>
			) : (
				<BulkBar
					label={`${picked.size}개 선택`}
					selectAll={selectAll}
					request={{ label: "요청", onClick: () => {} }}
					more={{
						label: "더 보기",
						children: (
							<>
								<DropdownMenuItem>보관</DropdownMenuItem>
								<DropdownMenuItem>내보내기</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="danger">
									휴지통으로<MenuShortcut>Del</MenuShortcut>
								</DropdownMenuItem>
							</>
						),
					}}
					clearLabel="선택 해제"
					onClear={() => setPicked(new Set())}
					className="border-monti-muted border-b"
				>
					<TextButton>발행</TextButton>
					<TextButton>폴더로</TextButton>
				</BulkBar>
			)}
			<Table container="none">
				<TableBody>
					{ROWS.map((row, index) => (
						<TableRow key={row.address} selected={picked.has(index)}>
							<TableCell>
								<RowCheck
									checked={picked.has(index)}
									onCheckedChange={() => toggle(index)}
									label={`${row.title} 선택`}
								/>
								<RowTitle title={row.title} address={row.address} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export const FilterRow: Story = { render: () => <List initial={[]} /> };

/** Some rows picked: the filter row became the bulk bar, and the select-all shows a bar. */
export const SomePicked: Story = { render: () => <List initial={[0]} /> };

/** All rows of the page picked: the select-all is a ✓. */
export const AllPicked: Story = { render: () => <List initial={[0, 1, 2]} /> };
