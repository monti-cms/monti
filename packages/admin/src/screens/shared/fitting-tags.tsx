"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Text } from "@monti-cms/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { sharedMessages } from "./messages";

const GAP = 4;
// design-system: needs a measured chip-list part (chips that fit their cell, with a +N rest); it reads the width of its own elements, so it keeps raw elements
const CHIP = "shrink-0 rounded-sm border border-monti-muted px-condensed py-px text-monti-caption text-monti-muted";

/**
 * Shows as many tags as fit the cell width and shortens the rest to `+N`. Remeasures when the column width changes.
 * Draws all tags and the longest `+N` in an invisible measuring row and measures the width. If none fit, the first tag is truncated with an ellipsis.
 */
export function FittingTags({ tags }: { tags: readonly { id: string; title: string }[] }) {
	const t = useTranslator(sharedMessages);
	const boxRef = useRef<HTMLSpanElement | null>(null);
	const measureRef = useRef<HTMLSpanElement | null>(null);
	const [shown, setShown] = useState(tags.length);
	const key = tags.map((tag) => tag.id).join();

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for the contents of the tag list
	useLayoutEffect(() => {
		const box = boxRef.current;
		const measure = measureRef.current;
		if (!box || !measure) return;
		const measureFit = () => {
			const width = box.clientWidth;
			const chips = [...measure.children] as HTMLElement[];
			const plus = chips.pop()?.offsetWidth ?? 0;
			const widths = chips.map((chip) => chip.offsetWidth);
			const total = widths.reduce((sum, chipWidth, index) => sum + chipWidth + (index > 0 ? GAP : 0), 0);
			if (width === 0 || total <= width) {
				setShown(widths.length);
				return;
			}
			let used = 0;
			let count = 0;
			for (const chipWidth of widths) {
				const next = used + (count > 0 ? GAP : 0) + chipWidth;
				if (next + GAP + plus > width) break;
				used = next;
				count += 1;
			}
			setShown(Math.max(1, count));
		};
		measureFit();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measureFit);
		observer.observe(box);
		return () => observer.disconnect();
	}, [key]);

	const hidden = tags.length - shown;
	return (
		// design-system: needs a measured chip-list part (see CHIP)
		<span
			ref={boxRef}
			className="relative flex min-w-0 items-center gap-tight overflow-hidden whitespace-nowrap"
			title={tags.map((tag) => tag.title).join(", ")}
		>
			{tags.slice(0, shown).map((tag, index) => (
				<span key={tag.id} className={index === 0 && hidden > 0 ? `${CHIP} min-w-0 shrink truncate` : CHIP}>
					{tag.title}
				</span>
			))}
			{hidden > 0 && (
				<Text variant="caption" tone="muted">
					<span aria-hidden>+{hidden}</span>
					<Text srOnly>{t("tags.more", { count: hidden })}</Text>
				</Text>
			)}
			{/* design-system: needs a measured chip-list part (see CHIP) */}
			<span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex gap-tight">
				{tags.map((tag) => (
					<span key={tag.id} className={CHIP}>
						{tag.title}
					</span>
				))}
				<Text variant="caption">+{tags.length}</Text>
			</span>
		</span>
	);
}
