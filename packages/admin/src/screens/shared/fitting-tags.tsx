"use client";

import { createTranslator } from "@monti-cms/core/client";
import { useLayoutEffect, useRef, useState } from "react";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

const GAP = 4;
const CHIP = "shrink-0 rounded bg-cms-muted px-1.5 py-0.5 text-cms-muted-foreground text-xs";

/**
 * 칸 폭에 들어가는 만큼 태그를 보여 주고, 나머지는 `+N`으로 줄인다. 열 너비를 바꾸면 다시 잰다.
 * 보이지 않는 측정 줄에 모든 태그와 가장 긴 `+N`을 그려 두고 폭을 잰다. 하나도 안 들어가면 첫 태그를 말줄임한다.
 */
export function FittingTags({ tags }: { tags: readonly { id: string; title: string }[] }) {
	const boxRef = useRef<HTMLSpanElement | null>(null);
	const measureRef = useRef<HTMLSpanElement | null>(null);
	const [shown, setShown] = useState(tags.length);
	const key = tags.map((tag) => tag.id).join();

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key`가 태그 목록의 내용을 대신한다
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
		<span
			ref={boxRef}
			className="relative flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap"
			title={tags.map((tag) => tag.title).join(", ")}
		>
			{tags.slice(0, shown).map((tag, index) => (
				<span key={tag.id} className={index === 0 && hidden > 0 ? `${CHIP} min-w-0 shrink truncate` : CHIP}>
					{tag.title}
				</span>
			))}
			{hidden > 0 && (
				<span className="shrink-0 text-cms-muted-foreground text-xs">
					<span aria-hidden>+{hidden}</span>
					<span className="sr-only">{t("tags.more", { count: hidden })}</span>
				</span>
			)}
			<span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex gap-1">
				{tags.map((tag) => (
					<span key={tag.id} className={CHIP}>
						{tag.title}
					</span>
				))}
				<span className="text-xs">+{tags.length}</span>
			</span>
		</span>
	);
}
