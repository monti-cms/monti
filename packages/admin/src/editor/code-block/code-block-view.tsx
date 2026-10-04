"use client";

import { createTranslator } from "@monti-cms/core/client";
import {
	CODE_LINE_EFFECTS,
	type CodeLineEffect,
	type CodeRule,
	lineAt,
	lineEffectDefinition,
	lineRange,
	lineStarts,
} from "@monti-cms/core/code-block";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { Check, ChevronRight, Copy, Info, ListOrdered, Rows3 } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Toggle } from "../../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { CODE_ANCHOR_REF } from "../added-marks";
import { useEditorEditable } from "../blocks/shared";
import {
	codeEffectsKey,
	type FoldRegion,
	foldRegions,
	lineEffectsOf,
	pickLines,
	rulesOf,
	setFoldOpen,
} from "./effects-plugin";
import { CODE_LANGUAGE_OPTIONS } from "./languages";
import { LineMenu } from "./line-menu";
import { startLinkFromLines } from "./link-commands";
import { codeBlockMessages } from "./messages";
import { formatMeta, parseMeta } from "./meta";
import { RulesPanel } from "./rules-panel";

const t = createTranslator(codeBlockMessages);

/** 한 줄 높이(px). 코드(`leading-6`)와 줄 번호 칸·줄 배경이 같은 높이를 쓴다. */
const LINE_HEIGHT = 24;
/** 코드 위아래 여백(`py-3`). */
const PAD_TOP = 12;

const effectsOnLine = (effects: readonly CodeLineEffect[], line: number) =>
	effects.filter((effect) => effect.start <= line && line < effect.end);

/** 줄 효과의 편집기 표시(줄 배경·물결 밑줄·줄 번호 칸 표시). 효과 정의의 `editor`다. */
const editorLookOf = (effect: CodeLineEffect) => lineEffectDefinition(effect.name)?.editor;

/** 줄 번호 칸 표시. 한 줄에 여럿이면 정의 순서가 앞선 효과다. */
const markerOf = (effects: readonly CodeLineEffect[]) =>
	CODE_LINE_EFFECTS.find((definition) => definition.editor?.marker && effects.some((e) => e.name === definition.name))
		?.editor?.marker;

