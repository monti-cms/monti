import { style as calloutStyle } from "@monti-cms/blocks/callout/style.ts";
import { Chart } from "@monti-cms/blocks/chart/site";
import { MathBlock } from "@monti-cms/blocks/math/site";
import { Mermaid } from "@monti-cms/blocks/mermaid/site";
import type { Block as BodyBlockValue } from "@monti-cms/core";
import type * as React from "react";
import { Grip } from "../../grip";
import {
	Add,
	ChartColumn,
	ChevronDown,
	ChevronRight,
	Idea,
	Information,
	SplitScreen,
	Star,
	TextColor,
	TrashCan,
	Warning,
	WarningAlt,
	WarningHex,
} from "../../icons";
import {
	Block,
	BlockBarPlace,
	BlockBox,
	BlockHandle,
	Box,
	Button,
	DocCallout,
	DocCode,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	DropLine,
	FileTree,
	FileTreeRow,
	FloatingBar,
	FloatingBarButton,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	FormatBarRequest,
	FormatButton,
	FormField,
	FormFieldError,
	FormFieldLabel,
	HeldBlock,
	IconButton,
	Inline,
	Input,
	MenuValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Stack,
	StandalonePage,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	TableAddStrip,
	TableColumnBorder,
	TableGrip,
	Text,
	Textarea,
} from "../../index";
import { BodyBlock, EditorPage, EntryHeader, EntryTitle, LanguageTabs, Paragraph, still } from "./editor-notion";

/**
 * The blocks of `@monti-cms/blocks` in the editor (doc 18), drawn with the design system's parts: each block owns a tool row on itself (the one way of
 * the image's: `BlockBarPlace` over its top left, shown while the pointer is over the block or the caret is in it), and a block's settings open from
 * that row as a menu or a card. The shared block menu keeps what every block has.
 */

/** Something the editor floats at a measured point (a block's tool row, a column's grip). */
function At({ top, left, right, children }: { top: number; left?: number; right?: number; children: React.ReactNode }) {
	// design-allow: a point the editor measures on the block (the row over a container, a grip over a column)
	return <div style={{ position: "absolute", top, left, right, zIndex: 2 }}>{children}</div>;
}

/** The writing column with one block in focus between two paragraphs. */
function Page({ children }: { children: React.ReactNode }) {
	return (
		<EditorPage
			header={<EntryHeader address="/posts/react-19" status="draft" statusLabel="초안" />}
			head={<LanguageTabs />}
			statusBar={
				<StatusBar>
					<StatusBarCell>저장됨 10:42</StatusBarCell>
					<StatusBarSpacer />
					<StatusBarCell end>1,240자</StatusBarCell>
				</StatusBar>
			}
		>
			<EntryTitle>React 19로 옮기며 배운 것</EntryTitle>
			<Paragraph>블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.</Paragraph>
			<BodyBlock gap={32}>
				{/* Room over the block for its tool row, which stands over its top left. */}
				<Box paddingTop={24}>{children}</Box>
			</BodyBlock>
			<BodyBlock gap={20}>
				<Paragraph>바꾼 것은 세 가지다. 서버 컴포넌트로 옮긴 페이지, 새 훅, 그리고 지운 의존성.</Paragraph>
			</BodyBlock>
		</EditorPage>
	);
}

/** The block's handle in the margin, as the editor's overlay puts it. */
function Handle() {
	return (
		<At top={3} left={-32}>
			<BlockHandle gripLabel="블록 메뉴" />
		</At>
	);
}

// --- Callout -------------------------------------------------------------------------------------------------------------------------------

const KINDS = [
	{ value: "note", name: "노트", Icon: Warning },
	{ value: "tip", name: "팁", Icon: Idea },
	{ value: "info", name: "정보", Icon: Information },
	{ value: "warning", name: "경고", Icon: WarningAlt },
	{ value: "danger", name: "위험", Icon: WarningHex },
] as const;

/**
 * A callout as the block draws it in the editor: its own look (`callout.css`, the site's: the kind's accent mixed into the ground 10% and the
 * border 40%, the old editor's mix), the kind's icon and the title typed in place, the title's empty text the kind's name.
 */
