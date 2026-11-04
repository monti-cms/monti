import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	BulkBar,
	Button,
	Caret,
	DropdownMenuItem,
	DropdownMenuSeparator,
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "./index";

/**
 * What replaces a list's head once rows are picked, in the same place: the count in bold, the assistant's request, the most used actions, a ⋯ with the
 * rest (the dangerous one last, in red), and "clear" at the end. Over a table it is a head row; over a grid it is the toolbar row.
 */
const meta = {
	title: "Patterns/List/BulkBar",
	// The select-all check hangs in the left margin, so the story leaves the page column's margin for it.
	decorators: [
		(Story) => (
			<Box paddingX={40}>
				<Story />
			</Box>
		),
	],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const more = {
	label: "더 보기",
	children: (
		<>
			<DropdownMenuItem>내보내기</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem variant="danger">휴지통으로</DropdownMenuItem>
		</>
	),
};

/** Over a table of posts: a head row across all its columns. */
export const OverTable: Story = {
	render: () => (
		<Table container="none" layout="fixed" columns={[120, undefined, 96, 48]}>
			<BulkBar
				label="3개 선택"
				colSpan={4}
				request={{ label: "요청", onClick: () => {} }}
				more={more}
				selectAll={{ state: "some", onChange: () => {}, label: "모두 선택" }}
				clearLabel="선택 해제"
				onClear={() => {}}
			>
				<Button variant="ghost" size="sm">
					발행
				</Button>
				<Button variant="ghost" size="sm">
					보관
				</Button>
				<Button variant="ghost" size="sm">
					폴더로 <Caret />
				</Button>
				<Button variant="ghost" size="sm">
					바꾸기 <Caret />
				</Button>
			</BulkBar>
			<TableBody>
				<TableRow selected>
					<TableCell>초안</TableCell>
					<TableCell>봄에 쓴 첫 글</TableCell>
					<TableCell>10. 28</TableCell>
					<TableCell />
				</TableRow>
			</TableBody>
		</Table>
	),
};

/** Over a grid of media tiles: the toolbar row; the request is "✦ 대체 텍스트". */
export const OverGrid: Story = {
	render: () => (
		<BulkBar
			label="2개 선택"
			request={{ label: "대체 텍스트", onClick: () => {} }}
			more={more}
			selectAll={{ state: "some", onChange: () => {}, label: "모두 선택" }}
			clearLabel="선택 해제"
			onClear={() => {}}
		>
			<Button variant="ghost" size="sm">
				폴더로 <Caret />
			</Button>
		</BulkBar>
	),
};

/** The trash: restore and delete for good, no request. */
export const Trash: Story = {
	render: () => (
		<BulkBar label="2개 선택" clearLabel="선택 해제" onClear={() => {}}>
			<Button variant="ghost" size="sm">
				복원
			</Button>
			<Button variant="ghost-danger" size="sm">
				영구 삭제
			</Button>
		</BulkBar>
	),
};
