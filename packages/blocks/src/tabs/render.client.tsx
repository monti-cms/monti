"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

/**
 * 탭 묶음의 전환 부분. 탭 이름 줄(`tablist`)과 탭마다의 본문(`tabpanel`)을 그린다. 본문은 서버가 그려 넘기므로 여기서는
 * 보이는 탭만 바꾼다(나머지는 `hidden`). 화살표·Home·End로 탭을 옮기고, 고른 탭만 Tab 키로 닿는다.
 */
export function TabsView({
	labels,
	panels,
	defaultIndex = 0,
}: {
	readonly labels: readonly string[];
	readonly panels: readonly ReactNode[];
	readonly defaultIndex?: number;
}) {
	const id = useId();
	const [active, setActive] = useState(defaultIndex);
	const buttons = useRef<(HTMLButtonElement | null)[]>([]);

	const select = (index: number) => {
		const next = (index + labels.length) % labels.length;
		setActive(next);
		buttons.current[next]?.focus();
	};

	const onKeyDown = (event: KeyboardEvent, index: number) => {
		const target = {
			ArrowRight: index + 1,
			ArrowDown: index + 1,
			ArrowLeft: index - 1,
			ArrowUp: index - 1,
			Home: 0,
			End: labels.length - 1,
		}[event.key];
		if (target === undefined) return;
		event.preventDefault();
		select(target);
	};

	return (
		<div className="cms-block-tabs">
			<div className="cms-block-tabs-list" role="tablist" aria-orientation="horizontal">
				{labels.map((label, index) => (
					<button
						// biome-ignore lint/suspicious/noArrayIndexKey: 같은 이름의 탭이 있을 수 있어 자리로 구분한다
						key={index}
						ref={(element) => {
							buttons.current[index] = element;
						}}
						type="button"
						role="tab"
						id={`${id}-tab-${index}`}
						className="cms-block-tabs-tab"
						aria-selected={index === active}
						aria-controls={`${id}-panel-${index}`}
						tabIndex={index === active ? 0 : -1}
						onClick={() => setActive(index)}
						onKeyDown={(event) => onKeyDown(event, index)}
					>
						{label}
					</button>
				))}
			</div>
			{panels.map((panel, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: 탭과 같은 자리 순서다
					key={index}
					role="tabpanel"
					id={`${id}-panel-${index}`}
					className="cms-block-tabs-panel"
					aria-labelledby={`${id}-tab-${index}`}
					hidden={index !== active}
				>
					{panel}
				</div>
			))}
		</div>
	);
}
