"use client";

import { createTranslator } from "@monti-cms/core/client";
import { charEffectByName } from "@monti-cms/core/code-block";
import { type Editor, posToDOMRect } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
	ChevronsLeftRightEllipsis,
	Eye,
	EyeOff,
	Link2,
	MessageSquareMore,
	Pencil,
	Regex,
	Trash2,
	Unlink,
	X,
} from "lucide-react";
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	type EditorBubblePanel,
	type EditorBubbleProps,
	type EditorMarkExtension,
	type EditorSelectionAction,
	useCmsAdminComponents,
} from "../admin-components";
import { cn } from "../lib/utils/cn";
import { IconButton } from "../ui/icon-button";
import { Separator } from "../ui/separator";
import { addedMarkName } from "./added-marks";
import { BLOCK_TOOLBAR } from "./blocks/shared";
import { CODE_TOOLTIP_MARK_NAME } from "./code-block/code-tooltip-mark";
import { codeEffectsKey, expandRule, removeRule, setFoldOpen } from "./code-block/effects-plugin";
import {
	type ActiveCodeRule,
	type ActiveInlineMark,
	allowedMarkTools,
	allowsMark,
	INLINE_MARK_TOOLS,
	type InlineBubbleTarget,
	inlineBubbleTarget,
	RANGED_MARKS,
	removeInlineMark,
} from "./inline-marks";
import { type LinkDraft, LinkForm, linkDraftFromSelection } from "./link-form";
import { MarkTextForm, type MarkTextLabels } from "./mark-text-form";
import { editorMessages } from "./messages";
import { ToolbarButton } from "./toolbar-button";

const t = createTranslator(editorMessages);

/** Text for the tooltip form on text inside code. */
const CODE_TOOLTIP_LABELS: MarkTextLabels = {
	name: t("inlineBubble.tooltipName"),
	field: t("inlineBubble.tooltipField"),
	empty: t("inlineBubble.tooltipEmpty"),
};

type Panel =
	| { kind: "link"; draft: LinkDraft }
	| { kind: "codeTooltip"; active: boolean; initial: string; range?: { from: number; to: number } }
	| { kind: "extension"; panel: EditorBubblePanel };

/**
 * Registered text-style extensions and their editor mark names. Given an `editor`, returns only the styles in that editor's schema (registrations
 * of blocks the site does not use are ignored).
 */
export function useMarkExtensions(editor?: Editor | null): { name: string; extension: EditorMarkExtension }[] {
	const { marks = {} } = useCmsAdminComponents();
	return Object.entries(marks).flatMap(([block, extension]) => {
		const name = addedMarkName(block);
		return !editor || editor.schema.marks[name] ? [{ name, extension }] : [];
	});
}

const GAP = 8;
const EDGE = 8;

/** A bubble button. The name (aria-label) and tooltip are the same. With `pressed`, it is a toggle button. Extension bubble buttons use this too. */
export function BubbleButton({
	label,
	onClick,
	pressed,
	destructive,
	className,
	children,
}: {
	label: string;
	onClick: () => void;
	pressed?: boolean;
	destructive?: boolean;
	className?: string;
	children: ReactNode;
}) {
	return (
		<IconButton
			label={label}
			pressed={pressed}
			destructive={destructive}
			size="sm"
			// Do not steal the editor selection or focus on press.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
			className={cn("h-8 min-w-8 px-1.5", className)}
		>
			{children}
		</IconButton>
	);
}

/** Screen area to attach the bubble to. Effects with settings (link, tooltip, extension styles) attach to their range, the rest to the cursor. */
function anchorRange(target: InlineBubbleTarget, ranged: readonly string[]): { from: number; to: number } {
	if (target.kind === "selection") return target;
	const primary = target.marks[0];
	if (primary && ranged.includes(primary.name)) return primary;
	const rule = target.rules[0];
	if (!primary && rule) return rule;
	return { from: target.pos, to: target.pos };
}

