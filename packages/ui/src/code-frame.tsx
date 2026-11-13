import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";

/**
 * A code block in the editor (doc 17): the box (`bg-muted`, `radius-lg`, as the body's other boxes), its head row (the language and the file name, a
 * hairline under it), and the code. The block's tools are not in the box: they stand in the block's tool row over it (`BlockBarPlace`).
 */
function CodeFrame({ head, children, className, ...props }: React.ComponentProps<"div"> & { head?: React.ReactNode }) {
	return (
		<div
			data-slot="code-frame"
			className={cn("relative flex flex-col rounded-monti-lg bg-monti-muted", className)}
			{...props}
		>
			{head ? (
				<div
					data-slot="code-frame-head"
					contentEditable={false}
					className="flex min-h-monti-control-sm select-none items-center justify-between gap-monti-8 border-monti-default border-b px-monti-12"
				>
					{head}
				</div>
			) : null}
			{children}
		</div>
	);
}

/**
 * The code being written: the line numbers' column (`gutter`, rows of `CodeNumber`), and the text with the lines' grounds behind it (`grounds`, rows of
 * `CodeGround`, one per line as the text shows it). Every row is one 20px line, so the grounds of lines next to each other meet with no gap. The text is
 * the editor's own (`children`): what the highlighter, a rule or a closed fold put on it is styled here by its `data-` attribute.
 */
function CodeArea({
	gutter,
	grounds,
	aside,
	picking = false,
	children,
}: {
	gutter: React.ReactNode;
	grounds: React.ReactNode;
	/** What stands over the code at a line's place (`CodeAside`): a closed fold's summary. */
	aside?: React.ReactNode;
	/** Lines are picked by their numbers: the text's caret is hidden, the picked lines' ground shows where the action goes. */
	picking?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div data-slot="code-area" className="flex py-monti-8">
			<div data-slot="code-gutter" contentEditable={false} className="flex shrink-0 select-none flex-col">
				{gutter}
			</div>
			<div className="relative min-w-0 flex-1 overflow-x-auto">
				<div className="relative w-max min-w-full">
					<div
						aria-hidden
						contentEditable={false}
						className="pointer-events-none absolute inset-x-0 top-0 flex select-none flex-col"
					>
						{grounds}
					</div>
					<div
						data-slot="code-text"
						data-picking={picking ? "" : undefined}
						className={cn(
							"relative whitespace-pre pr-monti-16 pl-monti-16 font-mono text-monti-code text-monti-default",
							"data-picking:caret-transparent [&>*]:outline-none [&_.ProseMirror-trailingBreak]:hidden",
							// The site's two themes colour each piece (`--shiki-light`, `--shiki-dark` set on it by the highlighter).
							"[&_[data-token]]:text-(--shiki-light) monti-dark:[&_[data-token]]:text-(--shiki-dark)",
							// A closed fold's lines and words are hidden; its summary stands in their place.
							"[&_[data-code-hidden]]:hidden",
							"[&_[data-effect=bold]]:font-semibold [&_[data-effect=italic]]:italic [&_[data-effect=strike]]:line-through [&_[data-effect=underline]]:underline",
							"[&_[data-effect=codeTip]]:underline [&_[data-effect=codeTip]]:decoration-(--monti-fg-subtle) [&_[data-effect=codeTip]]:decoration-dotted [&_[data-effect=codeTip]]:underline-offset-4",
							"[&_[data-monti-mark=codeTip]]:underline [&_[data-monti-mark=codeTip]]:decoration-(--monti-fg-subtle) [&_[data-monti-mark=codeTip]]:decoration-dotted [&_[data-monti-mark=codeTip]]:underline-offset-4",
							"[&_[data-effect=codeFold]]:rounded-monti-sm [&_[data-effect=codeFold]]:outline-dashed [&_[data-effect=codeFold]]:outline-(--monti-border-strong) [&_[data-effect=codeFold]]:outline-1 [&_[data-effect=codeFold]]:-outline-offset-1",
							"[&_[data-monti-mark=codeFold]]:rounded-monti-sm [&_[data-monti-mark=codeFold]]:outline-dashed [&_[data-monti-mark=codeFold]]:outline-(--monti-border-strong) [&_[data-monti-mark=codeFold]]:outline-1 [&_[data-monti-mark=codeFold]]:-outline-offset-1",
							"[&_[data-wavy]]:underline [&_[data-wavy]]:decoration-1 [&_[data-wavy]]:decoration-wavy [&_[data-wavy]]:underline-offset-4",
							"[&_[data-wavy=error]]:decoration-(--monti-fg-danger) [&_[data-wavy=warning]]:decoration-(--monti-bg-warning-emphasis)",
						)}
					>
						{children}
					</div>
					{aside}
				</div>
			</div>
		</div>
	);
}

