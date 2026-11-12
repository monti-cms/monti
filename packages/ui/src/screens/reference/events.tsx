import { useEffect } from "react";
import { Globe, Image, Launch, ListBulleted, Save, SettingsAdjust, Spark, TrashCan } from "../../icons";
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
	Box,
	Chip,
	Count,
	DescriptionItem,
	DescriptionList,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	EntryStatus,
	FilterButton,
	Heading,
	Inline,
	ListFooter,
	MenuShortcut,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
	RowActions,
	RowLink,
	SidePanel,
	Stack,
	TabLink,
	TabLinks,
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
 * The states of the activity tab (screens.md, Events; flow 12). `default` is the log as it opens with one failed delivery; the others are the steps of
 * the flow and the states the flow does not draw (many pages, a filter with no match, a read that failed, a narrow window).
 */
export type EventsStage =
	| "default"
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
	| "filterMenu"
	| "filteredPending"
	| "oneEntry"
	| "noMatch"
	| "noReceivers"
	| "empty"
	| "pages"
	| "loadFailed";

/** How a line's deliveries show at its end. */
type Delivery = { failed: number; quiet?: boolean } | "sending" | "pending" | "canceled";
type Line = {
	id: string;
	time: string;
	/** The assistant's request, quoted as the first line. */
	request?: string;
	what: string;
	where?: string;
	/** `open` shows the undo; a time shows when it was undone. */
	undo?: "open" | string;
	delivery?: Delivery;
};
type Day = { name: string; lines: readonly Line[] };

const PUBLISHED: Line = {
	id: "publish",
	time: "10:40",
	what: '"첫 번째 글" 발행',
	where: "post/first-post",
	delivery: { failed: 3 },
};

const TODAY: readonly Line[] = [
	{
		id: "shorter",
		time: "10:58",
		request: "더 짧게 다듬어 줘. 말투는 그대로.",
		what: '"첫 번째 글" 본문 5곳 고침',
		undo: "open",
	},
	{
		id: "tidy",
		time: "10:52",
		request: "이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고 안 쓰는 초안은 지워 줘.",
		what: '"리액트 19 마이그레이션" 저장 · 9편을 2024 폴더로 옮김 · 3개 휴지통으로 외 1건',
		undo: "open",
	},
	{ id: "scans", time: "10:51", request: "예전 스캔 파일 지워 줘", what: "2개 휴지통으로", undo: "open" },
	{ id: "saved", time: "10:42", what: '"발행 후 고친 글" 저장', where: "post/edited-post", delivery: "pending" },
	{
		id: "english",
		time: "10:41",
		request: "이 글 영어로 옮겨 줘",
		what: '"첫 번째 글" 본문 4곳 고침',
		undo: "10:44",
	},
	PUBLISHED,
	{ id: "schema", time: "10:12", what: "스키마 적용", where: "설정 · monti.schema.ts" },
	{ id: "upload", time: "09:15", what: "cover-react.png 올림", where: "미디어 · Blog Assets" },
];

const YESTERDAY: readonly Line[] = [
	{ id: "trash", time: "17:20", what: '"옛 소개 글" 휴지통으로', where: "휴지통" },
	{ id: "label", time: "14:03", what: "게시글 컬렉션 설정 저장", where: "설정" },
	{ id: "bulk", time: "11:30", what: "글 3편 발행", where: "게시글" },
];

const FAILED_THREE: readonly Line[] = [
	{
		id: "f1",
		time: "10:40",
		what: '"첫 번째 글" 발행',
		where: "post/first-post",
		delivery: { failed: 3, quiet: true },
	},
	{
		id: "f2",
		time: "10:31",
		what: '"리액트 19 마이그레이션" 발행',
		where: "post/react-19",
		delivery: { failed: 4, quiet: true },
	},
	{ id: "f3", time: "09:58", what: '"연습장" 보관', where: "note/scratch", delivery: { failed: 9, quiet: true } },
];

/** A day with three failed deliveries among the assistant's lines, newest first. */
const THREE_FAILED_DAY: readonly Line[] = [...TODAY.slice(0, 3), ...FAILED_THREE];

const withDelivery = (lines: readonly Line[], change: (line: Line) => Delivery | undefined): Line[] =>
	lines.map((line) => ({ ...line, delivery: change(line) }));

