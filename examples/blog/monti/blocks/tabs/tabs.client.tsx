"use client";

import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

/**
 * The switching part of the tabs. Renders the row of the tabs' names (`tablist`) and each tab's panel (`tabpanel`, the `Tab` the server drew), so here
 * only the shown tab is switched (the rest are `hidden`). Arrow keys, Home and End move between tabs, and only the selected tab is reachable with the Tab key.
 */
export function TabsView({
	labels,
	panels,
	defaultIndex = 0,
	lang,
	holder = false,
}: {
	readonly labels: readonly string[];
	readonly panels: readonly ReactNode[];
	readonly defaultIndex?: number;
	/** The source's language, when the tabs keep the source's words in a translation. */
	readonly lang?: string;
	/**
	 * The editor's stand-in while the block's own view loads: one holder (`panels[0]`) has every tab's blocks in it, so it shows the tab `defaultIndex` names (a rule
	 * of `style.ts`, by `data-shown`), and the tabs are inert until the real view comes.
	 */
	readonly holder?: boolean;
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
		<div className="monti-block-tabs" lang={lang} data-shown={holder ? defaultIndex : undefined}>
			<div className="monti-block-tabs-list" role="tablist" aria-orientation="horizontal">
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
						className="monti-block-tabs-tab"
						title={label}
						aria-label={label}
						disabled={holder}
						aria-selected={index === active}
						// The stand-in draws one panel, the shown tab's: only that tab points at a panel.
						aria-controls={!holder || index === defaultIndex ? `${id}-panel-${index}` : undefined}
						tabIndex={index === active ? 0 : -1}
						onClick={() => setActive(index)}
						onKeyDown={(event) => onKeyDown(event, index)}
					>
						<span className="monti-block-tabs-name" data-name={label}>
							<span className="monti-block-tabs-text">{label}</span>
						</span>
					</button>
				))}
			</div>
			{(holder ? panels.slice(0, 1) : panels).map((panel, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: same position order as the tabs
					key={index}
					role="tabpanel"
					id={`${id}-panel-${holder ? defaultIndex : index}`}
					aria-labelledby={`${id}-tab-${holder ? defaultIndex : index}`}
					hidden={!holder && index !== active}
				>
					{panel}
				</div>
			))}
		</div>
	);
}
