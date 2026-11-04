import {
	Button,
	Count,
	EntryStatus,
	type EntryStatusKind,
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
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
} from "../../index";
import { AdminFrame } from "./frame";

type Post = {
	status: EntryStatusKind;
	label: string;
	title: string;
	address: string;
	category: string;
	tags?: string;
	language: string;
	date: string;
};

const POSTS: readonly Post[] = [
	{
		status: "editing",
		label: "수정 중",
		title: "발행 후 고친 글",
		address: "/edited-post",
		category: "개발",
		tags: "리액트",
		language: "KO",
		date: "10. 26",
	},
	{
		status: "draft",
		label: "초안",
		title: "리액트 서버 컴포넌트 다시 보기",
		address: "/rsc-again",
		category: "개발",
		tags: "리액트 · 성능",
		language: "KO",
		date: "10. 25",
	},
	{
		status: "draft",
		label: "초안",
		title: "가을 사진 정리",
		address: "/autumn-photos",
		category: "일상",
		language: "KO",
		date: "10. 22",
	},
	{
		status: "published",
		label: "발행됨",
		title: "첫 번째 글",
		address: "/first-post",
		category: "개발",
		tags: "리액트",
		language: "KO +1",
		date: "10. 01",
	},
	{
		status: "published",
		label: "발행됨",
		title: "CMS elements: details",
		address: "/cms-elements-details",
		category: "개발",
		language: "KO +1",
		date: "09. 20",
	},
	{
		status: "published",
		label: "발행됨",
		title: "CMS elements",
		address: "/cms-elements",
		category: "개발",
		tags: "Blocks",
		language: "KO",
		date: "09. 14",
	},
	{
		status: "published",
		label: "발행됨",
		title: "서울의 밤",
		address: "/seoul-night",
		category: "일상",
		language: "KO",
		date: "09. 02",
	},
	{
		status: "published",
		label: "발행됨",
		title: "타입스크립트 5.9 정리",
		address: "/ts-59",
		category: "개발",
		language: "KO",
		date: "08. 28",
	},
	{
		status: "published",
		label: "발행됨",
		title: "여름 휴가 메모",
		address: "/summer-notes",
		category: "일상",
		language: "KO",
		date: "08. 11",
	},
	{
		status: "published",
		label: "발행됨",
		title: "리액트 19 마이그레이션, 서버 컴포넌트와 액션까지 한 번에 옮긴 기록",
		address: "/react-19-migration-notes",
		category: "개발",
		tags: "리액트 · 마이그레이션 · 회고 · 타입스크립트",
		language: "KO +2",
		date: "08. 03",
	},
];

const COLUMNS = [
	{ id: "상태", label: "상태", size: 76 },
	{ id: "제목", label: "제목" },
	{ id: "카테고리", label: "카테고리", size: 84 },
	{ id: "태그", label: "태그", size: 152 },
	{ id: "언어", label: "언어", size: 60 },
	{ id: "수정일", label: "수정일", sort: "desc", align: "end", size: 72 },
] as const;

const more = (
	<TableCell align="end">
		<RowActions>
			<RowMore label="더 보기" />
		</RowActions>
	</TableCell>
);

/** The posts list's search: a list with a body searches its title and address, or everything, as the admin does. */
export function PostSearch() {
	return (
		<SearchToggle
			label="검색"
			value=""
			aria-label="검색"
			placeholder="제목·주소 검색"
			targets={[
				{ value: "fields", label: "제목·주소" },
				{ value: "all", label: "전체" },
			]}
			target="fields"
			targetLabel="찾을 곳"
		/>
	);
}

/** The posts list: a folder first, then the entries, and the pages under them. */
export function MainScreen() {
	return (
		<AdminFrame open="posts" folders={[{ name: "시리즈 원고", count: "2" }]} counts={{ trash: "6" }}>
			<PageColumn width="list">
				<PageHeader title="게시글" meta="/posts/:slug">
					<TextButton>+ 폴더</TextButton>
					<PostSearch />
					<Button variant="primary">+ 새 글 쓰기</Button>
				</PageHeader>
				<ListScroll>
					<Table container="none" layout="fixed">
						<ListHead
							selectAll={{ state: "none", onChange: () => {}, label: "이 페이지 모두 고르기" }}
							columns={COLUMNS}
							end={38}
							add={{ label: "열 추가", columns: [{ id: "more", label: "열 추가" }], onAdd: () => {} }}
						/>
						<TableBody>
							<TableRow>
								<TableCell />
								<TableCell truncate>
									<RowTitle folder title={<RowLink href="#">시리즈 원고</RowLink>} address="글 2" />
								</TableCell>
								<TableCell />
								<TableCell />
								<TableCell />
								<TableCell />
								{more}
							</TableRow>
							{POSTS.map((post) => (
								<TableRow key={post.address}>
									<TableCell>
										<RowCheck checked={false} label={`${post.title} 고르기`} />
										<EntryStatus status={post.status} quiet={post.status === "published"}>
											{post.label}
										</EntryStatus>
									</TableCell>
									<TableCell truncate>
										<RowTitle title={<RowLink href="#">{post.title}</RowLink>} address={post.address} />
									</TableCell>
									<TableCell tone="subtle" truncate>
										{post.category}
									</TableCell>
									<TableCell tone="subtle" truncate>
										{post.tags}
									</TableCell>
									<TableCell>
										<Text mono variant="meta">
											{post.language}
										</Text>
									</TableCell>
									<TableCell align="end">
										<Text mono variant="meta" tone="muted">
											{post.date}
										</Text>
									</TableCell>
									{more}
								</TableRow>
							))}
						</TableBody>
					</Table>
				</ListScroll>
				<ListFooter>
					<Count>1–25 / 148</Count>
					<PageSizeMenu label="25개씩" value={25} options={[{ value: 25, label: "25개씩" }]} />
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious disabled />
							</PaginationItem>
							{["1", "2", "3", "4", "5", "6"].map((page) => (
								<PaginationItem key={page}>
									<PaginationLink isActive={page === "1"}>{page}</PaginationLink>
								</PaginationItem>
							))}
							<PaginationItem>
								<PaginationNext />
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</ListFooter>
			</PageColumn>
		</AdminFrame>
	);
}