function CalloutBox({
	tone,
	title,
	children,
}: {
	tone: (typeof KINDS)[number]["value"];
	title: string;
	children: React.ReactNode;
}) {
	const kind = KINDS.find((each) => each.value === tone) ?? KINDS[0];
	return (
		<div className="monti-block-callout" data-tone={tone} role="note">
			<style href="monti-block-callout" precedence="monti-blocks">
				{calloutStyle}
			</style>
			<div className="monti-block-callout-title">
				<Inline gap={8}>
					<kind.Icon aria-hidden />
					<Input
						appearance="inline"
						size="inherit"
						aria-label="콜아웃 제목"
						defaultValue={title}
						placeholder={kind.name}
					/>
				</Inline>
			</div>
			<div className="monti-block-callout-body">
				<Text variant="reading">{children}</Text>
			</div>
		</div>
	);
}

/** The five kinds side by side, each in its accent (the old editor's colours, `styles/index.css:20-61` at 34d5adcd^). */
export function CalloutKindsScreen() {
	return (
		<Page>
			{/* Each callout keeps its own margin (callout.css). */}
			<Stack gap={0}>
				{KINDS.map(({ value, name }) => (
					<CalloutBox key={value} tone={value} title={value === "note" ? "" : name}>
						{`${name} 콜아웃의 본문.`}
					</CalloutBox>
				))}
			</Stack>
		</Page>
	);
}

/** A callout with the caret in it: its row's kind button; `menu`: the kinds open from it upward (✓ on the one it is), the callout in sight. */
export function CalloutScreen({ menu = false }: { menu?: boolean }) {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						<DropdownMenu open={menu} modal={false}>
							<FloatingBarButton
								label="콜아웃 종류 · 경고"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<WarningAlt aria-hidden />
							</FloatingBarButton>
							{/* Up from the row, over the text before the callout: the callout itself stays in sight. */}
							<DropdownMenuContent side="top">
								<DropdownMenuRadioGroup value="warning" onValueChange={still}>
									{KINDS.map(({ value, name, Icon }) => (
										<DropdownMenuRadioItem key={value} value={value}>
											<Icon aria-hidden />
											{name}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</FloatingBar>
				</BlockBarPlace>
				<CalloutBox tone="warning" title="알아 두세요">
					이 글은 React 19와 Next 16 기준이다.
				</CalloutBox>
			</Box>
		</Page>
	);
}

// --- Tabs ----------------------------------------------------------------------------------------------------------------------------------

/** Tabs: the picked tab's name typed where it reads, its row's buttons (first tab, remove), the + at the end of the tabs. */
export function TabsScreen() {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						<FloatingBarButton label="처음 열 탭" pressed>
							<Star aria-hidden />
						</FloatingBarButton>
						<Separator orientation="vertical" length="bar" />
						<FloatingBarButton label="탭 지우기" tone="danger">
							<TrashCan aria-hidden />
						</FloatingBarButton>
					</FloatingBar>
				</BlockBarPlace>
				<FolderTabs value="npm">
					<FolderTabsList>
						{/* The picked tab's name is its input from the start (README, rule 4): pressing it puts the caret there. */}
						<FolderTabEdit>
							<Input appearance="inline" size="inherit" aria-label="탭 이름" defaultValue="npm" />
						</FolderTabEdit>
						<FolderTab value="pnpm" draggable>
							pnpm
						</FolderTab>
						<FolderTab value="yarn" draggable>
							yarn
						</FolderTab>
						<FolderTabsAdd aria-label="탭 더하기" />
					</FolderTabsList>
					<FolderTabsBody value="npm">
						<Stack gap={12} padding={16}>
							<Text variant="reading">설치는 한 줄이다.</Text>
							<DocCode>npm install @monti-cms/core @monti-cms/next</DocCode>
						</Stack>
					</FolderTabsBody>
				</FolderTabs>
			</Box>
		</Page>
	);
}

// --- Columns -------------------------------------------------------------------------------------------------------------------------------

/**
 * Columns, as the table does it: the line between two columns to drag (`drag`), the + band at the right edge while the pointer is over the block,
 * and the grip on the top edge of the column under the pointer with its menu (`menu`). The row says the widths and evens them.
 */
export function ColumnsScreen({ state }: { state: "drag" | "menu" }) {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						<FloatingBarButton label="고르게">
							<SplitScreen aria-hidden />
						</FloatingBarButton>
					</FloatingBar>
				</BlockBarPlace>
				{state === "menu" ? (
					<At top={-6} left={150}>
						<DropdownMenu open modal={false}>
							<TableGrip along="column" label="단 1" active trigger={(grip) => <DropdownMenuTrigger render={grip} />} />
							<DropdownMenuContent>
								<DropdownMenuItem>왼쪽에 단 넣기</DropdownMenuItem>
								<DropdownMenuItem>오른쪽에 단 넣기</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem variant="danger">
									<TrashCan aria-hidden />단 지우기
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</At>
				) : null}
				{/* While the border is dragged, the widths at the block's top right, as the image's size (BlockBox `measure`). */}
				<BlockBox measure={state === "drag" ? "60 : 40" : undefined}>
					<Inline align="start" gap={32}>
						<Stack gap={8} grow minWidth={0}>
							<Text variant="reading">
								<b>전</b>
							</Text>
							<Text variant="reading">페이지마다 데이터를 효과 안에서 읽었다. 첫 화면이 비어 있다가 채워졌다.</Text>
						</Stack>
						<Stack gap={8} grow minWidth={0}>
							<Text variant="reading">
								<b>뒤</b>
							</Text>
							<Text variant="reading">서버 컴포넌트가 읽는다. 첫 화면에 글이 있다.</Text>
						</Stack>
					</Inline>
				</BlockBox>
				{/* design-allow: the border between the two columns and the + band at the right edge, where the editor measures them (as the table's) */}
				<div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(50% - 6px)", width: 12 }}>
					<TableColumnBorder label="단 1과 2의 폭" active={state === "drag"} />
				</div>
				{/* design-allow: the + band 8px right of the block, as wide as the table's */}
				<div style={{ position: "absolute", top: 0, bottom: 0, right: -24, width: 16 }}>
					<TableAddStrip label="단 더하기" />
				</div>
			</Box>
		</Page>
	);
}

