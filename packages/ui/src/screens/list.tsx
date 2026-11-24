import { Add, Close, FolderAdd, Search, Upload } from "../icons";
import {
	Button,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	Empty,
	EmptyStep,
	EntryStatus,
	LIST_COLUMN_SIZE,
	ListFooter,
	ListFooterEnd,
	ListHead,
	type ListHeadColumn,
	PageColumn,
	PageHeader,
	PageSizeMenu,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SplitButton,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
} from "../index";
import { Num, POST_FOLDERS, ScreenFrame } from "./frame";

/** 목록의 한 줄: 폴더이거나 글. */
export type ListRow =
	| { kind: "folder"; name: string; count: number }
	| {
			kind: "post";
			status: "draft" | "published" | "editing";
			/** 골라 둔 줄. */
			selected?: boolean;
			title?: string;
			tags?: string;
			author?: string;
			language: string;
			/** 언어가 더 있으면 그 수("외 1"). */
			more?: number;
			date: string;
	  };

/** 시안 `list.html`의 줄. */
export const LIST_ROWS: readonly ListRow[] = [
	{ kind: "folder", name: "안내", count: 4 },
	{ kind: "folder", name: "소식", count: 2 },
	{ kind: "folder", name: "보기 모음", count: 10 },
	{ kind: "post", status: "draft", title: "걷기 메모 (가져온 글)", language: "한국어", date: "11월 14일" },
	{ kind: "post", status: "draft", language: "한국어", date: "11월 14일" },
	{ kind: "post", status: "draft", title: "사막의 밤하늘 (바깥 링크)", language: "한국어", date: "11월 14일" },
	{
		kind: "post",
		status: "published",
		title: "사막의 밤하늘 (바깥 링크)",
		tags: "사막, 밤",
		author: "이바다",
		language: "한국어",
		more: 1,
		date: "11월 14일",
	},
	{ kind: "post", status: "draft", title: "끊긴 코드 링크가 있는 초안", language: "한국어", date: "11월 14일" },
	{ kind: "post", status: "published", title: "코드 블록 도구를 모두 쓴 글", language: "한국어", date: "11월 14일" },
	{ kind: "post", status: "draft", title: "주소 없는 초안", language: "한국어", date: "11월 14일" },
	{ kind: "post", status: "draft", title: "영상 주소가 빠진 초안", language: "한국어", date: "11월 14일" },
];

const STATUS_WORD = { draft: "초안", published: "발행됨", editing: "바뀜" } as const;

/**
 * 열 너비. 시안의 칸은 왼쪽 안쪽 여백이 0이고 부품의 칸은 10이라, 체크 열(시안 44)을 34로, 끝 열(시안 40)을 50으로 두면 모든 열의 글자가 시안과 같은
 * x에서 시작한다.
 */
export type ListSizes = { status: number; tags: number; author: number; language: number; date: number; end: number };
/** 시안 `list.html`의 열(`list-extreme.html`은 날짜가 길어 따로 준다). */
const LIST_SIZES: ListSizes = { status: 128, tags: 140, author: 112, language: 112, date: 92, end: 50 };
const columnSizes = (size: ListSizes) =>
	[LIST_COLUMN_SIZE.check, size.status, undefined, size.tags, size.author, size.language, size.date, size.end] as const;

/** 상태 열의 메뉴: 값 하나를 고르고, 맨 아래에서 필터를 지운다. */
function StatusMenu({ picked }: { picked: string }) {
	return (
		<>
			<DropdownMenuRadioGroup value={picked}>
				<DropdownMenuLabel>상태</DropdownMenuLabel>
				<DropdownMenuRadioItem value="all">모두</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="draft">초안</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="published">발행됨</DropdownMenuRadioItem>
				<DropdownMenuRadioItem value="changed">바뀜 있음</DropdownMenuRadioItem>
			</DropdownMenuRadioGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem>
				<Close aria-hidden />
				필터 지우기
			</DropdownMenuItem>
		</>
	);
}

function columnsFor(filtered: boolean, SIZE: ListSizes): ListHeadColumn[] {
	const menu = (picked: string) => <StatusMenu picked={picked} />;
	return [
		{
			id: "status",
			label: "상태",
			size: SIZE.status,
			menu: menu(filtered ? "draft" : "all"),
			filter: filtered ? { value: "초안", named: true, clearLabel: "상태 필터 지우기" } : undefined,
		},
		{ id: "title", label: "제목" },
		{ id: "tags", label: "태그", size: SIZE.tags, menu: menu("all") },
		{
			id: "author",
			label: "글쓴이",
			size: SIZE.author,
			menu: menu("all"),
			filter: filtered ? { value: "김하늘", clearLabel: "글쓴이 필터 지우기" } : undefined,
		},
		{ id: "language", label: "언어", size: SIZE.language, menu: menu("all") },
		{ id: "date", label: "수정일", size: SIZE.date, sort: "desc" },
	];
}

