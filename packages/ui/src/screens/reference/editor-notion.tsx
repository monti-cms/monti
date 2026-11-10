import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	Close,
	Copy,
	OverflowMenuHorizontal,
	Renew,
	Repeat,
	RightPanelOpen,
	Settings,
	Spark,
	TextAlignLeft,
	TrashCan,
} from "../../icons";
import {
	Block,
	BlockHandle,
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	EditorHeader,
	EditorTitleRule,
	EntryStatus,
	type EntryStatusKind,
	FloatingBar,
	FormatBarRequest,
	FormatButton,
	FormField,
	FormFieldLabel,
	Heading,
	IconButton,
	Inline,
	Input,
	MediaInput,
	MenuShortcut,
	PropertyGroup,
	PropertyPanel,
	RequestAnchor,
	Select,
	SelectTrigger,
	SelectValue,
	Separator,
	SplitButton,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarList,
	StatusBarSpacer,
	TabLink,
	TabLinks,
	TagInput,
	Text,
	Textarea,
	TextButton,
	TodoItem,
} from "../../index";

/** Nothing happens when a control of a reference screen is pressed: its looks only. */
export const still = () => {};

/** The editor's top bar: back to the list, the entry's address and state, then save, preview, publish and the panes. */
export function EntryHeader({
	back = "게시글",
	address,
	status,
	statusLabel,
	publish = true,
	panel = true,
	panelOpen = true,
	wide = false,
}: {
	back?: string;
	address?: string;
	status: EntryStatusKind;
	statusLabel: string;
	/** Save, preview and publish; without it the bar has only a save pill (a template). */
	publish?: boolean;
	/** The properties pane's toggle. */
	panel?: boolean;
	/** The properties pane is open beside the text: the toggle is pressed. A screen without the pane (a translation) leaves it unpressed. */
	panelOpen?: boolean;
	/** 16px between the bar's parts (a template's bar), not 12. */
	wide?: boolean;
}) {
	return (
		<EditorHeader>
			<Inline gap={wide ? 16 : 12} minWidth={0} paddingX={12}>
				<TextButton variant="quiet">
					<ChevronLeft aria-hidden />
					{back}
				</TextButton>
				{address ? (
					<Text variant="meta" tone="faint" truncate>
						{address}
					</Text>
				) : null}
				<EntryStatus status={status}>{statusLabel}</EntryStatus>
			</Inline>
			<Inline gap={wide ? 16 : 12} justify="end">
				{publish ? (
					<>
						<Button variant="ghost">
							저장{" "}
							<Text variant="micro" tone="faint">
								⌘S
							</Text>
						</Button>
						<Button variant="secondary">미리보기</Button>
						<SplitButton menuLabel="발행 방식" menu={null}>
							발행하기
						</SplitButton>
					</>
				) : (
					// A button shows no shortcut (button.md); ⌘S is in its tooltip.
					<Button>저장</Button>
				)}
				{/* The pill stands alone: the line sets it apart from the screen's tools (the panes, ⋯, ✦). */}
				<Separator orientation="vertical" length="control" flush />
				{panel ? (
					<IconButton label="속성" side="bottom" pressed={panelOpen}>
						<RightPanelOpen aria-hidden />
					</IconButton>
				) : null}
				<IconButton label="더 보기" side="bottom">
					<OverflowMenuHorizontal aria-hidden />
				</IconButton>
				<IconButton label="어시스턴트 열기" side="bottom">
					<Spark aria-hidden />
				</IconButton>
			</Inline>
		</EditorHeader>
	);
}

/** The entry's language tabs over its title. */
export function LanguageTabs({ english = "English", englishDot }: { english?: string; englishDot?: boolean }) {
	return (
		<Box as="nav" aria-label="언어" paddingTop={6}>
			<TabLinks>
				<TabLink current>한국어</TabLink>
				<TabLink dot={englishDot ? "warning" : undefined}>{english}</TabLink>
				<TabLink render={<button type="button" />}>+ 언어</TabLink>
			</TabLinks>
		</Box>
	);
}

/**
 * The editor's page: the bar, the writing column (its head — tabs, title, rule — then the body) with the properties pane beside it when given, and the
 * status bar.
 */
