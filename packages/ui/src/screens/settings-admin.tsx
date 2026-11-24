import {
	Add,
	ChevronDown,
	Close,
	Code,
	DataTable,
	Heading,
	Image,
	Launch,
	Link,
	ListBulleted,
	ListChecked,
	Logout,
	Paragraph,
	Quotes,
	Reset,
	Spark,
	Subtract,
	Template,
	TextBold,
	TextItalic,
	TextStrikethrough,
	TextUnderline,
	Video,
	View,
	ViewOff,
	WarningAlt,
} from "../icons";
import {
	Box,
	Button,
	Caret,
	DragHandle,
	FloatingBar,
	FloatingBarButton,
	FormatButton,
	FormField,
	FormFieldHint,
	FormFieldLabel,
	Grid,
	IconButton,
	Inline,
	LetterMark,
	Section,
	Segmented,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	SettingRow,
	Switch,
	TextButton,
	ToolList,
	ToolListAdd,
	ToolListHead,
	ToolListItem,
	ToolListSeparator,
	ToolPreview,
	ToolPreviewMenu,
	ToolPreviewMenuItem,
	ToolPreviewSelection,
} from "../index";
import { Num } from "./frame";
import { SettingsScreen } from "./settings";

const noop = () => {};

/** "화면" 절: 나에게만 적용되는 화면 언어. 칸은 공용 짧은 폭(240, v7.1의 `--w-input-short`)이다. */
function ScreenSection({ last = false }: { last?: boolean }) {
	return (
		<Section layout="grid" last={last} title="화면" description="나에게만 적용됩니다">
			<FormField spacing="label">
				<FormFieldLabel size="label" htmlFor="admin-locale">
					화면 언어
				</FormFieldLabel>
				<Box width="menu">
					<Select items={[{ value: "ko", label: "한국어" }]} value="ko">
						<SelectTrigger id="admin-locale" width="full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ko">한국어</SelectItem>
						</SelectContent>
					</Select>
				</Box>
				<FormFieldHint>메뉴와 안내 문구의 언어. 글의 언어와는 따로입니다</FormFieldHint>
			</FormField>
		</Section>
	);
}

/** 서식 막대의 한 항목(시안 `settings-toolbar.html`). `separator`는 구분선 줄이다. */
type BarItem =
	| { readonly separator: true; readonly id: string }
	| {
			readonly separator?: false;
			readonly id: string;
			readonly icon: React.ReactNode;
			readonly name: string;
			readonly shortcut?: string;
	  };

const SEP = (id: string): BarItem => ({ separator: true, id });

const BLOCK_TYPE: BarItem = { id: "type", icon: <Heading aria-hidden />, name: "본문 · 제목 바꾸기" };
const BOLD: BarItem = { id: "bold", icon: <TextBold aria-hidden />, name: "굵게", shortcut: "⌘B" };
const LINK: BarItem = { id: "link", icon: <Link aria-hidden />, name: "링크", shortcut: "⌘K" };
const AI: BarItem = { id: "ai", icon: <Spark aria-hidden />, name: "AI", shortcut: "⌘J" };
const STYLES: readonly BarItem[] = [
	{ id: "italic", icon: <TextItalic aria-hidden />, name: "기울임", shortcut: "⌘I" },
	{ id: "underline", icon: <TextUnderline aria-hidden />, name: "밑줄", shortcut: "⌘U" },
	{ id: "strike", icon: <TextStrikethrough aria-hidden />, name: "취소선", shortcut: "⌘⇧X" },
	{ id: "code", icon: <Code aria-hidden />, name: "코드", shortcut: "⌘E" },
];

/** 기본 순서: 블록 종류 | 굵게 … 코드 | 링크 | AI. */
const BAR: readonly BarItem[] = [BLOCK_TYPE, SEP("s1"), BOLD, ...STYLES, SEP("s2"), LINK, SEP("s3"), AI];