/** The log of each stage: its days, newest first. */
function daysOf(stage: EventsStage): Day[] {
	const today = (lines: readonly Line[]): Day[] => [{ name: "오늘 · 10. 26", lines }];
	const both = (lines: readonly Line[]): Day[] => [...today(lines), { name: "어제 · 10. 25", lines: YESTERDAY }];
	switch (stage) {
		case "failedOnly":
			return today([PUBLISHED]);
		case "retrying":
			return today([{ ...PUBLISHED, delivery: "sending" }]);
		case "retried":
		case "noMatch":
		case "empty":
		case "loadFailed":
			return [];
		case "canceled":
			return both(withDelivery(TODAY, (line) => (line.id === "publish" ? "canceled" : line.delivery)));
		case "threeFailed":
			return both(THREE_FAILED_DAY);
		case "retryingAll":
			return both(withDelivery(THREE_FAILED_DAY, (line) => (line.id.startsWith("f") ? "sending" : line.delivery)));
		case "allSent":
			return both(withDelivery(THREE_FAILED_DAY, (line) => (line.id.startsWith("f") ? undefined : line.delivery)));
		case "someFailed":
			return both(
				withDelivery(THREE_FAILED_DAY, (line) =>
					line.id === "f3" ? { failed: 1 } : line.id.startsWith("f") ? undefined : line.delivery,
				),
			);
		case "filteredPending":
			return today(TODAY.filter((line) => line.delivery === "pending"));
		case "oneEntry":
			return today(TODAY.filter((line) => line.id === "shorter" || line.id === "english"));
		case "noReceivers":
			return both(withDelivery(TODAY, () => undefined));
		default:
			return both(TODAY);
	}
}

