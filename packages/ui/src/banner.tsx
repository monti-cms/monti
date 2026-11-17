"use client";

import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";
import { CutWords } from "./cut-words";

/**
 * A one-line notice across the very top of a screen, over its header, for something the writer should know about the whole page ("The Korean source
 * changed"): cream background and one rule below. Where it stands is not its own: a screen gives it to the top place (`PageBanner`, or the `banner`
 * of `SidebarInset` and `StandalonePage`). A 6px dot leads the sentence, 8px before its words. `tone="warning"` (the default) sets the sentence in the warning text color and the dot in the
 * warning mark color; `tone="danger"` is for something that failed (a delivery, a save) and makes both red; `tone="neutral"` is a state that is neither (an
 * entry in the trash): both are subtle, and `meta` is a plain sentence (`plainMeta` makes it one on any tone: "This post can't be saved"). `title` is the sentence, `meta` the small detail after it in mono. Nothing wraps: on a short line the detail is cut with "…" first, then the sentence; cut words say themselves whole to a pointer on them, and to the keyboard, which stops on them while they are cut (`CutWords`); the actions are never cut; `children`
 * are what can be done about it, at the right end (text buttons: the one that goes there underlined, then the one that dismisses).
 *
 * How it is said aloud: its own box is no live region (`role="note"`). A screen reader reads what changes in a live region, and whether it
 * reads a region that comes into the page with its words already in it differs by reader. So the region is the top place the banner stands
 * in (`PageBannerPlace`), which is in the page, empty, from the start: a banner drawn into it is an addition to it, and is read. A banner
 * drawn outside a top place (a part's story) is not announced.
 */
function Banner({
	title,
	meta,
	plainMeta,
	tone = "warning",
	className,
	children,
	ref,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	/** The sentence. A banner always has one. */
	title: React.ReactNode;
	meta?: React.ReactNode;
	/** The detail is a plain sentence in the subtle ink, not a small mono one (a date, a count). On by default for `neutral`. */
	plainMeta?: boolean;
	/** `warning` for something to know, `danger` for something that failed, `neutral` for a state that is neither. */
	tone?: "warning" | "danger" | "neutral";
}) {
	const ink = tone === "danger" ? "text-monti-danger" : tone === "neutral" ? "text-monti-subtle" : "text-monti-warning";
	const dot = (
		<span
			aria-hidden="true"
			data-slot="banner-dot"
			className={cn(
				"size-1.5 shrink-0 rounded-monti-full",
				tone === "danger" ? "bg-(--monti-fg-danger)" : tone === "neutral" ? "bg-current" : "bg-monti-warning-emphasis",
			)}
		/>
	);
	return (
		<div
			data-slot="banner"
			data-tone={tone}
			// A note of the page, found by its role. Not a live region: the top place around it is.
			role="note"
			ref={ref}
			className={cn(
				"flex items-center gap-monti-16 border-monti-default border-b bg-monti-tool px-monti-24 py-monti-10 text-monti-note",
				className,
			)}
			{...props}
		>
			<span className={cn("inline-flex min-w-0 items-center gap-monti-8 font-semibold", ink)}>
				{dot}
				{/* A sentence longer than the line ends in "…"; while it is cut it says itself whole, and the Tab key stops on it. */}
				<CutWords stop render={<span data-slot="banner-title" className="min-w-0 truncate" />}>
					{title}
				</CutWords>
			</span>
			{meta && (
				<CutWords
					stop
					render={
						(plainMeta ?? tone === "neutral") ? (
							<span data-slot="banner-meta" className="min-w-0 shrink-[999] truncate text-monti-subtle" />
						) : (
							<Count data-slot="banner-meta" className="min-w-0 shrink-[999] truncate" />
						)
					}
				>
					{meta}
				</CutWords>
			)}
			{children && (
				<span className="ml-auto flex shrink-0 items-center gap-monti-16 whitespace-nowrap">{children}</span>
			)}
		</div>
	);
}

export { Banner };