/** / 메뉴의 블록(시안 `settings-toolbar-hidden.html`): 보이는 열둘, 숨긴 둘. */
const BLOCKS = [
	{ id: "paragraph", icon: <Paragraph aria-hidden />, name: "문단" },
	{ id: "heading", icon: <Heading aria-hidden />, name: "제목" },
	{ id: "list", icon: <ListBulleted aria-hidden />, name: "목록" },
	{ id: "todo", icon: <ListChecked aria-hidden />, name: "할 일" },
	{ id: "quote", icon: <Quotes aria-hidden />, name: "인용" },
	{ id: "code", icon: <Code aria-hidden />, name: "코드" },
	{ id: "image", icon: <Image aria-hidden />, name: "이미지" },
	{ id: "table", icon: <DataTable aria-hidden />, name: "표" },
	{ id: "callout", icon: <WarningAlt aria-hidden />, name: "알림 상자" },
	{ id: "toggle", icon: <ChevronDown aria-hidden />, name: "접기" },
	{ id: "template", icon: <Template aria-hidden />, name: "템플릿" },
	{ id: "divider", icon: <Subtract aria-hidden />, name: "구분선" },
] as const;

const HIDDEN_BLOCKS = [
	{ id: "link-card", icon: <Launch aria-hidden />, name: "링크 카드" },
	{ id: "video", icon: <Video aria-hidden />, name: "영상 넣기" },
] as const;

const handle = (name: string) => <DragHandle aria-label={`${name} 옮기기`} />;
const hide = (name: string) => (
	<IconButton size="xs" tone="quiet" label={`${name} 숨기기`}>
		<View aria-hidden />
	</IconButton>
);

/** 서식 막대 항목의 줄들. `held`: 끌고 있는 항목의 id(놓일 자리에 뜬다). */
function BarRows({ items, held }: { items: readonly BarItem[]; held?: string }) {
	return items.map((item) =>
		item.separator ? (
			<ToolListSeparator
				key={item.id}
				handle={handle("구분선")}
				action={
					<IconButton size="xs" tone="quiet" label="구분선 빼기">
						<Close aria-hidden />
					</IconButton>
				}
			/>
		) : (
			<ToolListItem
				key={item.id}
				handle={handle(item.name)}
				icon={item.icon}
				name={item.name}
				shortcut={item.shortcut}
				action={hide(item.name)}
				held={item.id === held}
			/>
		),
	);
}

/** 미리보기의 서식 막대: 목록의 순서대로. `marked`: 방금 옮긴 버튼. */
function PreviewBar({ items, marked }: { items: readonly BarItem[]; marked?: string }) {
	return (
		<FloatingBar aria-label="서식 막대 미리보기">
			{items.map((item) => {
				if (item.separator) return <Separator key={item.id} orientation="vertical" length="bar" />;
				const on = item.id === marked;
				switch (item.id) {
					case "type":
						return (
							<FloatingBarButton key={item.id} named label="블록 종류">
								본문
								<Caret />
							</FloatingBarButton>
						);
					case "ai":
						return (
							<FloatingBarButton key={item.id} label="AI" tone="proposal">
								<Spark aria-hidden />
							</FloatingBarButton>
						);
					case "link":
						return (
							<FloatingBarButton key={item.id} label="링크" marked={on}>
								<Link aria-hidden />
							</FloatingBarButton>
						);
					default:
						return (
							<FormatButton
								key={item.id}
								mark={item.id as "bold" | "italic" | "underline" | "strike" | "code"}
								label={item.name}
							/>
						);
				}
			})}
		</FloatingBar>
	);
}

type ToolsView = "bar" | "menu";

