import type { Meta, StoryObj } from "@storybook/react-vite";
import {
	Box,
	EntryStatus,
	Image,
	ListScroll,
	RenameField,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowThumb,
	RowTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
	Text,
	TextButton,
} from "./index";

/**
 * A list's table: a head row, rows with a rule under each; the title in ink and its mono address after it on one line, the other columns gray. The check hangs in the left
 * margin and shows with the pointer; the ⋯ is always there. A picked row is filled with the selected ground; the assistant's picks with the proposal tint.
 */
const meta = {
	title: "Patterns/List/Table",
	component: Table,
	// The check hangs in the left margin, so the story leaves the page column's margin for it.
	decorators: [
		(Story) => (
			<Box paddingX={40}>
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

const POSTS = [
	{
		id: "1",
		status: "published",
		label: "발행됨",
		title: "봄에 쓴 첫 글",
		slug: "/posts/first-spring",
		date: "10. 28",
	},
	{
		id: "2",
		status: "editing",
		label: "수정 중",
		title: "편집기를 다시 만든 이유",
		slug: "/posts/why-a-new-editor",
		date: "10. 27",
	},
	{ id: "3", status: "draft", label: "초안", title: "읽은 책 정리", slug: "/posts/reading-notes", date: "10. 21" },
] as const;

const rows = (pick: (id: string) => { selected?: boolean; proposal?: boolean }) =>
	POSTS.map((post) => {
		const state = pick(post.id);
		return (
			<TableRow key={post.id} selected={state.selected} proposal={state.proposal}>
				<TableCell>
					<RowCheck
						checked={!!state.selected}
						onCheckedChange={() => {}}
						label={`${post.title} 고르기`}
						proposal={state.proposal}
					/>
					<EntryStatus status={post.status} quiet={post.status === "published"}>
						{post.label}
					</EntryStatus>
				</TableCell>
				<TableCell truncate>
					<RowTitle title={<RowLink href="#">{post.title}</RowLink>} address={post.slug} />
				</TableCell>
				<TableCell tone="muted" align="end">
					{post.date}
				</TableCell>
				<TableCell>
					<RowActions>
						<RowMore label="더 보기" />
					</RowActions>
				</TableCell>
			</TableRow>
		);
	});

const Frame = ({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) => (
	<ListScroll>
		<Table container="none" layout="fixed" columns={[120, undefined, 96, 48]}>
			<TableHeader>
				<TableRow>
					<TableHead>상태</TableHead>
					<TableHead>제목</TableHead>
					<TableHead align="end">수정한 날</TableHead>
					<TableHead />
				</TableRow>
			</TableHeader>
			<TableBody dimmed={dimmed}>{children}</TableBody>
		</Table>
	</ListScroll>
);

export const Rows: Story = { render: () => <Frame>{rows(() => ({}))}</Frame> };

/** A folder first: its icon before the name, what it holds after it; the status cell stays empty. */
export const Folder: Story = {
	render: () => (
		<Frame>
			<TableRow>
				<TableCell />
				<TableCell truncate>
					<RowTitle folder title={<RowLink href="#">시리즈 원고</RowLink>} address="글 2" />
				</TableCell>
				<TableCell />
				<TableCell>
					<RowActions>
						<RowMore label="더 보기" />
					</RowActions>
				</TableCell>
			</TableRow>
			{rows(() => ({}))}
		</Frame>
	),
};

/** A media row: the picture before the name, in the name's column, the words at its middle. */
export const MediaRow: Story = {
	render: () => (
		<Frame>
			<TableRow>
				<TableCell />
				<TableCell truncate>
					<RowTitle
						thumb={
							<RowThumb>
								<Image src={null} alt="" size="row" ratio="photo" radius="sm" />
							</RowThumb>
						}
						title={<RowLink href="#">desk-morning.jpg</RowLink>}
					/>
				</TableCell>
				<TableCell />
				<TableCell>
					<RowActions>
						<RowMore label="더 보기" />
					</RowActions>
				</TableCell>
			</TableRow>
		</Frame>
	),
};

/** A folder being named (new, or renamed): the field takes the name's place after the icon, its underline whole, the row as high as the others. */
export const FolderNaming: Story = {
	render: () => (
		<Frame>
			<TableRow>
				<TableCell />
				<TableCell truncate>
					<RowTitle
						folder
						editing
						title={
							<RenameField
								value="새 폴더"
								onValueChange={() => {}}
								onCommit={() => {}}
								onCancel={() => {}}
								label="폴더 이름"
							/>
						}
					/>
				</TableCell>
				<TableCell />
				<TableCell>
					<RowActions />
				</TableCell>
			</TableRow>
			{rows(() => ({}))}
		</Frame>
	),
};

/** Picked rows: the selected ground, the rule between them a step darker. */
export const Picked: Story = { render: () => <Frame>{rows((id) => ({ selected: id !== "3" }))}</Frame> };

/** Rows the assistant picked: the proposal tint. */
export const ProposalPicked: Story = {
	render: () => <Frame>{rows((id) => ({ selected: id === "2", proposal: id === "2" }))}</Frame>,
};

/** Out of date while new rows load: shown, quieter. */
export const Refreshing: Story = { render: () => <Frame dimmed>{rows(() => ({}))}</Frame> };

/**
 * Columns dragged narrow: each cell cuts its value with "…" at its own edge and says it whole when pointed at (`title`), a status keeps its mark, a count that
 * is a link ends in "…" too, and what stands after the title gives way before the title does and says itself whole (`addressTitle`). A press on any of them
 * opens the row.
 */
export const CutCells: Story = {
	tags: ["visual"],
	render: () => (
		// A column as wide as a sheet, so the title's column is short of room too.
		<Box width="sheet">
			<ListScroll>
				<Table container="none" layout="fixed" columns={[60, undefined, 60, 60, 48]}>
					<TableHeader>
						<TableRow>
							<TableHead>상태</TableHead>
							<TableHead>제목</TableHead>
							<TableHead>카테고리</TableHead>
							<TableHead align="end">글 수</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell truncate title="수정 중">
								<RowCheck checked={false} onCheckedChange={() => {}} label="편집기를 다시 만든 이유 고르기" />
								<EntryStatus status="editing">수정 중</EntryStatus>
							</TableCell>
							<TableCell truncate>
								<RowTitle
									title={<RowLink href="#">편집기를 다시 만든 이유</RowLink>}
									address={
										<>
											why-a-new-editor-and-what-it-cost-us-in-the-end
											<Text variant="note" tone="warning">
												{" · 영어 이름 없음"}
											</Text>
										</>
									}
									addressTitle="why-a-new-editor-and-what-it-cost-us-in-the-end · 영어 이름 없음"
								/>
							</TableCell>
							<TableCell tone="subtle" truncate title="개발 이야기">
								개발 이야기
							</TableCell>
							<TableCell align="end" truncate title="글 12,345">
								<TextButton variant="underline" size="note" href="#">
									글 12,345
								</TextButton>
							</TableCell>
							<TableCell>
								<RowActions>
									<RowMore label="더 보기" />
								</RowActions>
							</TableCell>
						</TableRow>
						<TableRow>
							<TableCell truncate title="발행됨">
								<RowCheck checked={false} onCheckedChange={() => {}} label="봄에 쓴 첫 글 고르기" />
								<EntryStatus status="published" quiet>
									발행됨
								</EntryStatus>
							</TableCell>
							<TableCell truncate>
								<RowTitle title={<RowLink href="#">봄에 쓴 첫 글</RowLink>} address="/posts/first-spring" />
							</TableCell>
							<TableCell tone="subtle" truncate title="일상">
								일상
							</TableCell>
							<TableCell align="end" truncate title="쓰는 글 없음">
								<Text variant="note" tone="faint">
									쓰는 글 없음
								</Text>
							</TableCell>
							<TableCell>
								<RowActions>
									<RowMore label="더 보기" />
								</RowActions>
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</ListScroll>
		</Box>
	),
};