/** Something that stands at the right end of a line of the code being written (`row`: the line's place among the lines shown, from 0). */
function CodeAside({ row, children }: { row: number; children: React.ReactNode }) {
	return (
		<div
			data-slot="code-aside"
			contentEditable={false}
			className="absolute right-monti-8 flex h-[20px] select-none items-center"
			// design-allow: the line's place, from its row among the lines shown (20px each)
			style={{ top: row * 20 }}
		>
			{children}
		</div>
	);
}

/**
 * What a line carries: its ground — an effect's (`highlight` the text-emphasis ground, `plus`, `minus`), `picked` by the line numbers (the selection's ground),
 * `lit` while a code link to it or its fold's button is pointed at (the block ground) — its mark, a wavy line under its words.
 */
type CodeLineTone = "highlight" | "plus" | "minus" | "picked" | "lit";

const TONES =
	"data-[tone=highlight]:bg-monti-highlight data-[tone=minus]:bg-monti-danger-muted data-[tone=plus]:bg-monti-success-muted data-[tone=lit]:bg-monti-block data-[tone=picked]:bg-monti-selection";

/** One line's ground behind the text being written: one 20px row, so picked lines next to each other are one ground. */
function CodeGround({ tone }: { tone?: CodeLineTone }) {
	return <div data-slot="code-ground" data-tone={tone} className={cn("h-[20px] shrink-0", TONES)} />;
}

/** Where a line stands in a fold that spans lines: its first line, a line inside it, its last line. The fold's column draws the extent as a bracket. */
type CodeFoldEdge = "start" | "middle" | "end";

/**
 * One line's number in the code's left column, pressable to pick lines (doc 17). `fold` is the fold's button on its first line; `edge` draws the fold's
 * extent beside the numbers (a bracket from its first to its last line), `foldLit` while the fold's button is pointed at. `mark` is the effect's
 * character (`+`, `−`, `›`), in a column of its own after the number.
 */
function CodeNumber({
	number,
	tone,
	fold,
	folds = false,
	edge,
	foldLit = false,
	mark,
	numbersOff = false,
	readOnly = false,
	changed,
	className,
	...props
}: React.ComponentProps<"div"> & {
	number: number;
	/** In a comparison: the line's effects differ from the other side's (the change dot's name); `""` keeps the dot's place on a line that did not. */
	changed?: string;
	tone?: CodeLineTone;
	fold?: React.ReactNode;
	folds?: boolean;
	edge?: CodeFoldEdge;
	foldLit?: boolean;
	mark?: string;
	numbersOff?: boolean;
	readOnly?: boolean;
}) {
	return (
		<div
			data-slot="code-number"
			data-tone={tone}
			className={cn(
				"flex h-[20px] shrink-0 items-center gap-monti-2 pr-monti-4 pl-monti-8 font-mono text-monti-code tabular-nums",
				TONES,
				readOnly ? undefined : "cursor-pointer hover:bg-monti-selected",
				numbersOff ? "text-monti-faint" : "text-monti-subtle",
				tone === "picked" ? "text-monti-default" : undefined,
				className,
			)}
			{...props}
		>
			{folds ? (
				<span className="relative flex size-[20px] shrink-0 items-center justify-center self-stretch">
					{edge && !fold ? (
						<span
							aria-hidden
							data-edge={edge}
							data-lit={foldLit ? "" : undefined}
							className={cn(
								"absolute left-1/2 border-monti-strong border-l data-lit:border-monti-emphasis",
								edge === "end" ? "top-0 h-1/2 w-1/4 border-b" : "inset-y-0",
							)}
						/>
					) : null}
					{fold}
				</span>
			) : null}
			{changed === undefined ? null : (
				<span className="flex w-monti-8 shrink-0 items-center">{changed ? <ChangeDot label={changed} /> : null}</span>
			)}
			<span className="min-w-[2ch] text-right">{number}</span>
			<span
				aria-hidden
				className="w-[1ch] text-center data-[mark=+]:text-monti-success data-[mark=−]:text-monti-danger"
				data-mark={mark}
			>
				{mark}
			</span>
		</div>
	);
}