/** "편집기 도구" 절: 서식 막대 · / 블록 메뉴를 고르는 칸, 기본값으로 되돌리기, 항목 목록과 미리보기. */
function ToolsSection({ view, dragging }: { view: ToolsView; dragging: boolean }) {
	// 끄는 중: 링크를 굵게 뒤로 옮기는 중이다. 놓일 자리(굵게 뒤)에 링크가 떠 있고, 미리보기는 놓였을 때의 막대를 먼저 보인다.
	const items = dragging ? [BLOCK_TYPE, SEP("s1"), BOLD, LINK, ...STYLES, SEP("s2"), SEP("s3"), AI] : BAR;
	const changed = view === "menu";
	return (
		<Section
			layout="grid"
			last
			title="편집기 도구"
			description="글자 서식 막대와 / 블록 메뉴의 순서와 보이기. 모든 관리자에게 적용됩니다"
		>
			<Inline gap={12} justify="between">
				<Segmented<ToolsView>
					inline
					aria-label="편집기 도구"
					value={view}
					onValueChange={noop}
					options={[
						{ value: "bar", label: "서식 막대" },
						{ value: "menu", label: "/ 블록 메뉴" },
					]}
				/>
				{/* 시안처럼 늘 그 자리에 있다: 기본값 그대로면 흐리게 눌리지 않고, 바뀐 곳이 생겨도 줄이 움직이지 않는다. */}
				<TextButton variant="quiet" size="caption" disabled={!changed}>
					<Reset aria-hidden />
					기본값으로 되돌리기
				</TextButton>
			</Inline>
			<Grid columns="preview" gap={24} align="start">
				{view === "bar" ? (
					<ToolList aria-label="서식 막대 항목">
						<ToolListHead>
							보이는 항목 · <Num>8</Num>
						</ToolListHead>
						<BarRows items={items} held={dragging ? "link" : undefined} />
						{!dragging && (
							<ToolListAdd>
								<Add aria-hidden />
								<span>구분선 넣기</span>
							</ToolListAdd>
						)}
					</ToolList>
				) : (
					<ToolList aria-label="/ 블록 메뉴 항목">
						<ToolListHead>
							보이는 항목 · <Num>12</Num>
						</ToolListHead>
						{BLOCKS.map((block) => (
							<ToolListItem
								key={block.id}
								handle={handle(block.name)}
								icon={block.icon}
								name={block.name}
								action={hide(block.name)}
							/>
						))}
						<ToolListHead aside="/ 메뉴에 안 보이고, 이미 쓴 블록은 그대로">
							숨긴 항목 · <Num>2</Num>
						</ToolListHead>
						{HIDDEN_BLOCKS.map((block) => (
							<ToolListItem
								key={block.id}
								hidden
								handle={handle(block.name)}
								icon={block.icon}
								name={block.name}
								action={
									<IconButton size="xs" tone="quiet" label={`${block.name} 보이기`}>
										<ViewOff aria-hidden />
									</IconButton>
								}
							/>
						))}
					</ToolList>
				)}
				{view === "bar" ? (
					<ToolPreview
						title="미리보기"
						note="글자를 고르면 뜨는 막대"
						float={<PreviewBar items={items} marked={dragging ? "link" : undefined} />}
					>
						산책로는 <ToolPreviewSelection>강을 따라 4km</ToolPreviewSelection> 이어집니다. 중간에 쉼터가 두 곳
						있습니다.
					</ToolPreview>
				) : (
					<ToolPreview
						title="미리보기"
						note="/ 를 누르면 뜨는 메뉴"
						stage="menu"
						float={
							<ToolPreviewMenu
								label="블록"
								more={
									<>
										외 <Num>6</Num>개
									</>
								}
							>
								{BLOCKS.slice(0, 6).map((block, index) => (
									<ToolPreviewMenuItem key={block.id} current={index === 0}>
										{block.icon}
										{block.name}
									</ToolPreviewMenuItem>
								))}
							</ToolPreviewMenu>
						}
					>
						/
					</ToolPreview>
				)}
			</Grid>
		</Section>
	);
}

/**
 * 설정 › 관리자(시안 `settings-admin.html`): 화면 언어, 기능(본문 템플릿), 계정. v7.1대로 관리자 탭은 페이지 폭 전체다(편집기 도구가 넓다).
 * `tools`: 편집기 도구 절이 열린 모습(시안 `settings-toolbar.html` · `-hidden` · `-drag`). `menu`: / 블록 메뉴를 고쳐 숨긴 항목이 둘이다.
 * `dragging`: 링크를 끄는 중이다.
 */
export function SettingsAdminScreen({ tools }: { tools?: { view: ToolsView; dragging?: boolean } }) {
	return (
		<SettingsScreen tab="admin" wide changes={tools?.view === "menu" ? ["영상 넣기", "링크 카드"] : undefined}>
			<ScreenSection />
			{tools ? (
				<ToolsSection view={tools.view} dragging={tools.dragging ?? false} />
			) : (
				<>
					<Section layout="grid" title="기능" description="이 사이트의 모든 관리자에게 적용됩니다">
						<SettingRow
							title="본문 템플릿"
							description="편집기의 / 메뉴에서 미리 만든 본문을 넣습니다. 끄면 ‘도구 › 템플릿’도 숨겨집니다."
							control={<Switch checked aria-label="본문 템플릿" />}
						/>
					</Section>
					<Section layout="grid" last title="계정">
						<SettingRow
							align="center"
							lead={<LetterMark person>하</LetterMark>}
							title="김하늘"
							description="haneul@example.com · 관리자"
							control={
								<Button variant="secondary">
									<Logout aria-hidden />
									로그아웃
								</Button>
							}
						/>
					</Section>
				</>
			)}
		</SettingsScreen>
	);
}
