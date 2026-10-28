import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { BulkBar } from "./bulk-bar";
import { Caret } from "./caret";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSearch,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { ListHead } from "./list-head";
import { MenuShortcut } from "./menu-parts";
import type { SelectAllState } from "./page-header";
import { RowActions, RowCheck, RowTitle, Table, TableBody, TableCell, TableRow } from "./table";
import { TextButton } from "./text-button";

const ROWS = [
	{ title: "발행 후 고친 글", address: "/edited-post" },
	{ title: "첫 번째 글", address: "/first-post" },
	{ title: "여름 여행 기록", address: "/summer-trip" },
];

/**
 * What the head row of a list becomes once rows are picked. It is a row of the same table in the same place, as tall as the head row with the same line
 * under it, so the rows below do not move. The select-all hangs in the left margin on the line of the rows' checks: hidden until the pointer is on the head
 * row while nothing is picked, always shown on the bar, a bar while only some rows of the page are picked and a ✓ for all of them.
 */
const meta = {
	title: "Patterns/List/Bulk bar",
	component: BulkBar,
	args: { label: "2개 선택", clearLabel: "선택 해제", onClear: () => {}, colSpan: 2 },
} satisfies Meta<typeof BulkBar>;
export default meta;
type Story = StoryObj<typeof meta>;

const TAGS = [
	{ name: "리액트", state: "all" },
	{ name: "성능", state: "some" },
	{ name: "타입스크립트", state: "none" },
] as const;

/** The 바꾸기 menu: the relation fields, and under a field the values as a list where each is on for all the picked rows, for some (a bar, with how many) or for none. */
function ChangeMenu({ defaultOpen = false }: { defaultOpen?: boolean }) {
	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger render={<TextButton />}>
				바꾸기
				<Caret />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>카테고리</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuItem>개발</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSub defaultOpen={defaultOpen}>
					<DropdownMenuSubTrigger>태그</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuSearch label="태그 찾기" value="" onValueChange={() => {}} />
						{TAGS.map((tag) => (
							<DropdownMenuCheckboxItem
								key={tag.name}
								box
								checked={tag.state === "all"}
								mixed={tag.state === "some"}
								onCheckedChange={() => {}}
							>
								{tag.name}
								{tag.state === "some" && <MenuShortcut>1/2</MenuShortcut>}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function List({ initial, changeOpen = false }: { initial: number[]; changeOpen?: boolean }) {
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
			<Table container="none" layout="fixed">
				<colgroup>
					<col />
					<col style={{ width: 54 }} />
				</colgroup>
				{picked.size === 0 ? (
					<ListHead
						columns={[{ id: "title", label: "제목" }]}
						end={54}
						selectAll={selectAll}
						moveLabel=""
						onPlace={() => {}}
						onStep={() => {}}
					/>
				) : (
					<BulkBar
						colSpan={2}
						label={`${picked.size}개 선택`}
						selectAll={selectAll}
						request={{ label: "요청", onClick: () => {} }}
						more={{
							label: "더 보기",
							children: (
								<>
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
					>
						<TextButton>발행</TextButton>
						<TextButton>보관</TextButton>
						<TextButton>
							폴더로
							<Caret />
						</TextButton>
						<ChangeMenu defaultOpen={changeOpen} />
					</BulkBar>
				)}
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
							<TableCell align="end">
								<RowActions>⋯</RowActions>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export const HeadRow: Story = { render: () => <List initial={[]} /> };

/** Some rows picked: the head row became the bulk bar, and the select-all shows a bar. */
export const SomePicked: Story = { render: () => <List initial={[0]} /> };

/** All rows of the page picked: the select-all is a ✓. */
export const AllPicked: Story = { render: () => <List initial={[0, 1, 2]} /> };

/** 바꾸기 › 태그: a tag all the picked rows hold is ✓, one some hold is a bar with how many, and the rest are empty. */
export const ChangeOpen: Story = { render: () => <List initial={[0, 1]} changeOpen /> };
