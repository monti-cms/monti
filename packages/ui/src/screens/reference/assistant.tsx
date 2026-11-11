import {
	ChatAnswer,
	ChatEntryLink,
	ChatEntryList,
	ChatMessage,
	ChatThread,
	Count,
	EntryStatus,
	ListFooter,
	ListHead,
	ListScroll,
	PageColumn,
	PageHeader,
	PageSizeMenu,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	ProposalActions,
	ProposalCard,
	ProposalEntry,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	ToolCallLine,
	ToolCallLines,
} from "../../index";
import { AssistantPanel, MessageActions } from "./assistant-parts";
import { AdminFrame } from "./frame";
import { NewPostButton, PostSearch } from "./main";

const none = () => {};

type Row = {
	status: "editing" | "draft" | "published";
	statusLabel: string;
	title: string;
	address: string;
	category: string;
	tags?: string;
	language: string;
	date: string;
};

const rows: readonly Row[] = [
	{
		status: "editing",
		statusLabel: "수정 중",
		title: "발행 후 고친 글",
		address: "/edited-post",
		category: "개발",
		tags: "리액트",
		language: "KO",
		date: "10. 26",
	},
	{
		status: "draft",
		statusLabel: "초안",
		title: "리액트 서버 컴포넌트 다시 보기",
		address: "/rsc-again",
		category: "개발",
		tags: "리액트 · 성능",
		language: "KO",
		date: "10. 25",
	},
	{
		status: "draft",
		statusLabel: "초안",
		title: "가을 사진 정리",
		address: "/autumn-photos",
		category: "일상",
		language: "KO",
		date: "10. 22",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "첫 번째 글",
		address: "/first-post",
		category: "개발",
		tags: "리액트",
		language: "KO +1",
		date: "10. 01",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "CMS elements: details",
		address: "/cms-elements-details",
		category: "개발",
		language: "KO +1",
		date: "09. 20",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "CMS elements",
		address: "/cms-elements",
		category: "개발",
		tags: "Blocks",
		language: "KO",
		date: "09. 14",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "서울의 밤",
		address: "/seoul-night",
		category: "일상",
		language: "KO",
		date: "09. 02",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "타입스크립트 5.9 정리",
		address: "/ts-59",
		category: "개발",
		language: "KO",
		date: "08. 28",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "여름 휴가 메모",
		address: "/summer-notes",
		category: "일상",
		language: "KO",
		date: "08. 11",
	},
	{
		status: "published",
		statusLabel: "발행됨",
		title: "리액트 19 마이그레이션, 서버 컴포넌트와 액션까지 한 번에 옮긴 기록",
		address: "/react-19-migration-notes",
		category: "개발",
		tags: "리액트 · 마이그레이션 · 회고 · 타입스크립트",
		language: "KO +2",
		date: "08. 03",
	},
];

/** The assistant docked beside the list: a conversation that ends in a proposal waiting for review. */
const conversation = (
	<AssistantPanel placeholder="사이트에 대해 물어보세요">
		<ChatThread>
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<MessageActions author="user" time="오후 3:12" />
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 게시글 6편
					</ToolCallLine>
					<ToolCallLine status="done" statusLabel="끝남">
						필드 확인 · summary
					</ToolCallLine>
				</ToolCallLines>
				<ChatMessage author="assistant">요약이 빈 글은 두 편이에요.</ChatMessage>
				<ChatEntryList>
					<ChatEntryLink slug="/edited-post">발행 후 고친 글</ChatEntryLink>
					<ChatEntryLink slug="/draft-post">쓰는 중인 글</ChatEntryLink>
				</ChatEntryList>
			</ChatAnswer>
			<MessageActions author="assistant" time="오후 3:12" />
			<ChatMessage author="user">이 두 편에 요약 써 줘</ChatMessage>
			<MessageActions author="user" time="오후 3:14" />
			<ChatAnswer>
				<ToolCallLines>
					<ToolCallLine status="done" statusLabel="끝남">
						글 읽음 · 2편
					</ToolCallLine>
					<ToolCallLine status="done" statusLabel="끝남">
						요약 쓰기 · 2편
					</ToolCallLine>
				</ToolCallLines>
				<ProposalCard
					title="제안"
					summary="요약 채우기 · 글 2편"
					status="검토 대기"
					statusTone="warning"
					footer={
						<ProposalActions
							reviewLabel="검토"
							onReview={none}
							discardLabel="버리기"
							onDiscard={none}
							applyLabel="적용"
							onApply={none}
						/>
					}
				>
					<ProposalEntry
						name="발행 후 고친 글"
						slug="/edited-post"
						field="요약"
						after="예시 코드를 고친 뒤 다시 정리한 메모. 바뀐 코드와 이유를 한 번에 봅니다."
					/>
					<ProposalEntry
						name="쓰는 중인 글"
						slug="/draft-post"
						field="요약"
						after="글보다 도구를 고치는 데 시간을 더 쓰게 된 이유와 그 정리."
					/>
				</ProposalCard>
			</ChatAnswer>
			<MessageActions author="assistant" time="오후 3:14" />
		</ChatThread>
	</AssistantPanel>
);