// --- Collapsible ---------------------------------------------------------------------------------------------------------------------------

/** A collapsible: its ▾ folds it in the editor too, its title is typed where it reads, its row's one button says whether it starts open. */
export function CollapsibleScreen({ open = true }: { open?: boolean }) {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						{/* A word, not an icon: an icon would need its tooltip to be understood (the old block's switch "처음부터 펼치기"). */}
						<FloatingBarButton label="처음부터 펼치기" pressed>
							처음부터 펼치기
						</FloatingBarButton>
					</FloatingBar>
				</BlockBarPlace>
				<DocCallout>
					<Inline gap={8}>
						<IconButton label={open ? "접기" : "펼치기"} size="xs">
							{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
						</IconButton>
						<Input
							appearance="inline"
							size="inherit"
							aria-label="접기 제목"
							defaultValue="설치가 안 될 때"
							placeholder="펼치기"
						/>
					</Inline>
					{open ? (
						<Stack gap={12}>
							<Text variant="reading">pnpm 9 아래에서는 peer 경고가 난다. 무시해도 된다.</Text>
							<DocCode>pnpm install --strict-peer-dependencies=false</DocCode>
						</Stack>
					) : null}
				</DocCallout>
			</Box>
		</Page>
	);
}

// --- Code explorer -------------------------------------------------------------------------------------------------------------------------

const FILES = ["src/app.ts", "src/db.ts", "package.json"];