function Row({ row, hovered }: { row: ListRow; hovered?: boolean }) {
	const check = (
		<TableCell>
			<RowCheck
				place="cell"
				checked={row.kind === "post" && row.selected === true}
				label={`${row.kind === "folder" ? row.name : (row.title ?? "제목 없음")} 고르기`}
			/>
		</TableCell>
	);
	const more = (
		<TableCell align="end">
			<RowActions reveal="hover">
				<RowMore label="더 보기" />
			</RowActions>
		</TableCell>
	);
	if (row.kind === "folder")
		return (
			<TableRow>
				{check}
				<TableCell />
				<TableCell truncate>
					<RowTitle
						folder
						title={<RowLink href="#">{row.name}</RowLink>}
						note={
							<>
								<Num>{row.count}</Num>편
							</>
						}
					/>
				</TableCell>
				<TableCell />
				<TableCell />
				<TableCell />
				<TableCell />
				{more}
			</TableRow>
		);
	return (
		<TableRow data-hovered={hovered || undefined} selected={row.selected}>
			{check}
			<TableCell truncate>
				<EntryStatus status={row.status} quiet>
					{STATUS_WORD[row.status]}
				</EntryStatus>
			</TableCell>
			<TableCell truncate>
				<RowTitle untitled={!row.title} title={<RowLink href="#">{row.title ?? "제목 없음"}</RowLink>} />
			</TableCell>
			<TableCell truncate tone="muted" title={row.tags}>
				{row.tags}
			</TableCell>
			<TableCell truncate tone="muted" title={row.author}>
				{row.author}
			</TableCell>
			<TableCell tone="muted">
				<span>
					{row.language}
					{row.more ? (
						<Text tone="faint">
							{" "}
							외 <Num>{row.more}</Num>
						</Text>
					) : null}
				</span>
			</TableCell>
			<TableCell>
				<Text tone="subtle">{row.date}</Text>
			</TableCell>
			{more}
		</TableRow>
	);
}

/** "새 글" 알약과 그 ▾(새 폴더, 가져오기). */
function NewPost() {
	return (
		<SplitButton
			menuLabel="더 만들기"
			menu={
				<>
					<DropdownMenuItem>
						<FolderAdd aria-hidden />새 폴더
					</DropdownMenuItem>
					<DropdownMenuItem>
						<Upload aria-hidden />
						가져오기
					</DropdownMenuItem>
				</>
			}
		>
			<Add aria-hidden />새 글
		</SplitButton>
	);
}

/**
 * 글 목록(시안 v5 `list.html`, `list-filter.html`, `list-extreme.html`). `filtered`: 상태와 글쓴이 필터가 열 머리에 칩으로 켜진 목록.
 * `hovered`: 포인터가 올라간 줄의 번호(그 줄에만 ⋯가 보인다).
 */
export function ListScreen({
	rows = LIST_ROWS,
	filtered = false,
	total,
	hovered,
	sizes = LIST_SIZES,
	note,
	bulk,
}: {
	rows?: readonly ListRow[];
	sizes?: ListSizes;
	/** 제목 옆의 말(전체 수). */
	note?: React.ReactNode;
	/** 고른 줄이 있을 때 페이지 아래에 뜨는 막대(`BulkBar place="float"`). */
	bulk?: React.ReactNode;
	filtered?: boolean;
	/** 필터 전 전체 수: 있으면 제목 옆에 "5 / 26편". */
	total?: number;
	hovered?: number;
}) {
	const posts = rows.filter((row) => row.kind === "post").length;
	const picked = rows.filter((row) => row.kind === "post" && row.selected).length;
	return (
		<ScreenFrame
			open="posts"
			folders={rows.length > 0 ? POST_FOLDERS : undefined}
			counts={rows.length > 0 ? undefined : { posts: null }}
		>
			<PageColumn width="full">
				<PageHeader
					layout="bar"
					title="글"
					note={
						note ??
						(total === undefined ? undefined : (
							<>
								<Num>{posts}</Num>{" "}
								<Text tone="disabled">
									/ <Num>{total}</Num>편
								</Text>
							</>
						))
					}
				>
					<Button variant="ghost">
						<Search aria-hidden />
						검색
					</Button>
					<NewPost />
				</PageHeader>
				{rows.length === 0 ? (
					<Empty title="아직 글이 없습니다">
						<EmptyStep>첫 글 쓰기</EmptyStep>
						<EmptyStep>글 가져오기</EmptyStep>
					</Empty>
				) : (
					<>
						<Table container="none" layout="fixed" columns={columnSizes(sizes)}>
							<ListHead
								checkColumn
								selectAll={{
									state: picked === 0 ? "none" : picked === posts ? "all" : "some",
									onChange: () => {},
									label: "이 페이지 모두 고르기",
								}}
								columns={columnsFor(filtered, sizes)}
								end={sizes.end}
							/>
							<TableBody>
								{rows.map((row, index) => (
									<Row key={`${row.kind}-${index}`} row={row} hovered={index === hovered} />
								))}
							</TableBody>
						</Table>
						<ListFooter layout="bar">
							<Text variant="caption" tone="subtle">
								<Num>
									1–{posts} / {posts}
								</Num>
								편
							</Text>
							{filtered ? (
								<ListFooterEnd>
									<Text variant="caption" tone="subtle">
										필터 <Num>2</Num>개 ·{" "}
										<TextButton variant="underline" size="caption">
											모두 지우기
										</TextButton>
									</Text>
									<PageSizeMenu label="25개씩" value={25} options={[{ value: 25, label: "25개씩" }]} />
								</ListFooterEnd>
							) : (
								<PageSizeMenu label="25개씩" value={25} options={[{ value: 25, label: "25개씩" }]} />
							)}
						</ListFooter>
						{bulk}
					</>
				)}
			</PageColumn>
		</ScreenFrame>
	);
}