/**
 * One line of code as a read-only row (a comparison, a picture of the code): its number with the same column as the editor's (`CodeNumber`: the fold's
 * button and range line, the change dot, the effect's mark), its ground, and its words with a wavy line for a warning or an error.
 */
function CodeLine({
	number,
	fold,
	edge,
	mark,
	tone,
	wavy,
	numbersOff = false,
	folds = false,
	readOnly = false,
	changed,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	number: number;
	fold?: React.ReactNode;
	edge?: CodeFoldEdge;
	mark?: "+" | "−" | "›";
	tone?: CodeLineTone;
	wavy?: "warning" | "error";
	numbersOff?: boolean;
	/** The block has a fold somewhere: the gutter keeps room for the fold's button on every line, so the numbers stay in a column. */
	folds?: boolean;
	/** Nothing to pick (an archived entry, a comparison): the numbers are not pressable, so no pointer and no tint under it. */
	readOnly?: boolean;
	/** In a comparison: the line's effects differ from the other side's. The words are the change dot's name for screen readers. */
	changed?: string;
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="code-line"
			data-tone={tone}
			className={cn("group/line flex h-[20px] items-stretch font-mono text-monti-code", TONES, className)}
			{...props}
		>
			<CodeNumber
				contentEditable={false}
				number={number}
				fold={fold}
				folds={folds}
				edge={edge}
				mark={mark}
				numbersOff={numbersOff}
				readOnly={readOnly}
				changed={changed}
				className="select-none"
			/>
			<span className="relative flex flex-1 items-center whitespace-pre pr-monti-16 pl-monti-16 text-monti-default">
				<span
					className={cn(
						wavy && "underline decoration-1 decoration-wavy underline-offset-4",
						wavy === "warning" && "decoration-(--monti-bg-warning-emphasis)",
						wavy === "error" && "decoration-(--monti-fg-danger)",
					)}
				>
					{children}
				</span>
			</span>
		</div>
	);
}

/** A piece of code in its two theme colours, as the highlighter gives them (`--shiki-light`, `--shiki-dark`): run-time values from the site's themes. */
function CodeToken({ light, dark, children }: { light?: string; dark?: string; children: React.ReactNode }) {
	return (
		<span
			data-slot="code-token"
			className="monti-dark:text-(--shiki-dark) text-(--shiki-light)"
			// design-allow: the site's Shiki themes colour each piece at run time
			style={{ "--shiki-light": light, "--shiki-dark": dark ?? light } as React.CSSProperties}
		>
			{children}
		</span>
	);
}

/**
 * Words of code with a mark of the code's own: `tip` a tooltip (dotted line under them), `fold` folded words (a dashed outline: in the editor they
 * stay open so they can be edited), `picked` words picked with the pointer (the selection's ground), `bold` words a rule makes bold.
 */
function CodeMark({ kind, children }: { kind: "tip" | "fold" | "picked" | "bold"; children: React.ReactNode }) {
	return (
		<span
			data-slot="code-mark"
			data-kind={kind}
			className={cn(
				kind === "tip" && "underline decoration-(--monti-fg-subtle) decoration-dotted underline-offset-4",
				kind === "fold" &&
					"rounded-monti-sm outline-dashed outline-(--monti-border-strong) outline-1 -outline-offset-1",
				kind === "picked" && "bg-monti-selection",
				kind === "bold" && "font-semibold",
			)}
		>
			{children}
		</span>
	);
}

/**
 * Words of the text that point at lines of a code block (doc 17): a dotted line under them, so they read apart from a link's solid one. `broken`: the lines
 * are gone, the dotted line red (a wavy line is the code's "error" effect). `picking`: the words picked first while a link is being made, on the selected
 * ground.
 */
function CodeRefText({
	state = "linked",
	children,
}: {
	state?: "linked" | "broken" | "picking";
	children: React.ReactNode;
}) {
	return (
		<span
			data-slot="code-ref"
			data-state={state}
			className={cn(
				"underline underline-offset-4",
				state === "linked" && "decoration-(--monti-fg-subtle) decoration-dotted",
				state === "broken" && "decoration-(--monti-fg-danger) decoration-dotted",
				state === "picking" && "rounded-monti-sm bg-monti-selected no-underline",
			)}
		>
			{children}
		</span>
	);
}

export {
	CodeArea,
	CodeAside,
	type CodeFoldEdge,
	CodeFrame,
	CodeGround,
	CodeLine,
	type CodeLineTone,
	CodeMark,
	CodeNumber,
	CodeRefText,
	CodeToken,
};
