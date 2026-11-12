import { useEffect } from "react";
import { OverflowMenuHorizontal, Renew, RightPanelOpen, Undo } from "../../icons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Banner,
	Count,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	EntryStatus,
	Heading,
	IconButton,
	Inline,
	LIST_COLUMN_SIZE,
	ListFooter,
	ListHead,
	type ListHeadColumn,
	MenuShortcut,
	PageBanner,
	PageColumn,
	PageHeader,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	RowActions,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	SidePanel,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	Toaster,
	toast,
} from "../../index";
import { AdminFrame } from "./frame";

/**
 * The states of the activity log's screen (screens.md, Events; flow 12). `default` is the log as it opens with one failed delivery; the others are the
 * steps of the flow and the states the flow does not draw (many pages, filters with no match, a read that failed).
 */
export type EventsStage =
	| "default"
	| "whatMenu"
	| "deliveryMenu"
	| "rowMenu"
	| "failedOnly"
	| "retrying"
	| "retried"
	| "detail"
	| "detailAssistant"
	| "detailGone"
	| "cancelConfirm"
	| "canceled"
	| "threeFailed"
	| "retryingAll"
	| "allSent"
	| "someFailed"
	| "searched"
	| "noReceivers"
	| "empty"
	| "pages"
	| "loadFailed";

/** How a line's deliveries came out, as its delivery cell says it. */
type Delivery = { failed: number } | "pending" | "sent" | "canceled";
type Line = {
	id: string;
	time: string;
	/** The assistant's request: the line's title, quoted. What it did then stands after it. */
	request?: string;
	what: string;
	where?: string;
	/** Who did it, when it was neither the person nor the assistant: the command line, a plugin. It is said in the grey words after the sentence. */
	by?: string;
	/** `open`: it can be undone. A time: when it was undone. */
	undo?: "open" | string;
	delivery?: Delivery;
};

const PUBLISHED: Line = {
	id: "publish",
	time: "10. 26 10:40",
	what: '"첫 번째 글" 발행',
	where: "post/first-post",
	undo: "open",
	delivery: { failed: 3 },
};

const LINES: readonly Line[] = [
	{
		id: "shorter",
		time: "10. 26 10:58",
		request: "더 짧게 다듬어 줘. 말투는 그대로.",
		what: '"첫 번째 글" 본문 5곳 고침',
		undo: "open",
		delivery: "sent",
	},
	{
		id: "tidy",
		time: "10. 26 10:52",
		request: "이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고 안 쓰는 초안은 지워 줘.",
		what: '"리액트 19 마이그레이션" 저장 · 9편을 2024 폴더로 옮김 · 3개 휴지통으로 외 1건',
		undo: "open",
		delivery: "sent",
	},
	{ id: "scans", time: "10. 26 10:51", request: "예전 스캔 파일 지워 줘", what: "2개 휴지통으로", undo: "open" },
	{
		id: "saved",
		time: "10. 26 10:42",
		what: '"발행 후 고친 글" 저장',
		where: "post/edited-post",
		undo: "open",
		delivery: "pending",
	},
	{
		id: "english",
		time: "10. 26 10:41",
		request: "이 글 영어로 옮겨 줘",
		what: '"첫 번째 글" 본문 4곳 고침',
		undo: "10:44",
		delivery: "sent",
	},
	PUBLISHED,
	{
		id: "schema",
		time: "10. 26 10:12",
		what: "스키마 적용",
		where: "설정 · monti.schema.ts",
		by: "명령줄",
		delivery: "sent",
	},
	{ id: "upload", time: "10. 26 09:15", what: "cover-react.png 올림", where: "미디어 · Blog Assets", delivery: "sent" },
	{
		id: "trash",
		time: "10. 25 17:20",
		what: '"옛 소개 글" 휴지통으로',
		where: "휴지통",
		undo: "open",
		delivery: "sent",
	},
	{ id: "label", time: "10. 25 14:03", what: "게시글 컬렉션 설정 저장", where: "설정", undo: "open", delivery: "sent" },
	{ id: "bulk", time: "10. 25 11:30", what: "글 3편 발행", where: "게시글", undo: "open", delivery: "sent" },
];

