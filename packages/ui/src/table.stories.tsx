import type { Meta, StoryObj } from "@storybook/react-vite";
import { MoreHorizontal } from "lucide-react";
import { Count } from "./count";
import { Empty } from "./empty";
import { EntryStatus } from "./entry-status";
import { IconButton } from "./icon-button";
import { Panel } from "./panel";
import { Skeleton } from "./skeleton";
import {
	RowActions,
	RowCheck,
	RowTitle,
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "./table";
import { Text } from "./text";

const ROWS = [
	{ title: "처음 쓰는 블로그 글", status: "발행됨", date: "2026-10-01" },
	{ title: "여름 여행 기록", status: "초안", date: "2026-09-18" },
	{ title: "이사 후기", status: "발행됨", date: "2026-09-02" },
];

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
							<EntryStatus status={row.status === "발행됨" ? "published" : "draft"}>{row.status}</EntryStatus>
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

export const WithCaptionAndFooter: Story = {
	render: () => (
		<Table>
			<TableCaption>최근 글 3개</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead>제목</TableHead>
					<TableHead>수정일</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{ROWS.map((row) => (
					<TableRow key={row.title}>
						<TableCell>{row.title}</TableCell>
						<TableCell>{row.date}</TableCell>
					</TableRow>
				))}
			</TableBody>
			<TableFooter>
				<TableRow>
					<TableCell>합계</TableCell>
					<TableCell>글 3개</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
	),
};

const POSTS = [
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

function ListRows({ picked, proposal = false }: { picked: ReadonlySet<number>; proposal?: boolean }) {
	return (
		<div className="max-w-3xl px-monti-32">
			<Table container="none" layout="fixed">
				<TableBody>
					{POSTS.map((post, index) => (
						<TableRow key={post.address} selected={picked.has(index)} proposal={proposal}>
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
							<TableCell tone="muted" width="lg">
								{post.tags}
							</TableCell>
							<TableCell width="md">
								<EntryStatus status={post.status === "발행됨" ? "published" : "draft"}>{post.status}</EntryStatus>
							</TableCell>
							<TableCell width="xs" align="end">
								<RowActions>
									<MoreButton />
								</RowActions>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function MoreButton() {
	return (
		<IconButton label="더 보기">
			<MoreHorizontal aria-hidden />
		</IconButton>
	);
}

/**
 * A list as the posts screen draws it: each row has its rule, the title is ink over its mono address, the other cells are gray. The check hangs
 * in the left margin and the ⋯ ends the row; both show while the pointer is on the row (point at one). The table does not scroll itself.
 */
export const List: Story = { render: () => <ListRows picked={new Set()} /> };

/** A picked row is filled with the muted background inside the table, and its rule goes darker; its check stays on. */
export const PickedRows: Story = { render: () => <ListRows picked={new Set([1, 2])} /> };

/** Rows the assistant picked: the proposal tint and a blue check. */
export const ProposedRows: Story = { render: () => <ListRows picked={new Set([0, 1])} proposal /> };

/** Cells never wrap (`whitespace-nowrap`), so a long title needs a width on the cell and a truncating `Text`. */
export const LongTextTruncates: Story = {
	render: () => (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>제목</TableHead>
					<TableHead>수정일</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell className="max-w-xs">
						<Text as="div" truncate>
							아주 긴 제목의 글이 표 안에서 한 줄에 다 들어가지 않으면 끝이 말줄임표로 잘려서 보여요
						</Text>
					</TableCell>
					<TableCell>2026-10-01</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	),
};

export const EmptyTable: Story = {
	render: () => (
		<Panel>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
						<TableHead>상태</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell colSpan={2}>
							<Empty size="compact" title="아직 글이 없어요" description="첫 글을 써서 블로그를 시작해 보세요." />
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</Panel>
	),
};

export const Loading: Story = {
	render: () => (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>제목</TableHead>
					<TableHead>상태</TableHead>
					<TableHead>수정일</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{[0, 1, 2].map((i) => (
					<TableRow key={i}>
						<TableCell>
							<Skeleton className="h-4 w-48" />
						</TableCell>
						<TableCell>
							<Skeleton className="h-4 w-16" />
						</TableCell>
						<TableCell>
							<Skeleton className="h-4 w-20" />
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
};

/** Wider than the container: the table scrolls sideways inside its own container. */
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
						<TableCell>first-post</TableCell>
						<TableCell>김하루</TableCell>
						<TableCell>일상</TableCell>
						<TableCell>2026-10-01</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	),
};

/** Column alignment (numbers to the end) and long text that ends in "…". */
export const AlignAndTruncate: Story = {
	render: () => (
		<Panel className="max-w-lg">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>제목</TableHead>
						<TableHead align="end">조회수</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell truncate>
							아주 긴 글 제목은 칸을 넓히지 않고 말줄임표로 끝나요. 끝까지 보려면 열어 보세요
						</TableCell>
						<TableCell align="end">1,204</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</Panel>
	),
};