/** A code explorer: the tree built from the files' names, the picked file's code beside it, its row's "first file" menu open (`first`). */
export function CodeExplorerScreen({ state }: { state: "first" | "rest" }) {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						<DropdownMenu open={state === "first"} modal={false}>
							<FloatingBarButton
								label="처음 보여 줄 파일 · src/app.ts"
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							>
								<Star aria-hidden />
							</FloatingBarButton>
							<DropdownMenuContent>
								<DropdownMenuRadioGroup value="src/app.ts" onValueChange={still}>
									<DropdownMenuRadioItem value="">첫 파일</DropdownMenuRadioItem>
									{FILES.map((file) => (
										<DropdownMenuRadioItem key={file} value={file}>
											{file}
										</DropdownMenuRadioItem>
									))}
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</FloatingBar>
				</BlockBarPlace>
				<Box border="all" radius="lg" overflow="hidden">
					<Inline align="stretch" gap={0}>
						<Box width="menu" padding={8} border="right">
							<FileTree aria-label="파일">
								<FileTreeRow name="src" folder />
								<FileTreeRow
									name="app.ts"
									depth={1}
									current
									more={
										<IconButton label="파일 지우기" size="xs" tone="danger">
											<TrashCan aria-hidden />
										</IconButton>
									}
								/>
								<FileTreeRow name="db.ts" depth={1} />
								<FileTreeRow name="package.json" />
								<Inline gap={4}>
									<Button variant="ghost" size="sm">
										<Add aria-hidden />
										파일
									</Button>
									<Button variant="ghost" size="sm">
										<Add aria-hidden />
										폴더
									</Button>
								</Inline>
							</FileTree>
						</Box>
						<Stack gap={8} grow minWidth={0} padding={12}>
							<Input size="sm" mono aria-label="파일 이름" defaultValue="src/app.ts" />
							<DocCode>{`import { db } from "./db";

export async function posts() {
  return db.selectFrom("entries").selectAll().execute();
}`}</DocCode>
						</Stack>
					</Inline>
				</Box>
			</Box>
		</Page>
	);
}

// --- Formula, diagram, chart: a source with its preview ------------------------------------------------------------------------------------

type Source = {
	/** The block's name, for its empty text ("수식 입력"). */
	name: string;
	code: string;
	preview: React.ReactNode;
	/** The source does not read: each line's problem under the field. */
	errors?: string[];
};

/**
 * A block written as code (a formula, a diagram, a chart), as the old block was: one press on the drawing picks it, the drawing stays on top and its
 * source opens under it in the block itself, written to the body after a short pause; a source that does not read says each line's problem under it.
 */
function SourcePanel({ source, closed = false }: { source: Source; closed?: boolean }) {
	if (closed)
		return (
			<Page>
				<Box position="relative">
					<Handle />
					{/* Not picked: only the drawing, in a thin box; an empty one says what goes in (the old block's "수식 입력"). */}
					<Box border="all" radius="md" padding={16}>
						{source.code ? (
							source.preview
						) : (
							<Text variant="note" tone="faint" align="center">
								{`${source.name} 입력`}
							</Text>
						)}
					</Box>
				</Box>
			</Page>
		);
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBox selected>
					<Stack gap={16} padding={16}>
						<Box minHeight="control-lg">{source.preview}</Box>
						<FormField>
							<FormFieldLabel htmlFor="ref-source">원문 코드</FormFieldLabel>
							<Textarea id="ref-source" mono rows={4} defaultValue={source.code} />
							{source.errors ? <FormFieldError errors={source.errors.map((message) => ({ message }))} /> : null}
						</FormField>
					</Stack>
				</BlockBox>
			</Box>
		</Page>
	);
}

/** A body block as the drawing components take it. */
const blockOf = (type: string, attrs: Record<string, unknown>, children?: BodyBlockValue[]): BodyBlockValue => ({
	id: `ref-${type}`,
	type,
	attrs,
	...(children ? { children } : {}),
});

const FORMULA = "f(x) = \\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}";
const DIAGRAM = "flowchart LR\n  A[글 쓰기] --> B[저장]\n  B --> C[발행]\n  C --> D[사이트]";

export function MathScreen({ state = "open" }: { state?: "open" | "closed" | "empty" }) {
	return (
		<SourcePanel
			closed={state !== "open"}
			source={{
				name: "수식",
				code: state === "empty" ? "" : FORMULA,
				// KaTeX, as the site draws it.
				preview: <MathBlock block={blockOf("math", { source: FORMULA })} attrs={{ source: FORMULA }} />,
			}}
		/>
	);
}

