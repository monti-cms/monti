"use client";

import * as React from "react";
import { cn } from "./cn";
import { Tooltip, TooltipContent } from "./tooltip";

/**
 * Whether a box shows less than it holds: its words run past its room (a fraction of a pixel short already ends them in "…"), or a piece inside
 * it ends in its own "…" (a text button or a status in a cut cell).
 */
function cutIn(box: HTMLElement) {
	const all = document.createRange();
	all.selectNodeContents(box);
	const style = getComputedStyle(box);
	const sides = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"] as const;
	const room = box.getBoundingClientRect().width - sides.reduce((sum, side) => sum + Number.parseFloat(style[side]), 0);
	if (all.getBoundingClientRect().width > room + 0.01) return true;
	for (const piece of box.querySelectorAll<HTMLElement>("*")) {
		if (piece.scrollWidth > piece.clientWidth && getComputedStyle(piece).textOverflow === "ellipsis") return true;
	}
	return false;
}

/**
 * Words cut to their box with "…" that say themselves whole. While they are cut, pointing at them, or coming with the keyboard to them or to
 * something inside them (a row's link), says them whole in a tooltip. Every place that cuts words uses this one part: a row's title, a table's
 * cut cell, a banner's sentence, a row's languages.
 *
 * - The pointer is asked for by its place, not by `pointerenter`: a row's link covers its whole row, so the pointer is "on the link"
 *   everywhere on the row, and the tooltip is for the pointer on the words themselves.
 * - Escape or a press closes it, and it then stays closed until the pointer has left the words.
 * - The tooltip is only made while it shows: a list of fifty rows holds no tooltip until one is asked for.
 */
function CutWords({
	render,
	whole,
	partial = false,
	stop = false,
	className,
	children,
}: {
	/** The box that cuts the words, when it is not a plain span: a table's cell. It gets the pointer's and the keyboard's listeners. */
	render?: React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>;
	/** What it says, when that is not the box's own words (a row's languages by name, where the box counts them). */
	whole?: string;
	/** It shows less than `whole` though nothing is cut with "…" (languages only counted): it says `whole` all the same. */
	partial?: boolean;
	/**
	 * While they are cut the words are a stop of the Tab key, so the keyboard alone can read them whole. For words that hold nothing the keyboard
	 * comes to and stand once on a screen (a banner's sentence); not for a table's cells, where it would add a stop to every cut cell of every row.
	 */
	stop?: boolean;
	className?: string;
	children?: React.ReactNode;
}) {
	const box = React.useRef<HTMLElement | null>(null);
	/** Open, and by what: the pointer on the words, or the keyboard on them. */
	const [by, setBy] = React.useState<"pointer" | "keys" | null>(null);
	/** What it says. Kept while it closes, so the tooltip does not empty before it is gone. */
	const [words, setWords] = React.useState("");
	/** Whether the words are cut now: only measured for words that are a Tab stop while they are. */
	const [stops, setStops] = React.useState(false);
	/** Whether the pointer is on the words now. */
	const onWords = React.useRef(false);
	/** Closed by hand (Escape, a press) with the pointer on the words, whatever opened it: it stays closed until the pointer has left them. */
	const dismissed = React.useRef(false);
	const dismiss = () => {
		dismissed.current = onWords.current;
		setBy(null);
	};
	const say = (how: "pointer" | "keys") => {
		const node = box.current;
		if (!node || !(partial || cutIn(node))) return;
		const said = whole ?? node.textContent ?? "";
		if (said === "") return;
		setWords(said);
		setBy(how);
	};
	/** The pointer is no longer on the words: what it opened closes, and what was closed by hand may open again. */
	const left = () => {
		onWords.current = false;
		dismissed.current = false;
		if (by === "pointer") setBy(null);
	};

	React.useLayoutEffect(() => {
		const node = box.current;
		if (!stop || !node) return;
		const measure = () => setStops(partial || cutIn(node));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [stop, partial]);

	// Escape closes it wherever the focus is: the pointer's tooltip has no focus of its own.
	const open = by !== null;
	React.useEffect(() => {
		if (!open) return;
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			dismissed.current = onWords.current;
			setBy(null);
		};
		document.addEventListener("keydown", key, true);
		return () => document.removeEventListener("keydown", key, true);
	}, [open]);

	const element = render ?? <span />;
	const own = element.props;
	const given = own.ref;
	const cutBox = React.cloneElement(
		element,
		{
			ref: (node: HTMLElement | null) => {
				box.current = node;
				if (typeof given === "function") given(node);
				else if (given) (given as React.RefObject<HTMLElement | null>).current = node;
			},
			"data-slot": (own as { "data-slot"?: string })["data-slot"] ?? "cut-words",
			"data-cut-words": whole ?? "",
			tabIndex: stop && stops ? 0 : own.tabIndex,
			className: cn(!render && "min-w-0 truncate", own.className, className),
			onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerMove?.(event);
				// A finger that starts a scroll here is not pointing.
				if (event.pointerType === "touch") return;
				const edge = event.currentTarget.getBoundingClientRect();
				const on =
					event.clientX >= edge.left &&
					event.clientX <= edge.right &&
					event.clientY >= edge.top &&
					event.clientY <= edge.bottom;
				if (!on) return left();
				onWords.current = true;
				if (by === null && !dismissed.current) say("pointer");
			},
			onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerLeave?.(event);
				left();
			},
			onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
				own.onPointerDown?.(event);
				if (by !== null) dismiss();
			},
			onFocus: (event: React.FocusEvent<HTMLElement>) => {
				own.onFocus?.(event);
				// The keyboard's focus only: a press that focuses a link in the words says nothing.
				if (event.target.matches(":focus-visible")) say("keys");
			},
			onBlur: (event: React.FocusEvent<HTMLElement>) => {
				own.onBlur?.(event);
				if (by === "keys") setBy(null);
			},
		} as React.HTMLAttributes<HTMLElement>,
		children ?? own.children,
	);
	return (
		<>
			{cutBox}
			{/* Kept while it closes (its words stay), and not made before it is first asked for. */}
			{words !== "" && (
				<Tooltip
					open={open}
					onOpenChange={(next) => {
						// What the library closes it for (a press outside); the pointer and the keyboard are heard above.
						if (!next && by !== null) dismiss();
					}}
				>
					{/* Words can be long: they wrap in the tooltip instead of running off the window. */}
					<TooltipContent anchor={box} align="start" className="max-w-monti-panel whitespace-normal break-words">
						{words}
					</TooltipContent>
				</Tooltip>
			)}
		</>
	);
}

export { CutWords };
