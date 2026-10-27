"use client";

import { charEffectByName } from "@monti-cms/core/code-block";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { Badge, Box, cn, Icon, IconButton, Inline, Separator, Text, TextLink } from "@monti-cms/ui";
import { type Editor, posToDOMRect } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
	ChevronsLeftRightEllipsis,
	Eye,
	EyeOff,
	Link2,
	type LucideIcon,
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
	useAdminComponents,
} from "../admin-components";
import { isComposingKey } from "../lib/keyboard";
import type { TranslatorFor } from "../translator";
import { addedMarkName } from "./added-marks";
import { allowanceOfState } from "./allowed-extension";
import { BLOCK_TOOLBAR } from "./blocks/shared";
import { CODE_TOOLTIP_MARK_NAME } from "./code-block/code-tooltip-mark";
import { codeEffectsKey, expandRule, removeRule, setFoldOpen } from "./code-block/effects-plugin";
import { FootnoteForm, removeFootnote } from "./footnote-form";
import {
	type ActiveCodeRule,
	type ActiveInlineMark,
	allowedMarkTools,
	allowsMark,
	INLINE_MARK_NAMES,
	type InlineBubbleTarget,
	inlineBubbleTarget,
	inlineMarkTools,
	offersMarkTool,
	RANGED_MARKS,
	removeInlineMark,
} from "./inline-marks";
import { type LinkDraft, LinkForm, linkDraftFromSelection } from "./link-form";
import { LinkTargetAnchor } from "./link-target-view";
import { MarkTextForm, type MarkTextLabels } from "./mark-text-form";
import { editorMessages } from "./messages";
import { ToolbarButton } from "./toolbar-button";

/** Text for the tooltip form on text inside code. */
const CODE_TOOLTIP_LABELS = (t: TranslatorFor<typeof editorMessages>): MarkTextLabels => ({
	name: t("inlineBubble.tooltipName"),
	field: t("inlineBubble.tooltipField"),
	empty: t("inlineBubble.tooltipEmpty"),
});

type Panel =
	| { kind: "link"; draft: LinkDraft }
	| { kind: "codeTooltip"; active: boolean; initial: string; range?: { from: number; to: number } }
	| { kind: "footnote"; target: Extract<InlineBubbleTarget, { kind: "footnote" }> }
	| { kind: "extension"; panel: EditorBubblePanel };

/**
 * Registered text-style extensions and their editor mark names. Given an `editor`, returns only the styles in that editor's schema (registrations
 * of blocks the site does not use are ignored).
 */
export function useMarkExtensions(editor?: Editor | null): { name: string; extension: EditorMarkExtension }[] {
	const { marks = {} } = useAdminComponents();
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
	tone,
	children,
}: {
	label: string;
	onClick: () => void;
	pressed?: boolean;
	tone?: "danger";
	children: ReactNode;
}) {
	return (
		<IconButton
			label={label}
			pressed={pressed}
			tone={tone}
			size="sm"
			// Do not steal the editor selection or focus on press.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onClick}
		>
			{children}
		</IconButton>
	);
}

/** A decorative icon at the start of a bubble row (what the row is about). */
function BubbleIcon({ icon }: { icon: LucideIcon }) {
	return (
		<Box as="span" paddingX="tight" shrink={false}>
			<Icon icon={icon} tone="muted" />
		</Box>
	);
}

