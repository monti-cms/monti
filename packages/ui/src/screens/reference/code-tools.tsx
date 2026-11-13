import type * as React from "react";
import {
	Add,
	ArrowRight,
	Chat,
	Checkmark,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CollapseAll,
	Copy,
	Document,
	ListNumbered,
	Row,
	TrashCan,
	TypePattern,
	Unlink,
} from "../../icons";
import {
	Affix,
	Banner,
	BlockBarPlace,
	Box,
	Button,
	Caret,
	CodeFrame,
	CodeLine,
	CodeMark,
	CodeRefText,
	CodeToken,
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	FloatingBar,
	FloatingBarButton,
	FormatBarRequest,
	FormatButton,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	Inline,
	Input,
	MenuShortcut,
	MenuValue,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectTrigger,
	SelectValue,
	Separator,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarList,
	StatusBarSpacer,
	Text,
	TextButton,
	TodoItem,
} from "../../index";
import { BodyBlock, EditorPage, EntryHeader, EntryTitle, LanguageTabs, Paragraph, still } from "./editor-notion";

/**
 * The code block in the editor (doc 17), from the last code block the owner used (`b612824d`, doc 17 "옛 화면") with the owner's seven points
 * (2026-11-14): the box with its head row (the language on the left, the tools on the right), the file name as a tab on the box, the line numbers and
 * what pressing them opens, the editor's own format card in code, the rules card, and a code link's strip, look and card.
 */

/** Something the editor floats at a measured point (the format card over picked words, the line menu beside picked lines). */
function At({ top, left, right, children }: { top: number; left?: number; right?: number; children: React.ReactNode }) {
	// design-allow: a point the editor measures (the picked words, the picked lines)
	return <div style={{ position: "absolute", top, left, right, zIndex: 2 }}>{children}</div>;
}

// --- The code -------------------------------------------------------------------------------------------------------------------------------

/** The site's light theme (github-light), as the highlighter colours the code at run time. */
const KEYWORD = "#d73a49";
const STRING = "#032f62";
const NUMBER = "#005cc5";
const NAME = "#6f42c1";
const VARIABLE = "#e36209";
const TAG = "#22863a";

type Piece = string | [string, string];
const CODE: Piece[][] = [
	[["import", KEYWORD], " { useState } ", ["from", KEYWORD], " ", ['"react"', STRING], ";"],
	[],
	[["export function", KEYWORD], " ", ["Counter", NAME], "() {"],
	[
		"  ",
		["const", KEYWORD],
		" [",
		["count", VARIABLE],
		", ",
		["setCount", VARIABLE],
		"] = ",
		["useState", NAME],
		"(",
		["0", NUMBER],
		");",
	],
	[
		"  ",
		["const", KEYWORD],
		" ",
		["add", VARIABLE],
		" = () => ",
		["setCount", NAME],
		"(",
		["count", VARIABLE],
		" + ",
		["1", NUMBER],
		");",
	],
	[
		"  ",
		["const", KEYWORD],
		" ",
		["add", VARIABLE],
		" = () => ",
		["setCount", NAME],
		"((",
		["n", VARIABLE],
		") => ",
		["n", VARIABLE],
		" + ",
		["1", NUMBER],
		");",
	],
	["  ", ["return", KEYWORD], " ("],
	["    <", ["button", TAG], " ", ["onClick", NAME], "={", ["add", VARIABLE], "}>"],
	["      {", ["count", VARIABLE], "}번 눌렀다"],
	["    </", ["button", TAG], ">"],
	["  );"],
	["}"],
];

const paint = (pieces: Piece[], plain = false) =>
	pieces.map((piece, at) =>
		typeof piece === "string" || plain ? (
			typeof piece === "string" ? (
				piece
			) : (
				piece[0]
			)
		) : (
			<CodeToken key={at} light={piece[1]}>
				{piece[0]}
			</CodeToken>
		),
	);

