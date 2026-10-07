"use client";

import { useTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Check, MoreHorizontal } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { editorMessages } from "./messages";
import type { ToolbarItem } from "./toolbar-button";
import { type FitItem, fitSlots, layoutKeys } from "./toolbar-fit";

/** One tool. When narrow, tools with the largest `priority` move into the "More" menu (`menu`) first. */
export interface ToolbarSlot {
	key: string;
	priority: number;
	/** A tool that cannot live inside a menu, like a popover. Never hidden. */
	fixed?: boolean;
	render: () => ReactNode;
	/** How it looks inside the "More" menu. Not needed for pinned tools. */
	menu?: () => ReactNode;
}

export type ToolbarEntry = ToolbarSlot | { key: string; divider: true };

const isDivider = (entry: ToolbarEntry): entry is { key: string; divider: true } => "divider" in entry;

/** Gap between toolbar items (gap-1) and the width of the "More" button (size-8). */
const GAP = 4;
const OVERFLOW_WIDTH = 32;
const END_KEY = "end";

export function ToolbarDivider() {
	return <span aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-cms-border" />;
}

/** One tool row in a dropdown or the "More" menu. */
export function ToolbarMenuItem({ editor, item }: { editor: Editor; item: ToolbarItem }) {
	const active = item.isActive?.(editor) ?? false;
	return (
		<DropdownMenuItem
			disabled={!editor.isEditable || (item.isDisabled?.(editor) ?? false)}
			onClick={() => item.run(editor)}
		>
			<item.icon aria-hidden className="size-4" />
			<span className="flex-1">{item.title ?? item.label}</span>
			{active && <Check aria-hidden className="size-4" />}
		</DropdownMenuItem>
	);
}

/**
 * A group inside the "More" menu. A divider goes above it unless it is first in the menu.
 * No heading is used (the item icon and name make it clear). `label` is the group name (for screen readers).
 */
export function ToolbarMenuSection({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<DropdownMenuSeparator className="first:hidden" />
			<DropdownMenuGroup aria-label={label}>{children}</DropdownMenuGroup>
		</>
	);
}

/** A dropdown group expanded inside the "More" menu. */
export function ToolbarMenuGroup({ editor, label, items }: { editor: Editor; label: string; items: ToolbarItem[] }) {
	return (
		<ToolbarMenuSection label={label}>
			{items.map((item) => (
				<ToolbarMenuItem key={item.label} editor={editor} item={item} />
			))}
		</ToolbarMenuSection>
	);
}

function OverflowMenu({ editor, children }: { editor: Editor; children: ReactNode }) {
	const t = useTranslator(editorMessages);
	return (
		<DropdownMenu>
			<IconButton
				label={t("toolbarRow.more")}
				side="bottom"
				className="shrink-0"
				disabled={!editor.isEditable}
				onMouseDown={(event) => event.preventDefault()}
				trigger={(button) => <DropdownMenuTrigger render={button} />}
			>
				<MoreHorizontal className="size-4" aria-hidden />
			</IconButton>
			<DropdownMenuContent align="end" className="min-w-44">
				{children}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const sameKeys = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((key, i) => key === b[i]);

/**
 * A one-row tool group. When width runs short, lower-priority tools move to the trailing "More" menu.
 * Every tool is rendered once in an invisible row to measure widths, then the tools to show are chosen to fit the real row's available width.
 * Pinned tools such as popovers must not be rendered twice, so their width is measured in the real row.
 */
export function ToolbarRow({ editor, entries, end }: { editor: Editor; entries: ToolbarEntry[]; end?: ReactNode }) {
	const areaRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const rowRef = useRef<HTMLDivElement>(null);
	const [hidden, setHidden] = useState<readonly string[]>([]);
	const hasEnd = !!end;

	const recompute = useCallback(() => {
		const area = areaRef.current;
		if (!area) return;
		// With no layout (before the first paint, jsdom) everything is shown.
		const available = area.clientWidth;
		if (!available) return;
		const widths = new Map<string, number>();
		const read = (root: HTMLElement | null, attr: string) => {
			for (const element of root?.querySelectorAll<HTMLElement>(`[${attr}]`) ?? []) {
				widths.set(element.getAttribute(attr) ?? "", Math.ceil(element.getBoundingClientRect().width));
			}
		};
		read(measureRef.current, "data-measure-key");
		read(rowRef.current, "data-slot-key");

		const items: FitItem[] = entries.map((entry) =>
			isDivider(entry)
				? { key: entry.key, priority: 0, width: widths.get(entry.key) ?? 0, divider: true }
				: { key: entry.key, priority: entry.priority, fixed: entry.fixed, width: widths.get(entry.key) ?? 0 },
		);
		if (hasEnd) items.push({ key: END_KEY, priority: 0, fixed: true, width: widths.get(END_KEY) ?? 0 });
		const visible = fitSlots(items, available, OVERFLOW_WIDTH, GAP);
		const next = entries.filter((entry) => !isDivider(entry) && !visible.has(entry.key)).map((entry) => entry.key);
		setHidden((previous) => (sameKeys(previous, next) ? previous : next));
	}, [entries, hasEnd]);
	const recomputeRef = useRef(recompute);
	recomputeRef.current = recompute;

	// Re-measure on every render. If the visible tools stay the same, state is not changed, so there is no re-render.
	useLayoutEffect(() => {
		recompute();
	});

	useEffect(() => {
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => recomputeRef.current());
		if (areaRef.current) observer.observe(areaRef.current);
		if (measureRef.current) observer.observe(measureRef.current);
		return () => observer.disconnect();
	}, []);

	const hiddenSet = new Set(hidden);
	const slots = entries.filter((entry): entry is ToolbarSlot => !isDivider(entry));
	const visible = new Set(slots.filter((slot) => !hiddenSet.has(slot.key)).map((slot) => slot.key));
	const shown = new Set(
		layoutKeys(
			entries.map((entry) => ({ key: entry.key, priority: 0, width: 0, divider: isDivider(entry) })),
			visible,
		),
	);
	const hiddenSlots = slots.filter((slot) => hiddenSet.has(slot.key));

	return (
		<div ref={areaRef} className="relative min-w-0 flex-1">
			{/* For measuring widths. Render every tool once and keep it invisible (confined to height 0 so it does not widen the scroll width). */}
			<div aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
				<div ref={measureRef} className="flex w-max items-center gap-1">
					{entries.map((entry) =>
						isDivider(entry) ? (
							<div key={entry.key} data-measure-key={entry.key} className="flex shrink-0 items-center">
								<ToolbarDivider />
							</div>
						) : entry.fixed ? null : (
							<div key={entry.key} data-measure-key={entry.key} className="flex shrink-0 items-center">
								{entry.render()}
							</div>
						),
					)}
				</div>
			</div>
			<div ref={rowRef} className="flex flex-nowrap items-center justify-center gap-1">
				{entries.map((entry) => {
					if (!shown.has(entry.key)) return null;
					if (isDivider(entry)) return <ToolbarDivider key={entry.key} />;
					return (
						<div
							key={entry.key}
							data-slot-key={entry.fixed ? entry.key : undefined}
							className="flex shrink-0 items-center"
						>
							{entry.render()}
						</div>
					);
				})}
				{hiddenSlots.length > 0 && (
					<OverflowMenu editor={editor}>
						{hiddenSlots.map((slot) => (
							<Fragment key={slot.key}>{slot.menu?.()}</Fragment>
						))}
					</OverflowMenu>
				)}
				{end && (
					<div data-slot-key={END_KEY} className="flex shrink-0 items-center">
						{end}
					</div>
				)}
			</div>
		</div>
	);
}