const FAILED_COUNT: Partial<Record<EventsStage, number>> = {
	default: 1,
	failedOnly: 1,
	retrying: 1,
	detail: 1,
	detailAssistant: 1,
	detailGone: 1,
	cancelConfirm: 1,
	threeFailed: 3,
	retryingAll: 3,
	someFailed: 1,
	filterMenu: 1,
	filteredPending: 1,
	oneEntry: 1,
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

/** What a line's end shows: what can be done with it, and nothing else. */
function LineEnd({ line }: { line: Line }) {
	const { undo, delivery } = line;
	if (!undo && !delivery) return null;
	return (
		<RowActions>
			<Inline gap={16} align="baseline">
				{undo === "open" ? (
					<TextButton variant="underline" size="note">
						되돌리기
					</TextButton>
				) : undo ? (
					<Text as="span" variant="note" tone="subtle">
						되돌림 · {undo}
					</Text>
				) : null}
				{delivery === "sending" ? (
					<TextButton variant="underline" size="note" loading>
						보내는 중…
					</TextButton>
				) : delivery === "pending" ? (
					<Text as="span" variant="note">
						보내는 중
					</Text>
				) : delivery === "canceled" ? (
					<Text as="span" variant="note" tone="subtle">
						취소됨
					</Text>
				) : delivery ? (
					<Inline gap={12} align="baseline">
						<EntryStatus status="failed" quiet={delivery.quiet}>
							{delivery.failed}번 실패
						</EntryStatus>
						<TextButton variant="underline" size="note">
							다시 보내기
						</TextButton>
					</Inline>
				) : null}
			</Inline>
		</RowActions>
	);
}

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

/** A line's details beside the list: the event, what it touched, and each receiver's delivery with what can be done about it. */
function Details({ stage }: { stage: EventsStage }) {
	if (stage === "detailAssistant")
		return (
			<SidePanel
				width="side"
				title="“이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고 안 쓰는 초안은 지워 줘.”"
				closable
				footer={<TextButton>되돌리기</TextButton>}
			>
				<Stack gap={32}>
					{/* The head cuts a long request; here it is whole. */}
					<Group title="요청">
						<Text>이 두 편 요약 채워 줘. 작년 글은 2024 폴더로 옮기고 안 쓰는 초안은 지워 줘.</Text>
					</Group>
					<Group title="이벤트">
						<DescriptionList>
							<DescriptionItem label="언제" mono>
								10. 26 10:52
							</DescriptionItem>
							<DescriptionItem label="한 사람">어시스턴트</DescriptionItem>
							<DescriptionItem label="ID" mono>
								5b1e6c0a-93d2-4c7b-8a44-0d5f6f1b2e91
							</DescriptionItem>
						</DescriptionList>
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
			<SidePanel width="side" title={'"옛 소개 글" 휴지통으로'} closable footer={<TextButton>되돌리기</TextButton>}>
				<Stack gap={32}>
					<Group title="이벤트">
						<DescriptionList>
							<DescriptionItem label="언제" mono>
								10. 25 17:20
							</DescriptionItem>
							<DescriptionItem label="한 사람">관리자</DescriptionItem>
							<DescriptionItem label="ID" mono>
								0c9d2a71-6e55-4f0e-b1c3-7a2f48d09be4
							</DescriptionItem>
						</DescriptionList>
					</Group>
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
							<DescriptionItem label="받는 곳" mono>
								plugin:next
							</DescriptionItem>
							<DescriptionItem label="이벤트" mono>
								entry.unpublished
							</DescriptionItem>
							<DescriptionItem label="상태">
								<EntryStatus status="published">보냄</EntryStatus>
							</DescriptionItem>
							<DescriptionItem label="시도 횟수" mono>
								1
							</DescriptionItem>
						</DescriptionList>
					</Group>
				</Stack>
			</SidePanel>
		);
	const canceled = stage === "canceled";
	return (
		<SidePanel width="side" title={'"첫 번째 글" 발행'} closable footer={<TextButton>되돌리기</TextButton>}>
			<Stack gap={32}>
				<Group title="이벤트">
					<DescriptionList>
						<DescriptionItem label="언제" mono>
							10. 26 10:40
						</DescriptionItem>
						<DescriptionItem label="한 사람">관리자</DescriptionItem>
						<DescriptionItem label="ID" mono>
							a81f3d52-7c4e-4b19-9f6a-2e0d1c8b5a37
						</DescriptionItem>
					</DescriptionList>
				</Group>
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
								<DescriptionItem label="받는 곳" mono>
									webhook:https://example.dev/api/revalidate
								</DescriptionItem>
								<DescriptionItem label="이벤트" mono>
									entry.published
								</DescriptionItem>
								<DescriptionItem label="상태">
									{canceled ? <Text tone="subtle">취소됨</Text> : <EntryStatus status="failed">실패</EntryStatus>}
								</DescriptionItem>
								<DescriptionItem label="시도 횟수" mono>
									3
								</DescriptionItem>
								<DescriptionItem label="마지막 오류" mono>
									503 Service Unavailable
								</DescriptionItem>
								{canceled ? null : (
									<DescriptionItem label="다음 시도" mono>
										11:16
									</DescriptionItem>
								)}
							</DescriptionList>
							{canceled ? null : (
								<Inline gap={16}>
									<TextButton variant="underline">다시 보내기</TextButton>
									<TextButton variant="quiet">취소</TextButton>
								</Inline>
							)}
						</Stack>
						<DescriptionList>
							<DescriptionItem label="받는 곳" mono>
								plugin:search
							</DescriptionItem>
							<DescriptionItem label="이벤트" mono>
								entry.published
							</DescriptionItem>
							<DescriptionItem label="상태">
								<EntryStatus status="published">보냄</EntryStatus>
							</DescriptionItem>
							<DescriptionItem label="시도 횟수" mono>
								1
							</DescriptionItem>
						</DescriptionList>
					</Stack>
				</Group>
			</Stack>
		</SidePanel>
	);
}

/** The kinds the log is filtered by, each with its icon; the assistant's is the spark. */
const KINDS = [
	{ value: "assistant", name: "AI 제안", icon: Spark },
	{ value: "save", name: "글 저장", icon: Save },
	{ value: "publish", name: "글 발행", icon: Globe },
	{ value: "trash", name: "휴지통", icon: TrashCan },
	{ value: "settings", name: "설정", icon: SettingsAdjust },
	{ value: "media", name: "미디어", icon: Image },
] as const;

/** The filter's button and its menu: the kinds, one at a time, and under a line the delivery states with how many deliveries are in each. */
function KindFilter({ open, kind, deliveries }: { open: boolean; kind?: string; deliveries: boolean }) {
	const picked = KINDS.find((each) => each.value === kind);
	return (
		<DropdownMenu open={open}>
			<DropdownMenuTrigger render={<FilterButton filled={picked !== undefined} />}>
				{picked ? `종류: ${picked.name}` : "종류"}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={kind ?? "all"}>
					<DropdownMenuRadioItem value="all">
						<ListBulleted aria-hidden />
						전체
					</DropdownMenuRadioItem>
					{KINDS.map(({ value, name, icon: Icon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<Icon aria-hidden />
							{name}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				{deliveries ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuSub open={open}>
							<DropdownMenuSubTrigger>
								<Launch aria-hidden />
								전송
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								<DropdownMenuRadioGroup value="">
									<DropdownMenuRadioItem value="pending">
										대기<MenuShortcut>1</MenuShortcut>
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="sent">
										보냄<MenuShortcut>42</MenuShortcut>
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="failed">
										실패<MenuShortcut>1</MenuShortcut>
									</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="canceled">
										취소됨<MenuShortcut>2</MenuShortcut>
									</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
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
 * Tools, on its activity tab: the log by day, newest first. A line says what was done and, under it, where; the assistant's work is one line per
 * request, quoted, with what it did under it. A line's end holds only what can be done with it: undo for the assistant's work, sending a failed
 * delivery again. One failed delivery shows in its own line; from two on, a banner over the log offers to send them all.
 */
export function EventsScreen({ stage = "default" }: { stage?: EventsStage }) {
	const days = daysOf(stage);
	const failed = FAILED_COUNT[stage] ?? 0;
	const open = OPEN[stage];
	const banner = stage === "threeFailed" || stage === "retryingAll";
	const noReceivers = stage === "noReceivers";
	const message = TOAST[stage];
	const failedFilter = stage === "failedOnly" || stage === "retrying" || stage === "retried";
	return (
		<AdminFrame
			open="tools"
			counts={{ tools: failed > 0 ? String(failed) : undefined }}
			corner={open === undefined}
			panel={open ? <Details stage={stage} /> : undefined}
		>
			<PageColumn width="list">
				<PageHeader title="도구" />
				<PageToolbar inset>
					<TabLinks variant="toolbar">
						<TabLink href="#">템플릿</TabLink>
						<TabLink href="#" current count={failed > 0 ? String(failed) : undefined} countTone="warning">
							활동 기록
						</TabLink>
					</TabLinks>
					<PageToolbarEnd>
						{failedFilter ? (
							<Chip onRemove={() => {}} removeLabel="필터 지우기">
								전송: 실패
							</Chip>
						) : null}
						{stage === "filteredPending" ? (
							<Chip onRemove={() => {}} removeLabel="필터 지우기">
								전송: 대기
							</Chip>
						) : null}
						{stage === "oneEntry" ? (
							<Chip onRemove={() => {}} removeLabel="필터 지우기">
								글: 첫 번째 글
							</Chip>
						) : null}
						{stage === "noMatch" ? (
							<Chip onRemove={() => {}} removeLabel="필터 지우기">
								전송: 취소됨
							</Chip>
						) : null}
						<KindFilter
							open={stage === "filterMenu"}
							kind={stage === "oneEntry" ? "assistant" : stage === "noMatch" ? "media" : undefined}
							deliveries={!noReceivers}
						/>
					</PageToolbarEnd>
				</PageToolbar>
				{banner ? (
					<Box paddingTop={16}>
						<Banner tone="danger" title="전송 실패 3건" meta="10. 26부터">
							<TextButton variant="underline">보기</TextButton>
							{stage === "retryingAll" ? (
								<TextButton loading>보내는 중…</TextButton>
							) : (
								<TextButton>모두 다시 보내기</TextButton>
							)}
						</Banner>
					</Box>
				) : null}
				{stage === "loadFailed" ? (
					<Box paddingTop={16}>
						<Banner tone="danger" title="기록을 불러오지 못했습니다" plainMeta>
							<TextButton variant="underline">다시 시도</TextButton>
						</Banner>
					</Box>
				) : null}
				{stage === "empty" || stage === "retried" || stage === "noMatch" ? (
					<Box paddingTop={24} paddingX={12}>
						<Inline gap={12} align="baseline">
							<Text tone="subtle">
								{stage === "empty"
									? "아직 기록이 없습니다"
									: stage === "retried"
										? "실패한 전송이 없습니다"
										: "맞는 기록이 없습니다"}
							</Text>
							{stage === "empty" ? null : (
								<TextButton variant="underline" size="note">
									필터 끄기
								</TextButton>
							)}
						</Inline>
					</Box>
				) : null}
				{days.map((day) => (
					<Stack key={day.name} gap={4} paddingTop={24}>
						<Box paddingX={12}>
							<Text as="p" variant="meta" tone="subtle">
								{day.name}
							</Text>
						</Box>
						{/* No widths but the time's: the end takes what its words need, and the title, which ends in "…", takes the rest. */}
						<Table container="none" aria-label={day.name}>
							<TableBody>
								{day.lines.map((line) => (
									<TableRow key={line.id} selected={line.id === open}>
										<TableCell valign="top" size={64}>
											<Count>{line.time}</Count>
										</TableCell>
										<TableCell truncate valign="top">
											<Stack gap={4} minWidth={0}>
												{line.request ? (
													<Inline gap={8} align="baseline" minWidth={0}>
														<Text tone="proposal" aria-hidden="true">
															✦
														</Text>
														<Text truncate>
															<RowLink render={<button type="button" />}>“{line.request}”</RowLink>
														</Text>
													</Inline>
												) : (
													<Text as="div" truncate>
														<RowLink render={<button type="button" />}>{line.what}</RowLink>
													</Text>
												)}
												<Box paddingY={2}>
													<Text as="div" variant="meta" tone="subtle" truncate>
														{line.request ? line.what : line.where}
													</Text>
												</Box>
											</Stack>
										</TableCell>
										<TableCell align="end" valign="top">
											<LineEnd line={line} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</Stack>
				))}
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
								<Text mono>webhook:https://example.dev/api/revalidate</Text>
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
