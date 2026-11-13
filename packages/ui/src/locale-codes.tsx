"use client";

import * as React from "react";
import { CutWords } from "./cut-words";

/** What the cell writes with `shown` codes written out: "KO · EN", or "KO +1" when the rest are only counted. */
const written = (codes: string[], shown: number) =>
	`${codes
		.slice(0, shown)
		.map((code) => code.toUpperCase())
		.join(" · ")}${codes.length > shown ? ` +${codes.length - shown}` : ""}`;

/**
 * A row's languages in a list's language column: as many codes as the column has room for ("KO · EN"), the rest counted ("KO +1"). A wider column writes more of
 * them. A column too narrow for even the shortest form cuts it with "…". While some are only counted or the text is cut, pointing at the cell names them all. The
 * codes are mono, so the room is counted in characters.
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
	const [cut, setCut] = React.useState(false);
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
			setCut(written(each, fits).length > room);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [all]);

	// Some languages are not on the cell: only counted, or cut with the text.
	const partial = shown < codes.length || cut;
	// One tree whether it counts or not, so the measured box stays the same node: it only says the names while some are not written. The box stands over
	// the row's link (`z-1`), wherever the language column is, so the pointer finds it.
	return (
		<CutWords
			whole={names}
			partial={partial}
			render={
				<span
					ref={box}
					data-slot="locale-codes"
					className="relative z-1 block min-w-0 truncate font-mono text-monti-meta"
				/>
			}
		>
			<span ref={unit} aria-hidden className="invisible absolute w-[1ch]" />
			<span aria-hidden={partial}>{written(codes, shown)}</span>
			{partial && <span className="sr-only">{names}</span>}
		</CutWords>
	);
}

export { LocaleCodes };