export function EditorPage({
	header,
	banner,
	head,
	side,
	beside,
	statusBar,
	dock,
	children,
}: {
	header: React.ReactNode;
	/** A `Banner` about the whole entry, edge to edge under the bar (a conflict, an ended session). */
	banner?: React.ReactNode;
	/** Over the title (the language tabs). */
	head?: React.ReactNode;
	/** The pane at the right (the properties). */
	side?: React.ReactNode;
	/** A pane at the left of the column (a translation's source). */
	beside?: React.ReactNode;
	statusBar: React.ReactNode;
	/** Held over the bottom of the writing area (the proposals' pill). */
	dock?: React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			{header}
			{banner}
			<Inline align="stretch" gap={beside ? 40 : 0} grow minHeight={0} overflow="hidden">
				{beside}
				<Stack gap={0} grow minWidth={0} overflow="y" paddingX={48} paddingTop={16}>
					<Stack gap={0} grow width="full" maxWidth="reading" centered paddingBottom={48}>
						{head}
						{children}
					</Stack>
					{dock ? <Box paddingBottom={16}>{dock}</Box> : null}
				</Stack>
				{side}
			</Inline>
			{statusBar}
		</Stack>
	);
}

/** The entry's title as large as a page's, with the ink rule under it; the body starts 32 below. */
export function EntryTitle({ children }: { children: React.ReactNode }) {
	return (
		<Stack gap={0} paddingTop={16} paddingBottom={32}>
			<Heading as="h1" variant="display">
				{children}
			</Heading>
			<EditorTitleRule />
		</Stack>
	);
}

/** A block of the body, `gap` px under the one before. */
export function BodyBlock({ gap = 0, children }: { gap?: 0 | 8 | 12 | 20 | 24 | 32; children: React.ReactNode }) {
	return (
		<Box paddingTop={gap} position="relative">
			{children}
		</Box>
	);
}

/** A paragraph of the body in the reading type. */
export function Paragraph({ tone, children }: { tone?: "muted" | "faint"; children: React.ReactNode }) {
	return (
		<Text as="p" variant="reading" tone={tone}>
			{children}
		</Text>
	);
}

/** A section heading of the body. */
export function BodyHeading({ children }: { children: React.ReactNode }) {
	return (
		<Heading as="h2" variant="heading">
			{children}
		</Heading>
	);
}

/** The entry's properties pane: its basic fields, then the classification. `summary` is the summary field (it differs per screen). */
export function EntryProperties({
	summary,
	seoDot,
}: {
	summary?: React.ReactNode;
	/** The SEO tab has a proposal in it. */
	seoDot?: boolean;
}) {
	return (
		<PropertyPanel
			label="속성"
			value="기본"
			onValueChange={still}
			tabs={[
				{ value: "기본", label: "기본" },
				{ value: "SEO", label: "SEO", dot: seoDot ? "proposal" : undefined },
			]}
		>
			<PropertyGroup>
				<FormField>
					<FormFieldLabel htmlFor="ref-address">주소</FormFieldLabel>
					<Input
						size="md"
						id="ref-address"
						defaultValue="first-post"
						placeholder="비어 있음"
						mono
						action={
							<IconButton label="제목으로 다시 만들기">
								<Renew aria-hidden />
							</IconButton>
						}
					/>
				</FormField>
				<FormField>
					<FormFieldLabel htmlFor="cover">대표 이미지</FormFieldLabel>
					<MediaInput
						id="cover"
						size="md"
						value={{ name: "cover-react.png" }}
						onClear={() => {}}
						clearLabel="빼기"
						action={
							<IconButton label="대표 이미지 설정">
								<Settings aria-hidden />
							</IconButton>
						}
					/>
				</FormField>
				{summary ?? (
					<FormField>
						<FormFieldLabel
							htmlFor="ref-summary"
							action={
								<TextButton tone="proposal" size="micro">
									채우기
								</TextButton>
							}
						>
							요약
						</FormFieldLabel>
						<Textarea size="md" id="ref-summary" placeholder="비어 있음" />
					</FormField>
				)}
			</PropertyGroup>
			<PropertyGroup title="분류">
				<FormField>
					<FormFieldLabel htmlFor="ref-category">카테고리</FormFieldLabel>
					<Input
						size="md"
						id="ref-category"
						defaultValue="개발"
						action={
							<IconButton label="카테고리 지우기">
								<Close aria-hidden />
							</IconButton>
						}
					/>
				</FormField>
				<FormField>
					<FormFieldLabel>태그</FormFieldLabel>
					<TagInput
						size="md"
						aria-label="태그"
						items={["리액트", "프론트엔드"]}
						onChange={still}
						removeLabel={(item) => `${item} 빼기`}
					/>
				</FormField>
				<FormField>
					<FormFieldLabel>시리즈</FormFieldLabel>
					<Select items={[{ value: "none", label: "없음" }]} value="none">
						<SelectTrigger size="md" width="full">
							<SelectValue />
						</SelectTrigger>
					</Select>
				</FormField>
			</PropertyGroup>
		</PropertyPanel>
	);
}