/** Two more failed deliveries among the lines, newest first: with the first, three. */
const THREE_FAILED: readonly Line[] = [
	...LINES.slice(0, 6),
	{
		id: "f2",
		time: "10. 26 10:31",
		what: '"리액트 19 마이그레이션" 발행',
		where: "post/react-19",
		undo: "open",
		delivery: { failed: 4 },
	},
	...LINES.slice(6, 8),
	{
		id: "f3",
		time: "10. 26 09:02",
		what: '"연습장" 보관',
		where: "note/scratch",
		undo: "open",
		delivery: { failed: 9 },
	},
	...LINES.slice(8),
];

const isFailed = (line: Line) => typeof line.delivery === "object";
const withDelivery = (lines: readonly Line[], change: (line: Line) => Delivery | undefined): Line[] =>
	lines.map((line) => ({ ...line, delivery: change(line) }));

/** The lines of each stage, newest first. */
function linesOf(stage: EventsStage): Line[] {
	switch (stage) {
		case "failedOnly":
			return [PUBLISHED];
		case "retrying":
			return [{ ...PUBLISHED, delivery: "pending" }];
		case "retried":
		case "empty":
		case "loadFailed":
			return [];
		case "canceled":
			return withDelivery(LINES, (line) => (line.id === "publish" ? "canceled" : line.delivery));
		case "threeFailed":
			return [...THREE_FAILED];
		case "retryingAll":
			return withDelivery(THREE_FAILED, (line) => (isFailed(line) ? "pending" : line.delivery));
		case "allSent":
			return withDelivery(THREE_FAILED, (line) => (isFailed(line) ? "sent" : line.delivery));
		case "someFailed":
			return withDelivery(THREE_FAILED, (line) =>
				line.id === "f3" ? { failed: 1 } : isFailed(line) ? "sent" : line.delivery,
			);
		case "searched":
			return LINES.filter((line) => line.what.includes("첫 번째 글"));
		case "noReceivers":
			return withDelivery(LINES, () => undefined);
		default:
			return [...LINES];
	}
}

const FAILED_COUNT: Partial<Record<EventsStage, number>> = {
	default: 1,
	whatMenu: 1,
	deliveryMenu: 1,
	rowMenu: 1,
	failedOnly: 1,
	retrying: 1,
	detail: 1,
	detailAssistant: 1,
	detailGone: 1,
	cancelConfirm: 1,
	threeFailed: 3,
	retryingAll: 3,
	someFailed: 1,
	searched: 1,
	pages: 1,
};

const TOAST: Partial<Record<EventsStage, string>> = {
	retried: "보냈습니다",
	canceled: "전송을 취소했습니다",
	allSent: "3건 보냈습니다",
	someFailed: "2건 보냈습니다 · 1건 실패",
};

/** The line open beside the list in each stage. */
const OPEN: Partial<Record<EventsStage, string>> = {
	detail: "publish",
	cancelConfirm: "publish",
	canceled: "publish",
	detailAssistant: "tidy",
	detailGone: "trash",
};

/**
 * A line's delivery. What needs a look has the lists' status mark (on its way, failed, canceled). A delivery that arrived says so in quiet words
 * with no mark: an empty cell under "전송" would read as nothing sent. Only a line that had nothing to send leaves the cell empty. The panel,
 * which is about one line, says "sent" with its mark (`whole`).
 */
function DeliveryCell({ delivery, whole = false }: { delivery?: Delivery; whole?: boolean }) {
	if (!delivery) return null;
	if (delivery === "sent")
		return whole ? (
			<EntryStatus status="published" quiet>
				보냄
			</EntryStatus>
		) : (
			<Text variant="note" tone="subtle">
				보냄
			</Text>
		);
	if (delivery === "pending")
		return (
			<EntryStatus status="draft" quiet>
				보내는 중
			</EntryStatus>
		);
	if (delivery === "canceled")
		return (
			<EntryStatus status="archived" quiet>
				취소됨
			</EntryStatus>
		);
	// The list says "failed"; how many times it was tried is said beside the delivery, in the panel.
	return <EntryStatus status="failed">{whole ? `${delivery.failed}번 실패` : "실패"}</EntryStatus>;
}

