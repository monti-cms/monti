"use client";

import { createTranslator } from "@monti-cms/core/client";
import {
	CODE_LINE_EFFECTS,
	COLLAPSE,
	type CodeLineEffect,
	canAddCollapse,
	hasLineEffect,
	newEffectId,
	setLineEffect,
} from "@monti-cms/core/code-block";
import { Check, ChevronsDownUp, ChevronsUpDown, Code2, Eye, Highlighter } from "lucide-react";
import { type CSSProperties, useEffect, useRef } from "react";
import { cn } from "../../lib/utils/cn";
import { useIconByName } from "../../screens/shared/collection-icon";
import { codeBlockMessages } from "./messages";

const t = createTranslator(codeBlockMessages);

interface LineMenuProps {
	/** The picked lines [start, end). */
	start: number;
	end: number;
	lineEffects: CodeLineEffect[];
	onChange: (next: CodeLineEffect[]) => void;
	onClose: () => void;
	/** Starts linking this line to body text (lets the user drag-select the body). */
	onLinkText?: () => void;
	style?: CSSProperties;
}

const ITEM_CLASS =
	"flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-cms-accent disabled:pointer-events-none disabled:opacity-50";

interface ItemProps {
	disabled?: boolean;
	title?: string;
	onSelect: () => void;
	children: React.ReactNode;
}

function MenuItem({ disabled, title, onSelect, children }: ItemProps) {
	return (
		<button
			type="button"
			role="menuitem"
			disabled={disabled}
			title={title}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onSelect}
			className={ITEM_CLASS}
		>
			{children}
		</button>
	);
}

function CheckItem({ checked, onSelect, children }: ItemProps & { checked: boolean }) {
	return (
		<button
			type="button"
			role="menuitemcheckbox"
			aria-checked={checked}
			onMouseDown={(event) => event.preventDefault()}
			onClick={onSelect}
			className={ITEM_CLASS}
		>
			{children}
			<Check aria-hidden className={cn("ml-auto size-3.5", !checked && "invisible")} />
		</button>
	);
}

/** Menu that turns line effects (the effects and folds from the definition list) on and off for the lines picked in the line number gutter. Names and icons come from the effect definitions. */
export function LineMenu({ start, end, lineEffects, onChange, onClose, onLinkText, style }: LineMenuProps) {
	const ref = useRef<HTMLDivElement>(null);
	const iconByName = useIconByName();
	// A fold equal to the picked range, or, when only one line is picked, a fold starting at that line (the first line with the › marker) (outermost first).
	const startingHere = lineEffects
		.filter((effect) => effect.name === COLLAPSE && effect.start === start)
		.sort((a, b) => b.end - a.end);
	const collapse =
		startingHere.find((effect) => effect.end === end) ?? (end - start === 1 ? startingHere[0] : undefined);
	const collapseProblem = collapse ? null : canAddCollapse(lineEffects, start, end);

	useEffect(() => {
		const onDown = (event: MouseEvent) => {
			if (event.target instanceof Node && !ref.current?.contains(event.target)) onClose();
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [onClose]);

	const setCollapseOpen = (open: boolean) =>
		onChange(
			lineEffects.map((effect) =>
				effect === collapse ? { ...effect, attrs: { ...effect.attrs, open: open || undefined } } : effect,
			),
		);

	return (
		<div
			ref={ref}
			role="menu"
			aria-label={
				start + 1 === end
					? t("lineMenu.lineEffects", { line: start + 1 })
					: t("lineMenu.rangeEffects", { start: start + 1, end })
			}
			data-code-ui=""
			contentEditable={false}
			style={style}
			className="absolute z-20 flex w-44 flex-col gap-0.5 rounded-md border bg-cms-popover p-1 font-sans text-cms-popover-foreground shadow-md"
		>
			{CODE_LINE_EFFECTS.map((effect) => {
				const active = hasLineEffect(lineEffects, effect.name, start, end);
				const Icon = iconByName(effect.icon) ?? Highlighter;
				return (
					<CheckItem
						key={effect.name}
						checked={active}
						onSelect={() => onChange(setLineEffect(lineEffects, effect.name, start, end, !active))}
					>
						<Icon aria-hidden className="size-3.5" />
						{effect.label}
					</CheckItem>
				);
			})}
			<div aria-hidden className="my-0.5 h-px bg-cms-border" />
			{collapse ? (
				<>
					<MenuItem onSelect={() => onChange(lineEffects.filter((effect) => effect !== collapse))}>
						<ChevronsUpDown aria-hidden className="size-3.5" />
						{t("lineMenu.uncollapse")}
						<span className="ml-auto text-cms-muted-foreground">
							{t("lineMenu.collapsedRange", { start: collapse.start + 1, end: collapse.end })}
						</span>
					</MenuItem>
					<CheckItem
						checked={collapse.attrs.open === true}
						onSelect={() => setCollapseOpen(collapse.attrs.open !== true)}
					>
						<Eye aria-hidden className="size-3.5" />
						{t("lineMenu.openFromStart")}
					</CheckItem>
				</>
			) : (
				<MenuItem
					disabled={!!collapseProblem}
					title={collapseProblem ?? undefined}
					onSelect={() =>
						onChange(
							[...lineEffects, { id: newEffectId(), name: COLLAPSE, start, end, attrs: {} } as CodeLineEffect].sort(
								(a, b) => a.start - b.start || b.end - a.end,
							),
						)
					}
				>
					<ChevronsDownUp aria-hidden className="size-3.5" />
					{t("lineMenu.collapse")}
				</MenuItem>
			)}
			{onLinkText && (
				<>
					<div aria-hidden className="my-0.5 h-px bg-cms-border" />
					<MenuItem onSelect={onLinkText}>
						<Code2 aria-hidden className="size-3.5" />
						{t("lineMenu.linkText")}
					</MenuItem>
				</>
			)}
		</div>
	);
}
