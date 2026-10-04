"use client";

import { createTranslator } from "@monti-cms/core/client";
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

const t = createTranslator(editorMessages);

/** 도구 하나. 좁으면 `priority`가 큰 것부터 "더보기" 메뉴(`menu`)로 들어간다. */
export interface ToolbarSlot {
	key: string;
	priority: number;
	/** 팝오버처럼 메뉴 안에 둘 수 없는 도구. 숨기지 않는다. */
	fixed?: boolean;
	render: () => ReactNode;
	/** "더보기" 메뉴 안에서의 모습. 고정 도구는 필요 없다. */
	menu?: () => ReactNode;
}

export type ToolbarEntry = ToolbarSlot | { key: string; divider: true };

const isDivider = (entry: ToolbarEntry): entry is { key: string; divider: true } => "divider" in entry;

/** 툴바 항목 사이 간격(gap-1)과 "더보기" 버튼 폭(size-8). */
const GAP = 4;
const OVERFLOW_WIDTH = 32;
const END_KEY = "end";

export function ToolbarDivider() {
	return <span aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-cms-border" />;
}

/** 드롭다운·"더보기" 메뉴의 도구 한 줄. */
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
 * "더보기" 메뉴 안의 한 묶음. 메뉴 맨 앞이 아니면 위에 구분선을 둔다.
 * 머리글은 두지 않는다(항목 아이콘과 이름으로 알 수 있다). `label`은 묶음 이름(스크린 리더)이다.
 */
export function ToolbarMenuSection({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<DropdownMenuSeparator className="first:hidden" />
			<DropdownMenuGroup aria-label={label}>{children}</DropdownMenuGroup>
		</>
	);
}

/** "더보기" 메뉴 안에서 드롭다운 묶음을 펼친 모습. */
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
 * 한 줄 도구 묶음. 폭이 모자라면 우선순위가 낮은 도구를 뒤쪽 "더보기" 메뉴로 옮긴다.
 * 모든 도구를 보이지 않는 줄에 한 번씩 그려 폭을 재고, 실제 줄의 가용 폭에 맞춰 보일 도구를 정한다.
 * 팝오버 같은 고정 도구는 두 벌 그리면 안 되므로 실제 줄에서 폭을 잰다.
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
		// 레이아웃이 없으면(첫 그림 전, jsdom) 전부 보인다.
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

	// 그릴 때마다 다시 잰다. 보일 도구가 그대로면 상태를 바꾸지 않으므로 다시 그리지 않는다.
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
			{/* 폭 재기용. 모든 도구를 한 번씩 그리고 보이지 않게 둔다(높이 0에 가둬 스크롤 폭을 늘리지 않는다). */}
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
