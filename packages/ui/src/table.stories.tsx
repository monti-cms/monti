import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "./card";
import { Checkbox } from "./checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./empty";
import { Skeleton } from "./skeleton";
import { StatusIndicator } from "./status-indicator";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./table";
import { Text } from "./text";

const ROWS = [
	{ title: "처음 쓰는 블로그 글", status: "발행됨", date: "2026-10-01" },
	{ title: "여름 여행 기록", status: "초안", date: "2026-09-18" },
	{ title: "이사 후기", status: "발행됨", date: "2026-09-02" },
];

const meta = {
	title: "Layout/Table",
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
							<StatusIndicator tone="strong" shape={row.status === "발행됨" ? "dot" : "ring"} label={row.status} />
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

export const SelectableRows: Story = {
	render: () => (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>
						<Checkbox aria-label="모두 선택" />
					</TableHead>
					<TableHead>제목</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{ROWS.map((row, i) => (
					<TableRow key={row.title} data-state={i === 1 ? "selected" : undefined}>
						<TableCell>
							<Checkbox aria-label={`${row.title} 선택`} checked={i === 1} />
						</TableCell>
						<TableCell>{row.title}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	),
};

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
							<Empty>
								<EmptyHeader>
									<EmptyTitle>아직 글이 없어요</EmptyTitle>
									<EmptyDescription>첫 글을 써서 블로그를 시작해 보세요.</EmptyDescription>
								</EmptyHeader>
							</Empty>
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
