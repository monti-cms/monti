"use client";

import { ChevronSort, Code, CollapseAll, TextHighlight, View } from "@carbon/icons-react";
import {
	COLLAPSE,
	type CodeLineEffect,
	canAddCollapse,
	hasLineEffect,
	newEffectId,
	setLineEffect,
} from "@monti-cms/core/code-block";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	MenuShortcut,
} from "@monti-cms/ui";
import { useIconByName } from "../../screens/shared/collection-icon";
import { codeBlockMessages } from "./messages";

interface LineMenuProps {
	/** The picked lines [start, end). */
	start: number;
	end: number;
	lineEffects: CodeLineEffect[];
	onChange: (next: CodeLineEffect[]) => void;
	onClose: () => void;
	/** Starts linking this line to body text (lets the user drag-select the body). */
	onLinkText?: () => void;
	/** Where the menu opens: the clicked point, or the end of the picked line (viewport pixels, read each time the menu is placed). */
	anchor: () => DOMRect;
	/** `end` when the anchor is the line's right end, so the card ends there. */
	align?: "start" | "end";
}

/**
 * Line effects the menu lists for the picked lines [start, end): the offered ones (`site.OFFERED_LINE_EFFECTS`) plus any omitted one
 * that is already on those lines, so it stays visible and can be turned off. Definition order.
 */
export function lineEffectsToList(site: Site, lineEffects: readonly CodeLineEffect[], start: number, end: number) {
	return site.CODE_LINE_EFFECTS.filter(
		(effect) =>
			site.OFFERED_LINE_EFFECTS.some((offered) => offered.name === effect.name) ||
			lineEffects.some((item) => item.name === effect.name && item.start < end && item.end > start),
	);
}

/** Whether the line menu has anything to show for the picked lines (an offered effect, folding, linking to body text, or an existing effect to turn off). */
export function lineMenuAvailable(
	site: Site,
	lineEffects: readonly CodeLineEffect[],
	start: number,
	end: number,
	canLink: boolean,
) {
	return (
		canLink ||
		site.CODE_BLOCK_FEATURES.fold ||
		lineEffectsToList(site, lineEffects, start, end).length > 0 ||
		lineEffects.some((effect) => effect.name === COLLAPSE && effect.start < end && effect.end > start)
	);
}

/** Menu that turns line effects (the effects and folds from the definition list) on and off for the lines picked in the line number gutter. Names and icons come from the effect definitions. */
export function LineMenu({
	start,
	end,
	lineEffects,
	onChange,
	onClose,
	onLinkText,
	anchor,
	align = "start",
}: LineMenuProps) {
	const site = useSite();
	const t = useTranslator(codeBlockMessages);
	const iconByName = useIconByName();
	// A fold equal to the picked range, or, when only one line is picked, a fold starting at that line (the first line with the › marker) (outermost first).
	const startingHere = lineEffects
		.filter((effect) => effect.name === COLLAPSE && effect.start === start)
		.sort((a, b) => b.end - a.end);
	const collapse =
		startingHere.find((effect) => effect.end === end) ?? (end - start === 1 ? startingHere[0] : undefined);
	// A fold that cannot be added here (it would cross another) is not offered.
	const canCollapse = !collapse && site.CODE_BLOCK_FEATURES.fold && !canAddCollapse(lineEffects, start, end);
	const listed = lineEffectsToList(site, lineEffects, start, end);
	const showFold = !!collapse || canCollapse;

	const setCollapseOpen = (open: boolean) =>
		onChange(
			lineEffects.map((effect) =>
				effect === collapse ? { ...effect, attrs: { ...effect.attrs, open: open || undefined } } : effect,
			),
		);

	return (
		<DropdownMenu open onOpenChange={(open) => !open && onClose()}>
			<DropdownMenuContent
				anchor={{ getBoundingClientRect: anchor }}
				align={align}
				aria-label={
					start + 1 === end
						? t("lineMenu.lineEffects", { line: start + 1 })
						: t("lineMenu.rangeEffects", { start: start + 1, end })
				}
			>
				{listed.map((effect) => {
					const active = hasLineEffect(lineEffects, effect.name, start, end);
					const Icon = iconByName(effect.icon) ?? TextHighlight;
					return (
						<DropdownMenuCheckboxItem
							key={effect.name}
							checked={active}
							onCheckedChange={() => onChange(setLineEffect(lineEffects, effect.name, start, end, !active))}
						>
							<Icon aria-hidden />
							{effect.label}
						</DropdownMenuCheckboxItem>
					);
				})}
				{listed.length > 0 && showFold && <DropdownMenuSeparator />}
				{collapse ? (
					<>
						<DropdownMenuItem onClick={() => onChange(lineEffects.filter((effect) => effect !== collapse))}>
							<ChevronSort aria-hidden />
							{t("lineMenu.uncollapse")}
							<MenuShortcut>
								{t("lineMenu.collapsedRange", { start: collapse.start + 1, end: collapse.end })}
							</MenuShortcut>
						</DropdownMenuItem>
						<DropdownMenuCheckboxItem
							checked={collapse.attrs.open === true}
							onCheckedChange={() => setCollapseOpen(collapse.attrs.open !== true)}
						>
							<View aria-hidden />
							{t("lineMenu.openFromStart")}
						</DropdownMenuCheckboxItem>
					</>
				) : canCollapse ? (
					<DropdownMenuItem
						onClick={() =>
							onChange(
								[...lineEffects, { id: newEffectId(), name: COLLAPSE, start, end, attrs: {} } as CodeLineEffect].sort(
									(a, b) => a.start - b.start || b.end - a.end,
								),
							)
						}
					>
						<CollapseAll aria-hidden />
						{t("lineMenu.collapse")}
					</DropdownMenuItem>
				) : null}
				{onLinkText && (
					<>
						{(listed.length > 0 || showFold) && <DropdownMenuSeparator />}
						<DropdownMenuItem onClick={onLinkText}>
							<Code aria-hidden />
							{t("lineMenu.linkText")}
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