/**
 * A line's ⋯, on every row as in every list: open its details (what a press on the row does, as the lists' menus start with "open"), then what can be done with
 * it: send its failed deliveries again, undo it. `panel` leaves the first out: the panel is the details.
 */
function LineMenu({ line, panel = false }: { line: Line; panel?: boolean }) {
	return (
		<>
			{panel ? null : (
				<DropdownMenuItem>
					<RightPanelOpen aria-hidden />
					자세히
				</DropdownMenuItem>
			)}
			{isFailed(line) ? (
				<DropdownMenuItem>
					<Renew aria-hidden />
					다시 보내기
				</DropdownMenuItem>
			) : null}
			{line.undo === "open" ? (
				<DropdownMenuItem>
					<Undo aria-hidden />
					되돌리기
				</DropdownMenuItem>
			) : null}
		</>
	);
}

/** Whether the panel's head has a ⋯: only when there is something to do with the line. */
const hasActions = (line: Line) => isFailed(line) || line.undo === "open";

/** One group of a panel: a small heading and its rows. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Stack gap={12}>
			<Heading as="h3" variant="label">
				{title}
			</Heading>
			{children}
		</Stack>
	);
}

/** The ⋯ of a panel's head: the same actions as the line's own ⋯. */
function PanelMore({ line }: { line: Line }) {
	if (!hasActions(line)) return null;
	return (
		<DropdownMenu>
			<IconButton label="더 보기" trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<OverflowMenuHorizontal aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end">
				<LineMenu line={line} panel />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** A line's details beside the list: when, what it touched, and each receiver's delivery (by its name) with what can be done about it. Who is not said. */
function Details({ stage, line }: { stage: EventsStage; line: Line }) {
	if (stage === "detailAssistant")
		return (
			<SidePanel width="side" title={`“${line.request}”`} closable actions={<PanelMore line={line} />}>
				<Stack gap={32}>
					{/* The first group has no heading, as in the other panels. */}
					<DescriptionList>
						<DescriptionItem label="시각" mono>
							10. 26 10:52
						</DescriptionItem>
					</DescriptionList>
					{/* The head cuts a long request; here it is whole. */}
					<Group title="요청">
						<Text>{line.request}</Text>
					</Group>
					<Group title="한 일 · 4">
						<Stack gap={8}>
							<Text variant="note" tone="muted">
								"리액트 19 마이그레이션" 저장
							</Text>
							<Text variant="note" tone="muted">
								"타입스크립트 5.9 노트" 저장
							</Text>
							<Text variant="note" tone="muted">
								9편을 2024 폴더로 옮김
							</Text>
							<Text variant="note" tone="muted">
								3개 휴지통으로
							</Text>
						</Stack>
					</Group>
					<Group title="항목 · 14">
						<Stack gap={8} align="start">
							<TextButton variant="underline">리액트 19 마이그레이션</TextButton>
							<TextButton variant="underline">타입스크립트 5.9 노트</TextButton>
							<TextButton variant="underline">2024</TextButton>
							<TextButton variant="underline">작년 회고</TextButton>
							<Text variant="note" tone="subtle">
								외 10개
							</Text>
						</Stack>
					</Group>
				</Stack>
			</SidePanel>
		);
	if (stage === "detailGone")
		return (
			<SidePanel width="side" title={line.what} closable actions={<PanelMore line={line} />}>
				<Stack gap={32}>
					<DescriptionList>
						<DescriptionItem label="시각" mono>
							10. 25 17:20
						</DescriptionItem>
					</DescriptionList>
					<Group title="항목">
						<DescriptionList>
							{/* Deleted for good since: its name stays as text, with nothing to open. */}
							<DescriptionItem label="글">옛 소개 글</DescriptionItem>
							<DescriptionItem label="컬렉션">게시글</DescriptionItem>
							<DescriptionItem label="언어" mono>
								KO · v7
							</DescriptionItem>
							<DescriptionItem label="주소" mono>
								/posts/about-old
							</DescriptionItem>
						</DescriptionList>
					</Group>
					<Group title="전송 · 1">
						<DescriptionList>
							<DescriptionItem label="받는 곳">사이트 캐시</DescriptionItem>
							<DescriptionItem label="이벤트" mono>
								entry.unpublished
							</DescriptionItem>
							<DescriptionItem label="상태">
								<DeliveryCell delivery="sent" whole />
							</DescriptionItem>
							{/* The id the receiver got it under, to find it in the receiver's own log. */}
							<DescriptionItem label="이벤트 ID" mono>
								7d3c1f0e-52a8-4b6d-9e1f-c04a8b7d21f1
							</DescriptionItem>
						</DescriptionList>
					</Group>
				</Stack>
			</SidePanel>
		);
	const canceled = stage === "canceled";
	return (
		<SidePanel width="side" title={line.what} closable actions={<PanelMore line={line} />}>
			<Stack gap={32}>
				<DescriptionList>
					<DescriptionItem label="시각" mono>
						10. 26 10:40
					</DescriptionItem>
				</DescriptionList>
				<Group title="항목">
					<DescriptionList>
						<DescriptionItem label="글">
							<TextButton variant="underline">첫 번째 글</TextButton>
						</DescriptionItem>
						<DescriptionItem label="컬렉션">게시글</DescriptionItem>
						<DescriptionItem label="언어" mono>
							KO · v12
						</DescriptionItem>
						<DescriptionItem label="주소" mono>
							/posts/first-post
						</DescriptionItem>
					</DescriptionList>
				</Group>
				<Group title="전송 · 2">
					<Stack gap={20}>
						<Stack gap={8} align="start">
							<DescriptionList>
								<DescriptionItem label="받는 곳">example.dev/api/revalidate</DescriptionItem>
								<DescriptionItem label="이벤트" mono>
									entry.published
								</DescriptionItem>
								<DescriptionItem label="상태">
									<DeliveryCell delivery={canceled ? "canceled" : { failed: 3 }} />
								</DescriptionItem>
								<DescriptionItem label="마지막 오류" mono>
									503 Service Unavailable
								</DescriptionItem>
								{canceled ? null : (
									<DescriptionItem label="다음 시도" mono>
										10. 26 11:16
									</DescriptionItem>
								)}
								{/* The id the receiver got it under, to find it in the receiver's own log. */}
								<DescriptionItem label="이벤트 ID" mono>
									7d3c1f0e-52a8-4b6d-9e1f-c04a8b7d21f2
								</DescriptionItem>
							</DescriptionList>
							{canceled ? null : (
								<Inline gap={16}>
									<TextButton variant="underline">다시 보내기</TextButton>
									<TextButton variant="quiet">취소</TextButton>
								</Inline>
							)}
						</Stack>
						<DescriptionList>
							<DescriptionItem label="받는 곳">example.dev/api/search</DescriptionItem>
							<DescriptionItem label="이벤트" mono>
								entry.published
							</DescriptionItem>
							<DescriptionItem label="상태">
								<DeliveryCell delivery="sent" whole />
							</DescriptionItem>
							{/* The id the receiver got it under, to find it in the receiver's own log. */}
							<DescriptionItem label="이벤트 ID" mono>
								7d3c1f0e-52a8-4b6d-9e1f-c04a8b7d21f3
							</DescriptionItem>
						</DescriptionList>
					</Stack>
				</Group>
			</Stack>
		</SidePanel>
	);
}

/** A row of a column's menu that filters by a value: a check box, the value, and how many lines have it. */
function ValueRow({ name, count, checked = false }: { name: string; count: number; checked?: boolean }) {
	return (
		<DropdownMenuCheckboxItem box checked={checked} closeOnClick={false}>
			{name}
			<MenuShortcut>{count}</MenuShortcut>
		</DropdownMenuCheckboxItem>
	);
}

/** The stages whose list shows the failed deliveries only. */
const isFailedOnly = (stage: EventsStage) => stage === "failedOnly" || stage === "retrying" || stage === "retried";

/**
 * The log's columns, as every list's: each name opens its menu. The work is filtered by its kind, the delivery by how it went, and the time is sorted both
 * ways and filtered by day as the lists' dates are. There is no column for who did it: one person uses the admin. A site with no receiver has no delivery
 * column.
 */
function columnsOf(stage: EventsStage): ListHeadColumn[] {
	const failedOnly = isFailedOnly(stage);
	return [
		{
			id: "what",
			label: "작업",
			menu: (
				<>
					<ValueRow name="글 저장" count={64} />
					<ValueRow name="글 발행" count={21} />
					<ValueRow name="휴지통" count={9} />
					<ValueRow name="설정" count={12} />
					<ValueRow name="미디어" count={26} />
				</>
			),
		},
		...(stage === "noReceivers"
			? []
			: [
					{
						id: "delivery",
						label: "전송",
						size: LIST_COLUMN_SIZE.one + 8,
						filtered: failedOnly,
						menu: (
							<>
								<ValueRow name="보내는 중" count={1} />
								<ValueRow name="보냄" count={42} />
								<ValueRow name="실패" count={1} checked={failedOnly} />
								<ValueRow name="취소됨" count={2} />
							</>
						),
					},
				]),
		{
			id: "at",
			label: "시각",
			sort: "desc",
			align: "end",
			size: LIST_COLUMN_SIZE.time,
			menu: (
				<>
					<DropdownMenuRadioGroup value="desc">
						<DropdownMenuRadioItem value="desc">최근부터</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="asc">오래전부터</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
					<DropdownMenuSeparator />
					<DropdownMenuRadioGroup value="all">
						<DropdownMenuRadioItem value="all">모든 날짜</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="today">오늘</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="7">최근 7일</DropdownMenuRadioItem>
						<DropdownMenuRadioItem value="30">최근 30일</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</>
			),
		},
	];
}

/** Shows the toast a stage ends with, for as long as the story is open. */
function StageToast({ message }: { message: string }) {
	useEffect(() => {
		toast(message);
		return () => {
			toast.dismiss();
		};
	}, [message]);
	return <Toaster duration={Number.POSITIVE_INFINITY} />;
}

/**
 * The activity log, a screen of its own as the trash is: its title, the search in the title's row, and the log as the lists' table right under it, newest
 * first. A row is one write, or the assistant's work for one request (✦ before its words): what was done with where after it, how its delivery went, and
 * when. A row opens its details beside the list; what can be done with it is in its ⋯. Failed deliveries, from the first one, are a banner at the top of the page,
 * where every screen's banner is, with the way to show them and to send them again (2026-11-12, owner).
 */
export function EventsScreen({ stage = "default" }: { stage?: EventsStage }) {
	const lines = linesOf(stage);
	const failed = FAILED_COUNT[stage] ?? 0;
	const open = lines.find((line) => line.id === OPEN[stage]) ?? LINES.find((line) => line.id === OPEN[stage]);
	const message = TOAST[stage];
	const columns = columnsOf(stage);
	const noMatch = stage === "retried";
	return (
		<AdminFrame
			open="activity"
			counts={{ activity: failed > 0 ? String(failed) : undefined }}
			corner={open === undefined}
			panel={open ? <Details stage={stage} line={open} /> : undefined}
		>
			{/* The page says it where its state lives; it stands at the very top of the screen, under the frame's own banners. */}
			<PageBanner>
				{failed > 0 ? (
					// It counts failed deliveries, as the sidebar does, and stays while they are on their way again.
					<Banner tone="danger" title={`전송 ${failed}건 실패`} meta="10. 26부터">
						{isFailedOnly(stage) ? null : <TextButton variant="underline">보기</TextButton>}
						{stage === "retrying" || stage === "retryingAll" ? (
							<TextButton loading>보내는 중…</TextButton>
						) : (
							<TextButton>{failed === 1 ? "다시 보내기" : "모두 다시 보내기"}</TextButton>
						)}
					</Banner>
				) : null}
				{stage === "loadFailed" ? (
					<Banner tone="danger" title="기록을 불러오지 못했습니다" plainMeta>
						<TextButton variant="underline">다시 시도</TextButton>
					</Banner>
				) : null}
			</PageBanner>
			<PageColumn width="list">
				<PageHeader title="활동 기록">
					{stage === "empty" || stage === "loadFailed" ? null : (
						<SearchToggle
							label="검색"
							aria-label="검색"
							placeholder="검색"
							value={stage === "searched" ? "첫 번째 글" : ""}
						/>
					)}
				</PageHeader>
				{stage === "empty" ? <Empty title="아직 기록이 없습니다." /> : null}
				{stage === "empty" || stage === "loadFailed" ? null : (
					<Table
						container="none"
						layout="fixed"
						columns={[...columns.map((column) => column.size), LIST_COLUMN_SIZE.end]}
					>
						<ListHead columns={columns} end={LIST_COLUMN_SIZE.end} />
						<TableBody>
							{noMatch ? (
								<TableRow>
									<TableCell colSpan={columns.length + 1}>
										<Inline gap={12}>
											<Text tone="subtle">맞는 것이 없습니다.</Text>
											<TextButton>필터 해제</TextButton>
										</Inline>
									</TableCell>
								</TableRow>
							) : null}
							{lines.map((line) => (
								<TableRow key={line.id} selected={line.id === open?.id}>
									<TableCell truncate>
										<RowTitle
											// The assistant's work is marked before its words; there is no column for who.
											byAssistant={line.request ? "어시스턴트" : undefined}
											title={
												<RowLink render={<button type="button" />}>
													{line.request ? `“${line.request}”` : line.what}
												</RowLink>
											}
											address={[
												line.request ? line.what : line.where,
												line.by,
												line.undo && line.undo !== "open" ? `되돌림 ${line.undo}` : null,
											]
												.filter(Boolean)
												.join(" · ")}
										/>
									</TableCell>
									{stage === "noReceivers" ? null : (
										<TableCell truncate>
											<DeliveryCell delivery={line.delivery} />
										</TableCell>
									)}
									<TableCell align="end">
										<Text mono variant="meta" tone="muted">
											{line.time}
										</Text>
									</TableCell>
									<TableCell align="end">
										<RowActions>
											<DropdownMenu open={stage === "rowMenu" && line.id === "publish" ? true : undefined}>
												<RowMore label="더 보기" trigger={(button) => <DropdownMenuTrigger render={button} />} />
												<DropdownMenuContent align="end">
													<LineMenu line={line} />
												</DropdownMenuContent>
											</DropdownMenu>
										</RowActions>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{stage === "pages" ? (
					<ListFooter>
						<Count>1–50 / 132</Count>
						<Pagination>
							<PaginationContent>
								<PaginationItem>
									<PaginationPrevious disabled />
								</PaginationItem>
								<PaginationItem>
									<PaginationLink href="#" isActive>
										1
									</PaginationLink>
								</PaginationItem>
								<PaginationItem>
									<PaginationLink href="#">2</PaginationLink>
								</PaginationItem>
								<PaginationItem>
									<PaginationLink href="#">3</PaginationLink>
								</PaginationItem>
								<PaginationItem>
									<PaginationNext href="#" />
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</ListFooter>
				) : null}
			</PageColumn>
			{stage === "cancelConfirm" ? (
				<AlertDialog open>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>이 전송을 취소할까요?</AlertDialogTitle>
							<AlertDialogDescription>
								<Text>example.dev/api/revalidate</Text>
								<br />
								다시 보내지 않습니다. 되돌릴 수 없습니다.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>닫기</AlertDialogCancel>
							<AlertDialogAction variant="danger">취소하기</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
			{message ? <StageToast message={message} /> : null}
		</AdminFrame>
	);
}