/** A diagram picked: Mermaid's drawing over its source; `error`: a line that does not read, the last good drawing kept. */
export function MermaidScreen({ error = false }: { error?: boolean }) {
	return (
		<SourcePanel
			source={{
				name: "다이어그램",
				code: error ? DIAGRAM.replace("C[발행]", "C[발행") : DIAGRAM,
				// A source that does not read keeps the last good drawing (the old block), its reason under the field.
				preview: <Mermaid block={blockOf("mermaid", { source: DIAGRAM })} attrs={{ source: DIAGRAM }} />,
				...(error ? { errors: ["3번째 줄: [ 를 닫지 않았습니다"] } : {}),
			}}
		/>
	);
}

const CHART_TEXT = `chart bar
x month
series views | 방문 | chart-1
series subs | 구독 | chart-2
show-values

data
month | views | subs
1월 | 1200 | 300
2월 | 1850 | 420
3월 | 2400 | 610`;

const CHART_ROWS = [
	["월", "방문", "구독"],
	["1월", "1200", "300"],
	["2월", "1850", "420"],
	["3월", "2400", "610"],
];
/** The chart's drawing: the package's chart component (SVG, drawn on the server), from the numbers the text or the table holds. */
const CHART_SOURCE = [
	"chart bar",
	"x month",
	"series views | 방문 | chart-1",
	"",
	"data",
	"month | views",
	...CHART_ROWS.slice(1).map((row) => `${row[0]} | ${row[1]}`),
].join("\n");
const chartDrawing = <Chart block={blockOf("chart", { source: CHART_SOURCE })} attrs={{ source: CHART_SOURCE }} />;

/** The chart as the old block wrote it: its own text, with the drawing over it (option A); `error`: a line that does not read. */
export function ChartTextScreen({ error = false }: { error?: boolean }) {
	return (
		<SourcePanel
			source={{
				name: "차트",
				code: error ? CHART_TEXT.replace("chart bar", "chart bars") : CHART_TEXT,
				preview: error ? null : chartDrawing,
				...(error ? { errors: ["1번째 줄: bars는 차트 종류가 아닙니다"] } : {}),
			}}
		/>
	);
}

/** The chart as a table under the drawing (option B): the table edited as the editor's table is, the kind from the row. */
export function ChartTableScreen() {
	return (
		<Page>
			<Box position="relative">
				<Handle />
				<BlockBarPlace>
					<FloatingBar>
						<DropdownMenu open modal={false}>
							<FloatingBarButton label="차트 종류 · 막대" trigger={(button) => <DropdownMenuTrigger render={button} />}>
								<ChartColumn aria-hidden />
							</FloatingBarButton>
							<DropdownMenuContent side="top">
								<DropdownMenuRadioGroup value="bar" onValueChange={still}>
									<DropdownMenuRadioItem value="bar">막대</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="line">선</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="area">영역</DropdownMenuRadioItem>
									<DropdownMenuRadioItem value="pie">원</DropdownMenuRadioItem>
								</DropdownMenuRadioGroup>
							</DropdownMenuContent>
						</DropdownMenu>
					</FloatingBar>
				</BlockBarPlace>
				<Stack gap={12}>
					{chartDrawing}
					{/* The editor's own table: a light grid, the head row only bolder (editor-tools.md, the table; as table-tools.tsx draws it). */}
					<table className="w-full border-collapse text-monti-reading [&_td]:border [&_td]:border-monti-muted [&_td]:px-monti-8 [&_th]:border [&_th]:border-monti-muted [&_th]:px-monti-8 [&_th]:text-left [&_th]:font-semibold">
						<tbody>
							<tr>
								<th>월</th>
								<th>방문</th>
								<th>구독</th>
							</tr>
							<tr>
								<td>1월</td>
								<td>1200</td>
								<td>300</td>
							</tr>
							<tr>
								<td>2월</td>
								<td>1850</td>
								<td>420</td>
							</tr>
						</tbody>
					</table>
				</Stack>
			</Box>
		</Page>
	);
}