type LineLook = {
	mark?: "+" | "−" | "›";
	tone?: "highlight" | "plus" | "minus" | "picked" | "lit";
	wavy?: "warning" | "error";
	words?: React.ReactNode;
};

/** The effects of the example: line 3 focus, 4 highlighted, 5 removed, 6 added, 7–11 a fold, 9 a warning. */
const EFFECTS: Record<number, LineLook> = {
	3: { mark: "›" },
	4: { tone: "highlight" },
	5: { tone: "minus", mark: "−" },
	6: { tone: "plus", mark: "+" },
	9: { wavy: "warning" },
};

function Lines({
	readOnly = false,
	looks = EFFECTS,
	fold = "open",
	numbersOff = false,
	plain = false,
	lines = CODE,
	words = {},
}: {
	readOnly?: boolean;
	looks?: Record<number, LineLook>;
	/** The fold over lines 7–11: open, closed, or none. */
	fold?: "open" | "closed" | "none";
	numbersOff?: boolean;
	plain?: boolean;
	lines?: Piece[][];
	/** A line's words drawn by the screen (marks in them). */
	words?: Record<number, React.ReactNode>;
}) {
	const folds = fold !== "none";
	const rows: React.ReactNode[] = [];
	for (let index = 0; index < lines.length; index++) {
		const number = index + 1;
		const look = looks[number] ?? {};
		const first = folds && number === 7;
		rows.push(
			<CodeLine
				key={number}
				number={number}
				folds={folds}
				readOnly={readOnly}
				numbersOff={numbersOff}
				mark={look.mark}
				tone={look.tone}
				wavy={look.wavy}
				fold={
					first ? (
						<IconButton size="xs" label={fold === "open" ? "7번째 줄부터 접기" : "7번째 줄부터 펼치기"}>
							{fold === "open" ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
						</IconButton>
					) : undefined
				}
			>
				{words[number] ?? paint(lines[index], plain)}
			</CodeLine>,
		);
		if (first && fold === "closed") {
			rows.push(
				<CodeLine key="folded" folds>
					<TextButton size="caption">접힌 4줄</TextButton>
				</CodeLine>,
			);
			index = 10;
		}
	}
	return <>{rows}</>;
}

// --- The box ----------------------------------------------------------------------------------------------------------------------------------

/** The box's head row: the language and the file name, as text (doc 17, 2026-11-14: the name is set from the tool row, not typed on the box). */
function Head({
	language = "TypeScript",
	name,
	copied = false,
	readOnly = false,
}: {
	language?: string;
	name?: string;
	copied?: boolean;
	readOnly?: boolean;
}) {
	return (
		<Inline gap={8} minWidth={0}>
			<Text variant="caption" tone="muted">
				{language}
			</Text>
			{name ? (
				<Text variant="caption" mono truncate>
					{name}
				</Text>
			) : null}
			{readOnly ? (
				<IconButton size="xs" label={copied ? "복사함" : "코드 복사"}>
					{copied ? <Checkmark aria-hidden /> : <Copy aria-hidden />}
				</IconButton>
			) : null}
		</Inline>
	);
}

/**
 * The code block's own tool row, over the box while the caret is in it (the image block's row, `BlockBarPlace` + `FloatingBar`): language, file name,
 * line numbers, line effects, rules; with words picked in the code, the tooltip and the folded words (and "처음부터 펼치기" once folded); copy.
 */
function Tools({
	language = "TypeScript",
	languageOpen,
	nameOpen,
	numbers = true,
	effectsOpen = false,
	rulesOpen,
	words,
	tipOpen,
	copied = false,
}: {
	language?: string;
	/** The language's list, open under its button. */
	languageOpen?: React.ReactNode;
	nameOpen?: React.ReactNode;
	numbers?: boolean;
	effectsOpen?: boolean;
	rulesOpen?: React.ReactNode;
	/** Words picked in the code: `tip` they have a tooltip, `fold` they are folded. */
	words?: "picked" | "tip" | "fold";
	tipOpen?: React.ReactNode;
	copied?: boolean;
}) {
	const opened = (open: React.ReactNode, label: string, icon: React.ReactNode) => (
		<Popover open onOpenChange={still}>
			<FloatingBarButton label={label} pressed trigger={(button) => <PopoverTrigger render={button} />}>
				{icon}
			</FloatingBarButton>
			{open}
		</Popover>
	);
	return (
		<BlockBarPlace>
			<FloatingBar aria-label="코드 도구">
				{languageOpen ? (
					opened(
						languageOpen,
						"언어",
						<>
							{language}
							<Caret />
						</>,
					)
				) : (
					<FloatingBarButton label="언어">
						{language}
						<Caret />
					</FloatingBarButton>
				)}
				{nameOpen ? (
					opened(nameOpen, "파일 이름", <Document aria-hidden />)
				) : (
					<FloatingBarButton label="파일 이름" pressed>
						<Document aria-hidden />
					</FloatingBarButton>
				)}
				<Separator orientation="vertical" length="bar" />
				<FloatingBarButton label="줄 번호" pressed={numbers}>
					<ListNumbered aria-hidden />
				</FloatingBarButton>
				<FloatingBarButton label="줄 효과" pressed={effectsOpen}>
					<Row aria-hidden />
				</FloatingBarButton>
				{rulesOpen ? (
					opened(rulesOpen, "정규식 규칙", <TypePattern aria-hidden />)
				) : (
					<FloatingBarButton label="정규식 규칙">
						<TypePattern aria-hidden />
					</FloatingBarButton>
				)}
				{words ? (
					<>
						<Separator orientation="vertical" length="bar" />
						{tipOpen ? (
							opened(tipOpen, "툴팁", <Chat aria-hidden />)
						) : (
							<FloatingBarButton label="툴팁" pressed={words === "tip"}>
								<Chat aria-hidden />
							</FloatingBarButton>
						)}
						<FloatingBarButton label="글자 접기" pressed={words === "fold"}>
							<CollapseAll aria-hidden />
						</FloatingBarButton>
						{words === "fold" ? <FloatingBarButton label="처음부터 펼치기">처음부터 펼치기</FloatingBarButton> : null}
					</>
				) : null}
				<Separator orientation="vertical" length="bar" />
				<FloatingBarButton label={copied ? "복사함" : "코드 복사"}>
					{copied ? <Checkmark aria-hidden /> : <Copy aria-hidden />}
				</FloatingBarButton>
			</FloatingBar>
		</BlockBarPlace>
	);
}

/** The block: its tool row over it while it is being written (none when read-only), the box with its head row. */
function Code({
	name,
	language,
	readOnly = false,
	copied = false,
	children,
	...tools
}: React.ComponentProps<typeof Tools> & { name?: string; readOnly?: boolean; children: React.ReactNode }) {
	return (
		<Box position="relative">
			{readOnly ? null : <Tools language={language} copied={copied} {...tools} />}
			<CodeFrame head={<Head language={language} name={name} readOnly={readOnly} copied={copied} />}>
				<Box paddingY={8}>{children}</Box>
			</CodeFrame>
		</Box>
	);
}

/** The writing column with the code block between two paragraphs. */
function Page({
	children,
	banner,
	statusBar,
	before = "버튼을 누를 때마다 수를 하나 올리는 카운터다. 처음 쓴 코드는 바깥의 count를 읽어서, 빠르게 두 번 누르면 하나만 올랐다.",
	archived = false,
}: {
	children: React.ReactNode;
	banner?: React.ReactNode;
	statusBar?: React.ReactNode;
	before?: React.ReactNode;
	archived?: boolean;
}) {
	return (
		<EditorPage
			banner={banner}
			header={
				<EntryHeader
					address="/posts/react-counter"
					status={archived ? "archived" : "editing"}
					statusLabel={archived ? "보관됨" : "수정 중"}
					publish={!archived}
				/>
			}
			head={<LanguageTabs />}
			statusBar={
				statusBar ?? (
					<StatusBar>
						<StatusBarCell>저장됨 10:42</StatusBarCell>
						<StatusBarCell>할 일 없음</StatusBarCell>
						<StatusBarSpacer />
						<StatusBarCell end>1,240자</StatusBarCell>
					</StatusBar>
				)
			}
		>
			<EntryTitle>카운터를 다시 만들기</EntryTitle>
			<Paragraph>{before}</Paragraph>
			<BodyBlock gap={20}>{children}</BodyBlock>
		</EditorPage>
	);
}

// --- 1 The code box ---------------------------------------------------------------------------------------------------------------------------

/**
 * The box (owner's point 1): the file name on a tab of its own over the box, the head row only the language and the tools, the gutter only the numbers
 * (and a fold's button where one starts); the line's mark sits in the code's left margin, so no empty column stands beside a number.
 */
export function CodeBoxScreen({
	state,
}: {
	state: "writing" | "folded" | "numbersOff" | "readOnly" | "unknown" | "noName" | "copied";
}) {
	if (state === "readOnly")
		return (
			<Page archived>
				<Code name="src/counter.tsx" readOnly>
					<Lines readOnly />
				</Code>
			</Page>
		);
	if (state === "unknown")
		return (
			<Page>
				<Code name="lib/counter.ex" language="elixir">
					<Lines
						fold="none"
						looks={{}}
						lines={[["defmodule Counter do"], ["  def add(n), do: n + 1"], ["end"]]}
						plain
					/>
				</Code>
			</Page>
		);
	return (
		<Page>
			<Code
				name={state === "noName" ? undefined : "src/counter.tsx"}
				numbers={state !== "numbersOff"}
				copied={state === "copied"}
			>
				<Lines fold={state === "folded" ? "closed" : "open"} numbersOff={state === "numbersOff"} />
			</Code>
		</Page>
	);
}

// --- 2 The language list --------------------------------------------------------------------------------------------------------------------

const LANGUAGES = [
	["TypeScript", "ts"],
	["TSX", "tsx"],
	["JavaScript", "js"],
	["JSON", "json"],
	["Bash", "bash"],
	["CSS", "css"],
	["HTML", "html"],
	["Python", "python"],
];

/** A language's row: its name, its code small right after it, and the ✓ alone at the end on the current one (owner's point 3). */
function LanguageRow({ name, code, current }: { name: string; code: string; current?: boolean }) {
	return (
		<CommandItem value={name} checked={current}>
			<Inline gap={6} minWidth={0}>
				<Text>{name}</Text>
				<Text variant="caption" tone="faint" mono>
					{code}
				</Text>
			</Inline>
		</CommandItem>
	);
}

/** The language's list: the link card's searchable list (`Popover` + `Command`), plain text first, then the site's languages. */
export function LanguageScreen({ state }: { state: "open" | "typed" | "none" | "unknown" }) {
	const typed = state === "typed" ? "ty" : state === "none" ? "zig" : "";
	const current = state === "unknown" ? "elixir" : "TSX";
	const rows = LANGUAGES.filter(([name, code]) => !typed || name.toLowerCase().includes(typed) || code.includes(typed));
	const list = (
		<PopoverContent padding="menu" width="md" align="start" alignOffset={-15} sideOffset={12}>
			<Command shouldFilter={false}>
				<CommandInput placeholder="언어 찾기" value={typed} readOnly aria-label="언어 찾기" />
				<CommandList>
					{rows.length === 0 ? <CommandEmpty>맞는 언어 없음</CommandEmpty> : null}
					{typed ? null : (
						<>
							<CommandItem value="일반 텍스트">일반 텍스트</CommandItem>
							<CommandSeparator />
						</>
					)}
					{rows.map(([name, code]) => (
						<LanguageRow key={code} name={name} code={code} current={name === current} />
					))}
				</CommandList>
			</Command>
		</PopoverContent>
	);
	return (
		<Page>
			<Code name="src/counter.tsx" language={current} languageOpen={list}>
				<Lines />
			</Code>
		</Page>
	);
}

// --- 3 The line menu ----------------------------------------------------------------------------------------------------------------------

const EFFECT_NAMES = ["강조", "포커스", "추가", "삭제", "경고", "오류"];

/**
 * The line menu (owner's point 4): pressing or dragging on the line numbers picks the lines and, on release, opens the menu beside them (the old code's
 * own comment, `b612824d:…/code-block-view.tsx:58`). Each effect is a check box for all the picked lines: on all, on some (–, with how many), on none.
 */
export function LineMenuScreen({ state }: { state: "picked" | "fold" | "linked" }) {
	const picked = state === "picked" ? [5, 6] : state === "linked" ? [4] : [7, 8, 9, 10, 11];
	const looks: Record<number, LineLook> = { ...EFFECTS };
	for (const line of picked) looks[line] = { ...looks[line], tone: "picked" };
	const some: Record<string, string> =
		state === "picked" ? { 추가: "1/2", 삭제: "1/2" } : state === "linked" ? {} : { 경고: "1/5" };
	const label = state === "picked" ? "5–6번째 줄 효과" : state === "linked" ? "4번째 줄 효과" : "7–11번째 줄 효과";
	return (
		<Page>
			<Box position="relative">
				<Code name="src/counter.tsx">
					<Lines looks={looks} />
				</Code>
				<At top={state === "picked" ? 141 : state === "linked" ? 121 : 181} left={688}>
					<DropdownMenu open modal={false}>
						<DropdownMenuTrigger render={<span />} />
						<DropdownMenuContent side="right" align="start">
							<DropdownMenuGroup>
								<DropdownMenuLabel>{label}</DropdownMenuLabel>
								{EFFECT_NAMES.map((name) => (
									<DropdownMenuCheckboxItem
										key={name}
										box
										checked={state === "linked" && name === "강조"}
										mixed={!!some[name]}
									>
										{name}
										{some[name] ? <MenuShortcut>{some[name]}</MenuShortcut> : null}
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							{state === "linked" ? null : state === "picked" ? (
								<DropdownMenuItem>이 줄들 접기</DropdownMenuItem>
							) : (
								<>
									<DropdownMenuItem>접기 해제</DropdownMenuItem>
									<DropdownMenuCheckboxItem checked={false}>처음부터 펼치기</DropdownMenuCheckboxItem>
								</>
							)}
							{state === "linked" ? null : <DropdownMenuSeparator />}
							{/* The link of the picked lines: checked, and the words that point here as its value (no standing mark on the line). */}
							<DropdownMenuCheckboxItem checked={state === "linked"}>
								본문 연결
								{state === "linked" ? <MenuValue>본문 · 수를 하나 올린다</MenuValue> : null}
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</At>
			</Box>
		</Page>
	);
}

// --- 4 The format card in code ----------------------------------------------------------------------------------------------------------

/** Line 5 with "setCount(count + 1)" picked, and the same words with a tooltip, as the format card's states need them. */
const PICKED: Record<number, React.ReactNode> = {
	5: (
		<>
			{"  "}
			<CodeToken light={KEYWORD}>const</CodeToken> <CodeToken light={VARIABLE}>add</CodeToken> = () =&gt;{" "}
			<CodeMark kind="picked">
				<CodeToken light={NAME}>setCount</CodeToken>(<CodeToken light={VARIABLE}>count</CodeToken> +{" "}
				<CodeToken light={NUMBER}>1</CodeToken>)
			</CodeMark>
			;
		</>
	),
};
const FOLDED: Record<number, React.ReactNode> = {
	1: (
		<>
			<CodeToken light={KEYWORD}>import</CodeToken> {"{ "}
			<CodeMark kind="picked">
				<CodeMark kind="fold">useState</CodeMark>
			</CodeMark>
			{" } "}
			<CodeToken light={KEYWORD}>from</CodeToken> <CodeToken light={STRING}>"react"</CodeToken>
			{";"}
		</>
	),
};
const MARKED: Record<number, React.ReactNode> = {
	1: (
		<>
			<CodeToken light={KEYWORD}>import</CodeToken> {"{ "}
			<CodeMark kind="fold">useState</CodeMark>
			{" } "}
			<CodeToken light={KEYWORD}>from</CodeToken> <CodeToken light={STRING}>"react"</CodeToken>
			{";"}
		</>
	),
	5: (
		<>
			{"  "}
			<CodeToken light={KEYWORD}>const</CodeToken> <CodeToken light={VARIABLE}>add</CodeToken> = () =&gt;{" "}
			<CodeMark kind="picked">
				<CodeMark kind="tip">
					<CodeToken light={NAME}>setCount</CodeToken>(<CodeToken light={VARIABLE}>count</CodeToken> +{" "}
					<CodeToken light={NUMBER}>1</CodeToken>)
				</CodeMark>
			</CodeMark>
			{";"}
		</>
	),
};

/**
 * Words picked in code (owner, 2026-11-14): the format card keeps every format that works in code — bold, italic, underline, strike — and leaves out what
 * cannot (inline code, superscript and subscript break the code's column; a link and a footnote are not drawn in code on the site). The code's own
 * marks are in the code block's tool row: the tooltip (a plain field in its card) and the folded words, with "처음부터 펼치기" once they are folded.
 */
export function FormatInCodeScreen({ state }: { state: "more" | "tooltip" | "fold" | "marked" }) {
	return (
		<Page>
			<Box position="relative">
				<Code
					name="src/counter.tsx"
					words={state === "fold" ? "fold" : state === "marked" ? "tip" : "picked"}
					tipOpen={
						state === "tooltip" ? (
							<PopoverContent align="start" width="sm">
								<Input size="md" aria-label="툴팁 글" defaultValue="바깥의 count를 읽는다" />
							</PopoverContent>
						) : undefined
					}
				>
					<Lines looks={{}} fold="none" words={state === "marked" ? MARKED : state === "fold" ? FOLDED : PICKED} />
				</Code>
				{state === "tooltip" ? null : (
					<At top={state === "fold" ? 30 : 110} left={state === "fold" ? 40 : 140}>
						<FloatingBar>
							<FormatButton mark="bold" label="굵게" />
							<FormatButton mark="italic" label="기울임" />
							<FormatButton mark="underline" label="밑줄" />
							<FormatButton mark="strike" label="취소선" />
							{state === "marked" ? <FormatButton mark="clear" label="서식 지우기" /> : null}
							<Separator orientation="vertical" length="bar" />
							<FormatBarRequest label="요청" />
						</FloatingBar>
					</At>
				)}
			</Box>
		</Page>
	);
}

// --- 5 The rules card -------------------------------------------------------------------------------------------------------------------

const RULES = [
	{ pattern: "/setCount/g", what: "굵게 · 2곳" },
	{ pattern: "/use\\w+/g", what: "툴팁 · 1곳" },
];

/**
 * The rules card, made again (owner's point 6): first a list — one row per rule, its pattern and what it does, and "규칙 추가" — then one rule at a time,
 * each value a labelled field in its own row, the match count under the pattern, and "규칙 지우기" at the foot. A change takes effect as it is typed.
 */
export function RulesScreen({ state }: { state: "list" | "rule" | "tooltip" | "empty" }) {
	const card =
		state === "list" || state === "empty" ? (
			<PopoverContent padding="menu" width="sm" align="end">
				<Command shouldFilter={false}>
					<CommandList>
						{state === "list"
							? RULES.map((rule) => (
									<CommandItem key={rule.pattern} value={rule.pattern}>
										<Text mono>{rule.pattern}</Text>
										<MenuValue>{rule.what}</MenuValue>
										<ChevronRight aria-hidden />
									</CommandItem>
								))
							: null}
						{state === "list" ? <CommandSeparator /> : null}
						<CommandItem value="add">
							<Add aria-hidden />
							규칙 추가
						</CommandItem>
					</CommandList>
				</Command>
			</PopoverContent>
		) : (
			<PopoverContent width="md" align="end" initialFocus={false}>
				<Stack gap={16}>
					<Inline>
						<TextButton variant="quiet" size="caption">
							<ChevronLeft aria-hidden />
							정규식 규칙
						</TextButton>
					</Inline>
					<FormField>
						<FormFieldLabel>찾을 글자</FormFieldLabel>
						<Inline gap={8}>
							<Affix
								size="md"
								prefix="/"
								suffix="/"
								aria-label="정규식"
								defaultValue={state === "tooltip" ? "(0" : "setCount"}
								aria-invalid={state === "tooltip" || undefined}
							/>
							<Input size="md" mono width="fit" aria-label="플래그" defaultValue="g" />
						</Inline>
						{state === "tooltip" ? (
							<FormFieldError>정규식을 읽을 수 없습니다</FormFieldError>
						) : (
							<FormFieldDescription>2곳에 적용</FormFieldDescription>
						)}
					</FormField>
					<FormField>
						<FormFieldLabel>효과</FormFieldLabel>
						<Select
							items={[{ value: state === "tooltip" ? "tip" : "bold", label: state === "tooltip" ? "툴팁" : "굵게" }]}
							defaultValue={state === "tooltip" ? "tip" : "bold"}
						>
							<SelectTrigger size="md" aria-label="효과">
								<SelectValue />
							</SelectTrigger>
						</Select>
					</FormField>
					{state === "tooltip" ? (
						<FormField>
							<FormFieldLabel>툴팁 글</FormFieldLabel>
							<Input size="md" aria-label="툴팁 글" defaultValue="React가 주는 고리" />
						</FormField>
					) : null}
					<FormField>
						<FormFieldLabel>찾는 곳</FormFieldLabel>
						<Inline gap={8}>
							<Select
								items={[
									{ value: state === "tooltip" ? "line" : "all", label: state === "tooltip" ? "한 줄만" : "코드 전체" },
								]}
								defaultValue={state === "tooltip" ? "line" : "all"}
							>
								<SelectTrigger size="md" aria-label="찾는 곳">
									<SelectValue />
								</SelectTrigger>
							</Select>
							{state === "tooltip" ? (
								<Input size="md" mono width="number" aria-label="줄 번호" defaultValue="4" />
							) : null}
						</Inline>
					</FormField>
					<Inline>
						<Button variant="ghost-danger" size="sm">
							<TrashCan aria-hidden />
							규칙 지우기
						</Button>
					</Inline>
				</Stack>
			</PopoverContent>
		);
	return (
		<Page>
			<Code name="src/counter.tsx" rulesOpen={card}>
				<Lines looks={{}} fold="none" words={state === "list" ? RULE_WORDS : {}} />
			</Code>
		</Page>
	);
}

/** What the two rules find, drawn in the code: setCount bold, useState with a tooltip. */
const RULE_WORDS: Record<number, React.ReactNode> = {
	4: (
		<>
			{"  "}
			<CodeToken light={KEYWORD}>const</CodeToken> [<CodeToken light={VARIABLE}>count</CodeToken>,{" "}
			<CodeToken light={VARIABLE}>setCount</CodeToken>] ={" "}
			<CodeMark kind="tip">
				<CodeToken light={NAME}>useState</CodeToken>
			</CodeMark>
			(<CodeToken light={NUMBER}>0</CodeToken>);
		</>
	),
	5: (
		<>
			{"  "}
			<CodeToken light={KEYWORD}>const</CodeToken> <CodeToken light={VARIABLE}>add</CodeToken> = () =&gt;{" "}
			<CodeMark kind="bold">
				<CodeToken light={NAME}>setCount</CodeToken>
			</CodeMark>
			(<CodeToken light={VARIABLE}>count</CodeToken> + <CodeToken light={NUMBER}>1</CodeToken>);
		</>
	),
};

// --- 6 Code links ------------------------------------------------------------------------------------------------------------------------

/**
 * A code link (owner's point 7): while one is made, the editor's own strip stands at the top of the screen, edge to edge (`Banner`, as the old strip stood
 * alone over the editor, `b612824d:…/tiptap-editor.tsx:277-281`), its actions text buttons; "연결" comes once both sides are picked. The words
 * have a solid line under them; their card is the link card's, under the format card.
 */
export function CodeLinkScreen({ state }: { state: "picking" | "ready" | "linked" | "card" | "broken" }) {
	const words = (link: "linked" | "broken" | "picking") => (
		<>
			버튼을 누를 때마다 <CodeRefText state={link}>수를 하나 올린다</CodeRefText>. 처음 쓴 코드는 바깥의 count를 읽어서,
			빠르게 두 번 누르면 하나만 올랐다.
		</>
	);
	const looks: Record<number, LineLook> = { ...EFFECTS, 4: {} };
	if (state === "ready") {
		looks[5] = { ...looks[5], tone: "picked" };
		looks[6] = { ...looks[6], tone: "picked" };
	}
	if (state === "linked") looks[4] = { tone: "lit" };
	const statusBar =
		state === "broken" ? (
			<StatusBar>
				<StatusBarCell>저장됨 10:42</StatusBarCell>
				<StatusBarList
					trigger={<StatusBarCell tone="danger">할 일 1</StatusBarCell>}
					label="발행 전에 고칠 것"
					count={1}
					countTone="danger"
					defaultOpen
				>
					<TodoItem title="끊긴 코드 링크 1개" detail="본문 · 수를 하나 올린다" blocking />
				</StatusBarList>
				<StatusBarSpacer />
				<StatusBarCell end>1,240자</StatusBarCell>
			</StatusBar>
		) : undefined;
	const card = state === "card" || state === "broken";
	return (
		<Page
			banner={
				state === "picking" ? (
					<Banner tone="neutral" title="‘수를 하나 올린다’에 연결할 코드 줄을 골라 주세요">
						<TextButton>취소</TextButton>
					</Banner>
				) : state === "ready" ? (
					<Banner tone="neutral" title="‘수를 하나 올린다’ · 코드 5–6번째 줄">
						<TextButton variant="underline">연결</TextButton>
						<TextButton>취소</TextButton>
					</Banner>
				) : undefined
			}
			statusBar={statusBar}
			before={words(state === "broken" ? "broken" : state === "picking" || state === "ready" ? "picking" : "linked")}
		>
			<Box position="relative">
				{card ? (
					<At top={-118} left={120}>
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
								<FormatButton
									mark="more"
									label="코드 줄 링크"
									pressed
									trigger={(button) => <PopoverTrigger render={button} />}
								/>
								<PopoverContent padding="menu">
									<Command shouldFilter={false}>
										<CommandList>
											{state === "broken" ? (
												<Box paddingX={8} paddingY={6}>
													<Text variant="caption" tone="danger">
														가리키던 줄 없음
													</Text>
												</Box>
											) : (
												<CommandItem value="go">
													<ArrowRight aria-hidden />
													코드 4번째 줄
												</CommandItem>
											)}
											<CommandSeparator />
											<CommandItem value="unlink">
												<Unlink aria-hidden />
												링크 떼기
											</CommandItem>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
							<Separator orientation="vertical" length="bar" />
							<FormatBarRequest label="요청" />
						</FloatingBar>
					</At>
				) : null}
				<Code name="src/counter.tsx">
					<Lines
						looks={state === "broken" ? {} : looks}
						fold="none"
						lines={state === "broken" ? [...CODE.slice(0, 3), ...CODE.slice(4)] : CODE}
					/>
				</Code>
			</Box>
		</Page>
	);
}