/**
 * Inline effect bubble that floats above body text.
 * - When text is selected by dragging: tools to apply effects like bold and italic, and tooltip and link, right away.
 * - When the cursor is inside an effect: the spanning effects and a remove button, the link URL / tooltip text and an edit button.
 * Link and tooltip editing expands into an input form inside the bubble (no need to go to the top formatting tools).
 * For an extension's text styles (`CmsAdminComponents.marks`), it renders the buttons and content that extension provides.
 */
export function InlineBubble({
	editor,
	actions = [],
}: {
	editor: Editor;
	/** Actions to add at the end of the selection menu (plugins, e.g. polishing writing style). */
	actions?: readonly EditorSelectionAction[];
}) {
	const markExtensions = useMarkExtensions(editor);
	const detailed = markExtensions.flatMap(({ name, extension }) => (extension.detail ? [name] : []));
	const ranged = [...RANGED_MARKS, ...detailed];
	const snapshot = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current?.isEditable) return null;
			const target = inlineBubbleTarget(current.state, detailed);
			// Also watch the applied state so the pressed indicator of selection tools stays correct after an effect is applied.
			const active =
				target?.kind === "selection"
					? [
							...INLINE_MARK_TOOLS.map((tool) => tool.mark),
							"link",
							CODE_TOOLTIP_MARK_NAME,
							"codeFold",
							...markExtensions.map(({ name }) => name),
						].filter((mark) => current.isActive(mark))
					: [];
			// The open state of text folding (code block) is shown in the bubble too.
			const folds = codeEffectsKey.getState(current.state)?.version ?? 0;
			return { target, focused: current.isFocused, active, folds };
		},
	});
	const [panel, setPanel] = useState<Panel | null>(null);
	// Hide while dragging with the button held (selecting text) and while typing.
	const [pointerDown, setPointerDown] = useState(false);
	const [typing, setTyping] = useState(false);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const [, setScrollTick] = useState(0);

	const target = snapshot?.target ?? null;
	const visible =
		target !== null &&
		(panel !== null || (!!snapshot?.focused && !pointerDown && !(typing && target.kind === "marks")));

	useEffect(() => {
		const onTransaction = ({ transaction }: { transaction: Transaction }) => {
			if (transaction.docChanged && editor.state.selection.empty) setTyping(true);
			else if (transaction.selectionSet && !transaction.docChanged) setTyping(false);
		};
		const dom = editor.view.dom;
		const onPointerDown = (event: MouseEvent) => {
			if (event.button === 0) setPointerDown(true);
		};
		const onPointerUp = () => setPointerDown(false);
		editor.on("transaction", onTransaction);
		dom.addEventListener("mousedown", onPointerDown);
		window.addEventListener("mouseup", onPointerUp);
		return () => {
			editor.off("transaction", onTransaction);
			dom.removeEventListener("mousedown", onPointerDown);
			window.removeEventListener("mouseup", onPointerUp);
		};
	}, [editor]);

	// Pressing outside the bubble with the input form open closes the form (same as popovers).
	useEffect(() => {
		if (!panel) return;
		const onDown = (event: MouseEvent) => {
			const bubble = bubbleRef.current;
			if (bubble && event.target instanceof Node && !bubble.contains(event.target)) setPanel(null);
		};
		document.addEventListener("mousedown", onDown, true);
		return () => document.removeEventListener("mousedown", onDown, true);
	}, [panel]);

	useEffect(() => {
		if (!target && panel) setPanel(null);
	}, [target, panel]);

	// Follow the text on scroll and window resize (the bubble floats at a fixed screen position).
	useEffect(() => {
		if (!visible) return;
		const update = () => setScrollTick((tick) => tick + 1);
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [visible]);

	useLayoutEffect(() => {
		if (!visible || !target) {
			setPosition(null);
			return;
		}
		let rect: DOMRect;
		try {
			const range = anchorRange(target, ranged);
			rect = posToDOMRect(editor.view, range.from, range.to);
		} catch {
			setPosition(null);
			return;
		}
		const bubble = bubbleRef.current;
		const height = bubble?.offsetHeight ?? 36;
		const width = bubble?.offsetWidth ?? 0;
		// Keep it from being covered by the top (sticky) formatting tools. If there is no room above, float it below the text.
		const formatBar = editor.view.dom
			.closest("[data-cms-editor-shell]")
			?.querySelector(`[role="toolbar"][aria-label="${t("toolbar.format")}"]`);
		const minTop = (formatBar?.getBoundingClientRect().bottom ?? 0) + GAP;
		if (rect.bottom < minTop || rect.top > window.innerHeight) {
			setPosition(null);
			return;
		}
		const above = rect.top - height - GAP;
		const top = above >= minTop ? above : rect.bottom + GAP;
		const center = (rect.left + rect.right) / 2;
		const left = Math.max(EDGE, Math.min(center - width / 2, window.innerWidth - width - EDGE));
		setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
	});

	if (!visible || !target || typeof window === "undefined") return null;

	// Removing an effect from the bubble changes the document but is not typing, so keep the bubble visible.
	const act = (action: () => void) => () => {
		action();
		setTyping(false);
	};

	const closePanel = () => {
		setPanel(null);
		setTyping(false);
		editor.commands.focus();
	};

	const openLink = (draft: LinkDraft) => setPanel({ kind: "link", draft });
	const openCodeTooltip = (mark?: ActiveInlineMark) =>
		setPanel(
			mark
				? { kind: "codeTooltip", active: true, initial: String(mark.attrs.content ?? ""), range: mark }
				: {
						kind: "codeTooltip",
						active: editor.isActive(CODE_TOOLTIP_MARK_NAME),
						initial: String(editor.getAttributes(CODE_TOOLTIP_MARK_NAME).content ?? ""),
					},
		);
	// Values received by the extension's buttons and content.
	const inCode = !!editor.state.selection.$from.parent.type.spec.code;
	const bubbleProps: EditorBubbleProps = {
		editor,
		inCode,
		openPanel: (next) => setPanel({ kind: "extension", panel: next }),
		closePanel,
		act,
	};

	const renderMark = (mark: ActiveInlineMark) => {
		if (mark.name === "link") {
			const href = String(mark.attrs.href ?? "");
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<Link2 aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
					<a
						href={href}
						target="_blank"
						rel="noreferrer noopener"
						title={href}
						// If focus is taken from the editor on press, the bubble disappears first and the link does not open.
						onMouseDown={(event) => event.preventDefault()}
						className="max-w-56 truncate px-1 text-cms-primary text-xs underline underline-offset-2"
					>
						{href}
					</a>
					<BubbleButton
						label={t("link.edit")}
						onClick={() => openLink({ from: mark.from, to: mark.to, existing: true, href })}
					>
						<Pencil aria-hidden className="size-4" />
					</BubbleButton>
					<BubbleButton label={t("link.remove")} onClick={act(() => removeInlineMark(editor, mark))}>
						<Unlink aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		if (mark.name === CODE_TOOLTIP_MARK_NAME) {
			const content = String(mark.attrs.content ?? "");
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<MessageSquareMore aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
					<span className="max-w-48 truncate px-1 text-cms-muted-foreground text-xs" title={content}>
						{content}
					</span>
					<BubbleButton label={t("inlineBubble.tooltipEdit")} onClick={() => openCodeTooltip(mark)}>
						<Pencil aria-hidden className="size-4" />
					</BubbleButton>
					<BubbleButton label={t("inlineBubble.tooltipRemove")} onClick={act(() => removeInlineMark(editor, mark))}>
						<X aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		const Detail = markExtensions.find(({ name }) => name === mark.name)?.extension.detail;
		if (Detail) {
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<Detail {...bubbleProps} mark={mark} />
				</div>
			);
		}
		if (mark.name === "codeFold") {
			const region = {
				key: `m:${mark.from}`,
				kind: "fold" as const,
				from: mark.from,
				to: mark.to,
				defaultOpen: true,
				hiddenLines: 0,
			};
			const open = codeEffectsKey.getState(editor.state)?.overrides.get(region.key) ?? region.defaultOpen;
			const publicOpen = mark.attrs.open === true;
			const type = editor.schema.marks.codeFold;
			return (
				<div key={mark.name} className="flex items-center gap-0.5">
					<ChevronsLeftRightEllipsis aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
					<span className="px-1 text-cms-muted-foreground text-xs">{t("inlineBubble.fold")}</span>
					<BubbleButton
						label={open ? t("inlineBubble.collapse") : t("inlineBubble.expand")}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
					</BubbleButton>
					<BubbleButton
						label={t("inlineBubble.openByDefault")}
						pressed={publicOpen}
						className="text-xs"
						onClick={act(() => {
							if (!type) return;
							editor
								.chain()
								.focus()
								.command(({ tr }) => {
									tr.addMark(mark.from, mark.to, type.create({ open: !publicOpen }));
									return true;
								})
								.run();
						})}
					>
						{t("inlineBubble.openByDefault")}
					</BubbleButton>
					<BubbleButton label={t("inlineBubble.foldRemove")} onClick={act(() => removeInlineMark(editor, mark))}>
						<X aria-hidden className="size-4" />
					</BubbleButton>
				</div>
			);
		}
		const tool = INLINE_MARK_TOOLS.find((item) => item.mark === mark.name);
		if (!tool) return null;
		return (
			<BubbleButton
				key={mark.name}
				label={t("markText.remove", { name: tool.title ?? tool.label })}
				onClick={act(() => removeInlineMark(editor, mark))}
				className="gap-0.5"
			>
				<tool.icon aria-hidden className="size-4" />
				<X aria-hidden className="size-3 text-cms-muted-foreground" />
			</BubbleButton>
		);
	};

	/** Spot found by a regex rule. Being a rule, only this spot cannot be cleared — clear the whole rule, or resolve it into individual effects and clear one by one. */
	const renderRule = ({ rule, blockPos, from, to, count }: ActiveCodeRule) => {
		const label = charEffectByName(rule.name)?.label ?? rule.name;
		const region = { key: `m:${from}`, kind: "fold" as const, from, to, defaultOpen: true, hiddenLines: 0 };
		const open = codeEffectsKey.getState(editor.state)?.overrides.get(region.key) ?? true;
		return (
			<div key={rule.id} className="flex items-center gap-0.5">
				<Regex aria-hidden className="mx-1 size-4 shrink-0 text-cms-muted-foreground" />
				<span
					className="max-w-48 truncate px-1 text-cms-muted-foreground text-xs"
					title={`/${rule.pattern}/${rule.flags}`}
				>
					{t("inlineBubble.ruleSummary", { label, count })}
				</span>
				{rule.name === "fold" && (
					<BubbleButton
						label={open ? t("inlineBubble.collapse") : t("inlineBubble.expand")}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
					</BubbleButton>
				)}
				<BubbleButton
					label={t("inlineBubble.ruleExpand")}
					className="text-xs"
					onClick={act(() => expandRule(editor.view, blockPos, rule.id))}
				>
					{t("inlineBubble.ruleExpandShort")}
				</BubbleButton>
				<BubbleButton
					label={t("inlineBubble.ruleDelete")}
					destructive
					onClick={act(() => removeRule(editor.view, blockPos, rule.id))}
				>
					<Trash2 aria-hidden className="size-4" />
				</BubbleButton>
			</div>
		);
	};

	const renderMarks = (marks: ActiveInlineMark[], rules: ActiveCodeRule[]) => {
		const withDetail = marks.filter((mark) => [...ranged, "codeFold"].includes(mark.name));
		const simple = marks.filter((mark) => !withDetail.includes(mark));
		const groups = [
			...withDetail.map((mark) => <Fragment key={mark.name}>{renderMark(mark)}</Fragment>),
			...rules.map(renderRule),
			...(simple.length ? [<Fragment key="simple">{simple.map(renderMark)}</Fragment>] : []),
		];
		return groups.map((group, index) => (
			<div key={group.key} className="flex items-center gap-0.5">
				{index > 0 && <Separator orientation="vertical" className="mx-0.5 h-4" />}
				{group}
			</div>
		));
	};

	// In a code block, only the effects it accepts (bold, italic, strikethrough, underline, tooltip) and text folding are shown. Extension buttons hide themselves.
	const bubbleTools = (group: "format" | "link") =>
		markExtensions
			.flatMap(({ name, extension }) => (extension.bubble?.group === group ? [{ name, bubble: extension.bubble }] : []))
			.sort((a, b) => (a.bubble.order ?? 1) - (b.bubble.order ?? 1));
	const renderTool = ({ name, bubble }: ReturnType<typeof bubbleTools>[number]) => (
		<bubble.Button key={name} {...bubbleProps} />
	);
	const linkTools = bubbleTools("link");
	const renderSelectionTools = () => (
		<>
			{!inCode && actions.length > 0 && (
				<>
					{actions.map((action) => (
						<BubbleButton key={action.id} label={action.label} onClick={() => action.run(editor)}>
							{action.icon}
						</BubbleButton>
					))}
					<Separator orientation="vertical" className="mx-0.5 h-4" />
				</>
			)}
			{allowedMarkTools(editor.state).map((item) => (
				<ToolbarButton key={item.mark} editor={editor} item={item} tooltipSide="top" />
			))}
			{bubbleTools("format").map(renderTool)}
			<Separator orientation="vertical" className="mx-0.5 h-4" />
			{inCode && allowsMark(editor.state, CODE_TOOLTIP_MARK_NAME) && (
				<BubbleButton
					label={editor.isActive(CODE_TOOLTIP_MARK_NAME) ? t("inlineBubble.tooltipEdit") : t("inlineBubble.tooltipAdd")}
					onClick={() => openCodeTooltip()}
				>
					<MessageSquareMore aria-hidden className="size-4" />
				</BubbleButton>
			)}
			{linkTools.filter(({ bubble }) => (bubble.order ?? 1) < 0).map(renderTool)}
			{allowsMark(editor.state, "link") && !inCode && (
				<BubbleButton
					label={editor.isActive("link") ? t("link.edit") : t("link.add")}
					onClick={() => openLink(linkDraftFromSelection(editor))}
				>
					<Link2 aria-hidden className="size-4" />
				</BubbleButton>
			)}
			{linkTools.filter(({ bubble }) => (bubble.order ?? 1) >= 0).map(renderTool)}
			{inCode && allowsMark(editor.state, "codeFold") && (
				<BubbleButton
					label={t("inlineBubble.fold")}
					pressed={editor.isActive("codeFold")}
					onClick={() => editor.chain().focus().toggleMark("codeFold").run()}
				>
					<ChevronsLeftRightEllipsis aria-hidden className="size-4" />
				</BubbleButton>
			)}
		</>
	);

	const style = { position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 40 } as const;
	const surface = "rounded-md border bg-cms-popover/95 text-cms-popover-foreground shadow-sm backdrop-blur";

	return createPortal(
		panel ? (
			<div
				ref={bubbleRef}
				role="dialog"
				aria-label={
					panel.kind === "link"
						? t("inlineBubble.linkPanel")
						: panel.kind === "codeTooltip"
							? t("inlineBubble.tooltipPanel")
							: panel.panel.label
				}
				data-cms-inline-bubble
				style={style}
				className={cn(
					surface,
					"flex flex-col gap-3 p-3 text-xs",
					panel.kind === "extension" && panel.panel.size === "auto" ? "w-auto p-2" : "w-80",
				)}
				onKeyDown={(event) => {
					if (event.key === "Escape" && !event.nativeEvent.isComposing) {
						event.preventDefault();
						closePanel();
					}
				}}
			>
				{panel.kind === "link" ? (
					<LinkForm editor={editor} draft={panel.draft} onDone={closePanel} />
				) : panel.kind === "codeTooltip" ? (
					<MarkTextForm
						editor={editor}
						mark={CODE_TOOLTIP_MARK_NAME}
						attribute="content"
						labels={CODE_TOOLTIP_LABELS}
						active={panel.active}
						initial={panel.initial}
						range={panel.range}
						onDone={closePanel}
					/>
				) : (
					panel.panel.content
				)}
			</div>
		) : (
			<div
				ref={bubbleRef}
				role="toolbar"
				aria-label={target.kind === "selection" ? t("inlineBubble.selectionLabel") : t("inlineBubble.effectLabel")}
				data-cms-inline-bubble
				style={style}
				className={BLOCK_TOOLBAR}
			>
				{target.kind === "selection" ? renderSelectionTools() : renderMarks(target.marks, target.rules)}
			</div>
		),
		document.body,
	);
}
