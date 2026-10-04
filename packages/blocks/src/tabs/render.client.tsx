"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

/**
 * The switching part of the tab group. Renders the tab name row (`tablist`) and each tab's body (`tabpanel`). The server renders and passes the bodies, so here
 * only the visible tab is switched (the rest are `hidden`). Arrow keys, Home and End move between tabs, and only the selected tab is reachable with the Tab key.
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
						// biome-ignore lint/suspicious/noArrayIndexKey: tabs can share a name, so they are told apart by position
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
					// biome-ignore lint/suspicious/noArrayIndexKey: same position order as the tabs
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