// --- The drag handle -----------------------------------------------------------------------------------------------------------------------

type HandleLook = "pill" | "square" | "bar";
type HandleState = "hover" | "open" | "drag";

/**
 * The reference's drawing of the three looks of the block handle the owner chooses from (doc 18): `pill` is today's `BlockHandle` (24px round, the
 * six dots, no ground until its menu opens), `square` is Notion's and BlockNote's (a 20 × 24 rounded square that takes the selected ground when
 * pointed at), `bar` is a 16 × 24 narrow one with the dots a little larger. Only the chosen one becomes the part.
 */
function HandleDrawing({ look, state }: { look: HandleLook; state: HandleState }) {
	const on = state !== "hover";
	const shape = {
		pill: "size-monti-control-xs rounded-monti-full",
		square: "h-monti-control-xs w-monti-20 rounded-monti-sm",
		bar: "h-monti-control-xs w-monti-16 rounded-monti-sm",
	}[look];
	const ground = look === "pill" ? (on ? "bg-monti-selected" : "") : "bg-monti-selected";
	// Today's part pointed at: the dots go dark, with no ground (block-handle.tsx).
	return (
		<span
			className={`flex items-center justify-center ${shape} ${ground} text-monti-default ${state === "drag" ? "cursor-grabbing" : "cursor-grab"}`}
		>
			<Grip className={look === "bar" ? "scale-110" : undefined} />
		</span>
	);
}

/** One block with the handle in a state: pointed at, its menu open (the block on the block ground), or being dragged (the block at 40%, the card by the pointer, the line where it lands). */
function HandleCell({ look, state }: { look: HandleLook; state: HandleState }) {
	return (
		<Stack gap={8} grow minWidth={0}>
			<Box position="relative">
				{state === "drag" ? null : look === "pill" && state === "open" ? (
					<At top={3} left={-30}>
						<BlockHandle gripLabel="블록 메뉴" active />
					</At>
				) : (
					<At top={3} left={-30}>
						<HandleDrawing look={look} state={state} />
					</At>
				)}
				<Block active={state === "open"}>
					<Text variant="reading" tone={state === "drag" ? "faint" : undefined}>
						목록에는 제목과 주소만 남겼다.
					</Text>
				</Block>
			</Box>
			{state === "drag" ? (
				<Stack gap={4}>
					<DropLine />
					<Inline>
						<Box width="rail" />
						<HeldBlock kind="문단" text="목록에는 제목과 주소만 남겼다." />
					</Inline>
				</Stack>
			) : null}
		</Stack>
	);
}

/** The three looks of the handle, each beside the same blocks in each state (at rest there is no handle, in all three). */
export function HandleScreen() {
	const looks: [HandleLook, string][] = [
		["pill", "가: 지금 부품의 모양 (24px 원, 가리키면 점만 진해짐)"],
		["square", "나: 노션 · BlockNote (20 × 24 둥근 네모, 가리키면 바탕)"],
		["bar", "다: 좁은 막대 (16 × 24, 가리키면 바탕)"],
	];
	return (
		<StandalonePage>
			<Stack gap={32} padding={48}>
				<Inline gap={48}>
					<Box width="menu" />
					{["손잡이를 가리킬 때", "메뉴가 열렸을 때", "끄는 동안"].map((name) => (
						<Box key={name} grow minWidth={0}>
							<Text variant="label">{name}</Text>
						</Box>
					))}
				</Inline>
				{looks.map(([look, name]) => (
					<Inline key={look} gap={48} align="start">
						<Box width="menu">
							<Text variant="label">{name}</Text>
						</Box>
						<HandleCell look={look} state="hover" />
						<HandleCell look={look} state="open" />
						<HandleCell look={look} state="drag" />
					</Inline>
				))}
			</Stack>
		</StandalonePage>
	);
}

// --- Text colour and tooltip (approved 2026-11-14) -----------------------------------------------------------------------------------------

const COLORS = ["회색", "빨강", "주황", "노랑", "초록", "파랑", "보라", "분홍"];

