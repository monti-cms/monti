import { OverflowMenuHorizontal } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { Count } from "./count";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { EntryStatus } from "./entry-status";
import { IconButton } from "./icon-button";
import { RowActions, RowCheck, RowTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Text } from "./text";

type StatusName = "발행됨" | "수정 중" | "초안";
const STATUS = { 발행됨: "published", "수정 중": "editing", 초안: "draft" } as const;

function Status({ children }: { children: StatusName }) {
	return <EntryStatus status={STATUS[children]}>{children}</EntryStatus>;
}

const ROWS: { title: string; status: StatusName; date: string }[] = [
	{ title: "처음 쓰는 블로그 글", status: "발행됨", date: "2026-10-01" },
	{ title: "여름 여행 기록", status: "초안", date: "2026-09-18" },
	{ title: "이사 후기", status: "수정 중", date: "2026-09-02" },
];

/** Rows with a line under each: no box, no caption, no total row. The head names the columns. */
const meta = {
	title: "Patterns/List/Table",
	component: Table,
	args: {},
	render: (args) => (
		<Table {...args}>
			<TableHeader>
				<TableRow>
					<TableHead>제목</TableHead>
					<TableHead>상태</TableHead>
					<TableHead>수정일</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{ROWS.map((row) => (
					<TableRow key={row.title}>
						<TableCell>{row.title}</TableCell>
						<TableCell>
							<Status>{row.status}</Status>
						</TableCell>
						<TableCell>
							<Text tone="muted">{row.date}</Text>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const POSTS: { title: string; address: string; tags: string; status: StatusName; date: string }[] = [
	{ title: "발행 후 고친 글", address: "/edited-post", tags: "개발 · 리액트", status: "수정 중", date: "10.26" },
	{ title: "첫 번째 글", address: "/first-post", tags: "개발", status: "발행됨", date: "10.01" },
	{ title: "여름 여행 기록", address: "/summer-trip", tags: "일상", status: "초안", date: "09.18" },
	{
		title: "아주 긴 제목의 글이 한 줄에 다 들어가지 않으면 이렇게 끝이 잘려요",
		address: "/very-long-title",
		tags: "",
		status: "발행됨",
		date: "09.02",
	},
];

function ListRows({
	picked,
	proposal = false,
	clickable = false,
	menu = false,
}: {
	picked: ReadonlySet<number>;
	proposal?: boolean;
	/** The rows open something, so the pointer lights them. */
	clickable?: boolean;
	/** The ⋯ opens a menu. */
	menu?: boolean;
}) {
	return (
		// The list keeps its columns and scrolls sideways in a narrow window, so the title never shrinks to nothing.
		<div className="max-w-3xl overflow-x-auto">
			<div className="min-w-[640px] px-monti-32">
				<Table container="none" layout="fixed">
					<TableBody>
						{POSTS.map((post, index) => (
							<TableRow
								key={post.address}
								selected={picked.has(index)}
								proposal={proposal}
								onClick={clickable ? () => {} : undefined}
							>
								<TableCell width="md">
									<RowCheck
										checked={picked.has(index)}
										onCheckedChange={() => {}}
										label={`${post.title} 선택`}
										proposal={proposal}
									/>
									<Count>{post.date}</Count>
								</TableCell>
								<TableCell>
									<RowTitle title={post.title} address={post.address} />
								</TableCell>
								<TableCell tone="subtle" width="lg">
									{post.tags}
								</TableCell>
								<TableCell width="md">
									<Status>{post.status}</Status>
								</TableCell>
								<TableCell width="xs" align="end">
									<RowActions>{menu ? <MoreMenu /> : <MoreButton />}</RowActions>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}

function MoreButton() {
	return (
		<IconButton label="더 보기">
			<OverflowMenuHorizontal aria-hidden />
		</IconButton>
	);
}

function MoreMenu() {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<IconButton label="더 보기">
						<OverflowMenuHorizontal aria-hidden />
					</IconButton>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuItem>복제</DropdownMenuItem>
				<DropdownMenuItem>보관</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * A list as the posts screen draws it: each row has its rule, the title is ink over its mono address, the other cells are gray. The check hangs
 * in the left margin and the ⋯ ends the row; both show while the pointer is on the row (point at one). The table does not scroll itself.
 */
export const List: Story = { render: () => <ListRows picked={new Set()} /> };

/** The row whose ⋯ menu is open stays lit while the menu is open, so it is plain which row the menu is for; a right click does the same. */
export const MenuOpen: Story = {
	render: () => <ListRows picked={new Set()} clickable menu />,
	play: async ({ canvasElement }) => {
		const row = within(canvasElement).getByRole("row", { name: /첫 번째 글/ });
		await userEvent.click(within(row).getByRole("button", { name: "더 보기" }));
	},
};

/** A picked row is filled with the selected background inside the table, and its rule goes darker; its check stays on. Pointing at it changes nothing. */
export const PickedRows: Story = { render: () => <ListRows picked={new Set([1, 2])} /> };

/** Rows the assistant picked: the proposal tint and a blue check. */
export const ProposedRows: Story = { render: () => <ListRows picked={new Set([0, 1])} proposal /> };

/** Cells never wrap (`whitespace-nowrap`), so a long title needs a width on its cell and the others a fixed column: only the title is cut. */
export const LongTextTruncates: Story = {
	render: () => (
		<Table layout="fixed">
			<TableHeader>
				<TableRow>
					<TableHead>제목</TableHead>
					<TableHead width="md">수정일</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell truncate>
						아주 긴 제목의 글이 표 안에서 한 줄에 다 들어가지 않으면 끝이 말줄임표로 잘려서 보여요
					</TableCell>
					<TableCell width="md">2026-10-01</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	),
};

/** While the next rows load, the old ones stay, quieter, and a short line says so. */
export const Loading: Story = {
	render: () => (
		<div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
						<TableHead>상태</TableHead>
						<TableHead>수정일</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody dimmed>
					{ROWS.map((row) => (
						<TableRow key={row.title}>
							<TableCell>{row.title}</TableCell>
							<TableCell>
								<Status>{row.status}</Status>
							</TableCell>
							<TableCell>
								<Text tone="muted">{row.date}</Text>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Text as="p" variant="note" tone="subtle" className="px-monti-12 pt-monti-12">
				불러오는 중…
			</Text>
		</div>
	),
};

/** Wider than the container: the table scrolls sideways inside its own container. Addresses are mono. */
export const WideScrolls: Story = {
	render: () => (
		<div className="max-w-sm">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
						<TableHead>슬러그</TableHead>
						<TableHead>작성자</TableHead>
						<TableHead>카테고리</TableHead>
						<TableHead>수정일</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell>처음 쓰는 블로그 글</TableCell>
						<TableCell className="font-mono text-monti-meta">first-post</TableCell>
						<TableCell>김하루</TableCell>
						<TableCell>일상</TableCell>
						<TableCell>2026-10-01</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	),
};

/** Column alignment (numbers to the end, in mono) and long text that ends in "…". */
export const AlignAndTruncate: Story = {
	render: () => (
		<div className="max-w-lg">
			<Table layout="fixed">
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
						<TableHead align="end" width="md">
							조회수
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							아주 긴 글 제목은 칸을 넓히지 않고 말줄임표로 끝나요. 끝까지 보려면 열어 보세요
						</TableCell>
						<TableCell align="end" width="md" className="font-mono text-monti-meta">
							1,204
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	),
};
