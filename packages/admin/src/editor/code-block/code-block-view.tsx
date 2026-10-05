"use client";

import { createTranslator } from "@monti-cms/core/client";
import {
	CODE_BLOCK_FEATURES,
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
import { CODE_LANGUAGE_CHOICES } from "./languages";
import { LineMenu, lineMenuAvailable } from "./line-menu";
import { startLinkFromLines } from "./link-commands";
import { codeBlockMessages } from "./messages";
import { formatMeta, parseMeta } from "./meta";
import { RulesPanel } from "./rules-panel";

const t = createTranslator(codeBlockMessages);

/** Height of one line (px). The code (`leading-6`), the line number gutter and the line background share this height. */
const LINE_HEIGHT = 24;
/** Vertical padding of the code (`py-3`). */
const PAD_TOP = 12;

const effectsOnLine = (effects: readonly CodeLineEffect[], line: number) =>
	effects.filter((effect) => effect.start <= line && line < effect.end);

/** Editor display of line effects (line background, wavy underline, line number gutter marker). The `editor` of the effect definition. */
const editorLookOf = (effect: CodeLineEffect) => lineEffectDefinition(effect.name)?.editor;

/** Line number gutter marker. When several apply to one line, the effect defined first wins. */
const markerOf = (effects: readonly CodeLineEffect[]) =>
	CODE_LINE_EFFECTS.find((definition) => definition.editor?.marker && effects.some((e) => e.name === definition.name))
		?.editor?.marker;

/**
 * Code block editing view.
 * - Top: language, file name, regex rules, line numbers (shown on the public page), copy
 * - Left line number gutter: pressing or dragging to pick lines opens the line effect menu. The fold arrows open and close folds even while editing.
 * - Code: edited in place. Text effects are applied by selecting text and using the inline bubble or the top toolbar.
 */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
	/** AI slot discriminator. Stays the same while the node view is alive. */
	const slotScope = useId();
	const [copied, setCopied] = useState(false);
	/** Line effect menu. If `at` is set it opens there (where right-clicked), otherwise to the right of the first selected line. */
	const [menu, setMenu] = useState<{ start: number; end: number; at?: { top: number; left: number } } | null>(null);
	const dragRef = useRef<{ anchor: number; start: number; end: number } | null>(null);
	const anchorRef = useRef<number | null>(null);
	const bodyRef = useRef<HTMLDivElement>(null);

	// The NodeView does not re-render when only selection or plugin state changes. Subscribe to the fold state and the selection.
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return "";
			const { from, to } = current.state.selection;
			return `${codeEffectsKey.getState(current.state)?.version ?? 0}:${from}:${to}:${current.isEditable}`;
		},
	});

	// When read-only (trash, source mode), hide the language, path and effect tools and do not select lines.
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

	// Lines hidden by a closed line fold (the first line stays visible).
	const hiddenLines = new Set<number>();
	for (const region of collapses) {
		if (region.open || region.startLine === undefined || region.endLine === undefined) continue;
		for (let line = region.startLine + 1; line < region.endLine; line += 1) hiddenLines.add(line);
	}
	const rows = starts.map((_, line) => line).filter((line) => !hiddenLines.has(line));

	// Lines spanned by the selection inside this block.
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
			// Ignore when clipboard access is unavailable
		}
	};

	// Lines picked in the line number gutter. Press or drag to pick, extend with Shift. The menu opens via the "Line effects" button next to the picked lines.
	const pickState = codeEffectsKey.getState(editor.state)?.picked ?? null;
	const picked = pickState && pickState.blockPos === pos ? pickState : null;
	const effectsState = codeEffectsKey.getState(editor.state);
	const hoverRef = effectsState?.hoverRef ?? null;
	const linkingLines =
		effectsState?.linking?.kind === "lines" && effectsState.linking.blockPos === pos ? effectsState.linking : null;

	/** Picks lines `start` to `end` (copy and effect application also apply to those lines). */
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

	/** Right-clicking a line number opens the line effect menu there. Inside the picked lines it targets all picked lines; outside, just that line. */
	const openLineMenuAt = (line: number, event: React.MouseEvent) => {
		if (rawMode || !editable || !lineMenuOffered) return;
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

	// Closed text folds are hidden and shown as `…`. Fit the warning/error wavy underline length to the visible text.
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

	const languageOptions = CODE_LANGUAGE_CHOICES.some((option) => option.value === language)
		? CODE_LANGUAGE_CHOICES
		: [...CODE_LANGUAGE_CHOICES, { label: language, value: language }];
	// Tools turned off in the site config are not offered, but what the block already has stays shown so it can be edited or removed.
	const lineMenuOffered = lineMenuAvailable(lineEffects, 0, starts.length, !!CODE_ANCHOR_REF);
	const rulesOffered = CODE_BLOCK_FEATURES.rules || rules.length > 0;

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
							// The name list must be passed so a closed slot shows the name (`TypeScript`) rather than the value (`ts`).
							items={languageOptions}
							onValueChange={(value) => value && updateAttributes({ language: value })}
						>
							<SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label={t("view.language")}>
								<SelectValue placeholder={t("view.languagePlaceholder")} />
							</SelectTrigger>
							<SelectContent>
								{CODE_LANGUAGE_CHOICES.map((option) => (
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
							{lineMenuOffered && (
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
							)}
							{rulesOffered && (
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
							)}
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
							// biome-ignore lint/a11y/noStaticElementInteractions: pressing (dragging) a line number picks lines and right-click opens the menu (keyboard users use the top "Line effects" button)
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
									// A line linked to the body gets a line drawn on the left of the line number gutter.
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
								// The line picked first during linking, and the line the hovered body link points to.
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
										{/* Draw the wavy underline once across the whole line so it is not broken per text fragment (syntax color). Overlay the same text transparently to match the length. */}
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
								// Syntax colors are inlined as light theme colors. In the dark theme they switch to --shiki-dark.
								"cms-dark:[&_.shiki-token]:text-(--shiki-dark)!",
								// Hide the cursor while lines are picked by line number (picked lines are shown by the line background).
								picked && "caret-transparent",
							)}
						>
							<NodeViewContent<"code"> as="code" className="block outline-none" />
						</pre>
					</div>
				</div>

				{menu && !rawMode && editable && lineMenuOffered && (
					<LineMenu
						start={menu.start}
						end={Math.min(menu.end, starts.length)}
						lineEffects={lineEffects}
						onChange={(next) => updateAttributes({ lineEffects: next })}
						onClose={closeMenu}
						// Body-to-code linking is used only when there is a text decoration pointing at code lines (such as `codeRef` of the blocks extension).
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
