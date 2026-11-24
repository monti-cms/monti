"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type * as React from "react";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { Close } from "./icons";

/**
 * A filter that is on, in a filter row (the media library's head row) where its name stood: a 24px chip on the selected ground, its left edge on the
 * start line where the name started (nothing sticks out of it, 2026-11-24). 글자는 8px 안에서 시작하고, `named`면 흐린 조건 이름("종류 · 이미지": 조건을
 * 말하지 않는 값) 아니면 값만, 그 뒤에 잉크 점(목록 열 머리의 칩과 같이 값 뒤, 2026-11-24), 끝에 지우는 ×(`clearLabel`). The chip itself opens the
 * condition's menu: `render` on the trigger, `<DropdownMenuTrigger render={<FilterChip … />}>`, takes the chip's main part. The same look as a list's
 * filtered column head (`ListHeadColumn` `filter`).
 */
function FilterChip({
	name,
	value,
	named = false,
	clearLabel,
	onClear,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "value" | "name"> & {
	/** The condition ("종류"). Read by screen readers even when it is not shown. */
	name: string;
	/** What it is set to ("이미지"). */
	value: React.ReactNode;
	/** Shows the condition's name before the value. */
	named?: boolean;
	clearLabel: string;
	onClear?: () => void;
}) {
	return (
		<span
			data-slot="filter-chip"
			className="inline-flex h-monti-control-xs min-w-0 max-w-full shrink-0 items-center rounded-monti-md bg-monti-selected pr-[2px] font-medium text-monti-caption text-monti-default"
		>
			<ButtonPrimitive
				type="button"
				className={cn(
					"inline-flex h-full min-w-0 cursor-pointer items-center gap-monti-6 rounded-monti-md border-0 bg-transparent p-0 pl-monti-8 text-inherit outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/60",
					className,
				)}
				{...props}
			>
				{named ? (
					<span className="shrink-0 font-normal text-monti-subtle">
						{name}
						<span className="text-monti-faint"> ·</span>
					</span>
				) : (
					<span className="sr-only">{name}</span>
				)}
				<CutWords className="truncate">{value}</CutWords>
				{/* 점은 값 뒤에, 목록 열 머리의 칩과 같다(2026-11-24). */}
				<span aria-hidden className="size-[6px] shrink-0 rounded-monti-full bg-monti-emphasis" />
			</ButtonPrimitive>
			<button
				type="button"
				aria-label={clearLabel}
				onClick={onClear}
				className="ml-monti-6 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-monti-sm border-0 bg-transparent p-0 text-monti-subtle outline-none hover:bg-monti-current hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60 [&_svg]:size-3"
			>
				<Close aria-hidden />
			</button>
		</span>
	);
}

export { FilterChip };