/**
 * 코드 블록 편집 화면(v2 C5 재개발).
 * - 위: 언어·파일명·정규식 규칙·줄 번호(공개 화면 표시)·복사
 * - 왼쪽 줄 번호 칸: 누르거나 끌어 줄을 고르면 줄 효과 메뉴가 뜬다. 줄 접기 화살표로 편집 중에도 여닫는다.
 * - 코드: 그 자리에서 고친다. 글자 효과는 글자를 골라 인라인 버블·상단 도구로 준다.
 */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
	/** AI 자리 구분값. 노드 뷰가 살아 있는 동안 같다. */
	const slotScope = useId();
	const [copied, setCopied] = useState(false);
	/** 줄 효과 메뉴. `at`이 있으면 그 자리(오른쪽 클릭한 곳), 없으면 고른 첫 줄 오른쪽에 뜬다. */
	const [menu, setMenu] = useState<{ start: number; end: number; at?: { top: number; left: number } } | null>(null);
	const dragRef = useRef<{ anchor: number; start: number; end: number } | null>(null);
	const anchorRef = useRef<number | null>(null);
	const bodyRef = useRef<HTMLDivElement>(null);

	// NodeView는 선택·플러그인 상태만 바뀌면 다시 그려지지 않는다. 접기 상태와 선택을 구독한다.
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return "";
			const { from, to } = current.state.selection;
			return `${codeEffectsKey.getState(current.state)?.version ?? 0}:${from}:${to}:${current.isEditable}`;
		},
	});

	// 읽기 전용(휴지통·원문 모드)이면 언어·경로·효과 도구를 숨기고 줄을 고르지 않는다.
	const editable = useEditorEditable(editor);
	const pos = typeof getPos === "function" ? getPos() : undefined;
	const base = typeof pos === "number" ? pos + 1 : null;
	const language = (node.attrs.language as string) || "text";
	const parsedMeta = parseMeta((node.attrs.meta as string) || "");
	const rawMode = node.attrs.rawMode === true;
	const text = node.textContent;
	const starts = lineStarts(text);
	const lineEffects = lineEffectsOf(node);
	const rules = rulesOf(node);
	const overrides = codeEffectsKey.getState(editor.state)?.overrides ?? new Map<string, boolean>();
	const regions = typeof pos === "number" ? foldRegions(node, pos, overrides) : [];
	const collapses = regions.filter((region) => region.kind === "collapse");

	// 닫힌 줄 접기가 숨기는 줄(첫 줄은 보인다).
	const hiddenLines = new Set<number>();
	for (const region of collapses) {
		if (region.open || region.startLine === undefined || region.endLine === undefined) continue;
		for (let line = region.startLine + 1; line < region.endLine; line += 1) hiddenLines.add(line);
	}
	const rows = starts.map((_, line) => line).filter((line) => !hiddenLines.has(line));

	// 이 블록 안의 선택이 걸친 줄.
	const { from: selFrom, to: selTo } = editor.state.selection;
	const selectionInside = base !== null && selFrom >= base && selTo <= base + text.length;
	const selectedLines = selectionInside
		? { start: lineAt(starts, selFrom - base), end: lineAt(starts, selTo - base) + 1 }
		: null;

	const setMeta = (next: { title?: string; showLineNumbers?: boolean }) =>
		updateAttributes({
			meta: formatMeta({
				title: next.title ?? parsedMeta.title,
				showLineNumbers: next.showLineNumbers ?? parsedMeta.showLineNumbers,
				raw: parsedMeta.raw,
			}),
		});

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// 클립보드 접근 불가 시 무시
		}
	};

	// 줄 번호 칸에서 고른 줄. 누르거나 끌어 고르고 Shift로 늘린다. 메뉴는 고른 줄 옆 "줄 효과" 버튼으로 연다.
	const pickState = codeEffectsKey.getState(editor.state)?.picked ?? null;
	const picked = pickState && pickState.blockPos === pos ? pickState : null;
	const effectsState = codeEffectsKey.getState(editor.state);
	const hoverRef = effectsState?.hoverRef ?? null;
	const linkingLines =
		effectsState?.linking?.kind === "lines" && effectsState.linking.blockPos === pos ? effectsState.linking : null;

	/** `start`~`end` 줄을 고른다(복사·효과 적용도 그 줄에 걸린다). */
	const selectLines = useCallback(
		(start: number, end: number) => {
			const blockPos = typeof getPos === "function" ? getPos() : undefined;
			if (typeof blockPos === "number") pickLines(editor.view, blockPos, start, end);
		},
		[editor, getPos],
	);

	const startLineDrag = (line: number, event: React.MouseEvent) => {
		if (event.button !== 0 || rawMode || !editable) return;
		event.preventDefault();
		const anchor = event.shiftKey && picked ? (anchorRef.current ?? picked.start) : line;
		anchorRef.current = anchor;
		const range = { anchor, start: Math.min(anchor, line), end: Math.max(anchor, line) + 1 };
		dragRef.current = range;
		setMenu(null);
		selectLines(range.start, range.end);
		window.addEventListener(
			"mouseup",
			() => {
				dragRef.current = null;
			},
			{ once: true },
		);
	};

	const extendLineDrag = (line: number) => {
		const drag = dragRef.current;
		if (!drag) return;
		const start = Math.min(drag.anchor, line);
		const end = Math.max(drag.anchor, line) + 1;
		if (start === drag.start && end === drag.end) return;
		dragRef.current = { ...drag, start, end };
		selectLines(start, end);
	};

	const rowTop = (line: number) => PAD_TOP + Math.max(0, rows.indexOf(line)) * LINE_HEIGHT;
	const closeMenu = useCallback(() => setMenu(null), []);

	/** 줄 번호를 오른쪽 클릭하면 그 자리에 줄 효과 메뉴를 연다. 고른 줄 안이면 고른 줄 전체, 밖이면 그 줄이다. */
	const openLineMenuAt = (line: number, event: React.MouseEvent) => {
		if (rawMode || !editable) return;
		event.preventDefault();
		const inside = picked && picked.start <= line && line < picked.end;
		const range = inside ? { start: picked.start, end: picked.end } : { start: line, end: line + 1 };
		if (!inside) {
			anchorRef.current = line;
			selectLines(range.start, range.end);
		}
		const body = bodyRef.current?.getBoundingClientRect();
		setMenu({ ...range, at: { top: event.clientY - (body?.top ?? 0), left: event.clientX - (body?.left ?? 0) + 2 } });
	};

	// 닫힌 글자 접기는 숨기고 `…`로 보인다. 경고·오류 물결 밑줄 길이를 보이는 글자에 맞춘다.
	const closedFolds = regions
		.filter((region) => region.kind === "fold" && !region.open && base !== null)
		.map((region) => ({ from: region.from - (base ?? 0), to: region.to - (base ?? 0) }))
		.sort((a, b) => a.from - b.from);
	const visibleLineText = (line: number) => {
		const range = lineRange(text, starts, line);
		let out = "";
		let at = range.from;
		for (const fold of closedFolds) {
			if (fold.to <= range.from || fold.from >= range.to) continue;
			out += `${text.slice(at, Math.max(at, fold.from))}…`;
			at = Math.max(at, fold.to);
		}
		return out + text.slice(at, range.to);
	};

	const languageOptions = CODE_LANGUAGE_OPTIONS.some((option) => option.value === language)
		? CODE_LANGUAGE_OPTIONS
		: [...CODE_LANGUAGE_OPTIONS, { label: language, value: language }];

	const collapseAt = (line: number): FoldRegion | undefined => collapses.find((region) => region.startLine === line);

	return (
		<NodeViewWrapper
			className="not-prose group/code relative my-4 flex w-full flex-col rounded-md border bg-cms-muted/30 text-sm"
			data-code-block-wrapper=""
		>
			<div
				data-code-ui=""
				contentEditable={false}
				className="flex flex-wrap items-center justify-between gap-2 rounded-t-md border-b bg-cms-muted/60 px-2 py-1 text-cms-muted-foreground text-xs"
			>
				{editable ? (
					<div className="flex flex-wrap items-center gap-1.5">
						<Select
							value={language}
							// 이름 목록을 넘겨야 닫힌 칸에 값(`ts`)이 아니라 이름(`TypeScript`)이 보인다.
							items={languageOptions}
							onValueChange={(value) => value && updateAttributes({ language: value })}
						>
							<SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label={t("view.language")}>
								<SelectValue placeholder={t("view.languagePlaceholder")} />
							</SelectTrigger>
							<SelectContent>
								{CODE_LANGUAGE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							placeholder={t("view.filePath")}
							value={parsedMeta.title}
							onChange={(event) => setMeta({ title: event.target.value })}
							className="h-7 w-48 text-xs"
							aria-label={t("view.filePath")}
						/>
					</div>
				) : (
					<div className="flex min-h-7 items-center gap-2 px-1">
						<span>{languageOptions.find((option) => option.value === language)?.label ?? language}</span>
						{parsedMeta.title && <span className="font-mono">{parsedMeta.title}</span>}
					</div>
				)}
				<div className="flex items-center gap-0.5">
					{!editable ? null : rawMode ? (
						<Tooltip>
							<TooltipTrigger render={<span className="flex items-center gap-1 px-1" />}>
								<Info aria-hidden className="size-3.5" />
								{t("view.rawMode")}
							</TooltipTrigger>
							<TooltipContent>{t("view.rawModeHint")}</TooltipContent>
						</Tooltip>
					) : (
						<>
							<IconButton
								label={t("view.lineEffects")}
								size="icon-xs"
								className="size-7"
								disabled={!(picked ?? selectedLines)}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => {
									const lines = picked ?? selectedLines;
									if (lines) setMenu({ start: lines.start, end: lines.end });
								}}
							>
								<Rows3 aria-hidden className="size-3.5" />
							</IconButton>
							<RulesPanel
								rules={rules}
								text={text}
								language={node.attrs.language}
								slotScope={slotScope}
								lineCount={starts.length}
								selection={
									selectionInside &&
									selFrom < selTo &&
									!text.slice(selFrom - (base ?? 0), selTo - (base ?? 0)).includes("\n")
										? { text: text.slice(selFrom - (base ?? 0), selTo - (base ?? 0)) }
										: null
								}
								onChange={(next: CodeRule[]) => updateAttributes({ rules: next })}
							/>
						</>
					)}
					{editable && (
						<Tooltip>
							<TooltipTrigger
								render={
									<Toggle
										size="sm"
										pressed={parsedMeta.showLineNumbers}
										onPressedChange={(pressed) => setMeta({ showLineNumbers: pressed })}
										aria-label={t("view.lineNumbers")}
										className="size-7 min-w-7 p-0"
									/>
								}
							>
								<ListOrdered aria-hidden className="size-3.5" />
							</TooltipTrigger>
							<TooltipContent>{t("view.lineNumbers")}</TooltipContent>
						</Tooltip>
					)}
					<IconButton
						label={copied ? t("view.copied") : t("view.copy")}
						size="icon-xs"
						className="size-7"
						onClick={handleCopy}
					>
						{copied ? (
							<Check aria-hidden className="size-3.5 text-cms-primary" />
						) : (
							<Copy aria-hidden className="size-3.5" />
						)}
					</IconButton>
				</div>
			</div>

			<div ref={bodyRef} className="relative flex rounded-b-md">
				<div
					data-code-ui=""
					data-code-gutter=""
					contentEditable={false}
					className="shrink-0 select-none rounded-bl-md border-r bg-cms-muted/40 py-3 font-mono text-cms-muted-foreground text-xs"
				>
					{rows.map((line) => {
						const effects = effectsOnLine(lineEffects, line);
						const collapse = collapseAt(line);
						const lines = picked ?? selectedLines;
						const selected = !!lines && lines.start <= line && line < lines.end;
						const whole = !!picked && picked.start <= line && line < picked.end;
						const anchored = effects.some((effect) => effect.name === "anchor");
						const marker = markerOf(effects);
						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: 줄 번호를 눌러(끌어) 줄을 고르고 오른쪽 클릭으로 메뉴를 연다(키보드는 상단 "줄 효과" 버튼)
							<div
								key={line}
								data-line={line}
								data-anchored={anchored || undefined}
								title={anchored ? t("view.anchoredLine") : undefined}
								onMouseDown={(event) => startLineDrag(line, event)}
								onMouseEnter={() => extendLineDrag(line)}
								onContextMenu={(event) => openLineMenuAt(line, event)}
								className={cn(
									"flex h-6 cursor-pointer items-center gap-0.5 pr-1.5 pl-0.5 hover:bg-cms-accent/60",
									selected && "bg-cms-primary/10 text-cms-foreground",
									whole && "bg-cms-primary/20",
									// 본문과 연결된 줄은 줄 번호 칸 왼쪽에 선을 긋는다.
									anchored && "shadow-[inset_2px_0_0_0_var(--cms-primary)]",
								)}
							>
								<span className="flex w-4 justify-center">
									{collapse && (
										<IconButton
											label={t(collapse.open ? "view.collapseFrom" : "view.expandFrom", { line: line + 1 })}
											side="left"
											size="icon-xs"
											aria-expanded={collapse.open}
											onMouseDown={(event) => {
												event.preventDefault();
												event.stopPropagation();
												setFoldOpen(editor.view, collapse, !collapse.open);
											}}
											className="size-4 rounded p-0 hover:bg-cms-accent"
										>
											<ChevronRight
												aria-hidden
												className={cn("size-3.5 transition-transform", collapse.open && "rotate-90")}
											/>
										</IconButton>
									)}
								</span>
								<span className={cn("min-w-5 text-right tabular-nums", !parsedMeta.showLineNumbers && "opacity-50")}>
									{line + 1}
								</span>
								<span className="w-2.5 text-center">
									{marker && <span className={marker.className}>{marker.text}</span>}
								</span>
							</div>
						);
					})}
				</div>

				<div className="relative min-w-0 flex-1 overflow-x-auto">
					<div className="relative w-max min-w-full">
						<div
							aria-hidden
							contentEditable={false}
							className="pointer-events-none absolute inset-x-0 top-3 select-none font-mono text-sm leading-6"
						>
							{rows.map((line) => {
								const effects = effectsOnLine(lineEffects, line);
								const wavy = effects.map((effect) => editorLookOf(effect)?.wavy).find(Boolean);
								const whole = !!picked && picked.start <= line && line < picked.end;
								// 잇기 중에 먼저 고른 줄, 마우스를 올린 본문 연결이 가리키는 줄.
								const pending = !!linkingLines && linkingLines.start <= line && line < linkingLines.end;
								const hovered = effects.some((effect) => effect.name === "anchor" && effect.attrs.id === hoverRef);
								return (
									<div
										key={line}
										className={cn(
											"h-6",
											...effects.map((effect) => editorLookOf(effect)?.background ?? ""),
											(whole || pending || hovered) && "bg-cms-primary/15",
										)}
									>
										{/* 물결 밑줄은 글자 조각(구문 색)마다 끊기지 않게 줄 전체에 한 번 긋는다. 같은 글자를 투명하게 겹쳐 길이를 맞춘다. */}
										{wavy && (
											<span
												className={cn(
													"block w-max whitespace-pre px-4 text-transparent underline decoration-wavy",
													wavy,
												)}
											>
												{visibleLineText(line) || " "}
											</span>
										)}
									</div>
								);
							})}
						</div>
						<pre
							className={cn(
								"relative m-0 whitespace-pre bg-transparent px-4 py-3 font-mono text-cms-foreground text-sm leading-6",
								// 구문 색은 밝은 테마 색을 인라인으로 넣는다. 어두운 테마에서는 --shiki-dark로 바꾼다.
								"cms-dark:[&_.shiki-token]:text-(--shiki-dark)!",
								// 줄 번호로 고른 동안에는 커서를 숨긴다(고른 줄은 줄 배경으로 보인다).
								picked && "caret-transparent",
							)}
						>
							<NodeViewContent<"code"> as="code" className="block outline-none" />
						</pre>
					</div>
				</div>

				{menu && !rawMode && editable && (
					<LineMenu
						start={menu.start}
						end={Math.min(menu.end, starts.length)}
						lineEffects={lineEffects}
						onChange={(next) => updateAttributes({ lineEffects: next })}
						onClose={closeMenu}
						// 본문–코드 잇기는 코드 줄을 가리키는 글자 꾸밈(블록 확장 `codeRef` 등)이 있을 때만 쓴다.
						onLinkText={
							CODE_ANCHOR_REF
								? () => {
										if (typeof pos === "number") startLinkFromLines(editor.view, pos, menu.start, menu.end);
										closeMenu();
									}
								: undefined
						}
						style={menu.at ?? { top: rowTop(menu.start), right: 8 }}
					/>
				)}
			</div>
		</NodeViewWrapper>
	);
}