/** The block menu, open from a block's grip. */
function BlockMenu() {
	return (
		<DropdownMenuContent side="bottom" align="start" alignOffset={-18} sideOffset={6}>
			<DropdownMenuGroup>
				<DropdownMenuLabel>문단</DropdownMenuLabel>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<Repeat aria-hidden />
						다른 블록으로 바꾸기
					</DropdownMenuSubTrigger>
				</DropdownMenuSub>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<TextAlignLeft aria-hidden />
						정렬
					</DropdownMenuSubTrigger>
				</DropdownMenuSub>
			</DropdownMenuGroup>
			<DropdownMenuSeparator />
			<DropdownMenuItem>
				<ArrowUp aria-hidden />
				위로
				<MenuShortcut>⌥↑</MenuShortcut>
			</DropdownMenuItem>
			<DropdownMenuItem>
				<ArrowDown aria-hidden />
				아래로
				<MenuShortcut>⌥↓</MenuShortcut>
			</DropdownMenuItem>
			<DropdownMenuItem>
				<Copy aria-hidden />
				복제
				<MenuShortcut>⇧⌘D</MenuShortcut>
			</DropdownMenuItem>
			<DropdownMenuItem>
				<TrashCan aria-hidden />
				삭제
				<MenuShortcut>⇧⌘⌫</MenuShortcut>
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

/** The bar over picked words. */
function FormatBar() {
	return (
		<FloatingBar>
			<FormatButton mark="bold" label="굵게" pressed />
			<FormatButton mark="italic" label="기울임" />
			<FormatButton mark="underline" label="밑줄" />
			<FormatButton mark="strike" label="취소선" />
			<FormatButton mark="code" label="코드" />
			<Separator orientation="vertical" length="bar" />
			<FormatButton mark="superscript" label="위 첨자" />
			<FormatButton mark="subscript" label="아래 첨자" />
			<FormatButton mark="link" label="링크" />
			<FormatButton mark="footnote" label="각주" />
			<FormatButton mark="more" label="사이트가 더한 서식" />
			<Separator orientation="vertical" length="bar" />
			<FormatBarRequest label="요청" />
		</FloatingBar>
	);
}

/** The status bar of an entry with things to fix: unsaved changes, the to-do list open, spelling, the length. */
function NotionStatusBar() {
	return (
		<StatusBar>
			<StatusBarCell tone="warning">저장 전 변경사항</StatusBarCell>
			<StatusBarList
				trigger={<StatusBarCell tone="warning">할 일 2</StatusBarCell>}
				label="발행 전에 고칠 것"
				count={2}
				defaultOpen
			>
				{/* A row only takes you to its place; filling is the field's own ✦ there, beside what it fills. */}
				<TodoItem title="요약 쓰기" detail="속성 · 비어 있음" current />
				<TodoItem title="대체 텍스트 없는 이미지 2개" detail="대표 이미지 · 본문 1" />
			</StatusBarList>
			<StatusBarCell>맞춤법 2</StatusBarCell>
			<StatusBarSpacer />
			<StatusBarCell end>1,240자</StatusBarCell>
		</StatusBar>
	);
}

/** The editor as one writes: the first block's menu open from its grip, and the format bar over picked words. */
export function EditorNotionScreen() {
	return (
		<EditorPage
			header={<EntryHeader address="/posts/first-post" status="editing" statusLabel="수정 중" />}
			head={<LanguageTabs englishDot />}
			side={<EntryProperties />}
			statusBar={<NotionStatusBar />}
		>
			<EntryTitle>첫 번째 글</EntryTitle>
			<Box position="relative">
				{/* design-allow: the handle floats in the margin beside the block, where the editor's overlay puts it (32px left, 3px down: the 24px handle centred on the 30px line) */}
				<div style={{ position: "absolute", top: 3, left: -32 }}>
					<DropdownMenu open modal={false}>
						<BlockHandle gripLabel="블록 메뉴" active trigger={(grip) => <DropdownMenuTrigger render={grip} />} />
						<BlockMenu />
					</DropdownMenu>
				</div>
				<Block active>
					<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
				</Block>
			</Box>
			<BodyBlock gap={32}>
				<BodyHeading>무엇을 덜어냈나</BodyHeading>
			</BodyBlock>
			<BodyBlock gap={12}>
				<Box position="relative">
					{/* design-allow: the format bar floats over the picked words, where the editor's bubble puts it */}
					<div style={{ position: "absolute", top: -42, left: 300 }}>
						<FormatBar />
					</div>
					<Paragraph>
						목록에는 제목과 주소, 지금 상태만 남겼다. <RequestAnchor>나머지는 필요할 때 꺼내 본다</RequestAnchor>.
					</Paragraph>
				</Box>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph>편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.</Paragraph>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph tone="faint">/ 를 눌러 블록 넣기</Paragraph>
			</BodyBlock>
		</EditorPage>
	);
}