/** The posts list with the assistant open beside it: a conversation that ends in a proposal waiting for review. */
export function AssistantScreen() {
	return (
		<AdminFrame
			open="posts"
			folders={[{ name: "시리즈 원고", count: "2" }]}
			counts={{ trash: "6" }}
			corner={false}
			panel={conversation}
		>
			<PageColumn width="list">
				<PageHeader title="게시글" meta="/posts/:slug">
					<PostSearch />
					<NewPostButton />
				</PageHeader>
				<ListScroll>
					<Table container="none" layout="fixed" columns={[76, undefined, 84, 152, 60, 71, 39]}>
						<ListHead
							selectAll={{ state: "none", onChange: () => {}, label: "이 페이지 모두 고르기" }}
							end={39}
							columns={[
								{ id: "status", label: "상태", size: 76 },
								{ id: "title", label: "제목" },
								{ id: "category", label: "카테고리", size: 84 },
								{ id: "tags", label: "태그", size: 152 },
								{ id: "language", label: "언어", size: 60 },
								{ id: "updated", label: "수정일", sort: "desc", align: "end", size: 64 },
							]}
							add={{ label: "열 추가", columns: [{ id: "more", label: "열 추가" }], onAdd: none }}
						/>
						<TableBody>
							<TableRow>
								<TableCell />
								<TableCell truncate>
									<RowTitle folder title={<RowLink>시리즈 원고</RowLink>} address="글 2" />
								</TableCell>
								<TableCell />
								<TableCell />
								<TableCell />
								<TableCell />
								<TableCell align="end">
									<RowActions>
										<RowMore label="더 보기" />
									</RowActions>
								</TableCell>
							</TableRow>
							{rows.map((row) => (
								<TableRow key={row.address}>
									<TableCell>
										<RowCheck checked={false} label={`${row.title} 고르기`} />
										<EntryStatus status={row.status} quiet={row.status === "published"}>
											{row.statusLabel}
										</EntryStatus>
									</TableCell>
									<TableCell truncate>
										<RowTitle title={<RowLink>{row.title}</RowLink>} address={row.address} />
									</TableCell>
									<TableCell tone="subtle" truncate title={row.category}>
										{row.category}
									</TableCell>
									<TableCell tone="subtle" truncate title={row.tags}>
										{row.tags}
									</TableCell>
									<TableCell>
										<Text mono variant="meta">
											{row.language}
										</Text>
									</TableCell>
									<TableCell align="end">
										<Text mono variant="meta" tone="muted">
											{row.date}
										</Text>
									</TableCell>
									<TableCell align="end">
										<RowActions>
											<RowMore label="더 보기" />
										</RowActions>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</ListScroll>
				<ListFooter>
					<Count>1–25 / 148</Count>
					<PageSizeMenu label="한 쪽에 보일 수" value={25} options={[{ value: 25, label: "25개씩" }]} />
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious disabled />
							</PaginationItem>
							{["1", "2", "3", "4", "5", "6"].map((page) => (
								<PaginationItem key={page}>
									<PaginationLink href="#" isActive={page === "1"}>
										{page}
									</PaginationLink>
								</PaginationItem>
							))}
							<PaginationItem>
								<PaginationNext href="#" />
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</ListFooter>
			</PageColumn>
		</AdminFrame>
	);
}