/** Screen area to attach the bubble to. Effects with settings (link, tooltip, extension styles) attach to their range, the rest to the cursor. */
function anchorRange(target: InlineBubbleTarget, ranged: readonly string[]): { from: number; to: number } {
	if (target.kind === "selection" || target.kind === "footnote") return target;
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
 * For an extension's text styles (`AdminComponents.marks`), it renders the buttons and content that extension provides.
 */
export function InlineBubble({
	editor,
	actions = [],
}: {
	editor: Editor;
	/** Actions to add at the end of the selection menu (plugins, e.g. polishing writing style). */
	actions?: readonly EditorSelectionAction[];
}) {
	const site = useSite();
	const t = useTranslator(editorMessages);
	const allowance = allowanceOfState(editor.state);
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
							...INLINE_MARK_NAMES,
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

	const dismissedEmptyRef = useRef<string | null>(null);
	useEffect(() => {
		if (target?.kind === "footnote") {
			if (!target.defText && panel?.kind !== "footnote" && dismissedEmptyRef.current !== target.label) {
				setPanel({ kind: "footnote", target });
			}
		} else {
			dismissedEmptyRef.current = null;
		}
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
			.closest("[data-monti-editor-shell]")
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
		if (panel?.kind === "footnote" && target?.kind === "footnote" && !target.defText) {
			dismissedEmptyRef.current = target.label;
		}
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
			// An internal link holds the id of its entry: the bubble shows the entry it goes to, not an address.
			const entryId = typeof mark.attrs.entryId === "string" && mark.attrs.entryId ? mark.attrs.entryId : null;
			const href = entryId ? "" : String(mark.attrs.href ?? "");
			return (
				<Inline key={mark.name} gap="hair">
					<BubbleIcon icon={Link2} />
					{entryId ? (
						<LinkTargetAnchor entryId={entryId} />
					) : (
						<Box as="span" paddingX="tight" maxWidth="panel-sm" minWidth={0}>
							<Text as="div" variant="caption" truncate>
								<TextLink
									href={href}
									target="_blank"
									rel="noreferrer noopener"
									title={href}
									tone="accent"
									// If focus is taken from the editor on press, the bubble disappears first and the link does not open.
									onMouseDown={(event) => event.preventDefault()}
								>
									{href}
								</TextLink>
							</Text>
						</Box>
					)}
					<BubbleButton
						label={t("link.edit")}
						onClick={() => openLink({ from: mark.from, to: mark.to, existing: true, href, entryId })}
					>
						<Pencil aria-hidden />
					</BubbleButton>
					<BubbleButton label={t("link.remove")} onClick={act(() => removeInlineMark(editor, mark))}>
						<Unlink aria-hidden />
					</BubbleButton>
				</Inline>
			);
		}
		if (mark.name === CODE_TOOLTIP_MARK_NAME) {
			const content = String(mark.attrs.content ?? "");
			return (
				<Inline key={mark.name} gap="hair">
					<BubbleIcon icon={MessageSquareMore} />
					<Box as="span" paddingX="tight" maxWidth="panel-sm" minWidth={0}>
						<Text as="div" variant="caption" tone="muted" truncate title={content}>
							{content}
						</Text>
					</Box>
					<BubbleButton label={t("inlineBubble.tooltipEdit")} onClick={() => openCodeTooltip(mark)}>
						<Pencil aria-hidden />
					</BubbleButton>
					<BubbleButton label={t("inlineBubble.tooltipRemove")} onClick={act(() => removeInlineMark(editor, mark))}>
						<X aria-hidden />
					</BubbleButton>
				</Inline>
			);
		}
		const Detail = markExtensions.find(({ name }) => name === mark.name)?.extension.detail;
		if (Detail) {
			return (
				<Inline key={mark.name} gap="hair">
					<Detail {...bubbleProps} mark={mark} />
				</Inline>
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
				<Inline key={mark.name} gap="hair">
					<BubbleIcon icon={ChevronsLeftRightEllipsis} />
					<Box as="span" paddingX="tight">
						<Text variant="caption" tone="muted">
							{t("inlineBubble.fold")}
						</Text>
					</Box>
					<BubbleButton
						label={open ? t("inlineBubble.collapse") : t("inlineBubble.expand")}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
					</BubbleButton>
					<BubbleButton
						label={t("inlineBubble.openByDefault")}
						pressed={publicOpen}
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
						<X aria-hidden />
					</BubbleButton>
				</Inline>
			);
		}
		const tool = inlineMarkTools(site).find((item) => item.mark === mark.name);
		if (!tool) return null;
		return (
			<BubbleButton
				key={mark.name}
				label={t("markText.remove", { name: tool.title ?? tool.label })}
				onClick={act(() => removeInlineMark(editor, mark))}
			>
				<tool.icon aria-hidden />
				<X aria-hidden />
			</BubbleButton>
		);
	};

	/** Spot found by a regex rule. Being a rule, only this spot cannot be cleared — clear the whole rule, or resolve it into individual effects and clear one by one. */
	const renderRule = ({ rule, blockPos, from, to, count }: ActiveCodeRule) => {
		const label = charEffectByName(rule.name)?.label ?? rule.name;
		const region = { key: `m:${from}`, kind: "fold" as const, from, to, defaultOpen: true, hiddenLines: 0 };
		const open = codeEffectsKey.getState(editor.state)?.overrides.get(region.key) ?? true;
		return (
			<Inline key={rule.id} gap="hair">
				<BubbleIcon icon={Regex} />
				<Box as="span" paddingX="tight" maxWidth="panel-sm" minWidth={0}>
					<Text as="div" variant="caption" tone="muted" truncate title={`/${rule.pattern}/${rule.flags}`}>
						{t("inlineBubble.ruleSummary", { label, count })}
					</Text>
				</Box>
				{rule.name === "fold" && (
					<BubbleButton
						label={open ? t("inlineBubble.collapse") : t("inlineBubble.expand")}
						onClick={act(() => setFoldOpen(editor.view, { ...region, open }, !open))}
					>
						{open ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
					</BubbleButton>
				)}
				<BubbleButton
					label={t("inlineBubble.ruleExpand")}
					onClick={act(() => expandRule(editor.view, blockPos, rule.id))}
				>
					{t("inlineBubble.ruleExpandShort")}
				</BubbleButton>
				<BubbleButton
					label={t("inlineBubble.ruleDelete")}
					tone="danger"
					onClick={act(() => removeRule(editor.view, blockPos, rule.id))}
				>
					<Trash2 aria-hidden />
				</BubbleButton>
			</Inline>
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
			<Inline key={group.key} gap="hair">
				{index > 0 && <Separator orientation="vertical" length="control" />}
				{group}
			</Inline>
		));
	};

	const renderFootnote = (target: Extract<InlineBubbleTarget, { kind: "footnote" }>) => (
		<Inline gap="tight">
			<Badge variant="secondary">{target.badge}</Badge>
			<Box as="span" paddingX="tight" maxWidth="panel-sm" minWidth={0}>
				<Text as="div" variant="caption" truncate>
					<TextLink
						render={<button type="button" />}
						underline="hover"
						tone="muted"
						onClick={() => setPanel({ kind: "footnote", target })}
						title={target.defText || t("inlineBubble.footnoteEmpty")}
					>
						{target.defText || t("inlineBubble.footnoteEmpty")}
					</TextLink>
				</Text>
			</Box>
			<BubbleButton label={t("inlineBubble.footnoteEdit")} onClick={() => setPanel({ kind: "footnote", target })}>
				<Pencil aria-hidden />
			</BubbleButton>
			<BubbleButton
				label={t("inlineBubble.footnoteRemove")}
				onClick={act(() => {
					removeFootnote(editor, target);
				})}
			>
				<X aria-hidden />
			</BubbleButton>
		</Inline>
	);

	// In a code block, only the effects it accepts (bold, italic, strikethrough, underline, tooltip) and text folding are shown. Extension buttons hide themselves.
	// A text style the body's allowed list does not allow gets no button, but one already in the text still shows its details above.
	const bubbleTools = (group: "format" | "link") =>
		markExtensions
			.filter(({ name }) => allowance.allowsEditorMark(name))
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
					<Separator orientation="vertical" length="control" />
				</>
			)}
			{allowedMarkTools(site, editor.state).map((item) => (
				<ToolbarButton key={item.mark} editor={editor} item={item} tooltipSide="top" />
			))}
			{bubbleTools("format").map(renderTool)}
			<Separator orientation="vertical" length="control" />
			{inCode &&
				allowsMark(editor.state, CODE_TOOLTIP_MARK_NAME) &&
				offersMarkTool(site, editor.state, CODE_TOOLTIP_MARK_NAME) && (
					<BubbleButton
						label={
							editor.isActive(CODE_TOOLTIP_MARK_NAME) ? t("inlineBubble.tooltipEdit") : t("inlineBubble.tooltipAdd")
						}
						onClick={() => openCodeTooltip()}
					>
						<MessageSquareMore aria-hidden />
					</BubbleButton>
				)}
			{linkTools.filter(({ bubble }) => (bubble.order ?? 1) < 0).map(renderTool)}
			{allowsMark(editor.state, "link") && !inCode && allowance.allowsMark("link") && (
				<BubbleButton
					label={editor.isActive("link") ? t("link.edit") : t("link.add")}
					onClick={() => openLink(linkDraftFromSelection(editor))}
				>
					<Link2 aria-hidden />
				</BubbleButton>
			)}
			{linkTools.filter(({ bubble }) => (bubble.order ?? 1) >= 0).map(renderTool)}
			{inCode && allowsMark(editor.state, "codeFold") && offersMarkTool(site, editor.state, "codeFold") && (
				<BubbleButton
					label={t("inlineBubble.fold")}
					pressed={editor.isActive("codeFold")}
					onClick={() => editor.chain().focus().toggleMark("codeFold").run()}
				>
					<ChevronsLeftRightEllipsis aria-hidden />
				</BubbleButton>
			)}
		</>
	);

	const style = { position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 40 } as const;
	const surface = "rounded-monti-md border bg-monti-page text-monti-default backdrop-blur";

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
							: panel.kind === "footnote"
								? t("inlineBubble.footnotePanel")
								: panel.panel.label
				}
				data-monti-inline-bubble
				style={style}
				className={cn(
					surface,
					"flex flex-col gap-monti-12 p-monti-12 text-monti-caption",
					panel.kind === "extension" && panel.panel.size === "auto" ? "w-auto p-monti-8" : "w-80",
				)}
				onKeyDown={(event) => {
					if (event.key === "Escape" && !isComposingKey(event)) {
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
						labels={CODE_TOOLTIP_LABELS(t)}
						active={panel.active}
						initial={panel.initial}
						range={panel.range}
						onDone={closePanel}
					/>
				) : panel.kind === "footnote" ? (
					<FootnoteForm editor={editor} target={panel.target} onDone={closePanel} />
				) : (
					panel.panel.content
				)}
			</div>
		) : (
			<div
				ref={bubbleRef}
				role="toolbar"
				aria-label={
					target.kind === "selection"
						? t("inlineBubble.selectionLabel")
						: target.kind === "footnote"
							? t("inlineBubble.footnoteTitle")
							: t("inlineBubble.effectLabel")
				}
				data-monti-inline-bubble
				style={style}
				className={BLOCK_TOOLBAR}
			>
				{target.kind === "selection"
					? renderSelectionTools()
					: target.kind === "footnote"
						? renderFootnote(target)
						: renderMarks(target.marks, target.rules)}
			</div>
		),
		document.body,
	);
}
