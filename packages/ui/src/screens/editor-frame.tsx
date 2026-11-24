import { Add, OverflowMenuHorizontal, RightPanelOpen, Spark, View } from "../icons";
import {
	AssistantSlot,
	Box,
	Button,
	EditorBackButton,
	EditorBody,
	EditorHeader,
	EditorPath,
	EditorTitleRule,
	EditorToolbarSeparator,
	EntryStatus,
	Heading,
	IconButton,
	Inline,
	SplitButton,
	Stack,
	StandalonePage,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TabLink,
	TabLinks,
	Text,
} from "../index";

/** 발행 알약의 세 모습: 발행됨(바뀐 것 없음), 변경 발행(발행 뒤 바뀜), 발행(처음). */
export type PublishState = "published" | "changes" | "draft";

function Publish({ state }: { state: PublishState }) {
	if (state === "published")
		return (
			<SplitButton variant="secondary" menuLabel="발행 방식" menu={null}>
				<EntryStatus status="published" />
				발행됨
			</SplitButton>
		);
	return (
		<SplitButton menuLabel="발행 방식" menu={null}>
			{state === "changes" ? "변경 발행" : "발행"}
		</SplitButton>
	);
}

/**
 * 편집기 머리 줄(시안 v5 `parts/topbar.html`): 목록으로 돌아가기, 폴더와 글 제목의 경로, 미리보기, 발행 알약, 선 뒤의 속성 패널 · ⋯ · ✦.
 */
export function EditorTopBar({
	folder,
	title,
	publish,
	panelOpen = false,
}: {
	folder: string;
	title: string;
	publish: PublishState;
	panelOpen?: boolean;
}) {
	return (
		<EditorHeader>
			<Inline gap={8} minWidth={0}>
				<EditorBackButton>글</EditorBackButton>
				<EditorPath folders={[folder]} title={title} />
			</Inline>
			<Inline gap={4}>
				<Button variant="ghost">
					<View aria-hidden />
					미리보기
				</Button>
				<Publish state={publish} />
				<EditorToolbarSeparator />
				<IconButton label="속성" side="bottom" pressed={panelOpen}>
					<RightPanelOpen aria-hidden />
				</IconButton>
				<IconButton label="더 보기" side="bottom">
					<OverflowMenuHorizontal aria-hidden />
				</IconButton>
			</Inline>
		</EditorHeader>
	);
}

/** 편집기 아래 막대: 저장 상태, 할 일, 끝에 글자 수. */
export function EditorStatus({
	save,
	todo = "할 일 없음",
	todoTone,
	count,
}: {
	save: string;
	todo?: string;
	todoTone?: "warning";
	/** 글자 수(숫자만 mono). */
	count: string;
}) {
	return (
		<StatusBar aria-label="편집기 상태">
			<StatusBarCell render={<span />}>{save}</StatusBarCell>
			<StatusBarCell render={<span />} tone={todoTone} dot={false}>
				{todo}
			</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end render={<span />}>
				<span>{count}자</span>
			</StatusBarCell>
		</StatusBar>
	);
}

/** 글의 언어 탭: 지금 언어, 다른 언어들, "+ 언어". */
export function LanguageTabs({ others = [] }: { others?: readonly string[] }) {
	return (
		<Box as="nav" aria-label="언어">
			<TabLinks variant="entry">
				<TabLink current>한국어</TabLink>
				{others.map((language) => (
					<TabLink key={language}>{language}</TabLink>
				))}
				<TabLink render={<button type="button" />}>
					<Add aria-hidden />
					언어
				</TabLink>
			</TabLinks>
		</Box>
	);
}

/** 글 제목(32px)과 그 아래 먹색 선. */
export function DocTitle({ gap = 0, children }: { gap?: 0 | 24; children: React.ReactNode }) {
	return (
		// 본문의 첫 제목(h2)은 제 위 여백(36)으로 선에서 떨어지고, 문단으로 시작하는 본문은 `gap`을 준다.
		<Stack gap={0} paddingTop={20} paddingBottom={gap}>
			<Heading as="h1" variant="display">
				{children}
			</Heading>
			<EditorTitleRule />
		</Stack>
	);
}

/**
 * 편집기 화면: 머리 줄, (고정 도구 막대), 680px 글 단과 그 오른쪽의 패널, 아래 막대. `children`은 글 단 안의 언어 탭 · 제목 · 본문이다.
 */
export function EditorScreen({
	top,
	dock,
	panel,
	status,
	children,
}: {
	top: React.ReactNode;
	dock?: React.ReactNode;
	panel?: React.ReactNode;
	status: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Text as="div" variant="body">
			{/* 머리 줄 끝의 ✦는 앱이 한 번 주는 자리(`AssistantSlot`)에서 온다. 별 하나의 버튼이고, 그 패널은 이 화면들에 없다. */}
			<AssistantSlot
				button={
					<IconButton label="어시스턴트 열기" side="bottom">
						<Spark aria-hidden />
					</IconButton>
				}
			>
				<StandalonePage>
					{top}
					{dock}
					<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
						<Stack gap={0} grow minWidth={0} overflow="y" data-slot="editor-scroll">
							<Stack gap={0} width="reading" shrink={false} centered paddingTop={20} paddingBottom={48}>
								{children}
							</Stack>
						</Stack>
						{panel}
					</Inline>
					{status}
				</StandalonePage>
			</AssistantSlot>
		</Text>
	);
}

/** 본문: 편집기 엔진이 그리는 그대로의 요소들(`EditorBody`가 모양을 준다). */
export function DocBody({ children }: { children: React.ReactNode }) {
	return (
		<EditorBody>
			<div>{children}</div>
		</EditorBody>
	);
}