/** The format bar over picked words, its ⋯ open on the site's marks, "글자 색 ›" open: the text colours and the backgrounds, ✓ on the current. */
export function ColorScreen() {
	return (
		<Page>
			<Box position="relative">
				<At top={-46} left={40}>
					<FloatingBar>
						<FormatButton mark="bold" label="굵게" />
						<FormatButton mark="italic" label="기울임" />
						<FormatButton mark="underline" label="밑줄" />
						<FormatButton mark="strike" label="취소선" />
						<FormatButton mark="code" label="코드" />
						<FormatButton mark="clear" label="서식 지우기" />
						<Separator orientation="vertical" length="bar" />
						<FormatButton mark="superscript" label="위 첨자" />
						<FormatButton mark="subscript" label="아래 첨자" />
						<FormatButton mark="link" label="링크" />
						<FormatButton mark="footnote" label="각주" />
						<DropdownMenu open modal={false}>
							<FormatButton
								mark="more"
								label="사이트가 더한 서식"
								pressed
								trigger={(button) => <DropdownMenuTrigger render={button} />}
							/>
							<DropdownMenuContent>
								<DropdownMenuSub open>
									<DropdownMenuSubTrigger>
										<TextColor aria-hidden />
										글자 색<MenuValue>빨강</MenuValue>
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										<DropdownMenuRadioGroup value="빨강" onValueChange={still}>
											<DropdownMenuRadioItem value="">기본</DropdownMenuRadioItem>
											{COLORS.map((color) => (
												<DropdownMenuRadioItem key={color} value={color}>
													{color}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
										<DropdownMenuSeparator />
										<DropdownMenuRadioGroup value="" onValueChange={still}>
											<DropdownMenuLabel>바탕색</DropdownMenuLabel>
											<DropdownMenuRadioItem value="">기본</DropdownMenuRadioItem>
											{COLORS.map((color) => (
												<DropdownMenuRadioItem key={color} value={color}>
													{color}
												</DropdownMenuRadioItem>
											))}
										</DropdownMenuRadioGroup>
									</DropdownMenuSubContent>
								</DropdownMenuSub>
								<DropdownMenuItem>
									<Information aria-hidden />
									툴팁
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<Separator orientation="vertical" length="bar" />
						<FormatBarRequest label="요청" />
					</FloatingBar>
				</At>
				<Paragraph>그래서 서버 컴포넌트로 옮긴 페이지는 첫 화면이 비지 않는다.</Paragraph>
			</Box>
		</Page>
	);
}

/** "툴팁" from the ⋯: a card with one plain field. No "툴팁 떼기": clearing the formats takes a tooltip off, as it takes off a colour. */
export function TooltipScreen() {
	return (
		<Page>
			<Box position="relative">
				<At top={-46} left={40}>
					<FloatingBar>
						<FormatButton mark="bold" label="굵게" />
						<FormatButton mark="italic" label="기울임" />
						<FormatButton mark="underline" label="밑줄" />
						<FormatButton mark="strike" label="취소선" />
						<FormatButton mark="code" label="코드" />
						<Separator orientation="vertical" length="bar" />
						<FormatButton mark="superscript" label="위 첨자" />
						<FormatButton mark="subscript" label="아래 첨자" />
						<FormatButton mark="link" label="링크" />
						<FormatButton mark="footnote" label="각주" />
						<Popover open onOpenChange={still}>
							<FormatButton mark="more" label="툴팁" pressed trigger={(button) => <PopoverTrigger render={button} />} />
							<PopoverContent>
								{/* One plain field: a tooltip's text is written, not searched (no magnifier, as doc 17's tooltip card). */}
								<Input size="md" aria-label="툴팁 글" defaultValue="React Server Components의 줄임말" />
							</PopoverContent>
						</Popover>
						<Separator orientation="vertical" length="bar" />
						<FormatBarRequest label="요청" />
					</FloatingBar>
				</At>
				<Paragraph>그래서 서버 컴포넌트로 옮긴 페이지는 첫 화면이 비지 않는다. RSC라는 말은 쓰지 않았다.</Paragraph>
			</Box>
		</Page>
	);
}
