"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** What the cell writes with `shown` codes written out: "KO · EN", or "KO +1" when the rest are only counted. */
const written = (codes: string[], shown: number) =>
	`${codes
		.slice(0, shown)
		.map((code) => code.toUpperCase())
		.join(" · ")}${codes.length > shown ? ` +${codes.length - shown}` : ""}`;

/**
 * A row's languages in a list's language column: as many codes as the column has room for ("KO · EN"), the rest counted ("KO +1"). A wider column writes more of
 * them. While some are only counted, pointing at the cell names them all. The codes are mono, so the room is counted in characters.
 */
function LocaleCodes({
	codes,
	names,
}: {
	/** The row's own language first. */
	codes: string[];
	/** Every language by name, for the tooltip and for a screen reader ("Korean, English"). */
	names: string;
}) {
	const box = React.useRef<HTMLSpanElement>(null);
	const unit = React.useRef<HTMLSpanElement>(null);
	// Before it is measured, the shortest form: it never spills.
	const [shown, setShown] = React.useState(1);
	// The codes as one value: a list made anew on each render measures once.
	const all = codes.join(" ");
	React.useLayoutEffect(() => {
		const node = box.current;
		if (!node) return;
		const each = all.split(" ");
		const measure = () => {
			const character = unit.current?.getBoundingClientRect().width ?? 0;
			if (character === 0) return;
			const room = Math.floor(node.clientWidth / character);
			let fits = each.length;
			while (fits > 1 && written(each, fits).length > room) fits -= 1;
			setShown(fits);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [all]);

	const counted = shown < codes.length;
	const text = (
		<span
			ref={box}
			data-slot="locale-codes"
			className="relative block min-w-0 overflow-hidden whitespace-nowrap font-mono text-monti-meta"
		>
			<span ref={unit} aria-hidden className="invisible absolute w-[1ch]" />
			<span aria-hidden={counted}>{written(codes, shown)}</span>
			{counted && <span className="sr-only">{names}</span>}
		</span>
	);
	// One tree whether it counts or not, so the measured box stays the same node: the tooltip is only off while every code is written.
	return (
		<Tooltip disabled={!counted}>
			<TooltipTrigger render={text} />
			<TooltipContent>{names}</TooltipContent>
		</Tooltip>
	);
}

export { LocaleCodes };
